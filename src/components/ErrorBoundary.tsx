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
        <div className="sheet m-6 border-2 border-severity-critical p-6">
          <h2 className="display text-xl font-extrabold text-severity-critical">This page failed to render</h2>
          <p className="mono mt-2 text-sm text-ink">{this.state.error?.message}</p>
          <p className="mt-3 text-sm text-ink-soft">Reload the page. If it keeps happening, check the browser console.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
