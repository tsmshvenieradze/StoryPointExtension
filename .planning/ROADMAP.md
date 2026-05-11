# Roadmap — Story Point Calculator (Azure DevOps Extension)

**Project:** Story Point Calculator (Azure DevOps Extension)
**Public listing:** [TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator](https://marketplace.visualstudio.com/items?itemName=TsezariMshvenieradzeTfsAiReviewTask.story-point-calculator) — at v1.0.10
**Phase numbering:** continuous across milestones (never restarts)

---

## Milestones

- ✅ **v1.0 MVP** — Phases 0–5 (shipped 2026-05-04) — see [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Auto-Publish CI/CD** — Phases 6–8 (shipped 2026-05-11) — see [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- 📋 **v1.2+** — not yet defined (candidate themes in [PROJECT.md](PROJECT.md) "Next Milestone Goals")

---

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 0–5) — SHIPPED 2026-05-04</summary>

- [x] Phase 0: Bootstrap & Prerequisites (1/1 plans) — completed 2026-05-01
- [x] Phase 1: Calc Engine & Audit Parser (2/2 plans) — completed 2026-05-01
- [x] Phase 2: Manifest Shell & SDK Integration (1/1 plans) — completed 2026-05-02
- [x] Phase 3: Modal UI & Read Path (4/4 plans) — completed 2026-05-02
- [x] Phase 4: Write Path & Edge Cases (6/6 plans) — completed 2026-05-02
- [x] Phase 5: Polish & Marketplace Publish (5/5 plans) — completed 2026-05-04

Full detail + post-publish patch sequence v1.0.1..v1.0.7: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md). Phase artifacts archived under [milestones/v1.0-phases/](milestones/v1.0-phases/).

</details>

<details>
<summary>✅ v1.1 Auto-Publish CI/CD (Phases 6–8) — SHIPPED 2026-05-11</summary>

- [x] Phase 6: Workflow Scaffold & Pre-flight Gates (3/3 plans) — completed 2026-05-07
- [x] Phase 7: Bump, Publish, Tag (2/2 plans) — completed 2026-05-11 (first auto-publish v1.0.8)
- [x] Phase 8: Cleanup & Runbooks (5/5 plans) — completed 2026-05-11 (release-branch model + GitHub App verified commit-back; OPERATIONS.md; re-verification v1.0.9; SC #5 broken-PAT recovery v1.0.10)

38/38 requirements satisfied (CI-01 + TAG-02 satisfied via the deliberate Phase-8 architecture evolution to the release-branch model). Full detail: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) · audit: [milestones/v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md). Phase artifacts archived under [milestones/v1.1-phases/](milestones/v1.1-phases/).

</details>

### 📋 v1.2+ (not yet planned)

Run `/gsd-new-milestone` to scope the next milestone. Candidate themes (from the v1.0 audit + listing limitations, see [PROJECT.md](PROJECT.md) "Next Milestone Goals"):
- Pre-fill APPLY-03 production fix (widen `src/audit/parse.ts` or strip the orphaned `serialize` re-export)
- Node-20 → Node-24 action bump in `publish.yml` / `ci.yml` (GitHub deprecation deadline 2026-06-02)
- Phase 5 carry-overs: light + dark listing screenshots, Contributor non-admin smoke, cross-process Agile + CMMI smoke
- Cross-phase integration debt: `closeProgrammatically` defense-in-depth + shared `SAVING_DATASET_KEY` constant; strip dead `PermissionWarnBanner`
- v2 customization placeholder: Settings hub, configurable weights/dimensions/levels

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
| ----- | --------- | -------------- | ------ | --------- |
| 0. Bootstrap & Prerequisites | v1.0 | 1/1 | Complete | 2026-05-01 |
| 1. Calc Engine & Audit Parser | v1.0 | 2/2 | Complete | 2026-05-01 |
| 2. Manifest Shell & SDK Integration | v1.0 | 1/1 | Complete | 2026-05-02 |
| 3. Modal UI & Read Path | v1.0 | 4/4 | Complete | 2026-05-02 |
| 4. Write Path & Edge Cases | v1.0 | 6/6 | Complete | 2026-05-02 |
| 5. Polish & Marketplace Publish | v1.0 | 5/5 | Complete | 2026-05-04 |
| 6. Workflow Scaffold & Pre-flight Gates | v1.1 | 3/3 | Complete | 2026-05-07 |
| 7. Bump, Publish, Tag | v1.1 | 2/2 | Complete | 2026-05-11 |
| 8. Cleanup & Runbooks | v1.1 | 5/5 | Complete | 2026-05-11 |

**Shipped:** 2 milestones, 9 phases, 29 plans. Next: `/gsd-new-milestone`.

---

*v1.0 archived 2026-05-04 · v1.1 archived 2026-05-11 (gsd-complete-milestone). Per-milestone roadmaps under `.planning/milestones/`.*
