import React from "react";

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="panel m-6 p-6">
          <h2 className="text-lg font-semibold text-severity-critical">Something went wrong</h2>
          <p className="mt-2 text-sm text-slate-300">{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
