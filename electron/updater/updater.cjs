const { app, net, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const UPDATE_OWNER = 'Yahiaza';
const UPDATE_REPO = 'VAT-Returns-Manager';
const API_LATEST = `https://api.github.com/repos/${UPDATE_OWNER}/${UPDATE_REPO}/releases/latest`;

let mainWindow = null;
let initialized = false;
let portableAsset = null;
let portableDownloadPath = null;
let state = {
  currentVersion: app.getVersion(),
  availableVersion: null,
  status: 'idle',
  message: '',
  progress: 0,
  transferred: 0,
  total: 0,
  bytesPerSecond: 0,
  supported: false,
  portable: false,
  mode: 'unknown',
  lastCheckedAt: null,
  releaseNotes: '',
  downloadPath: null,
  source: `${UPDATE_OWNER}/${UPDATE_REPO}`
};

function isPortableBuild() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR);
}

function isSetupSupported() {
  return app.isPackaged && process.platform === 'win32' && !isPortableBuild();
}

function isPortableSupported() {
  return app.isPackaged && process.platform === 'win32' && isPortableBuild();
}

function currentMode() {
  if (!app.isPackaged) return 'dev';
  if (isPortableBuild()) return 'portable';
  if (process.platform === 'win32') return 'setup';
  return 'unsupported';
}

function emit(patch = {}) {
  state = {
    ...state,
    ...patch,
    currentVersion: app.getVersion(),
    supported: isSetupSupported() || isPortableSupported(),
    portable: isPortableBuild(),
    mode: currentMode(),
    source: `${UPDATE_OWNER}/${UPDATE_REPO}`
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('vat:updateStatus', state);
  }
  return state;
}

function normalizeReleaseNotes(notes) {
  if (!notes) return '';
  if (typeof notes === 'string') return notes;
  if (Array.isArray(notes)) return notes.map(n => n?.note || n?.version || '').filter(Boolean).join('\n');
  return String(notes);
}

function versionParts(v) {
  return String(v || '0').replace(/^v/i, '').split(/[.-]/).map(x => Number.parseInt(x, 10) || 0);
}

function isNewerVersion(remote, local) {
  const a = versionParts(remote), b = versionParts(local);
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const av = a[i] || 0, bv = b[i] || 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

async function fetchLatestRelease() {
  const res = await net.fetch(API_LATEST, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'VAT-Returns-Manager-Updater'
    }
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('لا يوجد إصدار منشور على GitHub حتى الآن.');
    throw new Error(`تعذر قراءة الإصدار من GitHub (${res.status}).`);
  }
  return res.json();
}

function findPortableAsset(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  return assets.find(a => /VAT-Returns-Manager-.*-Portable\.exe$/i.test(a?.name || '')) ||
    assets.find(a => /Portable\.exe$/i.test(a?.name || '')) || null;
}

function init(window) {
  mainWindow = window;
  if (initialized) return emit();
  initialized = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => emit({ status: 'checking', message: 'جاري التحقق من وجود تحديث...', progress: 0 }));
  autoUpdater.on('update-available', info => emit({
    status: 'available', availableVersion: info?.version || null,
    releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
    message: `يتوفر تحديث جديد ${info?.version || ''}`, progress: 0
  }));
  autoUpdater.on('update-not-available', info => emit({
    status: 'up-to-date', availableVersion: null, releaseNotes: '',
    message: `أنت تستخدم أحدث إصدار (${info?.version || app.getVersion()})`, progress: 0
  }));
  autoUpdater.on('download-progress', p => emit({
    status: 'downloading', progress: Number(p?.percent || 0),
    transferred: Number(p?.transferred || 0), total: Number(p?.total || 0),
    bytesPerSecond: Number(p?.bytesPerSecond || 0),
    message: `جاري تنزيل تحديث Setup... ${Number(p?.percent || 0).toFixed(0)}%`
  }));
  autoUpdater.on('update-downloaded', info => emit({
    status: 'downloaded', availableVersion: info?.version || state.availableVersion,
    progress: 100, message: 'تم تنزيل تحديث Setup. يمكنك إعادة التشغيل لتثبيته.'
  }));
  autoUpdater.on('error', err => emit({ status: 'error', message: err?.message || 'حدث خطأ أثناء التحديث.' }));

  emit();
}

async function checkPortable() {
  try {
    emit({ status: 'checking', message: 'جاري التحقق من تحديث النسخة Portable...', lastCheckedAt: new Date().toISOString(), progress: 0 });
    const release = await fetchLatestRelease();
    const version = String(release?.tag_name || release?.name || '').replace(/^v/i, '');
    if (!version) throw new Error('تعذر تحديد رقم الإصدار المنشور.');
    if (!isNewerVersion(version, app.getVersion())) {
      portableAsset = null;
      return emit({ status: 'up-to-date', availableVersion: null, releaseNotes: '', message: `أنت تستخدم أحدث إصدار (${app.getVersion()})`, progress: 0 });
    }
    portableAsset = findPortableAsset(release);
    if (!portableAsset) throw new Error('الإصدار موجود، لكن ملف Portable غير موجود داخل Release.');
    return emit({
      status: 'available', availableVersion: version,
      releaseNotes: normalizeReleaseNotes(release?.body),
      message: `يتوفر تحديث Portable جديد ${version}. سيتم تنزيله إلى مجلد Downloads.`, progress: 0
    });
  } catch (err) {
    return emit({ status: 'error', message: err?.message || 'تعذر التحقق من تحديث Portable.' });
  }
}

async function check(manual = true) {
  if (!app.isPackaged) return emit({ status: 'dev', message: 'التحقق من التحديثات يعمل في النسخة المبنية فقط.' });
  if (isPortableSupported()) return checkPortable();
  if (!isSetupSupported()) return emit({ status: 'unsupported', message: 'التحديث غير متاح على هذا النظام.' });
  try {
    emit({ status: 'checking', message: 'جاري التحقق من وجود تحديث...', lastCheckedAt: new Date().toISOString() });
    await autoUpdater.checkForUpdates();
    return state;
  } catch (err) {
    return emit({ status: 'error', message: err?.message || 'تعذر التحقق من التحديث.' });
  }
}

async function downloadPortable() {
  if (!portableAsset?.browser_download_url) {
    const checked = await checkPortable();
    if (checked.status !== 'available' || !portableAsset) return checked;
  }

  const downloadsDir = app.getPath('downloads');
  const filename = portableAsset.name || `VAT-Returns-Manager-${state.availableVersion}-Portable.exe`;
  const finalPath = path.join(downloadsDir, filename);
  const tempPath = `${finalPath}.download`;
  try {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    emit({ status: 'downloading', message: 'جاري تنزيل النسخة Portable إلى Downloads...', progress: 0, transferred: 0, total: Number(portableAsset.size || 0), downloadPath: finalPath });
    const res = await net.fetch(portableAsset.browser_download_url, { headers: { 'User-Agent': 'VAT-Returns-Manager-Updater' } });
    if (!res.ok || !res.body) throw new Error(`فشل تنزيل Portable (${res.status}).`);
    const total = Number(res.headers.get('content-length') || portableAsset.size || 0);
    const writer = fs.createWriteStream(tempPath);
    const reader = res.body.getReader();
    let transferred = 0;
    let lastAt = Date.now(), lastBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.length) {
        writer.write(Buffer.from(value));
        transferred += value.length;
        const now = Date.now();
        if (now - lastAt >= 250) {
          const bps = ((transferred - lastBytes) * 1000) / Math.max(1, now - lastAt);
          emit({ status: 'downloading', transferred, total, bytesPerSecond: bps, progress: total ? transferred / total * 100 : 0, message: `جاري تنزيل النسخة Portable... ${total ? Math.round(transferred / total * 100) : ''}%` });
          lastAt = now; lastBytes = transferred;
        }
      }
    }
    await new Promise((resolve, reject) => { writer.end(resolve); writer.on('error', reject); });
    if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    fs.renameSync(tempPath, finalPath);
    portableDownloadPath = finalPath;
    return emit({ status: 'downloaded', progress: 100, transferred, total: total || transferred, downloadPath: finalPath, message: `تم تنزيل النسخة الجديدة إلى Downloads: ${filename}` });
  } catch (err) {
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    return emit({ status: 'error', message: err?.message || 'تعذر تنزيل النسخة Portable.' });
  }
}

async function download() {
  if (isPortableSupported()) return downloadPortable();
  if (!isSetupSupported()) return check(true);
  try {
    emit({ status: 'downloading', message: 'جاري بدء تنزيل تحديث Setup...', progress: 0 });
    await autoUpdater.downloadUpdate();
    return state;
  } catch (err) {
    return emit({ status: 'error', message: err?.message || 'تعذر تنزيل التحديث.' });
  }
}

function launchPortableAfterExit(filePath) {
  const escaped = String(filePath).replace(/'/g, "''");
  const ps = spawn('powershell.exe', [
    '-NoProfile', '-WindowStyle', 'Hidden', '-Command',
    `Start-Sleep -Seconds 2; Start-Process -FilePath '${escaped}'`
  ], { detached: true, stdio: 'ignore', windowsHide: true });
  ps.unref();
}

function install() {
  if (isPortableSupported()) {
    const target = portableDownloadPath || state.downloadPath;
    if (!target || !fs.existsSync(target) || state.status !== 'downloaded') return state;
    launchPortableAfterExit(target);
    emit({ status: 'installing', message: 'سيتم إغلاق النسخة الحالية وفتح النسخة Portable الجديدة...' });
    setTimeout(() => app.quit(), 150);
    return state;
  }
  if (!isSetupSupported() || state.status !== 'downloaded') return state;
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return emit({ status: 'installing', message: 'سيتم إغلاق البرنامج وتثبيت تحديث Setup...' });
}

async function openDownloadedLocation() {
  const target = portableDownloadPath || state.downloadPath;
  if (!target || !fs.existsSync(target)) return { ok: false };
  shell.showItemInFolder(target);
  return { ok: true, path: target };
}

function getStatus() { return emit(); }

function scheduleAutomaticCheck(delayMs = 8000) {
  if (!app.isPackaged || process.platform !== 'win32') return;
  setTimeout(() => check(false), delayMs);
}

module.exports = { init, check, download, install, openDownloadedLocation, getStatus, scheduleAutomaticCheck };
