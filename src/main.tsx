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
import { logDiagnostic } from './lib/diagnostics'

// Belt-and-braces logging for errors an ErrorBoundary can't see (event
// handlers, unguarded promises). Registered before anything else even
// starts rendering, so this also catches a startup failure in LicenseGate's
// bootstrap sequence, not just errors after the app is already up. Beyond
// the console.error (only visible with REACH_POS_DEBUG=1 DevTools open —
// see electron/main.cjs), each one is also persisted via logDiagnostic so
// "Export Diagnostics" in Settings has something to show for it afterwards.
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection', e.reason)
  logDiagnostic('Unhandled promise rejection', e.reason instanceof Error ? e.reason.stack : String(e.reason))
})
window.addEventListener('error', (e) => {
  console.error('Unhandled error', e.error ?? e.message)
  logDiagnostic('Unhandled error', e.error instanceof Error ? e.error.stack : String(e.error ?? e.message))
})

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
