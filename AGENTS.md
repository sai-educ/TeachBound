# AGENTS.md

Guidance for AI coding agents (Codex, Claude Code, Cursor, etc.) working in this
repository. The goal is high-quality changes with **lightweight default
validation** — do the minimum that proves the change is sound, and let the human
do final browser validation. Only reach for heavy checks when the task actually
needs them.

---

## Project Overview

**Teach Bound** is a browser-based digital whiteboard for educators and teams.
It is a single-page React app with a separate Node WebSocket server that powers
real-time collaboration.

- **Frontend:** React 19 on **Create React App** (`react-scripts` 5). Plain
  JavaScript (no TypeScript), function components + hooks only.
- **Canvas:** HTML5 2D canvas with device-pixel-ratio (high-DPI) scaling.
- **Collaboration:** [Yjs](https://yjs.dev) CRDT shared over `y-websocket`.
- **Styling:** Hand-written CSS per component, Open Sans font, Lucide icons.
- **Backend:** `server/` — Node + `ws` + `y-websocket` (CommonJS).
- **Deploy:** Frontend on Vercel; collaboration server hosted separately.

---

## React / CRA Project Rule

This repo uses **React 19 on Create React App**. Do not introduce assumptions
from other stacks (Next.js, Vite, the App Router, RSC, etc.).

- Use **function components and hooks** only. Do not add class components.
- Do not introduce TypeScript, a new bundler, or eject CRA without being asked.
- Follow existing patterns before reaching for new libraries. This project keeps
  its dependency list deliberately small — prefer the platform and what is
  already installed.
- ESLint runs through `react-scripts` (the `react-app` config). There is no
  standalone `lint` or `typecheck` script — do not invent one.

---

## Default Workflow: Edit → Validate (light) → Stop

Unless the user explicitly says otherwise, every task uses this workflow:

1. Make the requested change with the **smallest practical diff**.
2. Keep edits **immutable** — never mutate elements or history in place
   (see *Coding Conventions* below).
3. Run **lightweight validation only** (see *Validation Rules*).
4. Report results using the *Final Response Format*. Then **stop**.

Do **not**, by default:

- Run `npm run build` (heavy; CRA build is for release/build-surface work).
- Run the full test suite in watch mode, or add new test infra.
- Run `load-test.js` or any load/stress testing.
- Start long-running dev servers and leave them running.
- Create branches, commits, PRs, or push (see *Git & GitHub*).
- Refactor unrelated code or chase pre-existing lint warnings.

If validation fails, fix **only** failures caused by the current change.

---

## Validation Rules

This is a JavaScript CRA project, so there is no `typecheck` and no standalone
`lint` step. Default validation is intentionally light:

```bash
# Run the relevant test(s) ONCE (not in watch mode) and exit:
CI=true npm test -- --watchAll=false

# Scope to a single file when possible:
CI=true npm test -- --watchAll=false src/App.test.js
```

> **CRA gotcha:** plain `npm test` opens an interactive **watch** session and
> never exits. Always pass `CI=true` (or `--watchAll=false`) in an agent context.

After light validation passes, **the human validates in the browser**. Do not
spin up browser automation or smoke tests unless explicitly asked.

**Escalate to heavier validation only when the task warrants it**, e.g.:

- Build-surface changes (CRA config, `public/`, service worker, env handling)
  → run `npm run build` to confirm it compiles and ESLint passes.
- Canvas rendering / export logic → ask the human to verify visually, or add a
  focused unit test.
- Collaboration / Yjs / server changes → see *Real-Time Collaboration*.

---

## Run & Develop

```bash
npm install              # install frontend deps
cd server && npm install # install collaboration server deps (separate package)

npm start                # frontend (:3000) + backend (:1234) together
npm run start:frontend   # CRA dev server only (http://localhost:3000)
npm run start:backend    # collab server only (nodemon, ws on :1234)
npm run server           # collab server, plain node (no reload)
```

The frontend talks to the collaboration server over WebSocket; the server port
defaults to `1234` (`PORT` env overrides it).

---

## Architecture Map

Centralized, top-down state in `App.js`; the canvas is the rendering surface.

| Area | File | Responsibility |
| --- | --- | --- |
| Root state | `src/App.js` | Tool selection, undo/redo history, element lifecycle, keyboard shortcuts |
| Drawing surface | `src/Canvas.js` | High-DPI canvas, draw/select/drag, PNG (1x/2x/3x) + PDF export |
| Toolbar | `src/Toolbar.js` | Tools, shape dropdown, color/width/font pickers, action buttons |
| Frames | `src/FrameBar.js` | Frame/board navigation strip |
| Top menu | `src/TopMenu.js` | App-level menu actions |
| Collaboration hook | `src/hooks/useCollaboration.js` | Wires React state to the Yjs document |
| Socket service | `src/services/socket.js` | Socket/WebSocket client wiring |
| Collab server | `server/index.js` | `y-websocket` connection setup over `ws` |

> `Canvas.js` is large (~60KB). Prefer extracting focused helpers/hooks over
> growing it further, but keep diffs minimal and behavior identical unless the
> task is an explicit refactor.

---

## Coding Conventions

- **Immutability (critical):** never mutate `elements` or `history` in place.
  Produce new objects/arrays. Undo/redo relies on `history[historyStep]` and the
  immutable `updateElementsAndHistory` flow — preserve it.
- **Element shape:** every drawable has `id` (timestamp-based), `type`
  (`pen | sticky | text | rectangle | circle | triangle | line | arrow`),
  `x`, `y`, plus type-specific fields (paths, dimensions, colors, text).
- **High-DPI canvas:** keep the device-pixel-ratio scaling in `setupHighResCanvas`
  intact; export paths redraw all elements onto an offscreen canvas at scale.
- **Styling:** component-scoped CSS in `[Component].css`, globals in `index.css`,
  CSS variables for theme, Open Sans throughout. Keep colors accessible
  (high-contrast tool palette defined in `Toolbar.js`).
- **Naming:** `camelCase` for vars/functions, `PascalCase` for components,
  `use`-prefixed custom hooks, `is/has/should/can` for booleans.
- Keep files focused and functions small; prefer early returns over deep nesting.

### Adding a new drawing tool

1. Add the tool to `Toolbar.js` (`mainTools` or `shapeTools`) with its shortcut.
2. Implement draw logic in `Canvas.js` (`handleMouseDown/Move/Up`).
3. Add any tool-specific options to the toolbar.
4. Render it in the redraw/export path so it appears on canvas **and** in exports.
5. Register the keyboard shortcut in `App.js` `handleKeyDown`.

---

## Real-Time Collaboration (Yjs)

- The **client** depends on `yjs` ^13 and `y-websocket` ^3 (root `package.json`).
- The **server** (`server/package.json`) pins `y-websocket` ^1.5.4 because v3
  no longer ships the `bin/utils` `setupWSConnection` server helper. `server/index.js`
  degrades gracefully and warns if that helper is missing.
- When touching collaboration: keep client/server protocol compatible, verify a
  two-client sync manually (or with a focused test), and do not silently upgrade
  the server's `y-websocket` to v3 without replacing the server utils
  (`@y/websocket-server`).

---

## Git & GitHub

> **Deliberate divergence from the sample:** this project does **not** auto-push
> to `main`. Be conservative with version control.

- **Commit/push only when the user explicitly asks.** Default to leaving changes
  in the working tree for the human to review.
- The default branch is `main`. When asked to commit, **branch off `main`**
  (e.g. `feat/<short-slug>`) rather than committing directly to it; push with
  `-u` and open a PR.
- Stage only files relevant to the current task; never sweep up unrelated
  working-tree changes.
- Commit message format: `<type>: <description>` where type is one of
  `feat | fix | refactor | docs | test | chore | perf | ci`.
- Before committing: `git branch --show-current` and `git status --short`; review
  scope with `git diff --cached --stat`.
- Do not run history rewrites (`rebase`, force-push), branch cleanup, or merges
  unless explicitly asked.

Remote: `https://github.com/sai-educ/TeachBound.git`.

---

## Token Discipline

Be operationally concise.

- Do not narrate every command or dump full diffs; prefer `git diff --stat` and
  compact file lists.
- Do not re-explore the whole repo — read only what the task touches.
- Do not inspect deploy/CI/remote state unless the task requires it.
- Stop once the change is made and lightly validated.

---

## Security & Quality Gates (before any commit)

- No hardcoded secrets, API keys, or tokens.
- Validate/sanitize any user-provided content rendered to the DOM or canvas.
- No leftover `console.log`/debug statements in committed code.
- Errors are handled explicitly; nothing silently swallowed.

---

## Final Response Format

Keep the final answer concise and structured:

```text
Done.

Changed:
- <files / what changed>

Validation:
- tests: passed / failed / not run (why)
- browser check: deferred to user

Not done (by default):
- production build
- full E2E / load testing
- commit / branch / PR / push (unless asked)
```
