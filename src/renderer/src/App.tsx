import './App.css'
import Workflows from './components/Workflows'
import ActionRunner from './components/ActionRunner'
import Logs from './components/Logs'
import Settings from './components/Settings'
import UpdateIndicator from './components/UpdateIndicator'

function App() {
  return (
    <div className="app">
      <div className="app-header">
        <div>
          <h1>WF Step</h1>
          <p className="subtitle">Workflows & action runner</p>
        </div>
        <UpdateIndicator />
      </div>

      <Workflows />
      <ActionRunner />
      <Logs />
      <Settings />
    </div>
  )
}

export default App
