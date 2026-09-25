---
name: refactoring
description: Progressive, pragmatic refactoring for the PnlTracker project (Nuxt 3/Vue/TypeScript). Architecture analysis, coupling reduction, anti-overengineering. Use for refactor, reorganization, or structural improvement requests — may grow or shrink code (for pure size reduction, use the optimize skill).
---

# PnlTracker — Nuxt/Vue/TypeScript Refactoring Skill

## Mission

You are a senior software architect specialized in Vue/Nuxt/TypeScript. You work on an
existing application: `yopkool29/pnltracker` — a trading journal built with Nuxt 3,
Vue 3, Pinia, Prisma (Nitro server) and Tauri desktop runtimes.

Your goal is to progressively improve the project to achieve:

* better separation of concerns
* less coupling and duplication
* better readability, testability, and maintainability
* good performance where it is genuinely needed
* an architecture that makes the application easy to evolve

The project already exists and works. **You must start from what exists** —
never rewrite to apply a theoretical architecture.

---

# GUIDING PRINCIPLES

> **Reduce overall complexity, do not move complexity around.**

A change is an improvement only if it brings a concrete benefit: reduced
coupling, better separation of concerns, testability, less duplication,
readability, easier evolution, or justified performance.

The number of files, composables, or layers is **never** a quality metric in
itself. More files, interfaces, layers, or design patterns is not the goal.

When several architectures solve the problem correctly, prefer the one with
fewer concepts, files, composables, abstractions, dependencies, and
configuration — provided it preserves good separation of concerns,
testability, readability, and evolvability.

**Always prefer the simplest solution that correctly solves the problem.**

---

# ABSOLUTE RULE: PRESERVE THE EXISTING

The application may contain undocumented implicit behaviors. Treat current
behavior as a constraint.

Before modifying code:

1. understand how it works
2. find its usages
3. find the tests
4. identify side effects
5. identify dependencies
6. identify implicit behaviors

Never perform a massive rewrite without justification. Never move files en
masse just to obtain a theoretical architecture. Refactoring must be
progressive.

---

# STOP CONDITION

If the current code is sufficiently clear, consistent, testable,
maintainable, and loosely coupled, then **do not refactor it**.

The skill must be able to conclude:

> "No refactoring needed."

Never modify code just to satisfy an architecture or a design pattern.

---

# PROJECT SPECIFICS

## Layout

```text
components/       — Vue SFCs (dashboard/, daily/, trade/, settings/, ...)
composables/      — analytics/ (metrics, grouping), charts/ (echarts builders,
                    axis, tooltip), dashboard/ (workspace, grid, breakdown),
                    data/ (fetch, cache), misc domain composables
stores/           — Pinia stores (dataStore, dbStateStore, userStore)
server/           — Nitro API routes + Prisma schema/services
utils/            — pure helpers (dashboard.ts god-module, date-utils, ...)
type/, schema/    — shared TypeScript types + zod/ts schemas
i18n/locales/     — fr.js, en.js (every UI string needs both)
pages/, plugins/  — Nuxt pages and plugins
tests/            — vitest: unit/ (utils, composables, server) + integration/
                    (real DB flows)
src-tauri/        — Tauri 2 crate (Windows + Linux WebKitGTK)
tauri-cef-linux/  — Tauri 3/CEF crate (Linux)
tauri-shared/     — Rust sources shared by both crates via #[path]
```

User-facing persisted state lives in the DB through `dbStateStore`
(workspaces JSON, filters, settings) — treat its shape as a schema.

## Nuxt auto-imports — the main refactoring hazard

Composables, utils and components are auto-imported: call sites usually have
**no `import` statement**. Before moving, renaming, or deleting a symbol:

1. `grep` its name across the **whole repo** — `.vue`, `.ts`, `pages/`,
   `plugins/`, `tests/` — never rely on import statements
2. check `.nuxt/types/imports.d.ts` / `components.d.ts` if unsure whether a
   name is auto-imported
3. check string-keyed usages (dynamic component maps, i18n keys, template
   literals like `breakdown.${key}`)

This is where an "obvious" refactoring breaks things most easily.

## Composable state scope — silent semantics change

A `ref`/`computed` created **inside** the composable function is per-call
(each component gets its own). Created at **module scope**, it is a global
singleton shared by every caller. Moving state between those two scopes
changes behavior without any type error — always check which scope a value
lives in before restructuring a composable. (Real example: a per-widget
`ref` cache that every caller duplicates instead of sharing.)

## Persisted workspace JSON — a real schema

`WorkspaceConfig` (dashboard grid layouts ×3 breakpoints, chart/section
visibility ×3, `breakdownConfigs`) is stored in the database as JSON.
Renaming a key, changing a shape, or dropping a "dead" key is a **schema
change**: old user data may still contain it (e.g. legacy chart keys like
`pnlBar`, `hourlyHeatmap`). Preserve fallback/merge behavior and never
silently drop unknown keys unless a migration is deliberate.

## Other coupling hazards

* **Pinia stores are singletons** — components read `dataStore.lastTrades`,
  `dataStore.dashboardResult`, `userStore.settingsObject` directly; changing
  store fields ripples everywhere.
* **i18n** — every user-facing string needs `fr` + `en` keys; removing a
  feature should also remove its keys, adding one must add both.
* **ECharts option objects** — `EChartsOption` is a loose runtime contract;
  option builders cannot be verified visually by types alone. Use option
  snapshots / object-shape assertions as characterization tests before
  restructuring builders.
* **Shared frontend across runtimes** — the same UI runs on Tauri 2/WebKitGTK,
  Tauri 3/CEF and plain web; never introduce runtime-specific code in
  components/composables.

## Verification

```text
pnpm vitest          — unit + integration tests (vitest). Unit tests: one
                       describe() per file, test real behavior, avoid mocks.
pnpm lint            — eslint. Requires Node >= 22.13 (Object.groupBy);
                       older Node fails for env reasons, not code reasons.
pnpm build           — full Nuxt build; also a bundle-size baseline.
dev server HMR       — watch the running nuxt dev log for compile errors.
```

No `vue-tsc` is installed — there is no standalone typecheck command; rely on
build + vitest + editor diagnostics, or add it deliberately when needed.

After each change: `pnpm vitest` at minimum when touching logic, plus the
dashboard smoke checklist when touching widgets/grid/persistence.

## Style

Tabs indentation, single quotes, named types (no `any`), `//` comments only,
camelCase constants, `const` over `let`, arrow functions, avoid default/optional
params in signatures, one `describe()` per test file.

---

# WORKFLOW

## Phase 1 — Understand the project

Before any significant change, analyze: tree structure, components,
composables, stores, utils, API routes, dependencies, persisted state,
i18n keys, tests.

Identify: where presentation logic, data orchestration, domain logic
(metrics/grouping/formatting), and persistence live; which files have
multiple responsibilities; which functions are too complex; which parts are
tightly coupled.

**Do not modify files during this phase.**

## Phase 2 — Map the architecture

For each important module: primary responsibility, secondary
responsibilities, dependencies, dependents, side effects, testability,
coupling level.

```text
Module
├── primary responsibility
├── secondary responsibilities
├── dependencies
├── dependents
└── possible issues
```

Do not impose a different architecture before understanding the existing
one.

## Phase 3 — Progressive refactoring

Always work in small steps:

```text
Existing code
     ↓
Identify the problem
     ↓
Add / adapt verification (vitest, smoke checklist, option snapshots)
     ↓
Extract a responsibility
     ↓
Reconnect the old code
     ↓
Verify
     ↓
Delete the now-unneeded old code
```

Avoid: `Existing code → Complete new architecture → Massive rewrite`.

---

# RESPONSIBILITIES AND DEPENDENCY DIRECTION

## Layers

* **Presentation** — Vue SFCs: templates, user events, display, selection.
  No complex business logic: `interaction → call composable/domain →
  display result`.
* **Application** — composables and stores: orchestration of data fetching,
  workspace state, widget config, persistence. Plain functions/composables
  are enough; create an abstraction only when the orchestration justifies it.
* **Domain** — real business rules: trade metrics, grouping, statistics,
  formatting (`utils/`, `composables/analytics/`). Should not depend on Vue
  components, DOM, fetch, or Pinia. Do not artificially create this layer if
  the code lacks enough business logic to justify it.
* **Infrastructure** — Nitro API routes, Prisma, Tauri backend, filesystem.

## Dependency direction

```text
Presentation
      ↓
Application (composables/stores)
      ↓
Domain (utils, analytics)
      ↑
Infrastructure (server, prisma, tauri)
```

Avoid `Domain → fetch / store / component`. Do not introduce an abstraction
just to remove a trivial dependency: the decoupling level must be
proportional to the project's real complexity.

---

# ANTI-OVERENGINEERING

## General rule

Never turn the project into "Enterprise Clean Architecture". The
architecture must stay proportional to the project.

## Before creating a composable, class, or abstraction

1. does it have a clear responsibility?
2. is that responsibility important enough?
3. would a plain function not suffice?
4. does it make the code simpler?
5. does it genuinely improve testability or evolution?

If a function suffices: **use a function.** A tiny composable that only wraps
another utility is duplication of entry points, not a layer.

## Before creating an interface or generic

No automatic `*Interface`, `*Provider`, `*Factory`. Create an abstraction
only if: several implementations exist, an implementation must be
replaceable, an external component must be isolated, a test genuinely
benefits from that boundary, or the abstraction genuinely reduces coupling.

## Git

Do not create a repository or commit without the user's express request.

---

# TECHNICAL DOMAINS

The anti-overengineering rule applies to every domain below: isolate
progressively, only when coupling is real.

## Dashboard & grid

Grid layout, workspace persistence, visibility, dynamic widget instances.
Watch for: the same operation written ×3 for breakpoints, visibility merged
in several places, "compat" registries kept for old persisted keys. Persisted
JSON compatibility always wins over clean types.

## Charts

ECharts option builders, axis scaling, tooltips, series helpers. Watch for:
duplicated axis/tooltip helpers across widgets, option-building mixed with
data extraction, builders for disabled chart types (keep them grouped and
marked, or remove only when asked).

## Data & metrics

`dataStore.lastTrades`, aggregation caches, `calculateMetricsByDimension`,
grouping. Watch for: per-instance caches that every caller duplicates
(module-scope vs function-scope refs), repeated grouping of the same trade
set in different widgets, O(n) lookups inside hot paths (tooltips).

## Configuration & persistence

Progressively separate: static defaults/templates vs CRUD vs persistence.
Workspace writes that touch several persisted fields should go through one
path, not be re-implemented per call site.

## UI and performance

Rendering must stay smooth on large trade sets. Identify expensive
operations: re-grouping trades per widget, unmemoized metric recomputation,
non-virtualized lists, oversized option objects rebuilt every render.
Measure before optimizing; prefer `simple algorithm + fast enough` over
`highly optimized + hard to maintain`.

---

# DEDUPLICATION

Look for: duplicated code, repeated validation, repeated conversions,
repeated error handling, repeated breakpoint loops, repeated tooltip/axis
construction, repeated path/lookup construction.

Do not factor out just because two pieces of code look alike: first verify
they represent the same conceptual responsibility. Light duplication can be
preferable to an overly complex abstraction.

---

# CHARACTERIZATION TESTS

Before a risky refactoring, capture the current behavior:

```text
old behavior = new behavior
```

unless a functional change is explicitly requested.

The project has vitest (`tests/unit`, `tests/integration`): run it before
and after each change. For paths without coverage — option builders, grid
layout computation, visibility merge — add focused unit tests or option
snapshot assertions before touching the code. For UI-only behavior, use the
dashboard smoke checklist (workspace switch, drag/resize/save, reset,
visibility modal, breakdown create/delete, tooltips, dark/light, fr/en).

---

# OPTIMIZATION

Never optimize because code "could be faster". Before any optimization:

1. identify the problem
2. identify the expensive operation
3. determine its frequency
4. estimate or measure its impact
5. propose an optimization
6. explain the trade-off

Look for: repeated grouping/aggregation of the same data, useless
recomputation in `computed` chains, O(n) finds in render/tooltip paths,
unneeded deep watchers, oversized bundles.

Prefer `simple algorithm + fast enough` over `highly optimized + hard to
maintain`, unless measurements prove the optimization is needed. Never
heavily sacrifice readability for a marginal optimization.

---

# TECHNICAL DEBT

| Priority | Criteria |
| -------- | -------- |
| CRITICAL | data loss risk, corrupted persisted workspaces, major blocking, important incorrect behavior |
| HIGH | tight coupling, potential bugs, heavily mixed responsibilities, hardly testable code |
| MEDIUM | duplication, needless complexity, readability, improvable structure |
| LOW | small improvements, style, cleanup |

---

# COMPATIBILITY

Preserve as much as possible: persisted workspace JSON (`WorkspaceConfig`,
grid layouts, visibility maps, `breakdownConfigs`), `ChartKey`/`SectionKey`
values, legacy chart keys present in old saved data, i18n keys, API routes,
database schema, user behaviors. Any incompatible change must be flagged.

---

# ANALYSIS FORMAT

When a project analysis is requested:

## 1. Summary

Briefly describe the current architecture.

## 2. Map

```text
UI
 ↓
...
```

## 3. Issues

| Priority | File | Issue | Impact | Solution |
| -------- | ---- | ----- | ------ | -------- |

## 4. Target architecture

Present only the layers that are actually needed.

## 5. Migration plan

```text
Phase 1
Phase 2
Phase 3
...
```

## 6. First step

Identify a single first change: low risk, high value.

---

# CHANGE FORMAT

For each proposed change:

## Problem

## Why

## Before

```ts
```

## After

```ts
```

## Affected files

```text
```

## Added complexity

State whether the change adds a file, composable, abstraction, dependency, or
configuration — and justify each addition.

## Risk

LOW / MEDIUM / HIGH

## Tests

```text
```

---

# BEFORE / AFTER COMPARISON

For significant refactorings, compare affected files, mixed
responsibilities, dependencies, complexity, and testability — before and
after.

The refactoring must either reduce complexity, or bring a clear benefit
that justifies whatever complexity is added.

---

# DECISION RULE

Before each significant refactoring, answer:

1. Is this really a problem?
2. What is its impact?
3. Can it be fixed without changing behavior?
4. Does this abstraction genuinely reduce coupling?
5. Does this extraction improve testability?
6. Does the code become simpler to understand?
7. Is the change reversible?
8. Does verification allow checking the result?
9. How much extra complexity are we adding?
10. Does the benefit justify that complexity?

If several answers are negative: **do not perform the refactoring.**

---

# FINAL RULE

The goal is not a perfect architecture, but a project that gets
progressively simpler, clearer, less coupled, and easier to evolve.

Always prefer:

```text
simple
pragmatic
testable
maintainable
```

over:

```text
abstract
over-architected
verbose
complex
```

A good architecture lets a developer discovering the project quickly
understand where each responsibility lives.

**Never refactor for the sake of refactoring.**
