import React,{useEffect,useState} from 'react';
import {toDisplayDate,toIsoDate} from '../../utils/date.js';
export default function DateInput({value,onChange,className='input',placeholder='يوم / شهر / سنة',disabled=false}){
  const [text,setText]=useState(toDisplayDate(value));
  useEffect(()=>setText(toDisplayDate(value)),[value]);
  const commit=()=>{const iso=toIsoDate(text);if(iso||!text.trim())onChange?.(iso)};
  return <input disabled={disabled} inputMode="numeric" dir="ltr" className={`${className} date-ddmmyyyy`} placeholder={placeholder} value={text} onChange={e=>setText(e.target.value.replace(/[^0-9/\-]/g,'').slice(0,10))} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){commit();e.currentTarget.blur()}}}/>;
}
