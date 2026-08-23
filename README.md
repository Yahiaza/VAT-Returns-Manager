# VAT Returns Manager 0.2.0

نسخة إعادة هيكلة للمشروع بدون تغيير قاعدة البيانات أو صيغة ملف `vat-returns.db`.

## الهيكل
- `src/app`: هيكل التطبيق والثوابت.
- `src/pages`: كل شاشة في ملف مستقل.
- `src/components`: العناصر المشتركة والـ Title Bar.
- `src/services`: API، حسابات VAT، التقارير، وتصنيفات الظهور.
- `src/utils`: تنسيق وتجميع المبالغ.
- `electron/database/store.cjs`: فتح SQLite، migrations، snapshot، واختبار السلامة.
- `electron/main.cjs`: دورة حياة Electron وIPC والتقارير/الملفات.
- `tests/database.test.cjs`: اختبار قاعدة بيانات مستقل بعد تثبيت الحزم.

## التشغيل
```powershell
npm install
npm run dev
```

## اختبار قاعدة البيانات
من داخل البرنامج: الإعدادات والنسخ الاحتياطي → **اختبار سلامة قاعدة البيانات**.

أو من Terminal بعد `npm install`:
```powershell
npm run test:db
```

الاختبار يتحقق من migrations، الحفظ وإعادة الفتح، الكسور العشرية، بيانات الفرع، تصنيفات الظهور، وربط حساب ببند VAT.

## Version 0.3.0 — Setup + Auto Update

- Added NSIS per-user Setup build without requiring a machine-wide install.
- Added automatic update checks for installed Setup versions.
- Added manual update controls and download progress under Settings.
- Update source: `Yahiaza/VAT-Returns-Updates` (public releases only).
- Portable build remains available and uses manual updates.
- Added GitHub Actions release workflow; source repository needs `UPDATE_REPO_TOKEN` secret scoped only to the updates repository.
