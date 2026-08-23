import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

// After a new deploy, hashed chunk filenames change; a client still running the
// old index.html will fail to fetch the old chunks. Reload once to pick up the
// new build instead of showing the error boundary. sessionStorage guards
// against a reload loop if the fetch keeps failing for another reason.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().then((module) => {
      sessionStorage.removeItem('chunk-reload');
      return module;
    }).catch((error) => {
      if (!sessionStorage.getItem('chunk-reload')) {
        sessionStorage.setItem('chunk-reload', '1');
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }),
  );
}
