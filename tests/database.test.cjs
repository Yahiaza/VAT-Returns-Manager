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
  store.rawRun("INSERT INTO attachments(period_id,name,stored_path) VALUES(?,?,?)",[periodId,'receipt-1.pdf',path.join(dir,'receipt-1.pdf')]); const receipt1Id=store.lastId();
  store.rawRun("INSERT INTO attachments(period_id,name,stored_path) VALUES(?,?,?)",[periodId,'receipt-2.pdf',path.join(dir,'receipt-2.pdf')]); const receipt2Id=store.lastId();
  store.setPaymentNoticeAttachment(periodId,receipt1Id);
  store.setPaymentNoticeAttachment(periodId,receipt2Id);
  store.persist();
  snap=store.snapshot();
  assert.strictEqual(snap.branches.find(b=>b.id===branchId).tax_number,'300000000000003');
  assert.deepStrictEqual(snap.accounts.find(a=>a.id===account.id).visibility_category_ids,[categoryId]);
  assert.strictEqual(snap.codes.find(c=>c.branch_id===branchId&&c.account_id===account.id).vat_box_15,2);
  assert.strictEqual(snap.entries.find(e=>e.period_id===periodId&&e.branch_id===branchId).total,1000.5);
  assert.strictEqual(snap.attachments.filter(a=>a.period_id===periodId&&Number(a.is_payment_notice)===1).length,1,'a period must have only one payment notice');
  assert.strictEqual(Number(snap.attachments.find(a=>a.id===receipt2Id).is_payment_notice),1,'the latest selected attachment becomes the payment notice');
  store.setPaymentNoticeAttachment(periodId,'invalid');
  assert.strictEqual(Number(store.snapshot().attachments.find(a=>a.id===receipt2Id).is_payment_notice),1,'malformed attachment ids must not clear the selected notice');
  // reopen persisted file to prove compatibility/persistence
  await store.openDatabase(dir); snap=store.snapshot();
  assert.strictEqual(snap.periods.find(p=>p.id===periodId).label,'أغسطس 2026');
  assert.strictEqual(snap.entries.find(e=>e.period_id===periodId).total,1000.5);
  assert.strictEqual(Number(snap.attachments.find(a=>a.id===receipt2Id).is_payment_notice),1,'payment notice selection must persist after reopening');
  // Simulate a database created by the previous release, before the payment-notice column existed.
  store.rawRun('ALTER TABLE attachments DROP COLUMN is_payment_notice');
  store.persist();
  await store.openDatabase(dir); snap=store.snapshot();
  assert.strictEqual(snap.attachments.filter(a=>a.period_id===periodId).length,2,'legacy attachments must survive the migration');
  assert.ok(snap.attachments.every(a=>Number(a.is_payment_notice)===0),'legacy attachments must receive the new default flag');
  console.log('✓ Database migration, persistence, decimals, branch metadata, visibility and VAT mapping passed');
 } finally { fs.rmSync(dir,{recursive:true,force:true}); }
})().catch(err=>{console.error(err);process.exit(1)});
