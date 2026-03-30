import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode; fallback?: ReactNode }

type State = { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message || String(err) }
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('UI error:', err, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="card error-card" role="alert">
            <h2>Something went wrong</h2>
            <p>{this.state.message}</p>
            <p className="muted">Try refreshing the page. If charts fail, check the browser console.</p>
          </div>
        )
      )
    }
    return this.props.children
  }
}
