import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

let openedAttachmentId=null;
globalThis.window={vatAPI:{openAttachment:id=>{openedAttachmentId=id;return Promise.resolve({ok:true})}}};

const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
  const {buildPeriodsStatisticsReport,buildBranchReport,buildAccountsDirectoryReport,buildAnnualStatementReport,buildVatReturnReport}=await vite.ssrLoadModule('/src/services/reportService.js');
  const {default:Accounts}=await vite.ssrLoadModule('/src/pages/Accounts/Accounts.jsx');
  const {default:AnnualStatement}=await vite.ssrLoadModule('/src/pages/AnnualStatement/AnnualStatement.jsx');
  const {default:ReturnView}=await vite.ssrLoadModule('/src/pages/VATForm/ReturnView.jsx');
  const {default:Dashboard}=await vite.ssrLoadModule('/src/pages/Dashboard/Dashboard.jsx');
  const {default:Attachments}=await vite.ssrLoadModule('/src/pages/Attachments/Attachments.jsx');
  const {default:EntryPage,accountSearchText}=await vite.ssrLoadModule('/src/pages/Entry/EntryPage.jsx');
  const {default:SettingsView}=await vite.ssrLoadModule('/src/pages/Settings/SettingsView.jsx');
  const {nextMoneyCellTarget}=await vite.ssrLoadModule('/src/utils/money.js');
  const periods=[
    {id:1,year:2026,month:1,label:'يناير 2026',status:'paid',is_locked:1,tax_rate:15},
    {id:2,year:2025,month:12,label:'ديسمبر 2025',status:'paid',is_locked:1,tax_rate:15}
  ];
  const data={
    settings:{companyName:'شركة الاختبار',separateRateCodes:'1'},periods,
    branches:[{id:1,name:'الفرع',active:1}],
    accounts:[{id:1,name:'مشتريات اختبارية',active:1,section:'purchase',visibility_category_ids:[]}],
    codes:[{branch_id:1,account_id:1,short_code:'OLD',program_code:'OLD-P',short_code_15:'S15',program_code_15:'P15',short_code_0:'S0',program_code_0:'P0'}],adjustments:[],payments:[],reminders:[],entryParts:[],categories:[],
    entries:[
      {period_id:1,branch_id:1,account_id:1,rate_type:'15',total:100},
      {period_id:2,branch_id:1,account_id:1,rate_type:'15',total:200}
    ],
    attachments:[{id:7,period_id:1,name:'receipt.pdf',stored_path:'receipt.pdf',is_payment_notice:1}]
  };

  const report=buildPeriodsStatisticsReport(data,2026);
  assert.match(report,/إحصائية الإقرارات الضريبية المسجلة لعام 2026/,'the preview title must include the selected year');
  assert.match(report,/يناير 2026/,'the selected year rows must be included');
  assert.doesNotMatch(report,/ديسمبر 2025/,'rows from other years must be excluded');

  const dashboard=renderToStaticMarkup(React.createElement(Dashboard,{data,period:periods[0],setPage:()=>{}}));
  assert.match(dashboard,/فتح إشعار السداد/,'paid rows with a selected notice must expose an open button');
  assert.doesNotMatch(dashboard,/ديسمبر 2025/,'the dashboard table must follow the open period year');
  const tree=Dashboard({data,period:periods[0],setPage:()=>{}});
  const textOf=node=>Array.isArray(node)?node.map(textOf).join(''):React.isValidElement(node)?textOf(node.props.children):String(node??'');
  const findButton=node=>{
    if(Array.isArray(node))return node.map(findButton).find(Boolean);
    if(!React.isValidElement(node))return null;
    if(node.type==='button'&&textOf(node).includes('فتح إشعار السداد'))return node;
    return findButton(node.props.children);
  };
  const openButton=findButton(tree);
  assert.ok(openButton,'the payment notice action must be an interactive button');
  await openButton.props.onClick();
  assert.equal(openedAttachmentId,7,'the dashboard action must open the selected payment notice');

  const attachmentsHtml=renderToStaticMarkup(React.createElement(Attachments,{data,period:periods[0],setData:()=>{}}));
  assert.match(attachmentsHtml,/payment-notice-selected/,'the selected payment notice must be visibly marked in attachments');
  assert.match(attachmentsHtml,/إشعار السداد/,'attachments must expose the payment notice selector');

  assert.deepEqual(nextMoneyCellTarget?.(0,'15',2),{rowIndex:0,rateType:'0'},'15% must advance to 0% on the same row');
  assert.deepEqual(nextMoneyCellTarget?.(0,'0',2),{rowIndex:1,rateType:'15'},'0% must advance to 15% on the next row');
  assert.equal(nextMoneyCellTarget?.(1,'0',2),null,'the final 0% cell has no forward target');
  assert.match(accountSearchText?.(data.accounts[0],data.codes[0],true)||'',/s0/,'entry search must index the displayed rate-specific codes');

  const entryHtml=renderToStaticMarkup(React.createElement(EntryPage,{data,period:periods[0],branchId:1,setBranchId:()=>{},setData:()=>{}}));
  assert.match(entryHtml,/بيانات 15%/,'enabled layout must render a framed 15% group');
  assert.match(entryHtml,/بيانات 0%/,'enabled layout must render a framed 0% group');
  assert.match(entryHtml,/S15/,'the entry table must display the 15% short code');
  assert.match(entryHtml,/S0/,'the entry table must display the 0% short code');

  const settingsHtml=renderToStaticMarkup(React.createElement(SettingsView,{data,setData:()=>{}}));
  assert.match(settingsHtml,/تفعيل أكواد مستقلة/,'settings must expose the opt-in layout toggle');

  const branchReport=buildBranchReport(data,periods[0],data.branches[0]);
  assert.match(branchReport,/S15/,'enabled reports must use the 15% code');
  assert.match(branchReport,/S0/,'enabled reports must use the 0% code');
  assert.doesNotMatch(branchReport,/>OLD</,'enabled reports must not show the legacy shared code');
  const accountsReport=buildAccountsDirectoryReport(data,1,'purchase');
  assert.match(accountsReport,/S15/,'enabled account-directory reports must use the 15% code');
  assert.match(accountsReport,/S0/,'enabled account-directory reports must use the 0% code');
  assert.doesNotMatch(accountsReport,/>OLD</,'enabled account-directory reports must not show the legacy shared code');
  const legacyData={...data,settings:{...data.settings,separateRateCodes:'0'}};
  const legacyAccountsReport=buildAccountsDirectoryReport(legacyData,1,'purchase');
  assert.match(legacyAccountsReport,/>OLD</,'disabled account-directory reports must keep the shared code layout');
  assert.doesNotMatch(legacyAccountsReport,/>S15</,'disabled account-directory reports must hide rate-specific codes');

  const rangedData={...data,periods:[...periods,
    {id:3,year:2026,month:3,tax_rate:15},
    {id:4,year:2026,month:4,tax_rate:15}
  ],entries:[...data.entries,
    {period_id:3,branch_id:1,account_id:1,rate_type:'15',total:300},
    {period_id:4,branch_id:1,account_id:1,rate_type:'15',total:900}
  ]};
  const annual=buildAnnualStatementReport(rangedData,2026,undefined,null,1,3);
  assert.match(annual,/يناير - 2026/);
  assert.match(annual,/مارس - 2026/);
  assert.doesNotMatch(annual,/أبريل - 2026|ديسمبر - 2025/,'months outside the range must be excluded from the exported report');
  assert.match(annual,/>400\.00</,'monthly report totals must use only the selected months');
  assert.match(renderToStaticMarkup(React.createElement(AnnualStatement,{data:rangedData})),/من شهر.*إلى شهر/);

  const vatData={...data,
    settings:{...data.settings,taxNumber:'TAX-COMPANY'},
    branches:[{...data.branches[0],tax_number:'TAX-BRANCH-1'},{id:2,name:'الفرع الآخر',active:1,tax_number:'TAX-BRANCH-2'}],
    entries:[...data.entries,{period_id:1,branch_id:2,account_id:1,rate_type:'15',total:800}],
    adjustments:[{period_id:1,box_no:7,value:50,tax_value:7.5},{period_id:1,box_no:14,value:10,tax_value:5}]
  };
  const branchVat=buildVatReturnReport(vatData,periods[0],1);
  assert.match(branchVat,/TAX-BRANCH-1/);
  assert.match(branchVat,/>100\.00</);
  assert.match(branchVat,/>-15\.00 ر\.س</,'branch net must exclude organization-level corrections');
  assert.doesNotMatch(branchVat,/TAX-COMPANY|TAX-BRANCH-2|>950\.00</);
  const overallVat=buildVatReturnReport(vatData,periods[0]);
  assert.match(overallVat,/TAX-COMPANY/);
  assert.match(overallVat,/>950\.00</,'overall VAT must retain all branches and adjustments');
  assert.match(renderToStaticMarkup(React.createElement(ReturnView,{data:vatData,period:periods[0]})),/<option value="2">الفرع الآخر<\/option>/);

  assert.match(entryHtml,/مسلسل - 15%/);
  assert.match(accountsReport,/مسلسل - 0%/);
  const renamed={...data,settings:{...data.settings,accountCodeLabels:JSON.stringify({short15:'مرجع داخلي',program0:'كود التصدير'})}};
  for(const html of [
    renderToStaticMarkup(React.createElement(Accounts,{data:renamed})),
    renderToStaticMarkup(React.createElement(EntryPage,{data:renamed,period:periods[0],branchId:1})),
    buildAccountsDirectoryReport(renamed,1,'purchase'),
    buildBranchReport(renamed,periods[0],data.branches[0])
  ]){
    assert.match(html,/مرجع داخلي/);
    assert.match(html,/كود التصدير/);
    assert.match(html,/مسلسل - 0%/,'editing one label must preserve the other defaults');
  }
  console.log('✓ Period statistics year scope and payment notice action passed');
} finally {
  await vite.close();
}
