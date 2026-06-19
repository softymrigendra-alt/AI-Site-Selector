import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-3xl mb-3">⚠️</p>
          <p className="text-base font-semibold text-red-700 mb-1">Something went wrong</p>
          <p className="text-sm text-red-500 mb-4 font-mono">{this.state.error.message}</p>
          <button
            onClick={this.reset}
            className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: '#DC2626' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
