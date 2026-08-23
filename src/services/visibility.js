export function normalizeVisibilityIds(account){
  if(Array.isArray(account?.visibility_category_ids)) return account.visibility_category_ids.map(Number).filter(Number.isFinite);
  return account?.visibility_category_id ? [Number(account.visibility_category_id)] : [];
}
export function accountVisibleForCategory(account,categoryId){
  const ids=normalizeVisibilityIds(account);
  return ids.length===0 || ids.includes(Number(categoryId));
}
export function accountVisibleForBranch(account,branch){
  const ids=normalizeVisibilityIds(account);
  if(ids.length===0)return true;
  return branch?.category_id!=null && ids.includes(Number(branch.category_id));
}
