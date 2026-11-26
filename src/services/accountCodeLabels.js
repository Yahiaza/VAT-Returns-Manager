export const DEFAULT_ACCOUNT_CODE_LABELS = {
  short: 'مسلسل',
  program: 'كود البرنامج',
  short15: 'مسلسل - 15%',
  program15: 'كود البرنامج 15%',
  short0: 'مسلسل - 0%',
  program0: 'كود البرنامج 0%',
};

export function accountCodeLabels(settings) {
  let saved;
  try {
    saved = JSON.parse(settings.accountCodeLabels || '{}');
  } catch {
    saved = {};
  }
  return Object.fromEntries(Object.entries(DEFAULT_ACCOUNT_CODE_LABELS).map(([key, label]) => {
    const override = saved?.[key];
    return [key, typeof override === 'string' && override.trim() ? override.trim() : label];
  }));
}
