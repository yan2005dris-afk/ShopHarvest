# Delta for category-taxonomy

## ADDED Requirements

All requirements are NEW — no existing category-taxonomy spec.

Refer to `openspec/specs/category-taxonomy/spec.md` for the full specification.

### Requirement: Category CRUD

The system MUST support creating, reading, updating, and deleting categories in a tree structure with materialized path.

#### Scenario: Create child category

- GIVEN an existing parent category with ID 5
- WHEN a child is created with `parentId: 5`
- THEN the child's `path` is parentPath + "/" + childId

#### Scenario: Read category tree

- GIVEN a root category with children
- WHEN the system reads by root ID
- THEN the response includes nested children

### Requirement: Materialized Path

The system SHALL maintain a `path` column for O(1) ancestry queries.

#### Scenario: Query ancestors

- GIVEN a category with path `/1/5/12`
- WHEN ancestors are queried
- THEN categories 1 and 5 are returned

#### Scenario: Query descendants

- GIVEN a root category with ID 1
- WHEN descendants are queried
- THEN all categories with path starting with `/1/` are returned

### Requirement: Source-to-Category Mapping

Categories MUST be mappable to sources with optional `remoteCode`.

#### Scenario: Map category to source

- GIVEN an existing category and source
- WHEN a mapping is created with `remoteCode: "CEL-123"`
- THEN the mapping is persisted

#### Scenario: Prevent duplicate mapping

- GIVEN an existing (categoryId, sourceId) pair
- WHEN the same pair is created again
- THEN the request is rejected

### Requirement: Delete Guard

Deleting a category with children MUST fail.

#### Scenario: Prevent parent deletion

- GIVEN a category with children
- WHEN deletion is attempted
- THEN the request is rejected
