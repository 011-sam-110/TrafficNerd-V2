# TrafficNerd v2 — Design Spec (2026-06-26)

This design was produced via the `superpowers:brainstorming` flow.

**The canonical, full design / PRD lives at [`/PRD.md`](../../../PRD.md)** at the repo root — kept there as a single source of truth so it doesn't diverge.

Quick summary of what was decided (see `PRD.md` for the detail):

- **Product:** a web app whose homepage is a rotating 3D **Globe.GL** Earth studded with ~10k+ open government traffic cameras worldwide; click → live view.
- **Intent:** a deployed, honest, resume-grade portfolio showpiece.
- **Architecture (Approach A):** single Next.js 15 (App Router, TS) app on Vercel + PostGIS registry + Vercel Cron ingestion + a closed edge image-proxy.
- **Core engineering:** a normalization layer (`SourceAdapter` → common `Camera` shape) over ~25 heterogeneous feeds, with two parameterized families (`ibi511`, `arcgisHub`) doing the heavy lifting.
- **Coverage:** maximal — keyless + free-key sources across every continent (see source catalog in `PRD.md` §7).
- **Compliance:** structural — per-camera license/attribution that the UI cannot omit; hard exclusion of France/NL/Japan/National-Highways and all Insecam-class sources; no face/plate recognition.
- **Roadmap:** P0 skeleton (TfL-only, deployed) → P1 keyless spread → P2 keyed + families (~10k) → P3 intelligence → P4 polish.
