# System Architecture — Quorum AI Accountability Engine

## 1. Overview

Quorum is a full-stack Node.js/Express + React application built around three core design commitments: **deterministic logic stays deterministic** (scheduling, urgency, and time itself are pure functions, not model outputs — Gemini is reserved for the calls that genuinely require judgment), **every functional concern is isolated into its own contract-bound module** (a failure or unexpected model response in one agent cannot corrupt another), and **agentic reasoning is visible, not just internal** — both the deterministic agents' decisions and the AI agents' actions are surfaced honestly to the user, including a clear distinction between speculative previews and committed state.

The system is organized around four cooperating agents — **Planner**, **Scheduler**, **Accountability**, and **Insight** — plus a **Coach** layer that, unlike a typical chat assistant, has genuine write access to the user's schedule through a structured, validated action layer.

---

## 2. Architecture Diagram

```
┌──────────────────────────────── CLIENT (React + Tailwind) ─────────────────────────────────┐
│                                                                                              │
│  Auth Screen ──┐   Task Creation Modal        Calendar View         Coach Drawer            │
│  (email/guest) │   (3-step wizard)             (week / day)         ──────────────          │
│                │        │                          │                  │      │              │
│                │        ▼                          │                  ▼      ▼              │
│                │   Agent Trace Panel                │              Chat reply  Excuse Modal  │
│                │   (speculative vs. committed)       │           + execution    (Accountab-  │
│                │                                     │              log         ility Hearing)│
│                │                                     ▼                                       │
│                │                                 Sidebar (Selected Day / Global Urgency)      │
│                │                                     │                                       │
│                │                                     ▼                                       │
│                │                          Urgency Breakdown Tooltip                           │
│                │                                                                              │
│                │                                                       Hidden Dev Controls    │
│                │                                                       (Time-Warp)            │
└────────────────┼──────────────────────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────── SERVER (Node.js + Express) ────────────────────────────────┐
│                                                                                              │
│   Identity Module ──► Context Injection Middleware ──► (profile fed into every agent call)  │
│   (anon JWT + email                  │                                                      │
│    lookup)                           ▼                                                      │
│                          ┌───────────────────────┐                                          │
│                          │     Planner Agent      │──► Gemini (decompose + classify)         │
│                          │ DecompositionEngine.ts │                                          │
│                          └───────────┬────────────┘                                          │
│                                      │ dry-run (speculative)                                 │
│                                      ▼                                                       │
│                          ┌───────────────────────┐                                          │
│                          │     DAG Validator       │  (cycle / duration / dependency checks) │
│                          └───────────┬────────────┘                                          │
│                                      │ on commit (binding)                                   │
│                                      ▼                                                       │
│                          ┌────────────────────────────────────┐                              │
│            ┌────────────►│   Scheduler Agent (THE single       │◄───────────┐                │
│            │             │   placement authority)               │            │                │
│            │             │   DeterministicScheduler.ts          │            │                │
│            │             │   - reads live VirtualClock           │            │                │
│            │             │   - reads live active taxes            │           │                │
│            │             │   - enforces tax penalties uniformly  │            │                │
│            │             └───────────────┬──────────────────────┘            │                │
│            │                             │                                   │                │
│   Action Processor                       ▼                              Accountability Agent  │
│   (reschedule_subtask,            Firestore (tasks,                     AccountabilityEngine.ts│
│    complete_subtask,               subtasks, profile)                   - grace-period check   │
│    delete_subtask,                                                       (pure, vs VirtualClock)│
│    replan_pending)                                                      - excuse eval ──► Gemini│
│            ▲                                                                   │              │
│            │ validates ownership/existence per-action,                        ▼              │
│            │ NO handler exists for `taxes` collection                   Tax Application Layer  │
│            │                                                            (taxes collection)      │
│   Coach Engine ──► Gemini (chat + function-calling)                     - ONLY the Excuse flow's │
│   coachRoutes.ts                                                          "forgiven" verdict can │
│                                                                            deactivate a tax       │
│   Urgency Engine (pure fn, returns full weighted breakdown) ──► Firestore reads                  │
│   Insight Agent (statistical, reads completion/miss logs) ──► Firestore                          │
│   Notification Decision Engine (rule-based, cooldown-aware)                                      │
│   Virtual Clock — single source of truth for ALL time-dependent reads above                      │
│                                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                 │                                                    │
                 ▼                                                    ▼
   Local disk fallback                                   Phase 2, not yet wired:
   (pre-Firestore-setup only)                             - Google Calendar API (OAuth)
                                                            - Cloud Scheduler (push-based checks)
                                                            - Firebase Authentication
```

**Key paths to note:**
- **Planner → dry-run → Scheduler** happens during roadmap *preview* only (speculative, not written to the database). The binding placement happens separately, on commit.
- **Coach → Action Processor → Scheduler**: chat-triggered reschedules never compute timestamps themselves — they hand a desired time to the same Scheduler every other flow uses, which is the sole authority on where a task actually lands.
- **Tax Application Layer** has exactly one writer (the Excuse flow's forgiven-verdict path) and one reader (the Scheduler, at execution time) — the Coach's action schema has no route to it at all, by design.

---

## 3. Core Design Principles

1. **Time has exactly one source of truth.** Every grace-period check, urgency calculation, scheduling decision, and tax-state read resolves from a single `VirtualClock` module (`virtualTime = realTime + offset`, offset defaulting to `0`). No scheduling, accountability, or tax-enforcement code path calls `Date.now()` or `new Date()` directly — including the Coach's chat-triggered reschedule actions, which read the live virtual time at the exact moment of execution rather than trusting any timestamp passed earlier in a request.

2. **Deterministic logic stays deterministic, and there is exactly one scheduler.** Placement and urgency scoring are pure functions over known inputs — they don't call Gemini. Critically, every code path that can result in a subtask being scheduled or rescheduled — initial task commit, the Excuse Modal's approval flow, and the Coach's `reschedule_subtask` and `replan_pending` actions — routes through the same `DeterministicScheduler.schedule` function. There is no second, independent implementation that could drift out of sync, and no path where an AI-generated raw timestamp is trusted directly; the model expresses intent (a desired time), and the scheduler is the sole authority on whether that's valid and where the task actually lands.

3. **Modules are isolated by contract, not just by convention — including what an agent is *not* allowed to do.** Each agent owns its own Firestore collections; cross-module needs go through a defined interface, never shared mutable state. This isolation is also used defensively: the Coach's chat action schema has no handler for the `taxes` collection at all. Active accountability penalties cannot be edited, deactivated, or bypassed through conversation — only the Excuse Modal's structured approval flow, on an explicit "forgiven" verdict, has the authorization to deactivate a tax. This is a structural guarantee (the code path doesn't exist), not a prompt-level instruction the model could be talked around.

4. **Agentic reasoning is shown, not just used.** Each deterministic agent emits a short, factual trace message describing what it computed — never anthropomorphized "thinking" language, since these agents don't reason, they calculate. The Planner additionally runs a non-binding dry-run through the Scheduler during the roadmap preview step, purely to give the user (and the trace panel) a realistic projection before anything is committed; this speculative trace is visually distinct (dashed border, muted color, explicit "(Speculative Preview)" label) from the actual, binding placement that occurs on commit. The same honesty principle applies to the Urgency Engine: every score is paired with its full weighted breakdown, available on demand, so a ranking is never just a number to be trusted.

---

## 4. Module Breakdown

| Module | Responsibility | Calls Gemini? |
|---|---|---|
| **Planner Agent** (`server/agents/planner/`) | Decomposes a task description into a dependency-aware DAG of subtasks; classifies `execution` vs `learning_goal` in the same call; runs a non-binding scheduling dry-run for the roadmap preview | Yes |
| **DAG Validator** (`server/agents/planner/DAGValidator.ts`) | Structural validation of the Planner's output: cycle detection, dangling-dependency checks, duration-sum-vs-deadline sanity | No |
| **Scheduler Agent** (`server/agents/scheduler/DeterministicScheduler.ts`) | The single, exclusive engine for all subtask placement — initial commit, excuse-approved reschedules, and chat-triggered reschedules/replans alike. Reads live active-tax state at execution time and applies the corresponding penalty (schedule compression, zero grace period) uniformly regardless of entry point | No |
| **Urgency Engine** (`server/agents/scheduler/UrgencyEngine.ts`) | Deterministic scoring of every open subtask, recomputed fresh on every read; returns the full weighted breakdown (not just the final score) for transparent display | No |
| **Accountability Agent** (`server/agents/accountability/`) | Detects missed soft deadlines against the virtual clock; evaluates user-submitted excuses (`/api/coach/excuse`) and is the sole authority that can deactivate an active tax on a forgiven verdict | Yes (excuse evaluation only — detection itself is pure logic) |
| **Coach Engine** (`server/agents/coach/`) | Conversational layer with genuine write capability: daily briefings, free-text chat, and a structured action schema (`reschedule_subtask`, `complete_subtask`, `delete_subtask`, `replan_pending`) that the server validates and executes — never trusting the model's claim of success without confirming the underlying write actually happened | Yes |
| **Action Processor** (within `coachRoutes.ts`) | Intercepts structured actions from the Coach's response, validates ownership/existence of each target subtask before executing, routes scheduling-related actions through the Scheduler, and returns a per-action result so partial batch failures are reported honestly rather than masked by a single success flag | No |
| **Insight Agent** (`server/agents/insights/`) | Surfaces behavioral patterns from the user's own logged completion/miss history; depth grows with usage | No (statistical, not generative) |
| **Notification Decision Engine** (`server/agents/notifications/`) | Rule-based evaluation of what to surface on each poll — grace-period alerts, upcoming-block reminders, daily summary, idle nudges — with cooldown logic to avoid recreating notification fatigue | No |
| **Identity Module** (`server/identity/`) | Issues JWT-backed anonymous guest sessions by default (zero-friction public access); supports an optional email-based lookup so a returning user's session resolves to the same `userId`, and therefore the same calendar, from any device | No |

---

## 5. Agentic Workflow

### Goal Decomposition (Planner)
1. User submits a task description, deadline, priority, and optional max-time constraint through the 3-step creation modal.
2. The Planner Agent sends a single Gemini call, with the user's onboarding profile injected as system context, requesting a strict JSON-schema response containing both a `task_type` classification and the subtask DAG.
3. The DAG Validator runs structural checks (cycle detection, dependency integrity, duration-sum-vs-deadline). On failure, one retry prompt naming the specific defect is issued; on a second failure, the system falls back to a safe flat checklist.
4. The Planner runs a non-binding dry-run through the Scheduler to project a realistic placement, surfaced in the Agent Trace Panel as a clearly-labeled speculative preview.
5. The user edits the roadmap as needed. On confirming the plan, a one-time recheck runs, then the final, user-edited subtask tree is sent to the scheduler-commit endpoint, where the actual, binding placement is computed and permanently written.

### Scheduling & Rescheduling
`DeterministicScheduler.schedule` is the single authority for where a subtask lands on the calendar, called identically whether triggered by initial commit, an approved excuse, or a Coach chat action. Given a desired anchor time, the user's focus-hour preference, manually-entered blocked time, and the current virtual time, it assigns a slot — rolling forward automatically to the next valid window if the requested time conflicts with a constraint. It also reads the user's currently active taxes at execution time and applies the corresponding penalty (e.g. compressing the duration of the next placed block, or collapsing the grace period to zero under Maximum Firmness), appending an explicit notation to the trace log so the consequence is visible, not silent.

### Urgency Scoring
Recomputed on every fetch of the task list, combining timeline pressure (dominant weight), normalized priority, dependency-blocking factor, and historical category risk into both a final score and its full weighted breakdown. Scores drive sort order; bands (high/moderate/low) drive color-coding — both read from the same underlying number. The breakdown is available on hover or tap on every urgency badge across the dashboard, sidebar, and task detail modal.

### Accountability, Excuses, and the Procrastination Tax
1. The Accountability Agent compares each subtask's soft deadline plus grace period against virtual time on read — purely deterministic — and flags expired subtasks as missed.
2. From a missed task's detail view, a user can "plead their case": submit a reason, which goes to Gemini with task and profile context, returning a verdict (`valid` / `invalid` / `conditional`) and, where applicable, a tax type.
3. On a forgiven verdict, the Excuse flow is the *only* code path authorized to query and deactivate the user's active tax documents, and to reschedule the affected subtask back to `pending` through the Scheduler.
4. On an unforgiven-but-granted verdict, the tax is written as an active flag and immediately enforced by the Scheduler on any subsequent placement for that user, regardless of how that placement is triggered.
5. Tax expiry (where applicable, e.g. Maximum Firmness reverting at day's end) is computed relative to an explicit `virtualMidnightTimestamp`, recalculated against the active offset rather than a relative "+24 hours" value.

### Conversational Agency (Coach)
The Coach Engine handles daily briefings and free-text conversation, with generic encouragement nudges served from tone-matched templates rather than a fresh model call each time. For task-modifying requests, the model is given the user's current subtask list (IDs, times, dependencies) as context and returns a response combining natural-language text with zero or more structured actions. The server processes these actions independently of the generated text:
- Each action's target subtask is checked for existence and ownership before execution; a stale, hallucinated, or unauthorized ID fails that specific action without affecting others in the same batch.
- `reschedule_subtask` and `replan_pending` both delegate the actual placement decision to `DeterministicScheduler.schedule` — the model supplies a desired time, the scheduler is the final authority on where it lands.
- Per-action results are returned to the client and rendered as an explicit execution log beneath the chat response, so a confidently-worded message from the model cannot misrepresent what the database actually did — the log is the source of truth, the chat text is commentary.
- A successful write triggers a unified refresh signal (`actionsApplied`), routed through the same central refresh mechanism used by roadmap commit and excuse approval, so the calendar, sidebar, and detail views update immediately without a manual reload.

---

## 6. Virtual Time Architecture

`VirtualClock` is the single module permitted to compute `realTime + offset`. Every other module receives the resolved virtual timestamp as an input rather than computing it independently — including the Coach's action processor, which reads live virtual time at the moment a chat-triggered reschedule actually executes, not at the moment the conversation started. This is what makes the Time-Warp developer control safe: advancing the offset doesn't trigger a special code path, every real piece of logic already reads from the one function being changed.

Two safeguards sit on top of this:
- **Developer gating** — Time-Warp is hidden behind an explicit, off-by-default developer setting, and disabled outright once a real, externally-synced calendar connection is active for a non-developer account.
- **Virtual-day boundaries** — anything scoped to "the rest of the day" (an active Maximum Firmness tax, for instance) resolves against the virtual day, not the real-world clock.

---

## 7. Data Persistence & Identity Model

**Identity:** the default experience is a zero-friction anonymous guest session — a JWT-backed identity issued automatically on first load, requiring no credentials, so a judge or new user reaches the working app immediately. On optional sign-in path supports a lightweight email-based lookup: providing an email either creates a new profile keyed to a fresh `userId`, or resolves to an existing one, so the same calendar reliably reappears from any device using that email. This is intentionally not a hardened authentication system (no email verification, no session expiry policy) — a deliberate scope decision consistent with the original brief's call for minimal auth complexity, not an oversight.

**Persistence:** primary data lives in Firebase Firestore. A local-disk fallback exists for development convenience when Firestore credentials aren't yet configured, intentionally scoped to that pre-setup situation rather than as a permanent dual-write path.

---

## 8. Directory Structure

```
/server
  /time/
    VirtualClock.ts            — single source of truth for time
  /identity/
    LocalIdentity.ts           — anonymous JWT sessions + email lookup
    AuthService.ts             — email-based account creation/lookup
  /middleware/
    contextInjector.ts         — attaches user profile to every agent request
  /agents/
    planner/
      DecompositionEngine.ts   — Gemini call, task_type classification, speculative dry-run
      DAGValidator.ts          — cycle/duration/dependency validation
    scheduler/
      DeterministicScheduler.ts — exclusive placement engine, tax enforcement
      UrgencyEngine.ts         — scoring + full weighted breakdown
    accountability/
      AccountabilityEngine.ts  — grace-period checks, excuse evaluation, tax lifecycle
    coach/
      CoachEngine.ts           — conversation + structured action schema
      coachRoutes.ts           — action interception, validation, execution
    insights/
      InsightGenerator.ts
    notifications/
      NotificationDecisionEngine.ts
  /routes/
    profile.ts
    scheduler/commit.ts        — binding placement on roadmap confirmation

/src
  /components/
    onboarding/
    dashboard/
    roadmap/
      AgentTracePanel.tsx      — speculative vs. committed reasoning display
    accountability/
      ExcuseModal.tsx
      TaskDetailModal.tsx
    shared/
      UrgencyBreakdownTooltip.tsx
    auth/
      LoginForm.tsx
      SignupForm.tsx
    developer/                 — hidden Time-Warp controls
  /hooks/
    useVirtualTime.ts
  /store/
    useAppStore.ts             — central refreshTrigger, shared by commit/coach/excuse flows
```

---

## 9. Gemini Output Reliability

Every structured Gemini call follows the same defensive pattern: strict JSON-schema enforcement, a deterministic validation pass appropriate to that call, one automatic retry naming the specific failure, and a safe minimal fallback if the retry also fails. The Coach's action layer extends this principle one step further — the model's output is never trusted as a completed fact. Every proposed action is independently validated (ownership, existence) and executed server-side, with the real per-action outcome surfaced back to the user regardless of how the model's accompanying text was phrased.

---

## 10. Deployment Architecture

The application is built and deployed through **Google AI Studio**, which runs the deployed app as a containerized service on **Cloud Run** under the hood — the Node.js/Express backend and React frontend deploy together as a single unit, with the Gemini API key handled as a server-side secret.

Accountability checks currently run on read (whenever the frontend polls or loads, missed-deadline detection runs against the virtual clock), backed by a lightweight background poll for passive state transitions. The system already exposes a stateless HTTPS endpoint (`/api/accountability/cron-check`), structured so that swapping in an external trigger — **Cloud Scheduler** calling that same endpoint — requires no change to the underlying detection logic, only a change in what invokes it.

---

## 11. Scalability & Extensibility

Because every agent is a contract-bound module owning its own data, two kinds of growth are cheap by design: replacing a mocked component (the Insight Agent's depth, or the Identity module's auth backend) means rewriting the inside of one module without changing what calls it; and adding a new agent means adding a new directory with its own contract, not modifying the control flow of existing ones. The Coach's action layer demonstrates this directly — its write capability was added without altering the Scheduler, Validator, or Accountability modules at all; it simply became a new, validated client of the same `DeterministicScheduler.schedule` contract everything else already used.
