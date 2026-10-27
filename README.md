# Project SIKAP

The school workspace uses React, TypeScript, Vite and Material UI, connected to the existing Supabase services. All existing feature screens use the new component layout: authentication, Overview and teacher summary, Digital Bank collections and filters, uploads, resource details and previews, review and revision forms, archive and restore, saved resources, notes, notifications, teacher accounts and profiles.

## Run locally

Use Node.js 22. Install dependencies with `npm ci`, then run `npm run dev`. Open http://127.0.0.1:4175/Pdrive/. If another local preview already uses that port, stop it first.

`npm run build` creates the GitHub Pages site in `docs/`. `npm run preview` serves that build. `npm run check` runs the build, automated tests and formatting checks.

## Data and publishing

The existing public Supabase configuration is preserved during builds. The restored desktop layout uses the existing database. Persistent Collaboration additionally requires `supabase/collaboration.sql`, applied after the existing curriculum setup. Database authorization, review checklist, resource version rules, PDF/DOCX uploads with the 20 MB limit, and download behavior continue through the existing services.

Desktop navigation restores Home, Digital Bank, Collaboration, Recent, category shortcuts and Workspace groups. Desktop Digital Bank search is in the top bar, with sorting beside the list controls; mobile retains its compact layout. Category card counts come from saved approved resources. Cards have natural heights and bounded widths. Forms, filters, tables and dialogs adapt to available space. The Overview and head-teacher summary read Digital Bank records; drafts and archived items are excluded from submission totals.

The in-memory Collaboration prototype, sample-account switcher and demo assets are excluded from the published site. Collaboration now uses database-backed invitations, discussion, verified file proposals, owner selection and immutable contributor credits. Only owners submit selected revisions; the existing head-teacher checklist and approval flow apply. Accepted contributors appear in Digital Bank cards, rows and details. Without the collaboration migration, the page reports setup required and never falls back to fake or local-only data. Media upload formats are not expanded, and no school accounts or stored resources are deleted. The competency catalog remains dependent on verified entries supplied to the database; this UI migration does not populate it.

`app/` contains the current React UI. The retained `src/` services and historical helpers support backend integration and regression tests; the old UI entry points are not loaded by the published site.


Authentication preserves the original login markup, styles, palette chooser, registration page, recovery page and animated particle book in an isolated document. Only the successful sign-in handoff connects it to the React workspace; credentials stay with the existing backend client.
