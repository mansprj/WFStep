import './App.css'
import ActionRunner from './components/ActionRunner'
import ProcessControls from './components/ProcessControls'

function App() {
  return (
    <div className="app">
      <h1>AutomationHub</h1>
      <p className="subtitle">Process management & action runner</p>

      <ProcessControls />
      <ActionRunner />
    </div>
  )
}

export default App
