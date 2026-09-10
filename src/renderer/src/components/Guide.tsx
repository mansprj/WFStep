import {
  KIND_HELP,
  KIND_LABELS,
  KIND_PLACEHOLDERS,
  type ActionKind,
} from '../actionForm'
import ActionIcon from './ActionIcon'

interface GuideItem {
  title: string
  body: string
  actionKind?: ActionKind
}

interface GuideSection {
  key: string
  title: string
  blurb: string
  items: GuideItem[]
}

// Extra context shown for each action, on top of the generated help text.
// Keep adding entries here whenever an action gains new behaviour.
const EXTRA_ACTION_TIPS: Partial<Record<ActionKind, string>> = {
  start: 'Use the Browse… button to pick the .exe. Add a Delay step after it if the program takes time to open.',
  stop: 'Works with the full path or just the process name (e.g. Discord).',
  restart: 'Stops then starts the process. Use the path you started it with when possible.',
  delay: 'Very useful between Start and Window steps so the app has time to appear.',
  shell: 'Runs through cmd. Example: echo hello or ping 10.0.0.1 -n 3.',
  openUrl: 'Only http and https links are allowed; opens in your default browser.',
  clickText: 'Uses Windows UI Automation: the element must expose readable text (buttons, links, menus). Set the Window field and a generous Timeout for slower screens.',
  waitForWindow: 'Polls until the window appears or the Timeout runs out. The workflow fails if the window is never found.',
  activateWindow: 'Matches by window title or program name (partial match is fine). Use the Window… button to pick an exact match.',
  ifWindowExists: 'On failure, skips the next steps (Skip next count) or stops the whole workflow when set to 0.',
}

const QUICK_START: GuideItem[] = [
  {
    title: 'Build a workflow',
    body: 'Open the Workflows tab, press New workflow, give it a name, then add steps from top to bottom. Steps run in order; drag the ⋮⋮ handle to reorder them.',
  },
  {
    title: 'Run it',
    body: 'Press Run next to the workflow. Only one workflow runs at a time, so a scheduled run is skipped (and logged) if another is still active.',
  },
  {
    title: 'Test first',
    body: 'Unsure how an action behaves? Try it alone in the Runner tab before adding it to a workflow.',
  },
]

const ACTIONS: GuideItem[] = (Object.keys(KIND_LABELS) as ActionKind[]).map(
  (kind) => ({
    title: KIND_LABELS[kind],
    body: `${
      EXTRA_ACTION_TIPS[kind] ?? KIND_HELP[kind]
    } Parameter: ${KIND_PLACEHOLDERS[kind]}.`,
    actionKind: kind,
  }),
)

const HOTKEYS: GuideItem[] = [
  {
    title: 'Recording',
    body: 'Click the Hotkey field in the workflow editor, then press the keys. The combination must include Ctrl or Alt, for example Ctrl+9 or Alt+M.',
  },
  {
    title: 'Global shortcut',
    body: 'The hotkey works even while the window is closed — as long as WF Step keeps running in the tray.',
  },
  {
    title: 'Conflicts',
    body: 'Each hotkey can belong to only one workflow. If a combination is already used, the save is rejected so nothing is overwritten.',
  },
]

const SCHEDULES: GuideItem[] = [
  {
    title: 'Interval',
    body: 'Runs every N minutes (1–10080) aligned to the system clock: every 30 min means at :00 and :30. Max is 7 days.',
  },
  {
    title: 'Time of day',
    body: 'Runs at a fixed time on the chosen weekdays. Fill 24h format, e.g. 09:00, and at least one day must be selected.',
  },
  {
    title: 'On app start',
    body: 'Fires roughly 8 seconds after WF Step starts — and only then. Editing a workflow later does not re-trigger it.',
  },
  {
    title: 'File watch',
    body: 'Fires when a watched file or folder changes. Folders are watched non-recursively. The path must exist, otherwise it is logged. A 10-second cooldown swallows bursts of changes.',
  },
  {
    title: 'Clipboard',
    body: 'Fires when copied text matches a pattern (regular expression, or plain text if the regex is invalid). Each distinct piece of text fires only once.',
  },
  {
    title: 'While it runs',
    body: 'Scheduled runs fire only while WF Step is running. A next run hint appears in the workflow list for interval and time schedules.',
  },
]

const RUNNER: GuideItem[] = [
  {
    title: 'One action at a time',
    body: 'Pick an action type, enter the parameter and press Run action. The result appears right below — perfect for verifying an action before using it in a workflow.',
  },
]

const LOGS: GuideItem[] = [
  {
    title: 'Reading the log',
    body: 'Entries are colour-coded: green = success, red = failure. The badge tells whether the entry comes from a workflow run or an action runner test.',
  },
  {
    title: 'Scheduled runs',
    body: 'Look for "Scheduled run triggered" (green) or "Skipped scheduled run" (red) — the latter means another workflow was already running.',
  },
  {
    title: 'Limits',
    body: 'The list keeps up to 500 entries in memory. Clear wipes the current view (stored entries are re-read from disk on next start).',
  },
]

const SETTINGS: GuideItem[] = [
  {
    title: 'Autostart with system',
    body: 'Registers WF Step to start with Windows. Turn it on if you rely on global hotkeys or schedules even when you forget to launch the app.',
  },
  {
    title: 'Theme',
    body: 'Choose the appearance: Graphite + Amber, Light, Midnight Blue, or Follow system (auto-switches with Windows dark/light mode).',
  },
]

const TROUBLESHOOTING: GuideItem[] = [
  {
    title: 'Window step does nothing',
    body: 'Matching uses the window title or the process name. Use the Window… button to pick from open windows, and make sure the process is running first.',
  },
  {
    title: 'Click element by text misses',
    body: 'UI Automation can only click text the control exposes. Try the exact visible label, fill the Window field, and raise the Timeout.',
  },
  {
    title: 'A schedule never fires',
    body: 'WF Step must be running (tray is fine). For file watch the path must exist; for clipboard only *new* copies match; interval/time use your system clock.',
  },
  {
    title: 'Workflow unexpectedly skipped',
    body: 'Only one workflow runs at a time. If another workflow is active, the scheduled one is skipped and logged with "another workflow is running".',
  },
  {
    title: 'Regex gave an error',
    body: 'An invalid clipboard pattern falls back to plain substring matching, so a broken regex still works as a literal search.',
  },
]

const SECTIONS: GuideSection[] = [
  { key: 'overview', title: 'Quick start', blurb: 'How everything fits together.', items: QUICK_START },
  { key: 'actions', title: 'Actions reference', blurb: 'Every action type and what it does.', items: ACTIONS },
  { key: 'hotkeys', title: 'Hotkeys', blurb: 'Assign shortcuts to workflows.', items: HOTKEYS },
  { key: 'schedules', title: 'Schedules', blurb: 'Run workflows automatically.', items: SCHEDULES },
  { key: 'runner', title: 'Action runner', blurb: 'The built-in testing area.', items: RUNNER },
  { key: 'logs', title: 'Logs', blurb: 'Understand the event journal.', items: LOGS },
  { key: 'settings', title: 'Settings', blurb: 'Autostart and appearance.', items: SETTINGS },
  { key: 'troubleshooting', title: 'Troubleshooting', blurb: 'Common problems and fixes.', items: TROUBLESHOOTING },
]

function Guide() {
  return (
    <div className="field">
      <h2 className="field-title">Guide</h2>
      <p className="help">
        Instructions for every part of the app. Sections can be collapsed.
      </p>

      <div className="guide">
        {SECTIONS.map((section, sectionIndex) => (
          <details
            key={section.key}
            className="guide-section"
            open={sectionIndex === 0}
          >
            <summary>
              <span className="guide-section-label">{section.title}</span>
              <span className="guide-section-blurb">{section.blurb}</span>
            </summary>
            <ul className="guide-list">
              {section.items.map((item) => (
                <li key={item.title} className="guide-item">
                  <span className="guide-item-head">
                    {item.actionKind !== undefined && (
                      <ActionIcon kind={item.actionKind} />
                    )}
                    <span className="guide-item-title">{item.title}</span>
                  </span>
                  <span className="guide-item-body">{item.body}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  )
}

export default Guide