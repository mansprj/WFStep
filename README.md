# AutomationHub

AutomationHub is a Windows desktop application for automating repetitive desktop tasks through a clean graphical interface.

## Current Features

- Restart Discord with one click (validates the whole application architecture)
- Process management: find, kill, restart, launch, status
- Automation actions: start/stop/restart app, delay, shell command, open URL, open folder

## Roadmap

- Visual workflow engine (combine actions into sequences)
- Global hotkeys
- User profiles
- Plugin system

## Tech Stack

- Electron
- electron-vite (build tool: dev server, main/preload build, HMR)
- React + TypeScript
- Vite

## Getting Started

### Prerequisites

- Node.js 20.19+ / 22.12+
- npm

### Install

```sh
npm install
```

### Run in development

```sh
npm run dev
```

Builds the main and preload processes, starts the Vite dev server for the renderer, and launches the Electron window with hot reload.

### Build for production

```sh
npm run build
npm start
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start development with hot reload |
| `npm run build` | Typecheck, then build main/preload/renderer to `out/` |
| `npm start` | Preview the production build in Electron |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Typecheck node and web projects |

## Project Structure

```
src/
├── main/        # Electron main process (window, IPC, process management, action executor)
├── preload/     # contextBridge API exposed to the renderer
├── renderer/    # React UI (Vite)
│   ├── public/
│   └── src/
└── shared/      # types and action definitions shared between main and renderer
```

## Architecture

```
React UI
   ↓  window.api.* (exposed via contextBridge)
   ↓  IPC (invoke / handle)
Electron Main Process
   ↓
Windows API / Node.js
```

The renderer never accesses Node.js APIs directly — everything goes through IPC. This keeps the frontend decoupled and prepares the ground for plugins and automation workflows.

## Documentation

Development decisions, status, and roadmap live in the `memory/` folder.
