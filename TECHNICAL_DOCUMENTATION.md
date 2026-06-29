# Technical Documentation: Quorum Implementation Details

## 1. The Urgency Engine Formula

The core of Quorum's prioritization logic is the **Urgency Engine**, which computes a score (0-100) for every pending subtask.

$$Score = (W_{timeline} \times P_{timeline}) + (W_{priority} \times P_{normalized}) + (W_{dep} \times F_{dep}) + (W_{risk} \times R_{historical})$$

### Weights:
- **Timeline Pressure ($W_{timeline}$)**: 50%
- **User Priority ($W_{priority}$)**: 25%
- **Dependency Depth ($W_{dep}$)**: 15%
- **Historical Risk ($W_{risk}$)**: 10%

### Active Blocking Multiplier:
If a subtask is a dependency for other uncompleted tasks, its score is multiplied by $1.5x$, ensuring critical path items are prioritized.

## 2. Gemini API Integration Strategy

Quorum uses the `@google/genai` SDK with the `gemini-2.0-flash` model for high-speed, cost-effective reasoning.

### Key Implementation Patterns:
- **Structured Outputs**: All agent responses are requested in JSON format using `responseMimeType: 'application/json'` to ensure deterministic parsing into the application state.
- **System Instructions**: Agents are given strict personas (e.g., "The Planner", "The Coach") with few-shot examples of task decomposition and excuse evaluation.
- **Quota Management**:
    - **Caching**: Daily briefings and urgency-sorted lists are cached per virtual day.
    - **Templating**: Low-complexity interactions (e.g., "Nudge me") use local templates matched to the user's tone, saving AI calls for complex reasoning.

## 3. Backend API Reference

### Scheduler
- `POST /api/scheduler/plan`: Maps a list of subtasks to the calendar.
- `GET /api/scheduler/urgency`: Returns all subtasks sorted by the Urgency Engine.

### Accountability
- `POST /api/accountability/cron-check`: Stateless endpoint for monitoring missed deadlines.
- `POST /api/accountability/excuse`: Evaluates a user's reason for a missed task.

### Identity & Settings
- `GET /api/settings`: Retrieves user profile, focus hours, and accountability tone.
- `POST /api/settings/time-warp`: Updates the global virtual time offset.

## 4. UI/UX Principles (Product Experience)

- **Visual Hierarchy**: Urgency is conveyed through color-coded "Banding" (Red, Amber, Green) and typography weight.
- **Motion Design**: Uses `motion/react` for staggered entrances of task lists and smooth transitions between creation steps.
- **Responsive Stage Sizing**: The calendar utilizes a `ResizeObserver` to maintain precise block positioning across all viewport sizes.
