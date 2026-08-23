import {accountVisibleForBranch} from './visibility.js';
export function aggregateBranchTotals(data,period){
  if(!period)return {sales15:0,sales0:0,purchase15:0,purchase0:0};
  // Use the exact same branch-aware calculation used by the entry screen and
  // the "إجمالي الفروع" preview. This is important after visibility categories
  // became multi-select: raw entry summing can include stale/hidden account
  // values and make the VAT form differ from the totals the user actually sees.
  return data.branches.filter(b=>b.active).map(b=>branchMetrics(data,period,b.id)).reduce((acc,m)=>({
    sales15:acc.sales15+m.sales15,
    sales0:acc.sales0+m.sales0,
    purchase15:acc.purchase15+m.purchase15,
    purchase0:acc.purchase0+m.purchase0
  }),{sales15:0,sales0:0,purchase15:0,purchase0:0});
}

export function defaultVatBox(account,rateType){
  if(account?.section==='sales') return rateType==='15'?1:3;
  return rateType==='15'?7:10;
}
export function effectiveVatBox(data,branchId,account,rateType){
  const code=data.codes.find(c=>c.branch_id===branchId&&c.account_id===account.id)||{};
  const raw=rateType==='15'?code.vat_box_15:code.vat_box_0;
  if(raw===-1 || raw==='-1')return null;
  if(raw!==null && raw!==undefined && raw!=='')return Number(raw);
  return defaultVatBox(account,rateType);
}
export function calculateVatBoxes(data,period){
  const boxes=Object.fromEntries([1,2,3,4,5,7,8,9,10,11].map(n=>[n,{value:0,tax:0,mappedValue:0,mappedTax:0}]));
  if(!period)return boxes;
  const rate=Number(period.tax_rate||15)/100;
  const taxableBoxes=new Set([1,2,7,8,9]);
  for(const branch of data.branches.filter(b=>b.active)){
    const accounts=data.accounts.filter(a=>a.active&&accountVisibleForBranch(a,branch));
    for(const account of accounts){
      for(const rateType of ['15','0']){
        const entry=data.entries.find(e=>e.period_id===period.id&&e.branch_id===branch.id&&e.account_id===account.id&&e.rate_type===rateType);
        const amount=Number(entry?.total||0); if(!amount)continue;
        const box=effectiveVatBox(data,branch.id,account,rateType); if(!box||!boxes[box])continue;
        boxes[box].mappedValue+=amount;
        if(taxableBoxes.has(box)) boxes[box].mappedTax+=amount*rate;
      }
    }
  }
  for(const n of Object.keys(boxes).map(Number)){
    const adj=data.adjustments.find(x=>x.period_id===period.id&&Number(x.box_no)===n)||{};
    boxes[n].value=boxes[n].mappedValue+Number(adj.value||0);
    boxes[n].tax=boxes[n].mappedTax+Number(adj.tax_value||0);
  }
  return boxes;
}
export function calcTotals(data,period){
  if(!period)return {sales15:0,sales0:0,purchase15:0,purchase0:0,outputTax:0,inputTax:0,net:0};
  const core=aggregateBranchTotals(data,period);
  const boxes=calculateVatBoxes(data,period);
  const outputTax=[1,2,3,4,5].reduce((s,n)=>s+Number(boxes[n]?.tax||0),0);
  const inputTax=[7,8,9,10,11].reduce((s,n)=>s+Number(boxes[n]?.tax||0),0);
  const correctionTax=Number(data.adjustments.find(x=>x.period_id===period.id&&Number(x.box_no)===14)?.tax_value||0);
  return {...core,outputTax,inputTax,net:outputTax-inputTax+correctionTax};
}
export function branchMetrics(data,period,branchId){
  const rate=Number(period?.tax_rate||15)/100;
  const branch=data.branches.find(b=>b.id===branchId);
  const accounts=data.accounts.filter(a=>a.active&&accountVisibleForBranch(a,branch));
  const getTotal=(accountId,rateType)=>Number(data.entries.find(e=>e.period_id===period?.id&&e.branch_id===branchId&&e.account_id===accountId&&e.rate_type===rateType)?.total||0);
  const sum=(section,rateType)=>accounts.filter(a=>a.section===section).reduce((total,a)=>total+getTotal(a.id,rateType),0);
  const sales15=sum('sales','15'),sales0=sum('sales','0'),purchase15=sum('purchase','15'),purchase0=sum('purchase','0');
  const outputTax=sales15*rate,inputTax=purchase15*rate;
  return {sales15,sales0,purchase15,purchase0,outputTax,inputTax,netTax:outputTax-inputTax};
}
