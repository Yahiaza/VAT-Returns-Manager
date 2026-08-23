import React,{useEffect,useState} from 'react';
import {Plus,Trash2,GripVertical,ChevronDown,X} from 'lucide-react';
import {api} from '../../services/api.js';
import {accountVisibleForCategory,normalizeVisibilityIds} from '../../services/visibility.js';
import Editable from '../../components/common/Editable.jsx';
function VisibilityPicker({categories,value,onChange,compact=false}){
  const [open,setOpen]=useState(false);
  const ids=Array.isArray(value)?value.map(Number):[];
  const all=ids.length===0;
  const toggle=id=>{const n=Number(id);const next=ids.includes(n)?ids.filter(x=>x!==n):[...ids,n];onChange(next)};
  const label=all?'جميع الفروع':ids.map(id=>categories.find(c=>Number(c.id)===id)?.name).filter(Boolean).join('، ')||'اختر التصنيف';
  return <div className={`visibility-picker ${open?'is-open':''}`}>
    <button type="button" className={compact?'visibility-trigger compact':'visibility-trigger'} onClick={()=>setOpen(v=>!v)} title={label}><span className="truncate">{label}</span><ChevronDown size={15}/></button>
    {open&&<><button className="visibility-backdrop" aria-label="إغلاق" onClick={()=>setOpen(false)}></button><div className="visibility-menu">
      <button type="button" className="visibility-option" onClick={()=>onChange([])}><span className={`check-box ${all?'checked':''}`}>{all?'✓':''}</span><span>جميع الفروع</span></button>
      <div className="visibility-separator"></div>
      {categories.map(c=>{const checked=ids.includes(Number(c.id));return <button type="button" className="visibility-option" key={c.id} onClick={()=>toggle(c.id)}><span className={`check-box ${checked?'checked':''}`}>{checked?'✓':''}</span><span>{c.name}</span></button>})}
      <div className="visibility-menu-footer"><span>{all?'يظهر في كل التصنيفات':`${ids.length} تصنيف محدد`}</span><button type="button" onClick={()=>setOpen(false)}>تم</button></div>
    </div></>}
  </div>
}

export default function Accounts({data,setData}){
  const [branchId,setBranchId]=useState(data.branches.find(b=>b.active)?.id||0);
  const [section,setSection]=useState('purchase');
  const [name,setName]=useState('');
  const [categoryName,setCategoryName]=useState('');
  const [visibility,setVisibility]=useState([]);
  const [drag,setDrag]=useState(null);
  const categories=data.categories||[];
  const sectionAccounts=data.accounts.filter(a=>a.active&&a.section===section);
  const groups=[{id:'all',name:'جميع الفروع'},...categories.map(c=>({id:String(c.id),name:c.name}))];
  const code=(a)=>data.codes.find(c=>c.branch_id===branchId&&c.account_id===a.id)||{};
  const add=async()=>{if(!name.trim())return;setData(await api.addAccount({name,section,visibilityCategoryIds:visibility}));setName('');setVisibility([])};
  const addCategory=async()=>{if(!categoryName.trim())return;setData(await api.addCategory(categoryName));setCategoryName('')};
  const drop=async(target)=>{if(!drag||drag.id===target.id)return;const arr=[...sectionAccounts];const from=arr.findIndex(x=>x.id===drag.id),to=arr.findIndex(x=>x.id===target.id);arr.splice(to,0,arr.splice(from,1)[0]);setData(await api.reorderAccounts(arr));setDrag(null)};
  return <div className="space-y-5">
    <div className="grid grid-cols-[1fr_410px] gap-5">
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <select className="input !w-64" value={branchId} onChange={e=>setBranchId(Number(e.target.value))}>{data.branches.filter(b=>b.active).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <button className={`btn ${section==='purchase'?'btn-primary':'btn-soft'}`} onClick={()=>setSection('purchase')}>المشتريات / المصروفات</button>
        <button className={`btn ${section==='sales'?'btn-primary':'btn-soft'}`} onClick={()=>setSection('sales')}>الإيرادات / المبيعات</button>
      </div>
      <div className="card p-4">
        <div className="text-xs font-bold text-slate-500 mb-2">تصنيفات الظهور</div>
        <div className="flex gap-2"><input className="input !py-2" placeholder="مثال: بصريات، تجهيزات، تجارية" value={categoryName} onChange={e=>setCategoryName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCategory()}/><button className="btn btn-soft !py-2" onClick={addCategory}><Plus size={16}/></button></div>
        <div className="flex flex-wrap gap-1.5 mt-2">{categories.map(c=><span className="category-chip" key={c.id}>{c.name}<button title="حذف التصنيف" onClick={async()=>setData(await api.deleteCategory(c.id))}><X size={12}/></button></span>)}</div>
      </div>
    </div>
    <div className="card p-4 flex gap-2 items-end">
      <div className="flex-1"><label className="tiny-label">البيان</label><input className="input" placeholder="إضافة حساب جديد" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()}/></div>
      <div className="w-80"><label className="tiny-label">تصنيف الظهور — يمكن اختيار أكثر من تصنيف</label><VisibilityPicker categories={categories} value={visibility} onChange={setVisibility}/></div>
      <button className="btn btn-primary h-[45px]" onClick={add}><Plus size={17} className="inline ml-1"/>إضافة</button>
    </div>
    <div className="space-y-4">
      {groups.map((g,idx)=>{
        const rows=sectionAccounts.filter(a=>{const ids=normalizeVisibilityIds(a);return g.id==='all'?ids.length===0:ids.includes(Number(g.id))});
        if(!rows.length)return null;
        return <div className={`account-group-card account-group-tone-${idx%5}`} key={g.id}>
          <div className="account-group-header"><div><div className="font-extrabold">{g.name}</div><div className="text-xs opacity-70 mt-1">{rows.length} حساب — {section==='purchase'?'المشتريات / المصروفات':'الإيرادات / المبيعات'}</div></div><span className="category-count">{rows.length}</span></div>
          <div className="overflow-visible rounded-b-[10px]"><table className="table w-full text-sm"><thead><tr><th className="w-10"></th><th>البيان</th><th>الكود المختصر لهذا الفرع</th><th>كود البرنامج لهذا الفرع</th><th className="w-40">ترحيل 15% إلى VAT</th><th className="w-40">ترحيل 0% إلى VAT</th><th className="w-[260px]">تصنيف الظهور</th><th className="w-12"></th></tr></thead><tbody>{rows.map(a=><tr key={a.id} draggable onDragStart={()=>setDrag(a)} onDragOver={e=>e.preventDefault()} onDrop={()=>drop(a)}><td className="text-slate-300 cursor-grab"><GripVertical size={18}/></td><td><Editable value={a.name} onSave={async v=>setData(await api.updateAccount({...a,name:v}))}/></td><td><CodeInput value={code(a).short_code||''} onSave={async v=>setData(await api.saveBranchCode({branchId,accountId:a.id,shortCode:v,programCode:code(a).program_code||'',vatBox15:code(a).vat_box_15,vatBox0:code(a).vat_box_0}))}/></td><td><CodeInput value={code(a).program_code||''} onSave={async v=>setData(await api.saveBranchCode({branchId,accountId:a.id,shortCode:code(a).short_code||'',programCode:v,vatBox15:code(a).vat_box_15,vatBox0:code(a).vat_box_0}))}/></td><td><VatBoxSelect section={a.section} rateType="15" value={code(a).vat_box_15} onChange={async v=>setData(await api.saveBranchCode({branchId,accountId:a.id,shortCode:code(a).short_code||'',programCode:code(a).program_code||'',vatBox15:v,vatBox0:code(a).vat_box_0}))}/></td><td><VatBoxSelect section={a.section} rateType="0" value={code(a).vat_box_0} onChange={async v=>setData(await api.saveBranchCode({branchId,accountId:a.id,shortCode:code(a).short_code||'',programCode:code(a).program_code||'',vatBox15:code(a).vat_box_15,vatBox0:v}))}/></td><td><VisibilityPicker compact categories={categories} value={normalizeVisibilityIds(a)} onChange={async ids=>setData(await api.updateAccount({...a,visibility_category_ids:ids}))}/></td><td><button className="text-red-600" onClick={async()=>setData(await api.deleteAccount(a.id))}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>
        </div>
      })}
    </div>
  </div>
}
function VatBoxSelect({section,rateType,value,onChange}){
  const sales=[[1,'1 — المبيعات بالنسبة الأساسية'],[2,'2 — تتحمل الدولة ضريبتها'],[3,'3 — المبيعات صفرية'],[4,'4 — الصادرات'],[5,'5 — المبيعات المعفاة']];
  const purchases=[[7,'7 — المشتريات بالنسبة الأساسية'],[8,'8 — استيرادات مدفوعة'],[9,'9 — احتساب عكسي'],[10,'10 — مشتريات صفرية'],[11,'11 — مشتريات معفاة']];
  const def=section==='sales'?(rateType==='15'?1:3):(rateType==='15'?7:10);
  return <select className="table-select !min-w-[150px]" value={value??''} onChange={e=>onChange(e.target.value===''?null:Number(e.target.value))}><option value="">تلقائي — بند {def}</option><option value={-1}>لا يتم الترحيل</option>{(section==='sales'?sales:purchases).map(([n,l])=><option key={n} value={n}>{l}</option>)}</select>
}
function CodeInput({value,onSave}){const [v,setV]=useState(value);useEffect(()=>setV(value),[value]);return <input className="input !py-2 money" value={v} onChange={e=>setV(e.target.value)} onBlur={()=>v!==value&&onSave(v)} />}

