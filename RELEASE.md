# Release and maintenance

## Source structure

- `src/ui/`: authentication, profiles, account review, modules, notes and reports.
- `src/frontend.js`: shared state, navigation and page shell.
- `src/backend.js`: Supabase operations and file validation.
- `src/lib/docx.js`: bounded DOCX text extraction, shared by upload validation and previews.
- `supabase/`: database migrations and access rules.
- `docs/`: generated GitHub Pages assets. Build from source; preserve `docs/config.js`.

The build combines the interface files into one versioned browser asset to prevent mismatched helper versions after deployment.

## Before publishing

1. Run `npm ci`, `npm run check` and `npm audit --omit=dev --audit-level=moderate`.
2. Verify separate Teacher and Head Teacher accounts against the school database: submit, return with feedback, revise and approve. Check assignment deadlines and teacher profiles.
3. Verify a teacher cannot read another teacher's files or change their role. Automated database tests cover these permissions locally; live checks also verify the deployed configuration.
4. Commit source and generated `docs` together. Push `main`; wait for the Pages deployment before sharing.

## Current service choices

Supabase's default email sender remains enabled by request. Delivery restrictions apply to signup confirmation and password recovery. Configure a school SMTP provider when wider invitations are needed.

Profile pictures use the private `sikap-avatars` bucket. Approved users upload only their own picture; its owner and approved Head Teachers can view it. The migration is `supabase/profile-pictures.sql`.

## Operations

Keep database backups and private storage backups under school administration. Verify the project's backup coverage and rehearse restoration before relying on it for the only copy of school records. Database backups alone do not establish that uploaded files are backed up.

Do not expose administrator keys in browser configuration. Review unreferenced uploads before any administrator cleanup; the application does not automatically delete immutable documents. Uploaded documents are not malware-scanned.

To roll back an interface release, restore source and generated assets from a known working commit and rebuild. Do not reverse database migrations by dropping tables or storage buckets containing school records.

## Profile picture read correction

If a saved profile picture reports Object not found, run `supabase/fix-profile-photo-read.sql` in Supabase SQL Editor after the profile-picture migration. It corrects the correlated storage object name in the private read policy. The picture owner and approved Head Teachers can read it; other Teachers cannot. It preserves existing files and accounts. Reload Profile and choose Retry after applying it.
