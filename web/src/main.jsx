import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './hud/afterlife.css'
import './hud/host.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
