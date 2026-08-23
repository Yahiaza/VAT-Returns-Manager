import { api } from './api.js';

export const updateService = {
  getStatus: () => api?.updateGetStatus?.(),
  check: () => api?.updateCheck?.(),
  download: () => api?.updateDownload?.(),
  install: () => api?.updateInstall?.(),
  subscribe: (callback) => api?.onUpdateStatus?.(callback)
};

export function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);
  if (!value) return '0 MB';
  const mb = value / 1024 / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}
