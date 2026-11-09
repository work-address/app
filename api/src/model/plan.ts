/** Workers the free plan includes, besides the owner. See web/PRODUCT.md §5. */
export const FREE_PLAN_WORKERS = 2

/**
 * How many trailing days of entries and runs a project keeps when its owner
 * has no plan. Kept at 14 to match what the pricing page advertises: the two
 * must not drift, or the free plan silently under-delivers what was sold.
 */
export const FREE_RETENTION_DAYS = 14

/** The longest a hosted project keeps a screenshot, invoiced or not. */
export const HOSTED_SCREENSHOT_RETENTION_DAYS = 365
