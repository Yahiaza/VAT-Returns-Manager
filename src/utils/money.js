export const fmt = n => new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n||0));
export const negativeClass = n => Number(n||0) < 0 ? 'negative-number' : '';
export const normalizeDigits = value => String(value ?? '')
  .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
  .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
  .replace(/٫/g,'.').replace(/٬/g,',');
export const cleanNum = v => Number(normalizeDigits(v).replace(/,/g,''))||0;
export const parseExpression = raw => normalizeDigits(raw).split('+').map(x=>x.trim().replace(/,/g,'')).filter(Boolean).map(Number).filter(Number.isFinite);
export const expressionTotal = v => parseExpression(v).reduce((s,n)=>s+n,0);
export const formatEditableAmount = value => {
  let s=normalizeDigits(value).replace(/[^0-9.,-]/g,'').replace(/,/g,''); const negative=s.startsWith('-'); s=s.replace(/-/g,'');
  const dot=s.indexOf('.'); let integer=dot>=0?s.slice(0,dot):s; let decimal=dot>=0?s.slice(dot+1).replace(/\./g,''):null;
  integer=integer.replace(/^0+(?=\d)/,''); if(integer==='')integer='0'; integer=integer.replace(/\B(?=(\d{3})+(?!\d))/g,','); if(decimal!==null)decimal=decimal.slice(0,2);
  return `${negative?'-':''}${integer}${decimal!==null?'.'+decimal:''}`;
};
export const formatEditableExpression = raw => normalizeDigits(raw).replace(/[^0-9.,+\-]/g,'').split('+').map(part=>formatEditableAmount(part)).join(' + ');
export const expressionForDisplay = raw => normalizeDigits(raw).split('+').map(x=>x.trim()).filter(Boolean).map(x=>{const n=Number(x.replace(/,/g,''));return Number.isFinite(n)?fmt(n):x}).join(' + ');
