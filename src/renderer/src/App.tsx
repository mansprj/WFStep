import { useState } from 'react'
import './App.css'
import Workflows from './components/Workflows'
import ActionRunner from './components/ActionRunner'
import Logs from './components/Logs'
import Settings from './components/Settings'
import Guide from './components/Guide'
import UpdateIndicator from './components/UpdateIndicator'

type TabKey = 'workflows' | 'runner' | 'logs' | 'settings' | 'guide'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'workflows', label: 'Workflows' },
  { key: 'runner', label: 'Runner' },
  { key: 'logs', label: 'Logs' },
  { key: 'guide', label: 'Guide' },
  { key: 'settings', label: 'Settings' },
]

function App() {
  const [tab, setTab] = useState<TabKey>('workflows')

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-heading">
          <h1>WF Step</h1>
          <p className="subtitle">Workflows & action runner</p>
        </div>
        <UpdateIndicator />
      </header>

      <nav className="app-tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.key}
            role="tab"
            aria-selected={tab === item.key}
            className={`app-tab${tab === item.key ? ' active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className="app-content">
        {tab === 'workflows' && <Workflows />}
        {tab === 'runner' && <ActionRunner />}
        {tab === 'logs' && <Logs />}
        {tab === 'guide' && <Guide />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}

export default App
