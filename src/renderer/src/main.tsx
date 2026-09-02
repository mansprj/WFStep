import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const VALID_THEMES = new Set(['graphite-amber', 'light', 'blue', 'system'])

function applyTheme(theme: string | undefined): void {
  const chosen = theme !== undefined && VALID_THEMES.has(theme) ? theme : 'graphite-amber'
  document.documentElement.setAttribute('data-theme', chosen)
}

// Apply the stored theme as soon as possible to avoid a flash of the default
// palette. Defaults to graphite-amber while settings load.
void window.api.settings.get().then((s) => applyTheme(s.theme))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
