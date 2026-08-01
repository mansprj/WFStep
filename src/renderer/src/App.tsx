import './App.css'
import ActionRunner from './components/ActionRunner'
import Applications from './components/Applications'

function App() {
  return (
    <div className="app">
      <h1>AutomationHub</h1>
      <p className="subtitle">Applications & action runner</p>

      <Applications />
      <ActionRunner />
    </div>
  )
}

export default App
