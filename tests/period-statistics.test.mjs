import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

let openedAttachmentId=null;
globalThis.window={vatAPI:{openAttachment:id=>{openedAttachmentId=id;return Promise.resolve({ok:true})}}};

const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
  const {buildPeriodsStatisticsReport}=await vite.ssrLoadModule('/src/services/reportService.js');
  const {default:Dashboard}=await vite.ssrLoadModule('/src/pages/Dashboard/Dashboard.jsx');
  const {default:Attachments}=await vite.ssrLoadModule('/src/pages/Attachments/Attachments.jsx');
  const periods=[
    {id:1,year:2026,month:1,label:'يناير 2026',status:'paid',is_locked:1,tax_rate:15},
    {id:2,year:2025,month:12,label:'ديسمبر 2025',status:'paid',is_locked:1,tax_rate:15}
  ];
  const data={
    settings:{companyName:'شركة الاختبار'},periods,
    branches:[{id:1,name:'الفرع',active:1}],
    accounts:[{id:1,name:'مبيعات',active:1,section:'sales',visibility_category_ids:[]}],
    codes:[],adjustments:[],payments:[],reminders:[],entryParts:[],categories:[],
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
  console.log('✓ Period statistics year scope and payment notice action passed');
} finally {
  await vite.close();
}
