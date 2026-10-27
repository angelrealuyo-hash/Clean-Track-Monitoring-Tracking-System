import { Component } from 'react'

// Shows `fallback` instead of a blank screen if something inside crashes.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('CleanTrack component error:', error)
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? <div className="ct-alert ct-alert--error">Something went wrong.</div>
    }
    return this.props.children
  }
}
