import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { PrimeverseSessionProvider } from './features/primeverse/games/primeverse-online/session/PrimeverseSessionProvider'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <PrimeverseSessionProvider>
        <App />
      </PrimeverseSessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
