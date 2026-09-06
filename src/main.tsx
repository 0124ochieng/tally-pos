import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './app/AuthContext'
import { ThemeProvider } from './app/ThemeContext'
import { LicenseGate } from './app/LicenseGate'
import { ToastProvider } from './components/ui/Toast'
import { UndoProvider } from './components/ui/UndoBar'
import { ErrorBoundary } from './components/ErrorBoundary'

// Belt-and-braces logging for errors an ErrorBoundary can't see (event
// handlers, unguarded promises). This alone doesn't show anything to the
// customer, but it means launching the installed app with
// REACH_POS_DEBUG=1 (see electron/main.cjs) will actually surface a cause
// in DevTools instead of nothing.
window.addEventListener('unhandledrejection', (e) => console.error('Unhandled promise rejection', e.reason))
window.addEventListener('error', (e) => console.error('Unhandled error', e.error ?? e.message))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <LicenseGate>
          <HashRouter>
            <ToastProvider>
              <UndoProvider>
                <AuthProvider>
                  <App />
                </AuthProvider>
              </UndoProvider>
            </ToastProvider>
          </HashRouter>
        </LicenseGate>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
