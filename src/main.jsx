import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Global styles first, so each page's own CSS can override them.
import './index.css'
import AuthProvider from './auth/AuthProvider.jsx'
import DataProvider from './store/DataProvider.jsx'
import ConnectedTrackingProvider from './tracking/ConnectedTrackingProvider.jsx'
import ToastProvider from './components/toast/ToastProvider.jsx'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <ConnectedTrackingProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </ConnectedTrackingProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
