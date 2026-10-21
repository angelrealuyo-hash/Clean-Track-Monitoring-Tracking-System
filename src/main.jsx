import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Global styles first, so each page's own CSS can override them.
import './index.css'
import AuthProvider from './auth/AuthProvider.jsx'
import TrackingProvider from './tracking/TrackingProvider.jsx'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TrackingProvider>
          <App />
        </TrackingProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
