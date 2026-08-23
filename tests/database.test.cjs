const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const store=require('../electron/database/store.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vat-db-test-'));
 try{
  await store.openDatabase(dir);
  let snap=store.snapshot();
  assert.strictEqual(snap.settings.taxRate,'15');
  assert.ok(snap.accounts.length>=18,'default accounts should be seeded');
  store.rawRun("INSERT INTO categories(name,sort_order) VALUES('مستشفى',0)"); const categoryId=store.lastId();
  store.rawRun("INSERT INTO branches(name,category_id,tax_number,address) VALUES('مستشفى أنصاري',?,'300000000000003','جدة')",[categoryId]); const branchId=store.lastId();
  store.rawRun("INSERT INTO periods(year,month,label,tax_rate) VALUES(2026,8,'أغسطس 2026',15)"); const periodId=store.lastId();
  const account=store.one("SELECT * FROM accounts WHERE section='sales' ORDER BY id LIMIT 1");
  store.replaceAccountVisibility(account.id,[categoryId]);
  store.rawRun("INSERT INTO branch_account_codes(branch_id,account_id,short_code,program_code,vat_box_15) VALUES(?,?,?,?,2)",[branchId,account.id,'005','400']);
  store.rawRun("INSERT INTO entries(period_id,branch_id,account_id,rate_type,total,expression) VALUES(?,?,?,?,?,?)",[periodId,branchId,account.id,'15',1000.50,'1000.50']);
  store.persist();
  snap=store.snapshot();
  assert.strictEqual(snap.branches.find(b=>b.id===branchId).tax_number,'300000000000003');
  assert.deepStrictEqual(snap.accounts.find(a=>a.id===account.id).visibility_category_ids,[categoryId]);
  assert.strictEqual(snap.codes.find(c=>c.branch_id===branchId&&c.account_id===account.id).vat_box_15,2);
  assert.strictEqual(snap.entries.find(e=>e.period_id===periodId&&e.branch_id===branchId).total,1000.5);
  // reopen persisted file to prove compatibility/persistence
  await store.openDatabase(dir); snap=store.snapshot();
  assert.strictEqual(snap.periods.find(p=>p.id===periodId).label,'أغسطس 2026');
  assert.strictEqual(snap.entries.find(e=>e.period_id===periodId).total,1000.5);
  console.log('✓ Database migration, persistence, decimals, branch metadata, visibility and VAT mapping passed');
 } finally { fs.rmSync(dir,{recursive:true,force:true}); }
})().catch(err=>{console.error(err);process.exit(1)});
