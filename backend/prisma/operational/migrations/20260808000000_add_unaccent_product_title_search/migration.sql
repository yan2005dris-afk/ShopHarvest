-- Enable unaccent for diacritic-insensitive product title search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- BOTH unaccent(text) and unaccent(regdictionary, text) ship as STABLE (they
-- depend on dictionary-file contents), so Postgres REJECTS them directly in an
-- index expression: "functions in index expression must be marked IMMUTABLE".
-- Documented contrib/unaccent workaround: re-declare the C symbol as IMMUTABLE,
-- then bind the dictionary in a SQL wrapper. Needs superuser — the official
-- postgres:16-alpine bootstrap role (POSTGRES_USER) is one.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(regdictionary, text)
  RETURNS text LANGUAGE c IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/unaccent', 'unaccent_dict';

CREATE OR REPLACE FUNCTION public.f_unaccent(text)
  RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  RETURN public.immutable_unaccent('public.unaccent'::regdictionary, $1);

-- Substring search ('%q%') has a leading wildcard -> no b-tree. pg_trgm GIN can
-- serve it; pg_trgm is ALREADY installed by 20260711062220_add_fase1a_models.
CREATE INDEX IF NOT EXISTS "Product_title_unaccent_trgm_idx"
  ON "Product" USING GIN (public.f_unaccent(lower("title")) gin_trgm_ops);
