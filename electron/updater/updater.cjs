const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let initialized = false;
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
  lastCheckedAt: null,
  releaseNotes: ''
};

function isPortableBuild() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR);
}

function isSupported() {
  return app.isPackaged && process.platform === 'win32' && !isPortableBuild();
}

function emit(patch = {}) {
  state = { ...state, ...patch, currentVersion: app.getVersion(), supported: isSupported(), portable: isPortableBuild() };
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

function init(window) {
  mainWindow = window;
  if (initialized) return emit();
  initialized = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => emit({ status: 'checking', message: 'جاري التحقق من وجود تحديث...', progress: 0 }));
  autoUpdater.on('update-available', info => emit({
    status: 'available',
    availableVersion: info?.version || null,
    releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
    message: `يتوفر تحديث جديد ${info?.version || ''}`,
    progress: 0
  }));
  autoUpdater.on('update-not-available', info => emit({
    status: 'up-to-date',
    availableVersion: null,
    releaseNotes: '',
    message: `أنت تستخدم أحدث إصدار (${info?.version || app.getVersion()})`,
    progress: 0
  }));
  autoUpdater.on('download-progress', p => emit({
    status: 'downloading',
    progress: Number(p?.percent || 0),
    transferred: Number(p?.transferred || 0),
    total: Number(p?.total || 0),
    bytesPerSecond: Number(p?.bytesPerSecond || 0),
    message: `جاري تنزيل التحديث... ${Number(p?.percent || 0).toFixed(0)}%`
  }));
  autoUpdater.on('update-downloaded', info => emit({
    status: 'downloaded',
    availableVersion: info?.version || state.availableVersion,
    progress: 100,
    message: 'تم تنزيل التحديث. أعد تشغيل البرنامج لتثبيته.'
  }));
  autoUpdater.on('error', err => emit({
    status: 'error',
    message: err?.message || 'حدث خطأ أثناء التحديث.'
  }));

  emit();
}

async function check(manual = true) {
  if (!isSupported()) {
    if (isPortableBuild()) {
      return emit({ status: 'unsupported', message: 'التحديث التلقائي متاح لنسخة Setup فقط. نسخة Portable يتم تحديثها يدويًا.' });
    }
    if (!app.isPackaged) {
      return emit({ status: 'dev', message: 'التحقق من التحديثات يعمل بعد تثبيت نسخة Setup المبنية فقط.' });
    }
    return emit({ status: 'unsupported', message: 'التحديث التلقائي غير متاح على هذا النظام.' });
  }
  try {
    emit({ status: 'checking', message: 'جاري التحقق من وجود تحديث...', lastCheckedAt: new Date().toISOString() });
    await autoUpdater.checkForUpdates();
    return state;
  } catch (err) {
    return emit({ status: 'error', message: err?.message || 'تعذر التحقق من التحديث.' });
  }
}

async function download() {
  if (!isSupported()) return check(true);
  try {
    emit({ status: 'downloading', message: 'جاري بدء تنزيل التحديث...', progress: 0 });
    await autoUpdater.downloadUpdate();
    return state;
  } catch (err) {
    return emit({ status: 'error', message: err?.message || 'تعذر تنزيل التحديث.' });
  }
}

function install() {
  if (!isSupported() || state.status !== 'downloaded') return state;
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return emit({ status: 'installing', message: 'سيتم إغلاق البرنامج وتثبيت التحديث...' });
}

function getStatus() {
  return emit();
}

function scheduleAutomaticCheck(delayMs = 8000) {
  if (!isSupported()) return;
  setTimeout(() => check(false), delayMs);
}

module.exports = { init, check, download, install, getStatus, scheduleAutomaticCheck };
