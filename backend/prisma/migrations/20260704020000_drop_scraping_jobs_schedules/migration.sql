-- Drop the ScrapingJob and ScrapingSchedule tables.
--
-- These modelled a headless-worker pipeline (enqueue job -> worker scrapes ->
-- submit result) that no longer exists. The worker was replaced by the browser
-- extension, and automated re-scraping now runs client-side via chrome.alarms
-- (review batch 5). Both tables only referenced DomainRule and had no dependents,
-- so dropping them is safe.

-- DropTable
DROP TABLE IF EXISTS "ScrapingSchedule";
DROP TABLE IF EXISTS "ScrapingJob";
