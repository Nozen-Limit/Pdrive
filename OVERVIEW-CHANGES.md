# Focused Overview update

Run `npm run build` and `npm run dev`, then open http://127.0.0.1:4175/Pdrive/.

- Removed Requirements, Submit Module, and My/All Modules from the general and Digital Bank sidebars. New and the upload shortcut open the existing Digital Bank upload form.
- Kept the original Overview shell, palette, spacing, board cards, status tabs, search, filters, list view, pinned notes and account controls.
- Overview now loads Digital Bank submissions, using the existing authorized `bank_list` API: `mine` for teachers, `all` for heads. Every page is fetched before displaying totals. Errors show a retry action, without substituting old workspace modules or partial totals.
- Cards, list rows and resource updates open the same Digital Bank details and downloads. Returning to Overview reloads the bank data. The old Requirements panel is replaced by Digital Bank submission counts, in the same panel style.
- Head teachers have **Overview → Summary** for submitted/approved/pending/returned counts per teacher and approved counts per learning area. These counts are independent of the board's search/status filters. Approved teachers with no submissions appear with zero counts. Names are grouped by account ID, so teachers with matching names remain separate.
- Head teachers can archive a resource from an Overview card/list or its Digital Bank details. **Archived resources** opens the archive; its resource menu/detail provides Restore. Archiving preserves files, versions, attribution and reviews. Restoring retains the previous review status; only approved resources reappear in the shared bank. Overview and archive lists refresh after the action. Teachers cannot archive or restore resources.

Definitions: submitted counts current non-draft, non-archived resources once each; pending includes resubmissions. Learning-area rows use the actual bank's area names, including areas with only pending/returned resources (zero approved). Accounts with submitted resources are included even if no longer in the approved-teacher list. Counts describe current statuses, not review events or versions.

No new database migration, curriculum catalog, competency validation or separate monitoring/preview site is required. Database functions, upload rules, review checklist, approval workflow and downloads are the originals from the ZIP. This version is in `Pdrive-site/Pdrive-main`; earlier work remains separate in `Pdrive-local`.

The summary reads all currently authorized resource pages. Very large banks will take longer to load; refresh after concurrent submissions/reviews to see the latest totals.
