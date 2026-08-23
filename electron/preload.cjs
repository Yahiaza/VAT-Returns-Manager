const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vatAPI', {
  init: () => ipcRenderer.invoke('vat:init'),
  chooseDataFolder: () => ipcRenderer.invoke('vat:chooseDataFolder'),
  getSnapshot: () => ipcRenderer.invoke('vat:getSnapshot'),
  testDatabase: () => ipcRenderer.invoke('vat:testDatabase'),
  windowMinimize: () => ipcRenderer.send('vat:windowMinimize'),
  windowToggleMaximize: () => ipcRenderer.send('vat:windowToggleMaximize'),
  windowClose: () => ipcRenderer.send('vat:windowClose'),
  saveSetting: (key, value) => ipcRenderer.invoke('vat:saveSetting', { key, value }),
  addBranch: (branch) => ipcRenderer.invoke('vat:addBranch', typeof branch==='string'?{name:branch}:branch),
  addCategory: (name) => ipcRenderer.invoke('vat:addCategory', { name }),
  deleteCategory: (id) => ipcRenderer.invoke('vat:deleteCategory', { id }),
  updateBranch: (branch) => ipcRenderer.invoke('vat:updateBranch', branch),
  deleteBranch: (id) => ipcRenderer.invoke('vat:deleteBranch', { id }),
  addAccount: (account) => ipcRenderer.invoke('vat:addAccount', account),
  updateAccount: (account) => ipcRenderer.invoke('vat:updateAccount', account),
  deleteAccount: (id) => ipcRenderer.invoke('vat:deleteAccount', { id }),
  reorderAccounts: (items) => ipcRenderer.invoke('vat:reorderAccounts', { items }),
  saveBranchCode: (payload) => ipcRenderer.invoke('vat:saveBranchCode', payload),
  createPeriod: (payload) => ipcRenderer.invoke('vat:createPeriod', payload),
  updatePeriod: (payload) => ipcRenderer.invoke('vat:updatePeriod', payload),
  deletePeriod: (id) => ipcRenderer.invoke('vat:deletePeriod', { id }),
  saveEntry: (payload) => ipcRenderer.invoke('vat:saveEntry', payload),
  saveAdjustment: (payload) => ipcRenderer.invoke('vat:saveAdjustment', payload),
  savePayment: (payload) => ipcRenderer.invoke('vat:savePayment', payload),
  saveReminder: (payload) => ipcRenderer.invoke('vat:saveReminder', payload),
  selectAttachments: (periodId) => ipcRenderer.invoke('vat:selectAttachments', { periodId }),
  removeAttachment: (id) => ipcRenderer.invoke('vat:removeAttachment', { id }),
  backup: () => ipcRenderer.invoke('vat:backup'),
  restore: () => ipcRenderer.invoke('vat:restore'),
  exportReport: (payload) => ipcRenderer.invoke('vat:exportReport', payload),
  previewReport: (payload) => ipcRenderer.invoke('vat:previewReport', payload),
  exportPdf: (payload) => ipcRenderer.invoke('vat:exportPdf', payload),
  exportExcel: (payload) => ipcRenderer.invoke('vat:exportExcel', payload),
  onReminder: (callback) => ipcRenderer.on('vat:reminder', (_e, data) => callback(data)),
  updateGetStatus: () => ipcRenderer.invoke('vat:updateGetStatus'),
  updateCheck: () => ipcRenderer.invoke('vat:updateCheck'),
  updateDownload: () => ipcRenderer.invoke('vat:updateDownload'),
  updateInstall: () => ipcRenderer.invoke('vat:updateInstall'),
  updateOpenDownloaded: () => ipcRenderer.invoke('vat:updateOpenDownloaded'),
  onUpdateStatus: (callback) => {
    const handler = (_e, data) => callback(data);
    ipcRenderer.on('vat:updateStatus', handler);
    return () => ipcRenderer.removeListener('vat:updateStatus', handler);
  }
});
