-- Drop legacy single-field selector columns from DomainRule.
--
-- These columns predate the visual mapper. `fieldMappings` (JSON) is the
-- single source of truth for extraction rules. The columns were already
-- optional in the active schema (schema.prisma) but the source files in
-- schema/models/domain_rule.prisma (since removed in batch 2) marked them
-- required. Application code was passing empty strings to satisfy the
-- Prisma generated types.
--
-- This migration is safe on the current dev DB which has no rows in
-- DomainRule. For any environment with existing rows the columns are
-- nullable or defaulted, so DROP COLUMN works without data loss beyond
-- the legacy fields themselves.

-- DropColumn
ALTER TABLE "DomainRule" DROP COLUMN "selectorTitle";
ALTER TABLE "DomainRule" DROP COLUMN "selectorPrice";
ALTER TABLE "DomainRule" DROP COLUMN "selectorImage";
ALTER TABLE "DomainRule" DROP COLUMN "selectorSku";
ALTER TABLE "DomainRule" DROP COLUMN "selectorType";
