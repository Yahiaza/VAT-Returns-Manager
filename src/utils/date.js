export function toDisplayDate(value){
  if(!value)return '';
  const s=String(value).trim();
  const iso=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso)return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d=new Date(s);
  if(Number.isNaN(d.getTime()))return s;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
export function toIsoDate(value){
  if(!value)return '';
  const s=String(value).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if(!m)return '';
  const d=Number(m[1]),mo=Number(m[2]),y=Number(m[3]);
  const test=new Date(y,mo-1,d);
  if(test.getFullYear()!==y||test.getMonth()!==mo-1||test.getDate()!==d)return '';
  return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
export function toDisplayDateTime(value){
  if(!value)return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return String(value);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
export function localDateTimeToIso(value){
  if(!value)return '';
  const m=String(value).trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\s+(\d{1,2}):(\d{2})$/);
  if(!m)return '';
  const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),Number(m[4]),Number(m[5]),0,0);
  return Number.isNaN(d.getTime())?'':d.toISOString();
}
