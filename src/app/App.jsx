import React,{useEffect,useState} from 'react';
import {LayoutDashboard,ReceiptText,Building2,ListTree,FileBarChart2,Paperclip,Settings,Plus,Bell,History} from 'lucide-react';
import {api} from '../services/api.js';
import TitleBar from '../components/layout/TitleBar.jsx';
import Dashboard from '../pages/Dashboard/Dashboard.jsx';
import Periods from '../pages/Periods/Periods.jsx';
import Branches from '../pages/Branches/Branches.jsx';
import Accounts from '../pages/Accounts/Accounts.jsx';
import EntryPage from '../pages/Entry/EntryPage.jsx';
import ReturnView from '../pages/VATForm/ReturnView.jsx';
import Attachments from '../pages/Attachments/Attachments.jsx';
import HistoryView from '../pages/History/HistoryView.jsx';
import SettingsView from '../pages/Settings/SettingsView.jsx';
export default function App(){
  const [data,setData]=useState(null); const [page,setPage]=useState('dashboard'); const [periodId,setPeriodId]=useState(null); const [branchId,setBranchId]=useState(null); const [toast,setToast]=useState('');
  const refresh=async()=>{if(!api)return;const s=await api.getSnapshot();setData(s);if(!periodId&&s.periods[0])setPeriodId(s.periods[0].id);if(!branchId&&s.branches.find(b=>b.active))setBranchId(s.branches.find(b=>b.active).id)};
  useEffect(()=>{refresh();api?.onReminder?.(r=>setToast(`تذكير: ${r.title}`))},[]);
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),3200);return()=>clearTimeout(t)}},[toast]);
  if(!data)return <div className="h-screen grid place-items-center text-slate-500">جاري فتح قاعدة البيانات...</div>;
  const activePeriod=data.periods.find(p=>p.id===periodId)||data.periods[0];
  const nav=[['dashboard','الرئيسية',LayoutDashboard],['periods','الإقرارات الضريبية',ReceiptText],['branches','الفروع',Building2],['accounts','دليل الحسابات',ListTree],['reports','نموذج VAT',FileBarChart2],['attachments','المرفقات',Paperclip],['history','سجل التعديلات',History],['settings','الإعدادات والنسخ الاحتياطي',Settings]];
  return <div className="h-screen flex flex-col bg-[#eef2f6]" dir="rtl">
    <TitleBar/>
    <div className="flex flex-1 min-h-0">
    <aside className="w-[238px] shrink-0 bg-[#1d2f45] text-white p-4 flex flex-col shadow-xl">
      <div className="flex items-center gap-3 px-2 py-3 mb-5"><div className="w-11 h-11 rounded-2xl bg-white/10 grid place-items-center border border-white/15"><span className="font-black text-lg">VAT</span></div><div><div className="font-bold">مدير الإقرارات</div><div className="text-xs text-white/55">ضريبة القيمة المضافة</div></div></div>
      <div className="space-y-1">{nav.map(([id,label,Icon])=><button key={id} onClick={()=>setPage(id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${page===id?'bg-white text-[#163b42] shadow':'text-white/75 hover:bg-white/10 hover:text-white'}`}><Icon size={18}/>{label}</button>)}</div>
      <div className="mt-auto text-xs text-white/45 px-2 leading-6">قاعدة البيانات<br/><span className="text-white/70 break-all">{data.dataFolder}</span></div>
    </aside>
    <main className="flex-1 min-w-0">
      <header className="h-[72px] bg-white/80 backdrop-blur border-b border-slate-200 px-7 flex items-center justify-between sticky top-0 z-30">
        <div><h1 className="font-bold text-lg text-slate-800">{nav.find(x=>x[0]===page)?.[1]}</h1><div className="text-xs text-slate-400">إدارة شهرية للفروع وتجهيز نموذج الإقرار</div></div>
        <div className="flex items-center gap-3">{activePeriod&&<select className="input !w-auto !py-2" value={activePeriod.id} onChange={e=>setPeriodId(Number(e.target.value))}>{data.periods.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>}<button className="btn btn-soft flex items-center gap-2" onClick={()=>setPage('periods')}><Plus size={17}/> إقرار جديد</button></div>
      </header>
      <section className="p-6">
        {page==='dashboard'&&<Dashboard data={data} period={activePeriod} setPage={setPage}/>} 
        {page==='periods'&&<Periods data={data} setData={setData} activeId={periodId} setActiveId={setPeriodId} setPage={setPage}/>} 
        {page==='branches'&&<Branches data={data} setData={setData}/>} 
        {page==='accounts'&&<Accounts data={data} setData={setData}/>} 
        {page==='reports'&&<ReturnView data={data} period={activePeriod} setData={setData}/>} 
        {page==='attachments'&&<Attachments data={data} period={activePeriod} setData={setData}/>} 
        {page==='history'&&<HistoryView data={data} period={activePeriod}/>} 
        {page==='settings'&&<SettingsView data={data} setData={setData}/>} 
        {page==='entry'&&<EntryPage data={data} period={activePeriod} branchId={branchId} setBranchId={setBranchId} setData={setData}/>} 
      </section>
    </main>
    {toast&&<div className="fixed left-6 bottom-6 bg-[#1d2f45] text-white px-5 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2"><Bell size={18}/>{toast}</div>}
    </div>
  </div>
}
