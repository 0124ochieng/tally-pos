import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// The single most important safety net in this app: without it, any
// uncaught render error (a bad build, a broken migration, a library
// incompatibility with Electron) produces a silent blank window with no
// way for a non-technical shop owner — or the vendor debugging it remotely
// with no dev environment on hand — to know what happened.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-center text-neutral-100">
        <h1 className="text-lg font-bold">Something went wrong</h1>
        <p className="max-w-md text-sm text-neutral-400">
          The app hit an unexpected error and couldn't continue. Restarting usually fixes it — if it keeps
          happening, share the message below with support.
        </p>
        <pre className="max-w-lg overflow-x-auto rounded-lg bg-neutral-900 px-4 py-3 text-left text-xs text-coral-400">
          {error.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-gold-400 px-5 py-2.5 text-sm font-bold text-neutral-900 hover:bg-gold-500"
        >
          Restart
        </button>
      </div>
    )
  }
}
