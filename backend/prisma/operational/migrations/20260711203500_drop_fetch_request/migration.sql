-- FetchRequest was part of the same headless-worker pipeline as ScrapingJob/
-- ScrapingSchedule (created alongside them in add_visual_mapper_fields,
-- review batch 5's replacement removed that whole worker). The migration
-- that dropped ScrapingJob/ScrapingSchedule (20260704020000) missed this
-- table — it was already gone from the Prisma schema and from every
-- environment, but never had its own DROP TABLE migration, which showed up
-- as schema drift once the shadow-DB replay ordering bug (fixed in this
-- same change, see 20260617010000_add_visual_mapper_fields rename) was
-- corrected and drift detection could actually run.

DROP TABLE IF EXISTS "FetchRequest";
