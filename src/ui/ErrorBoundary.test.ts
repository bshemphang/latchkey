import { describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary', () => {
  it('derives the error state from a thrown error', () => {
    expect(ErrorBoundary.getDerivedStateFromError(new Error('boom'))).toEqual({
      hasError: true,
    });
  });

  it('renders the fallback with a try-again button when in the error state', () => {
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { hasError: true };
    const html = renderToString(boundary.render() as ReactElement);
    expect(html).toContain('Something went wrong');
    expect(html).toContain('Try again');
  });

  it('renders children when nothing throws', () => {
    const html = renderToString(
      createElement(ErrorBoundary, null, createElement('p', null, 'all good')),
    );
    expect(html).toContain('all good');
  });
});
