import React from 'react';
import {ReceiptText,Building2,Percent,Calculator,CircleDollarSign,CheckCircle2,Eye,FileDown} from 'lucide-react';
import {api} from '../../services/api.js';
import {statuses} from '../../app/constants.js';
import {fmt,negativeClass} from '../../utils/money.js';
import {toDisplayDate} from '../../utils/date.js';
import {calcTotals} from '../../services/vatCalculations.js';
import {buildPeriodsStatisticsReport} from '../../services/reportService.js';

function periodHasData(data,p){
  const t=calcTotals(data,p);
  const totals=[t.sales15,t.sales0,t.purchase15,t.purchase0,t.outputTax,t.inputTax,t.net];
  if(totals.some(v=>Math.abs(Number(v||0))>0.000001)) return true;
  if(data.entries.some(e=>e.period_id===p.id&&Math.abs(Number(e.total||0))>0.000001)) return true;
  if(data.adjustments.some(a=>a.period_id===p.id&&(Math.abs(Number(a.value||0))>0.000001||Math.abs(Number(a.tax_value||0))>0.000001))) return true;
  return false;
}

export default function Dashboard({data,period,setPage}){
  const t=calcTotals(data,period);const activeBranches=data.branches.filter(b=>b.active);
  const completed=period?activeBranches.filter(b=>data.entries.some(e=>e.period_id===period.id&&e.branch_id===b.id&&Math.abs(e.total)>0)).length:0;
  const cards=[['إجمالي المبيعات',t.sales15+t.sales0,ReceiptText,'dash-blue'],['إجمالي المشتريات',t.purchase15+t.purchase0,Building2,'dash-violet'],['ضريبة المخرجات',t.outputTax,Percent,'dash-amber'],['ضريبة المدخلات',t.inputTax,Calculator,'dash-emerald'],['صافي VAT',t.net,CircleDollarSign,t.net>=0?'dash-navy':'dash-red']];
  const visiblePeriods=data.periods.filter(p=>periodHasData(data,p));
  const tableTotals=visiblePeriods.reduce((a,p)=>{const x=calcTotals(data,p);a.sales15+=x.sales15;a.sales0+=x.sales0;a.purchase15+=x.purchase15;a.purchase0+=x.purchase0;a.net+=x.net;return a},{sales15:0,sales0:0,purchase15:0,purchase0:0,net:0});
  const statsHtml=()=>buildPeriodsStatisticsReport(data);
  return <div className="space-y-5">
    {period&&<><div className="grid grid-cols-5 gap-4">{cards.map(([l,v,I,cls])=><div className={`dashboard-card ${cls}`} key={l}><div className="flex justify-between items-start"><div className="text-xs font-semibold opacity-80">{l}</div><div className="dashboard-icon"><I size={19}/></div></div><div className={`text-2xl font-extrabold mt-4 money ${negativeClass(v)}`}>{fmt(v)} <span className="text-xs font-normal opacity-70">ر.س</span></div></div>)}</div>
    <div className="grid grid-cols-3 gap-5"><div className="card p-5 col-span-2"><div className="flex items-center justify-between mb-4"><div><div className="font-bold">إقرار {period.label}</div><div className="text-sm text-slate-400 mt-1">حالة العمل والمتابعة</div></div><span className="badge bg-blue-50 text-blue-700"><CheckCircle2 size={14}/>{statuses[period.status]||period.status}{Number(period.is_locked)===1?' — مقفل':''}</span></div><div className="grid grid-cols-3 gap-4 text-sm"><Info label="الفروع التي بها إدخال" value={`${completed} / ${activeBranches.length}`}/><Info label="موعد الاستحقاق" value={period.due_date?toDisplayDate(period.due_date):'غير محدد'}/><Info label="النسبة الأساسية" value={`${period.tax_rate}%`}/></div><button className="btn btn-primary mt-5" onClick={()=>setPage('entry')}>{Number(period.is_locked)===1?'معاينة الإقرار':'فتح شاشة إدخال الفروع'}</button></div><div className="card p-5"><div className="font-bold mb-3">الوصول السريع</div><button onClick={()=>setPage('reports')} className="quick-link">عرض نموذج VAT النهائي</button><button onClick={()=>setPage('attachments')} className="quick-link mt-2">مرفقات الإقرار والسداد</button></div></div></>}
    {!period&&<EmptyPeriod setPage={setPage}/>} 
    <div className="card overflow-hidden"><div className="p-4 border-b flex items-center justify-between"><div><div className="font-bold">جميع الإقرارات المسجلة</div><div className="text-xs text-slate-400 mt-1">تظهر فقط الفترات التي تحتوي على بيانات فعلية</div></div><div className="flex gap-2"><button className="btn btn-soft !py-2 flex items-center gap-2" onClick={()=>api.previewReport({html:statsHtml(),title:'إحصائية الإقرارات الضريبية'})}><Eye size={16}/>معاينة وطباعة</button><button className="btn btn-soft !py-2 flex items-center gap-2" onClick={()=>api.exportPdf({html:statsHtml(),defaultName:'إحصائية-الإقرارات-الضريبية.pdf'})}><FileDown size={16}/>PDF</button></div></div>
      <div className="overflow-auto"><table className="table w-full text-sm"><thead><tr><th>الفترة</th><th>الحالة</th><th>إيرادات 15%</th><th>إيرادات 0%</th><th>مشتريات 15%</th><th>مشتريات 0%</th><th>صافي الضريبة</th></tr></thead><tbody>{visiblePeriods.length?visiblePeriods.map(p=>{const x=calcTotals(data,p);return <tr key={p.id}><td className="font-bold">{p.label}</td><td>{statuses[p.status]||p.status}{Number(p.is_locked)===1?' 🔒':''}</td><td className={`money ${negativeClass(x.sales15)}`}>{fmt(x.sales15)}</td><td className={`money ${negativeClass(x.sales0)}`}>{fmt(x.sales0)}</td><td className={`money ${negativeClass(x.purchase15)}`}>{fmt(x.purchase15)}</td><td className={`money ${negativeClass(x.purchase0)}`}>{fmt(x.purchase0)}</td><td className={`money font-bold ${negativeClass(x.net)}`}>{fmt(x.net)}</td></tr>}):<tr><td colSpan="7" className="text-center text-slate-400 py-8">لا توجد إقرارات تحتوي على بيانات حتى الآن</td></tr>}</tbody>{visiblePeriods.length>0&&<tfoot><tr className="font-extrabold bg-slate-100 border-t-2 border-slate-300"><td>الإجمالي</td><td>{visiblePeriods.length} إقرار</td><td className={`money ${negativeClass(tableTotals.sales15)}`}>{fmt(tableTotals.sales15)}</td><td className={`money ${negativeClass(tableTotals.sales0)}`}>{fmt(tableTotals.sales0)}</td><td className={`money ${negativeClass(tableTotals.purchase15)}`}>{fmt(tableTotals.purchase15)}</td><td className={`money ${negativeClass(tableTotals.purchase0)}`}>{fmt(tableTotals.purchase0)}</td><td className={`money ${negativeClass(tableTotals.net)}`}>{fmt(tableTotals.net)}</td></tr></tfoot>}</table></div>
    </div>
  </div>
}
function Info({label,value}){return <div className="bg-slate-50 rounded-xl p-3"><div className="text-slate-400 text-xs">{label}</div><div className="font-bold mt-1">{value}</div></div>}
function EmptyPeriod({setPage}){return <div className="card p-12 text-center"><ReceiptText className="mx-auto text-slate-300" size={48}/><h2 className="font-bold text-xl mt-4">لا يوجد إقرار حتى الآن</h2><p className="text-slate-400 mt-2">أنشئ أول فترة ضريبية شهرية ثم ابدأ إدخال الفروع.</p><button className="btn btn-primary mt-5" onClick={()=>setPage('periods')}>إنشاء إقرار</button></div>}
