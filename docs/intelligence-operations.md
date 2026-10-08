# Cluefy Information Architecture — Blueprint v3

Implementation source: `Cluefy_Information_Architecture_Media_Intelligence_Blueprint_v3.docx`.

## Navigation and lifecycle

The government workspace follows the v3 structure:

- Overview, with the existing Analisis Kecamatan and Demografi & Bahasa preserved as views inside it.
- Public Intelligence: Aspirasi Warga → Isu Daerah → Findings → Cases → Kinerja Layanan.
- Media Intelligence: one Media Monitoring menu with Ringkasan, Berita & Postingan, Media & Akun, Pencarian, Analitik, Peta & Relasi, and Tren tabs.
- Leadership Intelligence: Citra Kepala Daerah with actor selection and the distinction between an actor being mentioned and being the target of sentiment.
- Data & System: Sumber Data; Settings and Help Center remain utility actions.

Evidence, WhatsApp distribution, Action, Impact, Video Analysis, network analysis, and entity relationships remain contextual features rather than standalone sidebar menus.

## Public and media intelligence

Aspirasi Warga remains a content explorer and now exposes source classification, primary filters, and advanced contextual filters. Isu Daerah is the aggregation layer and links to conversations, Findings, Cases, and Media Monitoring. A Finding is a synthesis of recurring, related information across multiple aspirations and source signals; it is not a copy of one post. The Decision Room exposes Related Aspirasi separately from evidence provenance so users can understand how single information becomes a multiple-source Finding.

The Finding model retains evidence provenance, original AI output, immutable human corrections, review decisions, and before/after audit snapshots. Distribution and AI-assisted communication drafts point to the exact approved revision. Analysts can add a Finding to a Watchlist without changing its severity or validation state. Approved Findings can be monitored, broadcast internally, escalated into Cases, or used to draft a press release, talking points, and a social media brief. The seeded golden-path Finding combines three evidence records and labels controlled demo evidence separately from the official Kabupaten Badung source.

Media Monitoring uses the same Badung issue vocabulary and period shown elsewhere in the demo. One content record links to an official Kabupaten Badung page. Other illustrative reach, engagement, trend, and content records are labeled as controlled demo data and do not claim complete internet coverage.

## Cases and service performance

Cases contain Primary OPD, collaborating OPDs, workflow stages, SLA, related Findings/evidence, Actions, Timeline, and Impact. The seeded transport case uses a Dishub workflow.

Kinerja Layanan is an analytics layer over cases and agency workflows. It supports Executive → OPD → Process drill-down and displays configurable workflows for DPMPTSP, BAPENDA, Disdukcapil, PUPR, Dishub, and DLHK. Current values are demo data. Future agency adapters should map service ID, stage, SLA, responsible team, status, source reference, sync time, and freshness/error state. Credentials remain server-side, and missing API values must not be treated as zero.

## Production boundaries

Demo interactions are session-only. Production ingestion, identity and permission checks, persistence, immutable audit storage, media hashing, messaging, and publishing require server-side implementation. Official source URLs and publication data must be retained; generated or illustrative records must stay visibly labeled.
