# Canvas Manager

A local-first desktop application for managing and running **Excalidraw** and **tldraw** canvases, organised into projects. All data is stored on-device in a SQLite database; nothing leaves your machine unless you explicitly export a backup.

Built with Next.js (static export) + Tauri v2.

---

## Features

- **Two canvas engines** — Excalidraw (freehand drawing) and tldraw (structured diagramming), selectable per canvas
- **Project organisation** — group canvases into named projects; rename projects and canvases inline or from context menus
- **Recent dashboard** — open recently used canvases across all projects from the home view
- **Global search** — search canvases by canvas name, project name, or canvas type with `Cmd/Ctrl+K`
- **Auto-save with status** — changes are debounced and written to SQLite automatically, with `Unsaved`, `Saving`, `Saved`, and `Save failed` states
- **Manual save flush** — `Cmd/Ctrl+S` immediately flushes pending editor changes
- **Version history** — each successful save creates a capped local snapshot; restore older versions from the editor
- **Thumbnail cards** — generated canvas thumbnails make grid, recent, and search views easier to scan
- **Right-click workflows** — context menus for projects and canvases expose rename, duplicate, move, export, and trash actions
- **Soft delete & Trash** — projects and canvases are moved to trash rather than deleted immediately; restore or permanently delete from the Trash panel
- **Undo delete** — moving a project or canvas to trash shows an undo toast
- **Canvas operations** — duplicate a canvas including its data, move it to a different project, export one canvas, or export one project
- **Backup import/export** — export all projects/canvases as JSON and import that backup later
- **Recency sorting** — canvases are ordered by last-opened time so the most recent work surfaces first
- **Keyboard shortcuts** — `Cmd/Ctrl+N`, `Cmd/Ctrl+K`, `Cmd/Ctrl+S`, and `Escape`

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+N` | Create an untitled project from the dashboard, or an untitled Excalidraw canvas inside a selected project |
| `Cmd/Ctrl+K` | Open global canvas search |
| `Cmd/Ctrl+S` | Flush pending editor save immediately |
| `Escape` | Close delete confirmations, search, or Trash |

---

## Context Menus

Right-click a project in the sidebar:

- Rename
- Export project JSON
- Move to trash

Right-click a canvas card:

- Rename
- Duplicate
- Move to another project
- Export canvas JSON
- Move to trash

The editor action menu exposes rename, duplicate, export JSON, version history, and trash for the active canvas.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 16 (App Router, `output: 'export'`) |
| Desktop wrapper | Tauri v2 |
| Database | SQLite via `@tauri-apps/plugin-sql` (no ORM) |
| Canvas — drawing | Excalidraw 0.18 |
| Canvas — diagramming | tldraw v5 |
| Styling | Tailwind CSS v4 |
| Icons | lucide-react |
| Auto-save | lodash.debounce (500 ms) |
| Language | TypeScript / Rust |

---

## Architecture

```
canvas/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # HTML shell (server component)
│   │   ├── page.tsx                # SPA root — all state lives here ('use client')
│   │   └── globals.css             # Tailwind v4 + scoped canvas resets
│   ├── components/
│   │   ├── Sidebar.tsx             # Project list with inline create / rename / delete / trash
│   │   ├── CanvasGrid.tsx          # Canvas cards + create modal + context menu actions
│   │   ├── CanvasEditor.tsx        # Full-screen editor shell + save status + action menu + history
│   │   └── editors/
│   │       ├── ExcalidrawEditor.tsx  # Loaded via dynamic(ssr:false)
│   │       └── TldrawEditor.tsx      # Loaded via dynamic(ssr:false)
│   └── lib/
│       ├── types.ts                # Project, Canvas, version, and backup TypeScript interfaces
│       └── db.ts                   # All SQL executed here via @tauri-apps/plugin-sql
└── src-tauri/
    ├── src/
    │   ├── main.rs                 # Binary entry point
    │   └── lib.rs                  # Plugin registration + SQL migrations
    ├── build.rs
    ├── Cargo.toml                  # tauri 2 + tauri-plugin-sql/sqlite
    ├── tauri.conf.json             # Window config, frontendDist: ../out
    ├── capabilities/
    │   └── default.json            # sql:allow-execute/select/load permissions
    └── icons/                      # App icons (PNG, RGBA)
```

### Architectural rules

- **No API routes.** `output: 'export'` is enforced in `next.config.ts`. The only way data moves is `frontend → @tauri-apps/plugin-sql → Tauri IPC → SQLite`.
- **SSR-safe.** All Tauri IPC calls happen inside `useEffect`. Both canvas editors are `dynamic(..., { ssr: false })` so they are never executed during the Next.js static build.
- **No ORM.** Raw SQL is used throughout `src/lib/db.ts` with `?` bound parameters.
- **Local backups only.** Import/export uses browser JSON blobs; no remote service is involved.

---

## Database Schema

Migrations run automatically on first launch via `tauri_plugin_sql::Builder::add_migrations`.

```sql
CREATE TABLE IF NOT EXISTS Project (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    deletedAt DATETIME                -- NULL = active, set = in trash
);

CREATE TABLE IF NOT EXISTS Canvas (
    id        TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    name      TEXT NOT NULL,
    type      TEXT NOT NULL CHECK(type IN ('excalidraw', 'tldraw')),
    data      TEXT,                   -- JSON snapshot blob
    thumbnail TEXT,                   -- generated data URL for grid/search previews
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    openedAt  DATETIME,               -- updated on open; used for recency sort
    deletedAt DATETIME,               -- NULL = active, set = in trash
    FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CanvasVersion (
    id        TEXT PRIMARY KEY,
    canvasId  TEXT NOT NULL,
    data      TEXT NOT NULL,
    thumbnail TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (canvasId) REFERENCES Canvas(id) ON DELETE CASCADE
);
```

The database file is created at:
- **macOS:** `~/Library/Application Support/com.canvas.manager/local-projects.db`

---

## Auto-save

Both editors write to the database automatically — no save button needed.

| Editor | Hook | Serialised as | Debounce |
|---|---|---|---|
| Excalidraw | `onChange(elements, appState)` | `{ elements, appState }` JSON | 500 ms |
| tldraw | `editor.store.listen(…)` via `onMount` | `getSnapshot(editor.store)` JSON | 500 ms |

Each successful write also records a local version snapshot, capped to the latest 20 versions per canvas. The editor header shows save state, blocks accidental navigation when changes are unsaved or failed, and supports `Cmd/Ctrl+S` for an immediate save flush.

---

## Backup Format

Full backup exports are JSON objects with this shape:

```ts
interface BackupData {
  version: 1;
  exportedAt: string;
  projects: Project[];
  canvases: Canvas[];
}
```

Single-canvas exports contain one `Canvas`. Project exports contain `{ version: 1, project, canvases }`.

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- Rust (stable) — install via [rustup](https://rustup.rs)
- Xcode Command Line Tools (macOS)

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Development

```bash
npm install
npm run tauri dev
```

This starts the Next.js dev server on `localhost:3000` and opens a Tauri window with hot-reload.

### Production Build

```bash
npm run tauri build
```

Output:

```
src-tauri/target/release/bundle/
├── macos/Canvas Manager.app          <- drag to /Applications
└── dmg/Canvas Manager_0.1.0_aarch64.dmg
```

### Verification

```bash
npm run lint
npm run build
cd src-tauri && cargo test
npm run tauri build
```

### GitHub Releases

Tagged versions trigger the release workflow and attach the macOS app/DMG artifacts to a GitHub Release.

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow runs `npm run tauri build` on `macos-latest` and uploads files from `src-tauri/target/release/bundle/`.

---

## Key Design Decisions

**Why `output: 'export'`?**
Tauri serves a static bundle from disk (`out/`). There is no Node.js server at runtime, so server-side features like API routes are unavailable by design. This forces all persistence through Tauri's native plugin system.

**Why no ORM?**
The Tauri SQL plugin exposes raw `execute` / `select` on the frontend. Adding an ORM layer would require a Node.js runtime that doesn't exist in this setup. Plain SQL with `?` bound parameters is simpler and safer.

**Why dynamic imports with `ssr: false`?**
Both Excalidraw and tldraw access `window`, `document`, and `<canvas>` immediately on import. Next.js pre-renders pages at build time (even client components), which would crash without `ssr: false`. The dynamic wrappers ensure the editors only load inside the live WebView.

**Why debounce instead of a manual save button?**
Canvas editors produce a stream of micro-changes. Debouncing at 500 ms collapses rapid edits into a single write, keeping SQLite load low. The app also flushes pending changes on unmount and supports `Cmd/Ctrl+S` so the last state can be persisted immediately.

**Why soft delete?**
Permanent deletion of canvas data is irreversible. Soft delete (setting `deletedAt`) gives users a safety net without requiring a separate backup system. The Trash panel provides restore and explicit permanent-delete actions.

**Why generated thumbnails instead of canvas screenshots?**
The app embeds two third-party editors with different rendering models. Generated thumbnails provide stable previews across Excalidraw and tldraw without relying on brittle DOM or canvas screenshot hooks.
