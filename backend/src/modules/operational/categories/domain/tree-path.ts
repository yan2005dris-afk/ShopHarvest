/**
 * Framework-free helpers for the materialized-path tree that `Category.path`
 * represents. Kept outside the entity class so the rules are testable as
 * pure functions and so the entity stays focused on identity / state.
 *
 * Materialized-path semantics (preserved from the legacy service):
 *  - root node → path === selfId
 *  - child node → path === `${parent.path}/${selfId}`
 *
 * The repository writes paths inside an atomic reparent transaction; these
 * helpers are the read-side computations the use case runs before delegating.
 */

export interface CategoryPathSnapshot {
  id: string;
  parentId: string | null;
  path: string;
}

/**
 * Builds the materialized path for a node that just got a new parent.
 *
 * For root nodes (parentId === null) the path collapses to the node's own id,
 * matching the existing schema where root categories carry `path === id`.
 * For child nodes the path is `${parent.path}/${selfId}`.
 */
export function buildCategoryPath(
  parentPath: string,
  selfId: string,
  parentId: string | null,
): string {
  if (parentId === null) {
    return selfId;
  }
  return `${parentPath}/${selfId}`;
}

/**
 * Splits a materialized path into ancestor ids, EXCLUDING the node's own id.
 * Root nodes (path === selfId) and empty paths produce an empty list.
 */
export function ancestorIdsOf(path: string, selfId: string): string[] {
  if (!path) return [];
  return path.split('/').filter((part) => part !== '' && part !== selfId);
}

/**
 * Cycle guard for reparent operations.
 *
 * Reparing a node to one of its own descendants would create a cycle. The
 * detection uses materialized-path prefix: any descendant has a path that
 * starts with `${self.path}/`, so a candidate parent whose own path begins
 * with that prefix is a descendant and the move is rejected.
 *
 * Returns true when the move would create a cycle (the caller throws).
 */
export function wouldCreateCycle(
  self: CategoryPathSnapshot,
  candidateParent: CategoryPathSnapshot,
): boolean {
  if (candidateParent.id === self.id) {
    return true;
  }
  if (!candidateParent.path) {
    return false;
  }
  return candidateParent.path.startsWith(`${self.path}/`);
}
