/**
 * Error boundary: a malformed model response (or any render throw) must
 * never blank the whole app mid-demo. Shows a plain message with a
 * "try again" reset instead of a white screen.
 */

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(_error: unknown): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.warn('Latchkey: UI error caught by boundary', error);
  }

  private reset = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-stone-900">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            The app hit an unexpected error. Your saved profile and tracker
            are untouched.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-5 inline-flex items-center rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
