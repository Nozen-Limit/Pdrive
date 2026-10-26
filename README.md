# Project SIKAP

The school workspace uses React, TypeScript, Vite and Material UI, connected to the existing Supabase services. All existing feature screens use the new component layout: authentication, Overview and teacher summary, Digital Bank collections and filters, uploads, resource details and previews, review and revision forms, archive and restore, saved resources, notes, notifications, teacher accounts and profiles.

## Run locally

Use Node.js 22. Install dependencies with `npm ci`, then run `npm run dev`. Open http://127.0.0.1:4175/Pdrive/. If another local preview already uses that port, stop it first.

`npm run build` creates the GitHub Pages site in `docs/`. `npm run preview` serves that build. `npm run check` runs the build, automated tests and formatting checks.

## Data and publishing

The existing public Supabase configuration is preserved during builds. No database migration is needed for this UI update. Database authorization, review checklist, resource version rules, PDF/DOCX uploads with the 20 MB limit, and download behavior continue through the existing services.

Cards have natural heights and bounded widths. Forms, filters, tables and dialogs adapt to available space. The Overview and head-teacher summary read Digital Bank records; drafts and archived items are excluded from submission totals.

The in-memory Collaboration prototype, sample-account switcher and demo assets are excluded from the published site. This update does not implement persistent collaboration or media uploads, and does not delete school accounts or stored resources. The competency catalog remains dependent on verified entries supplied to the database; this UI migration does not populate it.

`app/` contains the current React UI. The retained `src/` services and historical helpers support backend integration and regression tests; the old UI entry points are not loaded by the published site.
