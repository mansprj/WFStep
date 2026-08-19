import './App.css'
import Workflows from './components/Workflows'
import ActionRunner from './components/ActionRunner'
import Logs from './components/Logs'
import Settings from './components/Settings'

function App() {
  return (
    <div className="app">
      <h1>WF Step</h1>
      <p className="subtitle">Workflows & action runner</p>

      <Workflows />
      <ActionRunner />
      <Logs />
      <Settings />
    </div>
  )
}

export default App
