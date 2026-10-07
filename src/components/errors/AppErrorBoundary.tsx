import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './ErrorState';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    error: undefined,
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info);
  }

  private retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  private reload = () => {
    window.location.reload();
  };

  private dashboard = () => {
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <ErrorState
        title="Career Companion needs to restart"
        message="An unexpected error stopped the application from rendering. Try again or reload the page."
        error={this.state.error}
        showRetry
        showReload
        showDashboard
        onRetry={this.retry}
        onReload={this.reload}
        onDashboard={this.dashboard}
      />
    );
  }
}
