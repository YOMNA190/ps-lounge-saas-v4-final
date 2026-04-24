import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import App from './App'
import { AuthProvider } from './lib/auth-context'
import { BranchProvider } from './lib/branch-context'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BranchProvider>
          <App />
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: '#16161f',
                border: '1px solid #1e1e2e',
                color: '#e8e8f0',
                fontFamily: 'IBM Plex Sans Arabic, sans-serif',
              },
            }}
          />
        </BranchProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
