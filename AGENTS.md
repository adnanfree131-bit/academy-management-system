# AGENTS.md — AI Agent Guidelines & gstack Workflows

This workspace is powered by **gstack** (https://github.com/garrytan/gstack), providing a structured, role-based workflow for AI-assisted software engineering.

---

## 🛠 Available gstack Skills

Skills are installed locally under `.agents/skills/` and can be invoked directly:

### 1. Planning & Product
- **`/gstack`** — Main router skill. Routes any high-level task to the optimal specialist persona.
- **`/office-hours`** — Senior partner / product strategist that pressure-tests requirements, extracts hidden premises, and scopes features.
- **`/plan-ceo-review`** — High-level product and business alignment review.
- **`/plan-eng-review`** — Engineering manager review locking in architecture, schema changes, and edge cases.
- **`/plan-design-review`** — UX/UI review catching usability issues and styling pitfalls.
- **`/autoplan`** — End-to-end autonomous implementation planner.

### 2. Code Review & Security
- **`/review`** — Comprehensive code reviewer identifying production bugs, regressions, and design discrepancies.
- **`/cso`** — Chief Security Officer persona conducting OWASP & STRIDE threat assessments.
- **`/devex-review`** — Developer experience review evaluating ergonomics, testability, and API cleanlines.

### 3. Testing & QA
- **`/qa`** — Full QA lead testing the app visually with automated browser verification, identifying bugs, and iterating on fixes.
- **`/qa-only`** — Diagnostic-only browser QA test without auto-patching code.
- **`/browse`** — Fast, integrated headless browser for web research, UI inspection, and automated DOM verification.

### 4. Shipping & Release
- **`/ship`** — Release manager orchestrating branch audits, test validation, clean commits, and PR preparation.
- **`/land-and-deploy`** — Merging and deployment pipeline verification.

### 5. Debugging & Maintenance
- **`/investigate`** — Root cause diagnostic investigator for tricky bugs and anomalies.
- **`/health`** — Project health inspection and dependency sanity check.
- **`/retro`** — Sprint retrospective analyzer.

---

## 🧭 Core Ethos

- **Boil the Ocean**: AI makes thoroughness cheap. Build the complete solution: test coverage, error handling, edge cases, and type safety.
- **Search Before Building**: Check existing project utilities, standard libraries, and frameworks before creating redundant helpers.
- **User Sovereignty**: The AI provides analysis and recommendations; the user decides. Always confirm before major architectural deviations.
- **Root-Cause Fixes**: Fix issues at their point of origin rather than patching downstream symptoms.

---

## 🪜 The Reuse Ladder

When implementing new logic, stop at the first rung that holds:
1. Existing helper or utility within this codebase.
2. The language standard library.
3. Native platform features (e.g., CSS over JS, DB constraints over application logic).
4. An already-installed library (avoid adding new dependencies for trivial tasks).
