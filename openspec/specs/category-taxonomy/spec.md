# Category Taxonomy Specification

## Purpose

Manages a hierarchical multi-level category tree with source-specific mappings. Categories form an arbitrary-depth tree with a practical limit of 6 levels.

## Requirements

### Requirement: Category CRUD

The system MUST support creating, reading, updating, and deleting categories within a tree structure.

#### Scenario: Create a root category

- GIVEN a valid category with `name` and no `parentId`
- WHEN the system creates it
- THEN the category is a root node with `path` set to its own ID

#### Scenario: Create a child category

- GIVEN an existing parent category with ID 5
- WHEN the system creates a child with `parentId: 5`
- THEN the child's `path` is parentPath + "/" + childId

#### Scenario: Update category name

- GIVEN an existing category
- WHEN the system updates its name (not parent)
- THEN only the name changes, `path` remains unchanged

#### Scenario: Read category tree

- GIVEN a root category with children
- WHEN the system reads by root ID
- THEN the response includes nested children

### Requirement: Materialized Path

The system SHALL maintain a `path` column encoding the full ancestor chain for O(1) ancestry queries.

#### Scenario: Query ancestors

- GIVEN a category with path `/1/5/12`
- WHEN the system queries ancestors
- THEN it returns categories with IDs 1 and 5

#### Scenario: Query descendants

- GIVEN a root category with ID 1
- WHEN the system queries descendants
- THEN all categories with path starting with `/1/` are returned

#### Scenario: Path updated on reparent

- GIVEN a category moved to a new parent
- WHEN the system reparents it
- THEN the category's path and all descendants' paths update recursively

### Requirement: Source-to-Category Mapping

Categories MUST be mappable to specific sources. A mapping MAY include a `remoteCode` (the category's ID in the source's system).

#### Scenario: Map category to source

- GIVEN an existing category and source
- WHEN the system creates a mapping with `remoteCode: "CEL-123"`
- THEN the mapping is persisted

#### Scenario: Prevent duplicate mapping

- GIVEN an existing (categoryId, sourceId) pair
- WHEN the system attempts to create the same mapping
- THEN the request is rejected as duplicate

#### Scenario: List source categories

- GIVEN a source with mapped categories
- WHEN the system queries mappings by sourceId
- THEN all mapped categories and their remoteCodes are returned

### Requirement: Delete Guard

Deleting a category with children MUST fail.

#### Scenario: Prevent parent deletion

- GIVEN a category with children
- WHEN the system attempts to delete it
- THEN the request is rejected

#### Scenario: Delete leaf category

- GIVEN a category with no children and no source mappings
- WHEN the system deletes it
- THEN the category is removed
