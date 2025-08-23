/**
 * Queue Configuration
 * Centralized configuration for queue-related settings
 */

export const QUEUE_CONFIG = {
  // Rate limiting settings
  REFRESH_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes - main queue refresh interval
  TIMEOUT_UPDATE_INTERVAL_MS: 30 * 1000, // 30 seconds - timeout info updates
  TIMEOUT_MONITORING_INTERVAL_MS: 30 * 1000, // 30 seconds - server-side timeout checks
  
  // Queue settings
  BOOKING_ZONE_SIZE: 20, // Number of positions that can book buses
  BOOKING_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes - time users have to book
  
  // UI settings
  SHOW_REFRESH_TIMER: true, // Whether to show countdown to next refresh
  ENABLE_FORCE_REFRESH: true, // Whether manual refresh button is enabled
} as const

export type QueueConfig = typeof QUEUE_CONFIG
