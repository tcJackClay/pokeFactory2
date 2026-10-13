export type * from './types';

let pendingCatalog: Promise<typeof import('./query')> | undefined;

/** Load only when a future TM consumer needs the fixed catalog. No remote lookup. */
export function loadFixedTmCatalog(): Promise<typeof import('./query')> {
  if (!pendingCatalog) {
    pendingCatalog = import('./query').catch((error) => {
      pendingCatalog = undefined;
      throw error;
    });
  }
  return pendingCatalog;
}
