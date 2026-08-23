const { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const store = require('./database/store.cjs');
const updater = require('./updater/updater.cjs');
const {rawRun,query,one,persist,lastId,logHistory,parseParts,replaceAccountVisibility,snapshot,ensureDir}=store;
const db={run:rawRun};
if (process.platform === 'win32') app.setAppUserModelId('sa.vat.returns.manager');
let win; let tray; let dataFolder; let dbPath; let reminderTimer;
function readConfig(){const p=path.join(app.getPath('userData'),'vat-config.json');try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{return {};}}
function writeConfig(obj){const p=path.join(app.getPath('userData'),'vat-config.json');ensureDir(path.dirname(p));fs.writeFileSync(p,JSON.stringify(obj,null,2));}
async function openDatabase(folder){await store.openDatabase(folder);dataFolder=store.getDataFolder();dbPath=store.getDbPath();writeConfig({dataFolder});}

function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 840, minWidth: 1120, minHeight: 700,
    frame: false, autoHideMenuBar: true,
    backgroundColor: '#eef2f6',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  });
  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.on('close', e => {
    if (!app.isQuitting) { e.preventDefault(); win.hide(); }
  });
}


function writeTempHtml(html, prefix='vat-report') {
  const dir = path.join(app.getPath('temp'), 'vat-returns-manager');
  ensureDir(dir);
  const file = path.join(dir, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(file, html || '<html></html>', 'utf8');
  return file;
}
function safeUnlink(file){ try{ if(file && fs.existsSync(file)) fs.unlinkSync(file); }catch{} }

function setupTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  const image = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(image);
  tray.setToolTip('VAT Returns Manager');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'فتح البرنامج', click: () => { win.show(); win.focus(); } },
    { type: 'separator' },
    { label: 'خروج', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => { win.show(); win.focus(); });
}

function checkReminders() {
  if (!db) return;
  const now = new Date();
  const rows = query("SELECT r.*, p.label FROM reminders r JOIN periods p ON p.id=r.period_id WHERE r.fired=0 AND datetime(r.remind_at) <= datetime(?)", [now.toISOString()]);
  for (const r of rows) {
    const n = new Notification({ title: r.title || 'تذكير ضريبة القيمة المضافة', body: `إقرار ${r.label}` });
    n.show();
    if (win) win.webContents.send('vat:reminder', r);
    db.run('UPDATE reminders SET fired=1 WHERE id=?', [r.id]);
  }
  if (rows.length) persist();
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const config = readConfig();
  const folder = config.dataFolder || path.join(app.getPath('documents'), 'VAT Returns Manager Data');
  await openDatabase(folder);
  createWindow();
  updater.init(win);
  updater.scheduleAutomaticCheck();
  setupTray();
  reminderTimer = setInterval(checkReminders, 60 * 1000);
  checkReminders();
});
app.on('window-all-closed', e => { if (process.platform !== 'darwin') e?.preventDefault?.(); });
app.on('before-quit', () => { app.isQuitting = true; if (reminderTimer) clearInterval(reminderTimer); });

ipcMain.handle('vat:init', async () => ({ ok: true, dataFolder }));

ipcMain.handle('vat:updateGetStatus', () => updater.getStatus());
ipcMain.handle('vat:updateCheck', () => updater.check(true));
ipcMain.handle('vat:updateDownload', () => updater.download());
ipcMain.handle('vat:updateInstall', () => updater.install());
ipcMain.handle('vat:updateOpenDownloaded', () => updater.openDownloadedLocation());

ipcMain.handle('vat:chooseDataFolder', async () => {
  const res = await dialog.showOpenDialog(win, { properties: ['openDirectory','createDirectory'], title: 'اختر مجلد قاعدة البيانات' });
  if (res.canceled || !res.filePaths[0]) return { canceled: true };
  await openDatabase(res.filePaths[0]);
  return { canceled: false, dataFolder, snapshot: snapshot() };
});
ipcMain.handle('vat:getSnapshot', () => snapshot());
ipcMain.handle('vat:testDatabase', () => store.healthCheck());
ipcMain.on('vat:windowMinimize',()=>win?.minimize());
ipcMain.on('vat:windowToggleMaximize',()=>{if(!win)return;win.isMaximized()?win.unmaximize():win.maximize();});
ipcMain.on('vat:windowClose',()=>win?.close());
ipcMain.handle('vat:saveSetting', (_e, { key, value }) => { db.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, String(value)]); persist(); return snapshot(); });
ipcMain.handle('vat:addBranch', (_e, b) => { const order = one('SELECT COALESCE(MAX(sort_order),-1)+1 n FROM branches')?.n || 0; db.run('INSERT INTO branches(name,sort_order,category_id,tax_number,address) VALUES(?,?,?,?,?)', [String(b.name||'').trim(), order, b.category_id||null, b.tax_number||'', b.address||'']); persist(); return snapshot(); });
ipcMain.handle('vat:updateBranch', (_e, b) => { db.run('UPDATE branches SET name=?,active=?,category_id=?,tax_number=?,address=? WHERE id=?', [b.name, b.active ? 1 : 0, b.category_id || null, b.tax_number||'', b.address||'', b.id]); persist(); return snapshot(); });
ipcMain.handle('vat:deleteBranch', (_e, { id }) => { db.run('UPDATE branches SET active=0 WHERE id=?', [id]); persist(); return snapshot(); });
ipcMain.handle('vat:addCategory', (_e,{name}) => { const n=String(name||'').trim(); if(!n)return snapshot(); const order=one('SELECT COALESCE(MAX(sort_order),-1)+1 n FROM categories')?.n||0; try{db.run('INSERT INTO categories(name,sort_order) VALUES(?,?)',[n,order]);}catch{} persist(); return snapshot(); });
ipcMain.handle('vat:deleteCategory', (_e,{id}) => { db.run('UPDATE branches SET category_id=NULL WHERE category_id=?',[id]); db.run('DELETE FROM account_visibility_categories WHERE category_id=?',[id]); db.run('UPDATE accounts SET visibility_category_id=NULL WHERE visibility_category_id=?',[id]); db.run('DELETE FROM categories WHERE id=?',[id]); persist(); return snapshot(); });
ipcMain.handle('vat:addAccount', (_e, a) => { const order = one('SELECT COALESCE(MAX(sort_order),-1)+1 n FROM accounts WHERE section=?', [a.section])?.n || 0; db.run('INSERT INTO accounts(section,name,sort_order,visibility_category_id) VALUES(?,?,?,NULL)', [a.section,a.name.trim(),order]); const id=lastId(); replaceAccountVisibility(id,a.visibilityCategoryIds||[]); persist(); return snapshot(); });
ipcMain.handle('vat:updateAccount', (_e, a) => { db.run('UPDATE accounts SET name=?,section=?,active=? WHERE id=?', [a.name,a.section,a.active ? 1 : 0,a.id]); if(Array.isArray(a.visibility_category_ids)) replaceAccountVisibility(a.id,a.visibility_category_ids); persist(); return snapshot(); });
ipcMain.handle('vat:deleteAccount', (_e, { id }) => { db.run('UPDATE accounts SET active=0 WHERE id=?', [id]); persist(); return snapshot(); });
ipcMain.handle('vat:reorderAccounts', (_e, { items }) => { db.run('BEGIN'); try { items.forEach((it,i)=>db.run('UPDATE accounts SET sort_order=? WHERE id=?',[i,it.id])); db.run('COMMIT'); } catch(err){db.run('ROLLBACK'); throw err;} persist(); return snapshot(); });
ipcMain.handle('vat:saveBranchCode', (_e, p) => { const toBox=v=>v===''||v==null?null:Number(v); db.run('INSERT INTO branch_account_codes(branch_id,account_id,short_code,program_code,vat_box_15,vat_box_0) VALUES(?,?,?,?,?,?) ON CONFLICT(branch_id,account_id) DO UPDATE SET short_code=excluded.short_code, program_code=excluded.program_code, vat_box_15=excluded.vat_box_15, vat_box_0=excluded.vat_box_0', [p.branchId,p.accountId,p.shortCode||'',p.programCode||'',toBox(p.vatBox15),toBox(p.vatBox0)]); persist(); return snapshot(); });
ipcMain.handle('vat:createPeriod', (_e, p) => {
  const exists = one('SELECT id FROM periods WHERE year=? AND month=?',[p.year,p.month]); if (exists) return { ...snapshot(), existingId: exists.id };
  const taxRate = Number(one("SELECT value FROM settings WHERE key='taxRate'")?.value || 15);
  const label = p.label || `${String(p.month).padStart(2,'0')}-${p.year}`;
  db.run('INSERT INTO periods(year,month,label,tax_rate,due_date) VALUES(?,?,?,?,?)',[p.year,p.month,label,taxRate,p.dueDate||null]);
  const id = lastId(); logHistory(id,'period',id,'create',{label,taxRate}); persist(); return snapshot();
});
ipcMain.handle('vat:updatePeriod', (_e, p) => {
  const before = one('SELECT * FROM periods WHERE id=?',[p.id]); if(!before)return snapshot();
  const status=p.status ?? before.status; const dueDate=p.dueDate !== undefined ? (p.dueDate||null) : before.due_date;
  const filedDate=p.filedDate !== undefined ? (p.filedDate||null) : before.filed_date; const referenceNo=p.referenceNo !== undefined ? (p.referenceNo||'') : before.reference_no;
  const isLocked=p.isLocked !== undefined ? (p.isLocked?1:0) : Number(before.is_locked||0);
  db.run('UPDATE periods SET status=?,is_locked=?,due_date=?,filed_date=?,reference_no=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[status,isLocked,dueDate,filedDate,referenceNo,p.id]);
  logHistory(p.id,'period',p.id,p.isLocked===true?'lock':p.isLocked===false?'unlock':'update',{before,after:{...p,status,isLocked}}); persist(); return snapshot();
});

ipcMain.handle('vat:deletePeriod', (_e, { id }) => {
  const period=one('SELECT * FROM periods WHERE id=?',[id]); if(!period)return snapshot();
  const attachments=query('SELECT * FROM attachments WHERE period_id=?',[id]);
  for(const a of attachments){try{if(a.stored_path&&fs.existsSync(a.stored_path))fs.unlinkSync(a.stored_path);}catch{}}
  const entryIds=query('SELECT id FROM entries WHERE period_id=?',[id]).map(x=>x.id);
  if(entryIds.length){const marks=entryIds.map(()=>'?').join(',');db.run(`DELETE FROM entry_parts WHERE entry_id IN (${marks})`,entryIds);}
  db.run('DELETE FROM entries WHERE period_id=?',[id]);
  db.run('DELETE FROM return_adjustments WHERE period_id=?',[id]);
  db.run('DELETE FROM payments WHERE period_id=?',[id]);
  db.run('DELETE FROM reminders WHERE period_id=?',[id]);
  db.run('DELETE FROM attachments WHERE period_id=?',[id]);
  db.run('DELETE FROM history WHERE period_id=?',[id]);
  db.run('DELETE FROM periods WHERE id=?',[id]);
  persist(); return snapshot();
});
ipcMain.handle('vat:saveEntry', (_e, p) => {
  if(Number(one('SELECT is_locked FROM periods WHERE id=?',[p.periodId])?.is_locked||0)===1) return snapshot();
  const parts = Array.isArray(p.parts) ? p.parts.map(Number).filter(Number.isFinite) : parseParts(p.expression || '');
  const total = parts.reduce((a,b)=>a+b,0); const expr = parts.join(' + ');
  const before = one('SELECT * FROM entries WHERE period_id=? AND branch_id=? AND account_id=? AND rate_type=?',[p.periodId,p.branchId,p.accountId,p.rateType]);
  db.run('INSERT INTO entries(period_id,branch_id,account_id,rate_type,total,expression,updated_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(period_id,branch_id,account_id,rate_type) DO UPDATE SET total=excluded.total,expression=excluded.expression,updated_at=CURRENT_TIMESTAMP',[p.periodId,p.branchId,p.accountId,p.rateType,total,expr]);
  const entry = one('SELECT * FROM entries WHERE period_id=? AND branch_id=? AND account_id=? AND rate_type=?',[p.periodId,p.branchId,p.accountId,p.rateType]);
  db.run('DELETE FROM entry_parts WHERE entry_id=?',[entry.id]); parts.forEach((amt,i)=>db.run('INSERT INTO entry_parts(entry_id,amount,position) VALUES(?,?,?)',[entry.id,amt,i]));
  logHistory(p.periodId,'entry',entry.id,'update',{before,after:{...entry,parts}}); persist(); return snapshot();
});
ipcMain.handle('vat:saveAdjustment', (_e,p) => { if(Number(one('SELECT is_locked FROM periods WHERE id=?',[p.periodId])?.is_locked||0)===1) return snapshot(); db.run('INSERT INTO return_adjustments(period_id,box_no,value,tax_value,note) VALUES(?,?,?,?,?) ON CONFLICT(period_id,box_no) DO UPDATE SET value=excluded.value,tax_value=excluded.tax_value,note=excluded.note',[p.periodId,p.boxNo,Number(p.value)||0,Number(p.taxValue)||0,p.note||'']); logHistory(p.periodId,'adjustment',p.boxNo,'update',p); persist(); return snapshot(); });
ipcMain.handle('vat:savePayment', (_e,p) => { db.run('INSERT INTO payments(period_id,payment_date,amount,reference_no,note) VALUES(?,?,?,?,?) ON CONFLICT(period_id) DO UPDATE SET payment_date=excluded.payment_date,amount=excluded.amount,reference_no=excluded.reference_no,note=excluded.note',[p.periodId,p.paymentDate||null,Number(p.amount)||0,p.referenceNo||'',p.note||'']); logHistory(p.periodId,'payment',p.periodId,'update',p); persist(); return snapshot(); });
ipcMain.handle('vat:saveReminder', (_e,p) => { db.run('INSERT INTO reminders(period_id,remind_at,title,fired) VALUES(?,?,?,0)',[p.periodId,p.remindAt,p.title||'تذكير سداد ضريبة القيمة المضافة']); persist(); return snapshot(); });
ipcMain.handle('vat:selectAttachments', async (_e,{periodId}) => {
  const res = await dialog.showOpenDialog(win,{properties:['openFile','multiSelections'],title:'إرفاق مستندات الإقرار'}); if(res.canceled) return snapshot();
  const dir = path.join(dataFolder,'attachments',String(periodId)); ensureDir(dir);
  for(const src of res.filePaths){ const name=path.basename(src); let dest=path.join(dir,name); if(fs.existsSync(dest)){ const ext=path.extname(name), base=path.basename(name,ext); dest=path.join(dir,`${base}-${Date.now()}${ext}`); } fs.copyFileSync(src,dest); db.run('INSERT INTO attachments(period_id,name,stored_path) VALUES(?,?,?)',[periodId,path.basename(dest),dest]); }
  persist(); return snapshot();
});
ipcMain.handle('vat:removeAttachment', (_e,{id}) => { const a=one('SELECT * FROM attachments WHERE id=?',[id]); if(a){ try{if(fs.existsSync(a.stored_path))fs.unlinkSync(a.stored_path);}catch{} db.run('DELETE FROM attachments WHERE id=?',[id]); persist(); } return snapshot(); });
ipcMain.handle('vat:backup', async () => {
  persist(); const res=await dialog.showSaveDialog(win,{title:'حفظ نسخة احتياطية',defaultPath:`VAT-Backup-${new Date().toISOString().slice(0,10)}.db`,filters:[{name:'VAT Backup',extensions:['db']}]}); if(res.canceled||!res.filePath)return{canceled:true}; fs.copyFileSync(dbPath,res.filePath); return{canceled:false,path:res.filePath};
});
ipcMain.handle('vat:restore', async () => {
  const res=await dialog.showOpenDialog(win,{title:'استعادة قاعدة البيانات',properties:['openFile'],filters:[{name:'SQLite Database',extensions:['db']}]}); if(res.canceled||!res.filePaths[0])return{canceled:true}; fs.copyFileSync(res.filePaths[0],dbPath); await openDatabase(dataFolder); return{canceled:false,snapshot:snapshot()};
});

ipcMain.handle('vat:previewReport', async (_e,payload) => {
  const file=writeTempHtml(payload?.html||'', 'preview');
  const preview=new BrowserWindow({width:1180,height:820,minWidth:850,minHeight:620,title:payload?.title||'معاينة التقرير',autoHideMenuBar:true,backgroundColor:'#f4f7fa',icon:path.join(__dirname,'..','build','icon.ico')});
  await preview.loadFile(file);
  preview.on('closed',()=>safeUnlink(file));
  return {ok:true};
});
ipcMain.handle('vat:exportPdf', async (_e,payload) => {
  const res=await dialog.showSaveDialog(win,{title:'تصدير PDF',defaultPath:payload?.defaultName||'VAT-report.pdf',filters:[{name:'PDF',extensions:['pdf']}]});
  if(res.canceled||!res.filePath)return{canceled:true};
  const file=writeTempHtml(payload?.html||'', 'pdf');
  const pdfWin=new BrowserWindow({show:false,width:1200,height:900,webPreferences:{sandbox:true}});
  try{
    await pdfWin.loadFile(file);
    const pdf=await pdfWin.webContents.printToPDF({printBackground:true,pageSize:'A4',margins:{top:0.25,bottom:0.25,left:0.25,right:0.25},preferCSSPageSize:true});
    fs.writeFileSync(res.filePath,pdf);
    return{canceled:false,path:res.filePath};
  } finally { if(!pdfWin.isDestroyed())pdfWin.destroy(); safeUnlink(file); }
});
ipcMain.handle('vat:exportExcel', async (_e,payload) => {
  const res=await dialog.showSaveDialog(win,{title:'تصدير Excel',defaultPath:payload?.defaultName||'VAT-report.xls',filters:[{name:'Excel',extensions:['xls']}]});
  if(res.canceled||!res.filePath)return{canceled:true};
  let html=String(payload?.html||'');
  html=html.replace(/<button[^>]*class="preview-print[^>]*>.*?<\/button>/is,'');
  html=html.replace('<html lang="ar" dir="rtl">','<html lang="ar" dir="rtl" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">');
  html=html.replace('</head>','<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>VAT</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>');
  fs.writeFileSync(res.filePath,'\uFEFF'+html,'utf8');
  return{canceled:false,path:res.filePath};
});

ipcMain.handle('vat:exportReport', async (_e,payload) => {
  const res=await dialog.showSaveDialog(win,{title:'تصدير التقرير',defaultPath:payload.defaultName||'VAT-report.csv',filters:[{name:'CSV',extensions:['csv']}]}); if(res.canceled||!res.filePath)return{canceled:true}; fs.writeFileSync(res.filePath,'\uFEFF'+(payload.csv||''),'utf8'); return{canceled:false,path:res.filePath};
});
