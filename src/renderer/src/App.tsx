import './App.css'
import Workflows from './components/Workflows'
import ActionRunner from './components/ActionRunner'
import Logs from './components/Logs'

function App() {
  return (
    <div className="app">
      <h1>AutomationHub</h1>
      <p className="subtitle">Workflows & action runner</p>

      <Workflows />
      <ActionRunner />
      <Logs />
    </div>
  )
}

export default App
