"use client";
import React from "react";

export class WidgetErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — the frame stays alive */ }
  render() {
    return this.state.failed
      ? <div className="tn-cw-failed">This widget hit an error.</div>
      : this.props.children;
  }
}
