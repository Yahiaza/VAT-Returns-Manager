import React,{useEffect,useState} from 'react';
import {RefreshCw,Download,RotateCcw,CheckCircle2,AlertTriangle,PackageOpen} from 'lucide-react';
import {updateService,formatBytes} from '../../services/updateService.js';

const statusText={
  idle:'جاهز للتحقق', checking:'جاري التحقق', available:'تحديث متاح', downloading:'جاري التنزيل',
  downloaded:'جاهز للتثبيت', installing:'جاري التثبيت', 'up-to-date':'أحدث إصدار',
  error:'خطأ', unsupported:'غير مدعوم', dev:'وضع التطوير'
};

export default function UpdatePanel(){
  const [u,setU]=useState({status:'idle',currentVersion:'...',progress:0,supported:false});
  useEffect(()=>{
    updateService.getStatus?.().then(r=>r&&setU(r));
    const off=updateService.subscribe?.(setU);
    return()=>off?.();
  },[]);
  const busy=['checking','downloading','installing'].includes(u.status);
  const pct=Math.max(0,Math.min(100,Number(u.progress||0)));
  return <div className="card p-5 col-span-2">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-700 grid place-items-center"><PackageOpen size={22}/></div>
        <div><h3 className="font-bold">تحديثات البرنامج</h3><div className="text-xs text-slate-400 mt-1">المصدر: Yahiaza/VAT-Returns-Updates</div></div>
      </div>
      <div className="text-left"><div className="text-xs text-slate-400">الإصدار الحالي</div><div className="font-black text-lg money">v{u.currentVersion||'...'}</div></div>
    </div>

    <div className={`mt-4 rounded-xl border p-4 ${u.status==='error'?'bg-red-50 border-red-200':u.status==='downloaded'?'bg-emerald-50 border-emerald-200':'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          {u.status==='error'?<AlertTriangle size={17} className="text-red-600"/>:<CheckCircle2 size={17} className="text-emerald-600"/>}
          {statusText[u.status]||u.status}
        </div>
        {u.availableVersion&&<span className="text-xs bg-white border rounded-lg px-2 py-1">الإصدار المتاح v{u.availableVersion}</span>}
      </div>
      <div className="text-xs text-slate-600 mt-2">{u.message||'يمكنك التحقق يدويًا من وجود إصدار أحدث.'}</div>
      {u.status==='downloading'&&<div className="mt-3">
        <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-sky-600 transition-all" style={{width:`${pct}%`}}/></div>
        <div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>{pct.toFixed(0)}%</span><span>{formatBytes(u.transferred)} / {formatBytes(u.total)}</span></div>
      </div>}
      {u.releaseNotes&&<details className="mt-3 text-xs"><summary className="cursor-pointer font-bold text-slate-600">ملاحظات الإصدار</summary><pre className="whitespace-pre-wrap font-[inherit] mt-2 text-slate-600">{u.releaseNotes}</pre></details>}
    </div>

    <div className="flex flex-wrap gap-2 mt-4">
      <button className="btn btn-soft" disabled={busy} onClick={()=>updateService.check()}><RefreshCw size={16} className={`inline ml-1 ${u.status==='checking'?'animate-spin':''}`}/>التحقق من التحديثات</button>
      {u.status==='available'&&<button className="btn btn-primary" onClick={()=>updateService.download()}><Download size={16} className="inline ml-1"/>تنزيل التحديث</button>}
      {u.status==='downloaded'&&<button className="btn btn-primary" onClick={()=>updateService.install()}><RotateCcw size={16} className="inline ml-1"/>إعادة التشغيل والتحديث</button>}
    </div>
    {!u.supported&&<div className="text-[11px] text-slate-400 mt-3">ملاحظة: التحديث الذاتي يعمل في نسخة Setup المثبتة. نسخة Portable تظل متاحة للتحديث اليدوي.</div>}
  </div>
}
