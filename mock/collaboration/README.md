# Local collaboration and media mock

Open the existing website at http://127.0.0.1:4175/Pdrive/. Sign in, open Digital Bank, then Collaboration. The preview mounts inside the existing signed-in workspace. The separate collaboration-preview.html is retained only as a development harness.

Build with `node scripts/build-collaboration-preview.mjs`; serve with `npm run dev`.

This is an interactive, browser-only prototype using sample accounts and resources. It never connects to Supabase. Reloading clears uploads, invitations, comments and decisions. The production website, database and upload policies are unchanged. Nothing is pushed by building this preview.

Try switching Preview as between Tom (owner), Mara (accepted contributor), Jose (another teacher), and Leon (head teacher). Invite Jose from Tom's shared draft; accept from Jose's Invitations; propose a PPTX with its PDF; switch back to Tom to select and submit it; review it as Leon. Approved versions remain available while their next revisions are drafted or reviewed.

Assumptions for this preview:
- Each resource has one owner; only the owner selects the submission package.
- Invitations require acceptance before private drafts become visible.
- Existing approved resource versions remain available during revision.
- PDF, DOCX and PPTX allow 20 MB per file. Each PPTX requires a separate PDF review copy in the same version. Reviewers must verify that both files correspond.
- Proposed media limits are MP4: 100 MB / 10 minutes; MP3: 25 MB / 20 minutes. These can be tried using File limits in the mock. Real deployment requires matching storage and server limits.
- Media recording permission is required; transcripts and WebVTT video captions are optional in this preview.
- Downloads can be opened offline; the website is not an offline media library.
- No simultaneous document editing. Contributions are comments and separate proposed files.

Before production: implement persisted collaboration tables, accepted-invitation access policies, immutable submission file sets, authorized storage, server-side file validation and media limits, and test real multi-account access. The mock's client-side permissions are demonstrations, not production security.

The generated slide and matching PDF are local sample fixtures. Video and audio playback examples link to MDN sample media and require a network connection. PDF.js is copied from the installed npm development dependency for local PDF rendering; retain its upstream license when distributing.

Published preview: Collaboration is also available on https://nozen-limit.github.io/Pdrive/. It uses sample accounts and in-memory data. On the hosted site, sample resources are included in the Digital Bank list only after opening Collaboration in that tab. Real school records are never changed by preview actions.
