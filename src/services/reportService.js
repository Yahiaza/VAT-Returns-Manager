import {fmt} from '../utils/money.js';
import {branchMetrics,calcTotals,calculateVatBoxes,aggregateBranchTotals} from './vatCalculations.js';
import {statuses} from '../app/constants.js';
import {accountVisibleForBranch} from './visibility.js';
export function esc(v){return String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
export function reportStyles(){return `<style>
@page{size:A4 portrait;margin:8mm}
*{box-sizing:border-box}
body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#24364a;margin:0;background:#f4f7fa}
.page{max-width:1100px;margin:24px auto;background:#fff;padding:24px}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:3px solid #285f83;padding-bottom:14px;margin-bottom:18px}
h1{font-size:22px;margin:0 0 5px}h2{font-size:17px;margin:22px 0 8px;color:#285f83}.muted{color:#728197;font-size:12px}
.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0}
.summary .metric{min-width:0;border:1px solid #d3dee8;background:#f3f7fa;padding:12px 14px;border-radius:4px;display:flex;flex-direction:column;justify-content:center;min-height:82px}
.summary .metric-label{display:block;color:#445a70;font-size:12px;line-height:1.45;text-align:right}
.summary .metric-value{display:block;margin-top:6px;color:#173858;font-size:18px;font-weight:800;line-height:1.15;direction:ltr;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.metric-tax{display:block;margin-top:7px;padding-top:7px;border-top:1px dashed #c8d6e2;color:#526b80;font-size:11px;font-weight:700}.metric-tax b{font-size:14px;color:#244a68;direction:ltr;display:inline-block;margin-right:5px}.negative-number{color:#c62828!important}
.overall-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.overall-summary .metric{min-height:88px}
.overall-summary .metric-value{font-size:21px}
.overall-summary .net-summary{grid-column:1/-1;background:#e8f5ee;border-color:#b8dec8;display:grid;grid-template-columns:1fr auto;align-items:center;gap:20px;min-height:72px}
.overall-summary .net-summary .metric-label{font-size:14px;font-weight:700;color:#246343}
.overall-summary .net-summary .metric-value{margin-top:0;font-size:24px;color:#14623d;text-align:left}
table{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:12px}th{background:#e8edf2;color:#344b60}th,td{border:1px solid #ccd7e0;padding:7px;text-align:right}td.num{direction:ltr;text-align:right;font-variant-numeric:tabular-nums}.total td{background:#dfe9f1;font-weight:700}.grand td{background:#edf5ff;color:#1e5fb9;font-weight:800}.taxbox{margin-top:12px;border:1px solid #cbd7e0}.taxbox .title{background:#263f59;color:#fff;padding:9px 12px;font-weight:700}.taxbox table{margin:0}.net{background:#dff4e7!important;color:#14623d;font-weight:900}.branch-block{page-break-inside:avoid;margin-bottom:28px}.preview-print{position:fixed;left:18px;top:18px;border:0;background:#285f83;color:#fff;padding:9px 18px;border-radius:6px;font-weight:700;cursor:pointer}
@media print{
 body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .page{margin:0;max-width:none;padding:0}
 .no-print{display:none}
 .branch-block{page-break-inside:avoid}
 .overall-summary{gap:8px;margin:10px 0 16px}
 .overall-summary .metric{min-height:72px;padding:9px 11px}
 .overall-summary .metric-label{font-size:11px}
 .overall-summary .metric-value{font-size:19px}
 .overall-summary .net-summary{min-height:58px}
 .overall-summary .net-summary .metric-value{font-size:21px}
}
</style>`}
export function sectionReportHtml(data,period,branch,section){
  const codeMap=Object.fromEntries(data.codes.filter(c=>c.branch_id===branch.id).map(c=>[c.account_id,c]));
  const accounts=data.accounts.filter(a=>a.active&&a.section===section&&accountVisibleForBranch(a,branch));
  const get=(aid,rate)=>data.entries.find(e=>e.period_id===period.id&&e.branch_id===branch.id&&e.account_id===aid&&e.rate_type===rate)?.total||0;
  const t15=accounts.reduce((s,a)=>s+Number(get(a.id,'15')),0),t0=accounts.reduce((s,a)=>s+Number(get(a.id,'0')),0);
  const rows=accounts.map(a=>{const c=codeMap[a.id]||{};return `<tr><td>${esc(a.name)}</td><td>${esc(c.short_code||'-')}</td><td>${esc(c.program_code||'-')}</td><td class="num ${Number(get(a.id,'15'))<0?'negative-number':''}">${fmt(get(a.id,'15'))}</td><td class="num ${Number(get(a.id,'0'))<0?'negative-number':''}">${fmt(get(a.id,'0'))}</td></tr>`}).join('');
  return `<h2>${section==='purchase'?'المشتريات / المصروفات':'الإيرادات / المبيعات'}</h2><table><thead><tr><th>البيان</th><th>الكود المختصر</th><th>كود البرنامج</th><th>15%</th><th>0%</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="total"><td colspan="3">الإجمالي</td><td class="num ${t15<0?'negative-number':''}">${fmt(t15)}</td><td class="num ${t0<0?'negative-number':''}">${fmt(t0)}</td></tr><tr class="grand"><td colspan="3">إجمالي مجمع</td><td colspan="2" class="num ${t15+t0<0?'negative-number':''}">${fmt(t15+t0)}</td></tr></tfoot></table>`;
}
export function branchReportBlock(data,period,branch){const m=branchMetrics(data,period,branch.id);return `<div class="branch-block"><div class="top"><div><h1>${esc(branch.name)}</h1><div class="muted">${esc(period.label)} — ${esc(data.settings.companyName||'المنشأة')}${branch.tax_number?` — الرقم الضريبي: ${esc(branch.tax_number)}`:''}</div></div><div><b>VAT ${esc(period.tax_rate)}%</b></div></div>${sectionReportHtml(data,period,branch,'purchase')}${sectionReportHtml(data,period,branch,'sales')}<div class="taxbox"><div class="title">ملخص الضريبة للفرع</div><table><tr><td>إجمالي الإيرادات ${esc(period.tax_rate)}%</td><td class="num ${m.sales15<0?'negative-number':''}">${fmt(m.sales15)}</td><td>قيمة الضريبة</td><td class="num ${m.outputTax<0?'negative-number':''}">${fmt(m.outputTax)}</td></tr><tr><td>إجمالي المشتريات ${esc(period.tax_rate)}%</td><td class="num ${m.purchase15<0?'negative-number':''}">${fmt(m.purchase15)}</td><td>قيمة الضريبة</td><td class="num ${m.inputTax<0?'negative-number':''}">${fmt(m.inputTax)}</td></tr><tr><td colspan="3">صافي الضريبة (الضريبة المستحقة)</td><td class="num net ${m.netTax<0?'negative-number':''}">${fmt(m.netTax)}</td></tr></table></div></div>`}
export function buildBranchReport(data,period,branch){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(branch.name)} - ${esc(period.label)}</title>${reportStyles()}</head><body><button class="preview-print no-print" onclick="window.print()">طباعة</button><div class="page">${branchReportBlock(data,period,branch)}</div></body></html>`}
export function buildOverallReport(data,period){
  const branches=data.branches.filter(b=>b.active);
  const totals=aggregateBranchTotals(data,period);
  const rate=Number(period.tax_rate||15)/100;
  const netTax=(totals.sales15*rate)-(totals.purchase15*rate);
  const top=`<div class="top"><div><h1>إجمالي الفروع — ${esc(period.label)}</h1><div class="muted">${esc(data.settings.companyName||'المنشأة')}${data.settings.unifiedNumber?` — الرقم الموحد: ${esc(data.settings.unifiedNumber)}`:''}</div></div><div><b>VAT ${esc(period.tax_rate)}%</b></div></div><div class="summary overall-summary"><div class="metric"><span class="metric-label">إجمالي الإيرادات 15%</span><b class="metric-value ${totals.sales15<0?'negative-number':''}">${fmt(totals.sales15)}</b><span class="metric-tax">قيمة الضريبة <b class="${totals.sales15*rate<0?'negative-number':''}">${fmt(totals.sales15*rate)}</b></span></div><div class="metric"><span class="metric-label">إجمالي الإيرادات 0%</span><b class="metric-value ${totals.sales0<0?'negative-number':''}">${fmt(totals.sales0)}</b></div><div class="metric"><span class="metric-label">إجمالي المشتريات 15%</span><b class="metric-value ${totals.purchase15<0?'negative-number':''}">${fmt(totals.purchase15)}</b><span class="metric-tax">قيمة الضريبة <b class="${totals.purchase15*rate<0?'negative-number':''}">${fmt(totals.purchase15*rate)}</b></span></div><div class="metric"><span class="metric-label">إجمالي المشتريات 0%</span><b class="metric-value ${totals.purchase0<0?'negative-number':''}">${fmt(totals.purchase0)}</b></div><div class="metric net-summary"><span class="metric-label">صافي الضريبة (الضريبة المستحقة)</span><b class="metric-value ${netTax<0?'negative-number':''}">${fmt(netTax)}</b></div></div>`;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>إجمالي الفروع - ${esc(period.label)}</title>${reportStyles()}</head><body><button class="preview-print no-print" onclick="window.print()">طباعة</button><div class="page">${top}${branches.map(b=>branchReportBlock(data,period,b)).join('')}</div></body></html>`
}

export function buildPeriodsStatisticsReport(data){
  const rows=data.periods.map(p=>{const t=calcTotals(data,p);return `<tr><td>${esc(p.label)}</td><td>${esc(statuses[p.status]||p.status)}${Number(p.is_locked)===1?' — مقفل':''}</td><td class="num ${t.sales15<0?'negative-number':''}">${fmt(t.sales15)}</td><td class="num ${t.sales0<0?'negative-number':''}">${fmt(t.sales0)}</td><td class="num ${t.purchase15<0?'negative-number':''}">${fmt(t.purchase15)}</td><td class="num ${t.purchase0<0?'negative-number':''}">${fmt(t.purchase0)}</td><td class="num ${t.outputTax<0?'negative-number':''}">${fmt(t.outputTax)}</td><td class="num ${t.inputTax<0?'negative-number':''}">${fmt(t.inputTax)}</td><td class="num ${t.net<0?'negative-number':''}">${fmt(t.net)}</td></tr>`}).join('');
  const unified=data.settings.unifiedNumber?` — الرقم الموحد: ${esc(data.settings.unifiedNumber)}`:'';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>إحصائية الإقرارات الضريبية</title>${reportStyles()}<style>@page{size:A4 landscape}.page{max-width:1400px}table{font-size:11px}</style></head><body><button class="preview-print no-print" onclick="window.print()">طباعة</button><div class="page"><div class="top"><div><h1>إحصائية الإقرارات الضريبية المسجلة</h1><div class="muted">${esc(data.settings.companyName||'المنشأة')}${unified}</div></div><div><b>VAT</b></div></div><table><thead><tr><th>الفترة</th><th>الحالة</th><th>إيرادات 15%</th><th>إيرادات 0%</th><th>مشتريات 15%</th><th>مشتريات 0%</th><th>ضريبة المخرجات</th><th>ضريبة المدخلات</th><th>صافي الضريبة</th></tr></thead><tbody>${rows||'<tr><td colspan="9">لا توجد إقرارات مسجلة</td></tr>'}</tbody></table></div></body></html>`;
}

export function buildVatReturnReport(data,period){
  const boxes=calculateVatBoxes(data,period);const adj=n=>data.adjustments.find(x=>x.period_id===period.id&&Number(x.box_no)===n)||{};
  const labels={1:`المبيعات الخاضعة للنسبة الأساسية ${period.tax_rate}%`,2:'المبيعات التي تتحمل الدولة ضريبتها',3:'المبيعات الخاضعة للنسبة الصفرية',4:'الصادرات',5:'المبيعات المعفاة من الضريبة',7:`المشتريات الخاضعة للنسبة الأساسية ${period.tax_rate}%`,8:'الاستيرادات الخاضعة للضريبة المدفوعة عند الاستيراد',9:'الاستيرادات الخاضعة للاحتساب العكسي',10:'المشتريات الخاضعة للنسبة الصفرية',11:'المشتريات المعفاة من الضريبة'};
  const sales=[1,2,3,4,5],purchases=[7,8,9,10,11];const row=n=>`<tr><td>${n}</td><td>${esc(labels[n])}</td><td class="num ${boxes[n].value<0?'negative-number':''}">${fmt(boxes[n].value)}</td><td class="num ${boxes[n].tax<0?'negative-number':''}">${fmt(boxes[n].tax)}</td></tr>`;
  const salesValue=sales.reduce((s,n)=>s+boxes[n].value,0),salesTax=sales.reduce((s,n)=>s+boxes[n].tax,0),purchaseValue=purchases.reduce((s,n)=>s+boxes[n].value,0),purchaseTax=purchases.reduce((s,n)=>s+boxes[n].tax,0);const corr=adj(14);const net=salesTax-purchaseTax+Number(corr.tax_value||0);
  const unified=data.settings.unifiedNumber?` — الرقم الموحد: ${esc(data.settings.unifiedNumber)}`:'';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>نموذج VAT - ${esc(period.label)}</title>${reportStyles()}</head><body><button class="preview-print no-print" onclick="window.print()">طباعة</button><div class="page"><div class="top"><div><h1>نموذج إقرار ضريبة القيمة المضافة</h1><div class="muted">${esc(period.label)} — ${esc(data.settings.companyName||'المنشأة')}${unified}</div></div><div><b>VAT ${esc(period.tax_rate)}%</b></div></div><h2>الضريبة على المبيعات</h2><table><thead><tr><th>#</th><th>البيان</th><th>القيمة</th><th>مبلغ الضريبة</th></tr></thead><tbody>${sales.map(row).join('')}</tbody><tfoot><tr class="total"><td colspan="2">إجمالي المبيعات</td><td class="num ${salesValue<0?'negative-number':''}">${fmt(salesValue)}</td><td class="num ${salesTax<0?'negative-number':''}">${fmt(salesTax)}</td></tr></tfoot></table><h2>الضريبة على المشتريات</h2><table><thead><tr><th>#</th><th>البيان</th><th>القيمة</th><th>مبلغ الضريبة</th></tr></thead><tbody>${purchases.map(row).join('')}</tbody><tfoot><tr class="total"><td colspan="2">إجمالي المشتريات</td><td class="num ${purchaseValue<0?'negative-number':''}">${fmt(purchaseValue)}</td><td class="num ${purchaseTax<0?'negative-number':''}">${fmt(purchaseTax)}</td></tr></tfoot></table><table><tr><td>تصحيحات من الفترات السابقة</td><td class="num ${Number(corr.value||0)<0?'negative-number':''}">${fmt(corr.value||0)}</td><td class="num ${Number(corr.tax_value||0)<0?'negative-number':''}">${fmt(corr.tax_value||0)}</td></tr><tr class="net"><td colspan="2">صافي الضريبة (الضريبة المستحقة)</td><td class="num ${net<0?'negative-number':''}">${fmt(net)} ر.س</td></tr></table></div></body></html>`;
}
