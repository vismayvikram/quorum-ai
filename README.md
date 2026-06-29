# Quorum — AI Accountability Engine

**Decisions made. Deadlines kept.**

Quorum is an agentic productivity ecosystem built for addressing the *"Last-Minute Life Saver"* problem statement. Instead of another reminder app that gets swiped away and ignored, Quorum decomposes goals into executable plans, schedules them around how you actually work, and enforces follow-through with real, applied consequences when a deadline slips.

---

## Table of Contents
- [The Core Innovation](#the-core-innovation)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Built with Google Technologies](#built-with-google-technologies)
- [Quick Start](#quick-start)
- [Known Limitations & Roadmap](#known-limitations--roadmap)

---

## The Core Innovation

Most productivity tools fail because they're **passive** — a notification fires, the user swipes it away, and nothing about their day actually changes. Quorum is **active**: it understands the structure of a goal, calculates the mathematical urgency of every step inside it, and enforces real-world accountability when a step is missed — taking the problem statement's challenge to "help users take meaningful action" literally, rather than building a smarter reminder.

### 🧠 Agentic Depth (Gemini-Powered)
- **The Planner Agent** — uses the Gemini API with strict JSON schema enforcement to decompose a single described goal into an executable, dependency-aware **Directed Acyclic Graph (DAG)** of subtasks. It also silently classifies the goal as an `execution` task or a `learning_goal` from the description alone, and shapes the plan accordingly — a flat checklist vs. a curriculum-style progression — with no extra step the user has to manage.
- **The Coach Agent** — generates daily briefings and evaluates a user's stated reason for missing a deadline against their chosen **Accountability Tone** (Gentle → Firm), returning a structured verdict rather than a simple yes/no.

Four cooperating agents — Planner, Scheduler, Accountability, and Insight — each own a distinct part of the decision loop, with their own data and a fixed contract for talking to one another, so the system behaves more like a small council reasoning over a plan than a single assistant guessing at one.

### ⚡ The Urgency Engine
A deterministic, fully explainable scoring function — not an AI call — that ranks every open subtask by:
- **Timeline pressure** — remaining estimated work relative to remaining time, not just raw days-until-deadline.
- **User-set priority** — the 1–10 input, normalized.
- **Dependency weight** — whether this subtask is currently blocking others from starting.
- **Historical risk** — the user's own past miss-rate in that task category.

Scores are recomputed on every read (never cached), so they stay accurate even when the system's virtual clock is fast-forwarded. Keeping this math deterministic rather than model-generated means every ranking is fast, free, and fully explainable — exactly why something ranks where it does is always one formula away, not a guess.

### 🛑 The Procrastination Tax
A reschedule request isn't a simple approval gate. The Coach Agent returns a verdict (`valid` / `invalid` / `conditional`) *and*, when an excuse doesn't hold up but the extension is granted anyway, an applied consequence — a shortened next focus block, a temporarily locked UI element, or a forced "Maximum Firmness" tone for the rest of the day. This is the system's sharpest differentiator: accountability with a real, felt cost, not just a re-snoozed notification.

### 🎨 Designed Around the Calendar, Not the Inbox
The dashboard is calendar-first by deliberate choice — a week-view grid is the dominant element on screen, with subtasks labeled by their parent task and color-banded by urgency, plus a sidebar for day-by-day and global-urgency views. The whole loop — goal entry, roadmap preview, scheduling, missed-task handling, and the resulting consequence — runs end to end in the live build, not as disconnected screens.

---

## Architecture at a Glance

A central **virtual clock** (real time + an adjustable offset) is the single source of truth for every time-dependent decision — scheduling, grace periods, urgency scoring. Each functional concern is isolated into its own module with a fixed input/output contract, so a failure or bad model response in one agent can't corrupt another. Full detail in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Built with Google Technologies

**Currently implemented:**
- **Google Gemini API** — structured/JSON-schema output powering the Planner Agent (goal decomposition) and the Coach Agent (briefings, excuse evaluation)
- **Firebase Firestore** — task, subtask, and profile persistence
- **Google Cloud Run** — build and deployment hosting environment (runs as containerized service under the hood)

**Designed for, not yet wired (see Roadmap):**
- **Firebase Authentication** — real sign-in, replacing the current local-identity model
- **Google Calendar API** — live OAuth-based conflict detection and calendar export, replacing the current local calendar with manual blocked-time entry
- **Cloud Scheduler** — push-based accountability checks, replacing the current poll-on-read model
- **Google Maps/Places** — optional, context-aware location-based reminders, not part of the current build

---

## Quick Start

### Prerequisites
- Node.js 18+
- A Google Gemini API key

### Installation
```bash
git clone https://github.com/your-username/quorum-accountability-engine.git
cd quorum-accountability-engine
npm install
```

Set your Gemini API key as an environment variable (see `.env.example`), then:
```bash
npm run dev
```

---

## Known Limitations & Roadmap

In the interest of the same transparency built into the product itself (the UI explicitly labels the calendar as a "Local Calendar Preview" with a disabled "Sync to Google Calendar" button rather than pretending it's live), here's what's intentionally deferred past this submission:

- **Identity** is currently a locally-generated UUID, not a real authenticated account. The data model is keyed identically to how a real `uid` would look, so this is a planned drop-in swap, not a rebuild.
- **Calendar conflict detection** currently runs against manually-entered blocked time, not a live Google Calendar connection.
- **The Insight Agent's** behavioral pattern summaries are based on the user's own logged history as it accumulates — depth of insight grows with usage.
- **Accountability checks** currently run on read/poll rather than via an external scheduler; the system already exposes a stateless endpoint shaped for that purpose.
