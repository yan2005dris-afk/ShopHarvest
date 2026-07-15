/**
 * Minimal port the categories use case uses to validate that a sourceId
 * exists before creating a mapping. Intentionally narrower than the full
 * Sources bounded context so application-layer code does not depend on
 * SourcesService or the Prisma `source` model directly.
 */
export interface CategorySourceLookup {
  sourceExists(sourceId: string): Promise<boolean>;
}

export const CATEGORY_SOURCE_LOOKUP = Symbol('CategorySourceLookup');
