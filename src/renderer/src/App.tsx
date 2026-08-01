import './App.css'
import Applications from './components/Applications'
import Workflows from './components/Workflows'
import ActionRunner from './components/ActionRunner'

function App() {
  return (
    <div className="app">
      <h1>AutomationHub</h1>
      <p className="subtitle">Applications, workflows & action runner</p>

      <Applications />
      <Workflows />
      <ActionRunner />
    </div>
  )
}

export default App
