/**
 * Error Boundary
 * 
 * Catches uncaught React rendering errors and displays a fallback UI.
 * Prevents full-page crashes from a single component failure.
 */
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Fallback UI to render on error. Receives error and reset handler. */
  fallback?: (error: Error, resetError: () => void) => ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[BCAMS ErrorBoundary]', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-md mx-auto">
          <div className="rounded-full bg-destructive-50 p-5 mb-5">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground mb-2">
            An unexpected error occurred while rendering this view.
          </p>
          <code className="text-xs bg-muted px-3 py-2 rounded-md text-muted-foreground mb-6 max-w-full overflow-x-auto block">
            {this.state.error.message}
          </code>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={this.resetError}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Retry
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                this.resetError();
                window.location.hash = '#/';
              }}
            >
              <Home className="h-4 w-4 mr-1.5" />
              Dashboard
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
