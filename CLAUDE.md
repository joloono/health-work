# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Health System is a personal health-productivity web app for a solopreneur (single-user). It enforces a structured workday: 4 blocks of 4 pomodoros (25 min each) with mandatory movement breaks between pomodoros (1 min minimum) and larger breaks between blocks. A gamification layer with 30 Greek-antiquity ranks rewards consistency. All UI text is German with Swiss spelling (ss instead of ss).

## Current State

The project currently consists of:
- `PRD-health-system.md` — Full product requirements document (the source of truth for features and data model)
- `health-tracker.jsx` — React component implementing the core timer flow (Phase 1 frontend prototype)

The JSX component uses `window.storage.get/set` for persistence (localStorage-style API), keyed by date (`health-YYYY-MM-DD`). State is a JSON blob with 4 blocks, each containing pomodoros, intentions, miniMoves, and blockMove.

## Architecture & Design Decisions

- **Single-user system** — no auth management in MVP, Basic Auth only
- **Backend target**: SQLite3 with WAL mode, Docker deployment (`docker compose up`)
- **Day structure**: 4 blocks x 4 pomodoros = 16 max/day. Within each block: `[Intention -> Pomodoro -> MiniMove] x 3 -> [Intention -> Pomodoro] -> BlockPause`
- **Movement is mandatory** — the 60s countdown must complete before exercise selection appears; no timer start without intention
- **Gamification**: Points per pomodoro (1pt), movement (2pt), business-value bonus (+1pt). Max 64 pts/day. Level-up every 3 consistent days (avg >= 20 pts/day). Level loss after 2 days inactivity.
- **30 ranks** from Neos (1) to Olympionikes (30) — see PRD Appendix A for full list
- **Data model**: 4 SQLite tables planned — `days`, `pomodoros`, `movements`, `gamification` (see PRD Appendix D)

## UI Conventions

- Mobile-first, max-width 480px
- Fonts: IBM Plex Sans (body), Playfair Display (headings), JetBrains Mono (timer)
- CSS custom properties for theming (defined inline on root div): `--fg`, `--bg`, `--accent` (#c44d2b), `--done` (#2d8a4e), etc.
- Swiss German spelling throughout: "ss" not "ss", "grössere" not "größere"
- Touch targets minimum 44px

## Phase 2 (Post-MVP)

REST API with OpenAPI spec, webhooks (timer end, streak warning), and Telegram bot integration for agent-driven control (`/intention`, `/start`, `/status`, `/stats`).
