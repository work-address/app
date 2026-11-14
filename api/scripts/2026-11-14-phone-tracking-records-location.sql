-- One-off data fix, 14 November 2026: phone tracking always records location.
--
-- The project setting used to be two switches, "Allow tracking from a phone"
-- (allowMobileTime) and "Record location" (trackLocation) under it. It is now
-- one: the server sets trackLocation to allowMobileTime on every save. Projects
-- saved before that may allow phone time without location, and keep it that
-- way until their next edit. This brings them in line at once.
--
-- Run once against each database, after `schema:sync` and after deploying the
-- API that has this change. Safe to run again: it only ever turns location on
-- where phone tracking already is.
--
--   psql "$DATABASE_URL" -f api/scripts/2026-11-14-phone-tracking-records-location.sql

UPDATE project SET "trackLocation" = true WHERE "allowMobileTime" = true;
