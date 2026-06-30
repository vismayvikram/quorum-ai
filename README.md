# Quorum — AI Accountability Engine

**Decisions made. Deadlines kept.**

Quorum is an agentic productivity ecosystem built for addressing the *"Last-Minute Life Saver"* problem statement. Instead of another reminder app that gets swiped away and ignored, Quorum decomposes goals into executable plans, schedules them around how you actually work, and enforces follow-through with real, applied consequences when a deadline slips — including a Coach Agent with genuine write access to your schedule, not just a chat window that talks about your tasks.

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
- **The Planner Agent** — uses the Gemini API with strict JSON schema enforcement to decompose a single described goal into an executable, dependency-aware **Directed Acyclic Graph (DAG)** of subtasks. It silently classifies the goal as an `execution` task or a `learning_goal` from the description alone, and shapes the plan accordingly — a flat checklist vs. a curriculum-style progression — with no extra step the user has to manage. It also runs a non-binding dry-run through the Scheduler during plan preview, so the user sees a realistic projected timeline before anything is committed.
- **The Coach Agent** — goes beyond conversation. Through a structured function-calling layer, it can genuinely reschedule, complete, delete, or replan a user's subtasks in response to natural language ("I'm running behind, fix my schedule"), with every write routed through the same deterministic scheduling engine the rest of the system uses — so a chat-requested change still respects focus hours, blocked time, and any active accountability penalty. The Coach also generates daily briefings and evaluates a user's stated reason for missing a deadline against their chosen **Accountability Tone** (Gentle → Firm), returning a structured verdict rather than a simple yes/no.

Four cooperating agents — Planner, Scheduler, Accountability, and Insight — each own a distinct part of the decision loop, with their own data and a fixed contract for talking to one another, so the system behaves more like a small council reasoning over a plan than a single assistant guessing at one. That reasoning isn't hidden, either: an **Agent Trace Panel** in the task-creation flow shows, in plain language, what each agent actually decided and why — including honest labeling of which placements are still speculative previews versus what's been permanently committed.

### ⚡ The Urgency Engine
A deterministic, fully explainable scoring function — not an AI call — that ranks every open subtask by:
- **Timeline pressure** — remaining estimated work relative to remaining time, not just raw days-until-deadline.
- **User-set priority** — the 1–10 input, normalized.
- **Dependency weight** — whether this subtask is currently blocking others from starting.
- **Historical risk** — the user's own past miss-rate in that task category.

Scores are recomputed on every read (never cached), so they stay accurate even when the system's virtual clock is fast-forwarded. The full weighted breakdown behind any score is one hover or tap away — every urgency badge in the app reveals exactly how much each factor contributed, turning "trust me, it's deterministic" into something a user (or a judge) can verify themselves in seconds.

### 🛑 The Procrastination Tax
A reschedule request isn't a simple approval gate. When a user "pleads their case" on a missed task, the Coach Agent returns a verdict (`valid` / `invalid` / `conditional`) *and*, when an excuse doesn't hold up but the extension is granted anyway, an applied consequence — a percentage-based schedule compression on the next block, a temporarily locked UI element, or a forced "Maximum Firmness" tone that also collapses the grace period on future deadlines to zero. These penalties are enforced directly inside the scheduling engine itself, so they apply consistently regardless of whether a task is rescheduled through the structured Excuse flow or a casual chat request — there's no back door. This is the system's sharpest differentiator: accountability with a real, felt cost, not just a re-snoozed notification.

### 🎨 Designed Around the Calendar, Not the Inbox
The dashboard is calendar-first by deliberate choice — a week-view grid is the dominant element on screen, with subtasks labeled by their parent task and color-banded by urgency, plus a sidebar for day-by-day and global-urgency views. The whole loop — goal entry, roadmap preview, scheduling, missed-task handling, chat-driven replanning, and the resulting consequence — runs end to end in the live build, not as disconnected screens.

---

## Architecture at a Glance

A central **virtual clock** (real time + an adjustable offset) is the single source of truth for every time-dependent decision — scheduling, grace periods, urgency scoring, and tax enforcement. Each functional concern is isolated into its own module with a fixed input/output contract, so a failure or bad model response in one agent can't corrupt another. Full detail in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Built with Google Technologies

**Currently implemented:**
- **Google Gemini API** — structured/JSON-schema output powering the Planner Agent (goal decomposition) and the Coach Agent (briefings, excuse evaluation, and structured task-modification actions)
- **Firebase Firestore** — task, subtask, and profile persistence
- **Google AI Studio** — build and deployment environment (runs on Cloud Run under the hood)

**Designed for, not yet wired (see Roadmap):**
- **Firebase Authentication** — a full managed auth provider, beyond the current lightweight email-lookup identity system
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

The app is fully usable instantly via anonymous guest access — no sign-up required. Optionally signing in with an email links a session to your calendar across devices/browsers.

---

## Known Limitations & Roadmap

In the interest of the same transparency built into the product itself (the UI explicitly labels the calendar as a "Local Calendar Preview" with a disabled "Sync to Google Calendar" button rather than pretending it's live), here's what's intentionally deferred past this submission:

- **Identity** is lightweight by design: anonymous guest sessions by default, with an optional email-based lookup to persist a calendar across devices. This is not a hardened auth system (no rate limiting, no email verification) — a deliberate scope choice, not an oversight, matching the original brief's call for "not that complex of auth."
- **Calendar conflict detection** currently runs against manually-entered blocked time, not a live Google Calendar connection.
- **The Insight Agent's** behavioral pattern summaries are based on the user's own logged history as it accumulates — depth of insight grows with usage.
- **Accountability checks** currently run on read/poll rather than via an external scheduler; the system already exposes a stateless endpoint shaped for that purpose.
