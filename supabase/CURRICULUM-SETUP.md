# Curriculum catalog setup

Use the existing Project SIKAP Supabase project. Do not rerun `setup.sql` or `account-approval.sql` on the current school database.

1. Open Supabase SQL Editor and create a new query.
2. Copy the entire contents of `curriculum-catalog.sql` and run it as the project administrator.
3. Check the result with:

```sql
select * from public.curriculum_settings;
select name from public.curriculum_learning_areas order by sort_order;
select count(*) as competency_entries from public.curriculum_competencies;
```

On a first installation, expect enforcement `false`, nine learning areas, and zero competencies. Re-running the upgrade preserves existing catalog entries and the enforcement setting. It does not delete resources, upload files, reviews, or approvals.

The updated website includes the fixed learning-area and grade selectors, searchable competency selector, a head-only catalog with source review, and coverage monitoring. The SQL does not import a curriculum guide. Keep enforcement off until reviewed catalog entries are available. The upload form uses a verified selection once entries are available. While the catalog is empty and enforcement is off, it retains the required free-text competency field and labels new entries Legacy so uploads remain usable. Enabling enforcement disables that temporary fallback, even if the catalog is empty. No invented competencies are inserted.

## Catalog fields

Each imported JSON entry contains:

- `learning_area`: one of the fixed names in `curriculum_learning_areas`.
- `grade`: `Grade 7`, `Grade 8`, `Grade 9`, or `Grade 10`.
- `quarter`: `Quarter 1` through `Quarter 4`, or null when the source does not assign a quarter.
- `official_code`: the code exactly as printed in the official source, or null if none exists. The UUID `id` is the internal SIKAP reference; do not present it as a DepEd code.
- `competency_text`: exact wording from the guide.
- `curriculum_version`: the source edition/version; the school must confirm that it is applicable.
- `source_title`, `source_url` (HTTPS), `source_page`: enough information to check the entry against its source.

No fictional or demonstration competencies are inserted by this upgrade. Imported entries start as draft even if a caller submits `status: verified`. Only an approved Head Teacher can verify or retire entries through the app RPCs. Verification must follow a real check of the wording, grade, learning area, source/version, quarter when specified, and official code when present. Retire outdated entries rather than rewriting historical mappings.

## App APIs

- `bank_curriculum()`: fixed area names, enforcement state, verified catalog count.
- `bank_competency_list(filters, page_no)`: searchable catalog, 50 entries per page. Filter keys: `grade`, `subject`, `term`, `q`, `status`. Teachers see verified entries only; approved heads also see draft/retired entries.
- `bank_competency_import(entries)`: head-only batch import, up to 500 entries; duplicates are skipped.
- `bank_competency_review(cid, expected_revision, decision, note)`: head-only verification/status change with a source-check note. Decisions: `draft`, `verified`, `retired`.
- `bank_competency_coverage()`: head-only verified catalog coverage and count without an approved resource. `catalog_empty: true` means a zero count must not be interpreted as complete curriculum coverage.
- Existing `bank_save` and `bank_edit` accept `d.competency_id`. The server copies the canonical text, official code, version, and source; submitted text/code cannot override them.
- Existing `bank_list` includes competency ID/code/version and `bank_competency_legacy`; filter key `legacy` accepts `true` or `false`.

The following module fields are added: `bank_competency_id`, `bank_competency_code`, `bank_curriculum_version`, `bank_competency_source`, `bank_competency_legacy`. Existing free-text records remain unchanged and are marked legacy. New version rows capture the mapped competency text/code/source/grade/area/quarter; old versions remain legacy because their historical mapping is unknown.

## Activation after the website update

Only after the new form has been deployed and verified entries exist, run:

```sql
update public.curriculum_settings
set enforce_catalog = true
where singleton;
```

Once enabled, new saves/metadata changes require a verified matching competency; wrong grade, learning area or a specified quarter is rejected. Direct module writes cannot bypass this mapping check. Existing legacy resources remain readable, reviewable and archivable; they require mapping before submitting a new version. The current free-text upload form will no longer be able to save new resources, which is why activation must follow the website update.

If an older form must be restored during rollout, the administrator can set the flag back to false. This is a compatibility switch, not deletion or rollback of catalog data. With the flag off, old free-text writes remain permitted and are labeled legacy; any provided competency ID is still validated.

This upgrade leaves the existing four-item review checklist, approval decisions, PDF/DOCX 20 MB file rules, downloads and archive/restore behavior in place. No survey or research questionnaire tables are created. It does not implement persistent collaboration or expanded media uploads.

## Validation performed

Isolated PostgreSQL tests cover: repeatable upgrade/data preservation; catalog role/RLS protection; canonical mapping and bypass protection; coverage/version snapshots/retirement behavior. The user applied the upgrade. The assistant confirmed the website can read all nine areas, the enforcement flag, the empty catalog and coverage through the live APIs.


## Proposal scope and source list

The proposal calls for a curriculum-aligned JHS resource bank; it does not specify transcribing every DepEd competency or operating a curriculum library. This update therefore supplies all Grades 7–10, the fixed nine learning areas, Quarter 1–4 resource tags, and source-reviewed competency mapping for the resources the school actually develops. It adds no survey or assessment module.

For each of Grades 7, 8, 9 and 10, the learning areas are:

1. Araling Panlipunan
2. English
3. Filipino
4. Mathematics
5. Science
6. Technology and Livelihood Education (TLE)
7. Music and Arts
8. Physical Education and Health
9. Values Education

These names follow the relevant full MATATAG guides linked by the official [DepEd curriculum page](https://www.deped.gov.ph/revised-k-to-10-curriculum/), checked on 25 October 2026. The app links the individual guides. The source editions are 2023; their presence on the official download page does not establish the edition used by a particular school/cohort. Confirm this during verification. Do not mix an old K–12/Edukasyon sa Pagpapakatao/MAPEH catalog into the MATATAG list without an explicit edition/mapping review.

TLE components are ICT, Agriculture and Fishery Arts, Family and Consumer Science, and Industrial Arts; specializations remain under TLE. Music and Arts and Physical Education and Health are separate areas in these guides. GMRC applies to the elementary section of the combined guide; Values Education applies to JHS. Quarter tags are not evidence that the source assigns that quarter: leave an unspecified source quarter null.

### Adding only the competencies the school needs

As an approved head teacher, open Digital Bank → Curriculum catalog. Expand the official guide list, then “Add a competency from a DepEd guide.” Enter the exact wording, grade/area, source edition, URL and PDF page. Enter a code or quarter only when supported by the source. Save as a draft. Open “Review entry,” check it against the guide and the school’s applicable edition, record the source-check note and choose “Verify for uploads.” Teachers can then find it in the upload dropdown. Retire outdated entries rather than changing history.

Prepared JSON imports remain available for the administrator; no complete curriculum import is required for this release. Imports always create drafts, even if a file supplies a verified status. The catalog page and the head-teacher Summary both distinguish an empty catalog from complete coverage.
