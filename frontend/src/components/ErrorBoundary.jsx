import { Component } from "react";
import { AlertTriangle } from "lucide-react";

// A rendering crash anywhere below this used to unmount the ENTIRE React
// tree, leaving a blank page in the app's own background color with zero
// explanation and no way to recover short of a hard refresh. This catches
// that instead and shows what actually broke, plus a way back without
// losing the person's saved data (everything's on the backend already —
// this is purely a frontend rendering failure, not data loss).
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Render error caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-base px-6 text-center">
          <AlertTriangle size={28} className="text-brass" />
          <div>
            <p className="font-display text-sm font-medium text-ink">Something went wrong rendering the app.</p>
            <p className="mt-1 max-w-md font-mono text-xs text-muted">{this.state.error.message}</p>
          </div>
          <p className="max-w-sm text-xs text-muted">
            Nothing was lost — chats and messages are saved on the backend. Reloading usually clears this.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-brass px-4 py-1.5 text-sm font-medium text-base hover:bg-brass/90"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
