import React from 'react';

interface Props {
  children?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'An unexpected error occurred';
      let isFirestoreError = false;
      
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error && parsed.operationType) {
          isFirestoreError = true;
          errorMessage = `Database Error: ${parsed.error}`;
          if (parsed.error.includes('Missing or insufficient permissions')) {
            errorMessage = "You do not have permission to access this data. Please ensure you are logged in with an authorized admin account.";
          }
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 border border-red-100">
            <h2 className="text-xl font-bold text-red-600 mb-4">Something went wrong</h2>
            <div className="bg-red-50 text-red-800 p-4 rounded-md text-sm mb-4 break-words">
              {errorMessage}
            </div>
            <button
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              onClick={() => window.location.href = '/'}
            >
              Return to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
