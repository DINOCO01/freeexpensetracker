/**
 * Centralized seasonal promotion flags for FreeExpenseTracker.com.
 *
 * Activation control:
 * Set `enableDecember2026SavingsPromo` to `true` during December 2026
 * to display the seasonal 2027 52-Week Savings Challenge banner on the homepage.
 * Set back to `false` to disable without removing any implementation.
 */
export const SEASONAL_PROMOTIONS = {
  enableDecember2026SavingsPromo: false,
} as const;

