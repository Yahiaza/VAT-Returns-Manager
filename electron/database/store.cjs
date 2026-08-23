const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

let SQL;
let db;
let dbPath;
let dataFolder;

const DEFAULT_ACCOUNTS = [
  ['purchase','مشتريات أصول ثابتة'],['purchase','مشتريات'],['purchase','مصاريف تشغيل'],['purchase','إنشاءات تحت التنفيذ'],['purchase','مصاريف مقدمة'],['purchase','مصاريف قسم مشتريات'],['purchase','مشتريات مقدمة'],
  ['sales','إيرادات المبيعات الآجلة'],['sales','إيرادات التحويلات'],['sales','إيرادات العيادات النقدية'],['sales','إيرادات الخدمات النقدية'],['sales','إيرادات نقدية مقدمة'],['sales','إشعارات دائنة (خصومات)'],['sales','مبيعات صيدلية'],['sales','مساهمات عينات نقدية'],['sales','مساهمات صيدلية نقدية'],['sales','إيرادات العيادات النقدية - تسويات'],['sales','إيرادات الخدمات النقدية - تسويات']
];
function ensureDir(p){if(!fs.existsSync(p))fs.mkdirSync(p,{recursive:true});}
async function openDatabase(folder){
  ensureDir(folder); dataFolder=folder; dbPath=path.join(folder,'vat-returns.db');
  const wasmDir=path.dirname(require.resolve('sql.js/dist/sql-wasm.wasm'));
  SQL=SQL||await initSqlJs({locateFile:file=>path.join(wasmDir,file)});
  if(db?.close) try{db.close();}catch{}
  db=fs.existsSync(dbPath)?new SQL.Database(fs.readFileSync(dbPath)):new SQL.Database();
  migrate(); persist(); return snapshot();
}
function rawRun(sql,params=[]){if(!db)throw new Error('Database is not open');db.run(sql,params);}
function run(sql,params=[]){rawRun(sql,params);persist();}
function query(sql,params=[]){if(!db)throw new Error('Database is not open');const stmt=db.prepare(sql);stmt.bind(params);const rows=[];while(stmt.step())rows.push(stmt.getAsObject());stmt.free();return rows;}
function one(sql,params=[]){return query(sql,params)[0]||null;}
function persist(){if(db&&dbPath)fs.writeFileSync(dbPath,Buffer.from(db.export()));}
function lastId(){return one('SELECT last_insert_rowid() AS id')?.id;}
function migrate(){
  rawRun(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, sort_order INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS branches (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, category_id INTEGER, tax_number TEXT DEFAULT '', address TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, section TEXT NOT NULL CHECK(section IN ('purchase','sales')), name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, visibility_category_id INTEGER);
    CREATE TABLE IF NOT EXISTS account_visibility_categories (account_id INTEGER NOT NULL, category_id INTEGER NOT NULL, PRIMARY KEY(account_id,category_id));
    CREATE TABLE IF NOT EXISTS branch_account_codes (branch_id INTEGER NOT NULL, account_id INTEGER NOT NULL, short_code TEXT DEFAULT '', program_code TEXT DEFAULT '', vat_box_15 INTEGER, vat_box_0 INTEGER, PRIMARY KEY(branch_id,account_id));
    CREATE TABLE IF NOT EXISTS periods (id INTEGER PRIMARY KEY AUTOINCREMENT, year INTEGER NOT NULL, month INTEGER NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', is_locked INTEGER NOT NULL DEFAULT 0, tax_rate REAL NOT NULL DEFAULT 15, due_date TEXT, filed_date TEXT, reference_no TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(year,month));
    CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY AUTOINCREMENT, period_id INTEGER NOT NULL, branch_id INTEGER NOT NULL, account_id INTEGER NOT NULL, rate_type TEXT NOT NULL CHECK(rate_type IN ('15','0')), total REAL NOT NULL DEFAULT 0, expression TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(period_id,branch_id,account_id,rate_type));
    CREATE TABLE IF NOT EXISTS entry_parts (id INTEGER PRIMARY KEY AUTOINCREMENT, entry_id INTEGER NOT NULL, amount REAL NOT NULL, position INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS return_adjustments (id INTEGER PRIMARY KEY AUTOINCREMENT, period_id INTEGER NOT NULL, box_no INTEGER NOT NULL, value REAL NOT NULL DEFAULT 0, tax_value REAL NOT NULL DEFAULT 0, note TEXT DEFAULT '', UNIQUE(period_id,box_no));
    CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, period_id INTEGER NOT NULL UNIQUE, payment_date TEXT, amount REAL DEFAULT 0, reference_no TEXT DEFAULT '', note TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, period_id INTEGER NOT NULL, remind_at TEXT NOT NULL, title TEXT NOT NULL, fired INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, period_id INTEGER NOT NULL, name TEXT NOT NULL, stored_path TEXT NOT NULL, added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, period_id INTEGER, entity TEXT NOT NULL, entity_id INTEGER, action TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
  const branchCols=query('PRAGMA table_info(branches)').map(x=>x.name);
  if(!branchCols.includes('category_id'))rawRun('ALTER TABLE branches ADD COLUMN category_id INTEGER');
  if(!branchCols.includes('tax_number'))rawRun("ALTER TABLE branches ADD COLUMN tax_number TEXT DEFAULT ''");
  if(!branchCols.includes('address'))rawRun("ALTER TABLE branches ADD COLUMN address TEXT DEFAULT ''");
  const accountCols=query('PRAGMA table_info(accounts)').map(x=>x.name);if(!accountCols.includes('visibility_category_id'))rawRun('ALTER TABLE accounts ADD COLUMN visibility_category_id INTEGER');
  const codeCols=query('PRAGMA table_info(branch_account_codes)').map(x=>x.name);if(!codeCols.includes('vat_box_15'))rawRun('ALTER TABLE branch_account_codes ADD COLUMN vat_box_15 INTEGER');if(!codeCols.includes('vat_box_0'))rawRun('ALTER TABLE branch_account_codes ADD COLUMN vat_box_0 INTEGER');
  const periodCols=query('PRAGMA table_info(periods)').map(x=>x.name);if(!periodCols.includes('is_locked'))rawRun('ALTER TABLE periods ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0');
  rawRun('CREATE TABLE IF NOT EXISTS account_visibility_categories (account_id INTEGER NOT NULL, category_id INTEGER NOT NULL, PRIMARY KEY(account_id,category_id))');
  for(const a of query('SELECT id,visibility_category_id FROM accounts WHERE visibility_category_id IS NOT NULL'))rawRun('INSERT OR IGNORE INTO account_visibility_categories(account_id,category_id) VALUES(?,?)',[a.id,a.visibility_category_id]);
  if(!one("SELECT 1 FROM settings WHERE key='taxRate'"))rawRun("INSERT INTO settings(key,value) VALUES('taxRate','15')");
  if(!one("SELECT 1 FROM settings WHERE key='companyName'"))rawRun("INSERT INTO settings(key,value) VALUES('companyName','المنشأة')");
  if(!one("SELECT 1 FROM settings WHERE key='unifiedNumber'"))rawRun("INSERT INTO settings(key,value) VALUES('unifiedNumber','')");
  if(!one('SELECT 1 FROM accounts LIMIT 1')){let order=0;for(const [section,name] of DEFAULT_ACCOUNTS)rawRun('INSERT INTO accounts(section,name,sort_order) VALUES(?,?,?)',[section,name,order++]);}
}
function logHistory(periodId,entity,entityId,action,details){rawRun('INSERT INTO history(period_id,entity,entity_id,action,details) VALUES(?,?,?,?,?)',[periodId||null,entity,entityId||null,action,JSON.stringify(details)]);}
function parseParts(expression){if(typeof expression!=='string')return[];return expression.split('+').map(s=>s.trim().replace(/,/g,'')).filter(Boolean).map(Number).filter(Number.isFinite);}
function replaceAccountVisibility(accountId,categoryIds){const ids=[...new Set((Array.isArray(categoryIds)?categoryIds:[]).map(Number).filter(Number.isFinite))];rawRun('DELETE FROM account_visibility_categories WHERE account_id=?',[accountId]);ids.forEach(id=>rawRun('INSERT OR IGNORE INTO account_visibility_categories(account_id,category_id) VALUES(?,?)',[accountId,id]));rawRun('UPDATE accounts SET visibility_category_id=? WHERE id=?',[ids[0]||null,accountId]);}
function snapshot(){const settingsRows=query('SELECT * FROM settings');const settings=Object.fromEntries(settingsRows.map(x=>[x.key,x.value]));const visibilityRows=query('SELECT account_id,category_id FROM account_visibility_categories ORDER BY account_id,category_id');const visibilityMap=visibilityRows.reduce((m,r)=>{(m[r.account_id]||=[]).push(Number(r.category_id));return m;},{});const accounts=query('SELECT * FROM accounts ORDER BY section,sort_order,id').map(a=>({...a,visibility_category_ids:visibilityMap[a.id]||[]}));return{dataFolder,settings,categories:query('SELECT * FROM categories ORDER BY sort_order,id'),branches:query('SELECT * FROM branches ORDER BY sort_order,id'),accounts,codes:query('SELECT * FROM branch_account_codes'),periods:query('SELECT * FROM periods ORDER BY year DESC,month DESC'),entries:query('SELECT * FROM entries'),entryParts:query('SELECT * FROM entry_parts ORDER BY entry_id,position'),adjustments:query('SELECT * FROM return_adjustments'),payments:query('SELECT * FROM payments'),reminders:query('SELECT * FROM reminders ORDER BY remind_at'),attachments:query('SELECT * FROM attachments ORDER BY added_at DESC'),history:query('SELECT * FROM history ORDER BY id DESC LIMIT 500')};}

function healthCheck(){
  const integrity=one('PRAGMA integrity_check')||{};
  const integrityValue=String(Object.values(integrity)[0]||'');
  const required=['settings','categories','branches','accounts','account_visibility_categories','branch_account_codes','periods','entries','entry_parts','return_adjustments','payments','reminders','attachments','history'];
  const existing=new Set(query("SELECT name FROM sqlite_master WHERE type='table'").map(r=>r.name));
  const missingTables=required.filter(t=>!existing.has(t));
  let writeTest=false;
  try{rawRun('SAVEPOINT vat_healthcheck');rawRun("INSERT INTO settings(key,value) VALUES('__healthcheck__','ok') ON CONFLICT(key) DO UPDATE SET value='ok'");writeTest=one("SELECT value FROM settings WHERE key='__healthcheck__'")?.value==='ok';rawRun('ROLLBACK TO vat_healthcheck');rawRun('RELEASE vat_healthcheck');}catch(e){try{rawRun('ROLLBACK TO vat_healthcheck');rawRun('RELEASE vat_healthcheck');}catch{} }
  const counts={branches:Number(one('SELECT COUNT(*) n FROM branches')?.n||0),accounts:Number(one('SELECT COUNT(*) n FROM accounts')?.n||0),periods:Number(one('SELECT COUNT(*) n FROM periods')?.n||0),entries:Number(one('SELECT COUNT(*) n FROM entries')?.n||0)};
  return {ok:integrityValue.toLowerCase()==='ok'&&missingTables.length===0&&writeTest,integrity:integrityValue,missingTables,writeTest,counts,dbPath};
}

function getDbPath(){return dbPath;} function getDataFolder(){return dataFolder;}
module.exports={openDatabase,rawRun,run,query,one,persist,lastId,migrate,logHistory,parseParts,replaceAccountVisibility,snapshot,healthCheck,getDbPath,getDataFolder,ensureDir};
