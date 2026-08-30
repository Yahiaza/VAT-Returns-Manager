import React,{useEffect} from 'react';
import {AlertTriangle,X} from 'lucide-react';
export default function ConfirmDialog({open,title,message,confirmText='تأكيد',cancelText='إلغاء',danger=false,onConfirm,onCancel}){
  useEffect(()=>{if(!open)return;const onKey=e=>{if(e.key==='Escape'){e.preventDefault();onCancel?.()}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[open,onCancel]);
  if(!open)return null;
  return <div className="system-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onCancel?.()}>
    <div className="system-modal" role="dialog" aria-modal="true">
      <button className="system-modal-close" onClick={onCancel}><X size={18}/></button>
      <div className={`system-modal-icon ${danger?'danger':'warning'}`}><AlertTriangle size={24}/></div>
      <div className="system-modal-body"><h3>{title}</h3><p>{message}</p></div>
      <div className="system-modal-actions"><button className="btn btn-soft" onClick={onCancel}>{cancelText}</button><button className={`btn ${danger?'btn-danger-solid':'btn-primary'}`} onClick={onConfirm}>{confirmText}</button></div>
    </div>
  </div>
}
