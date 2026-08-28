/**
 * Days of time-log history a free account keeps.
 *
 * Mirrors `TimeManager.freeTimeLogRetentionDays` in the API, which is what
 * actually purges entries. The two must be changed together — copy promising
 * a different window than the code enforces is how a free tier silently
 * under-delivers what was advertised, and this pair has drifted before.
 *
 * Interpolated into copy via `{{days}}` rather than written into each
 * translation, so the number lives in one place across all five locales.
 */
export const FREE_RETENTION_DAYS = 14
