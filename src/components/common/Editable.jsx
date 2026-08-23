import React,{useState} from 'react';
export default function Editable({value,onSave}){const [v,setV]=useState(value);return <input className="bg-transparent outline-none border-b border-transparent focus:border-teal-600 w-full" value={v} onChange={e=>setV(e.target.value)} onBlur={()=>v!==value&&onSave(v)} />}
