# Queue Rate Limiting Implementation

## Overview
This document describes the rate limiting implementation for the queue system to prevent overwhelming the backend with frequent API calls.

## Changes Made

### 1. New Rate-Limited Hook (`useRateLimitedQueue`)
- **Location**: `src/hooks/useRateLimitedQueue.ts`
- **Purpose**: Manages queue data with built-in rate limiting
- **Features**:
  - Main queue refresh: Every 5 minutes (configurable)
  - Timeout info updates: Every 30 seconds (configurable)
  - Force refresh capability for immediate updates
  - Visual indicators for next refresh timing

### 2. Configuration File (`queue-config.ts`)
- **Location**: `src/lib/queue-config.ts`
- **Purpose**: Centralized configuration for all queue-related settings
- **Configurable Values**:
  - `REFRESH_INTERVAL_MS`: 5 minutes (300,000 ms)
  - `TIMEOUT_UPDATE_INTERVAL_MS`: 30 seconds (30,000 ms)
  - `TIMEOUT_MONITORING_INTERVAL_MS`: 30 seconds (30,000 ms)

### 3. Updated Queue Page
- **Location**: `src/app/queue/page.tsx`
- **Changes**:
  - Replaced manual state management with rate-limited hook
  - Added refresh status banner showing countdown to next refresh
  - Updated refresh button to respect rate limits
  - Visual feedback for when refresh is available/unavailable

### 4. Reduced Update Frequencies
- **QueueManager**: Timeout monitoring reduced from 10s to 30s
- **useQueue hook**: User timeout updates reduced from 1s to 30s
- **Main queue refresh**: Reduced from continuous to 5-minute intervals

## Rate Limiting Rules

### Queue Data Refresh
- **Automatic**: Every 5 minutes
- **Manual**: Only allowed after 5-minute cooldown
- **Force**: Available immediately after user actions (join/leave queue)

### Timeout Information
- **Automatic**: Every 30 seconds (when user is in queue)
- **Manual**: Respects 30-second cooldown
- **Force**: Available for immediate updates

### User Actions
- **Join/Leave Queue**: Always allowed, triggers force refresh
- **Manual Refresh**: Rate-limited to prevent abuse

## Benefits

1. **Reduced Backend Load**: Significantly fewer API calls
2. **Better User Experience**: Clear indication of when data will refresh
3. **Configurable**: Easy to adjust intervals via configuration file
4. **Smart Updates**: Force refresh available when needed
5. **Visual Feedback**: Users know when next refresh will occur

## Configuration

To adjust rate limiting intervals, modify `src/lib/queue-config.ts`:

```typescript
export const QUEUE_CONFIG = {
  REFRESH_INTERVAL_MS: 5 * 60 * 1000,        // 5 minutes
  TIMEOUT_UPDATE_INTERVAL_MS: 30 * 1000,     // 30 seconds
  TIMEOUT_MONITORING_INTERVAL_MS: 30 * 1000, // 30 seconds
  // ... other settings
}
```

## Migration Notes

- Old queue page implementation has been completely replaced
- All queue data now flows through the rate-limited hook
- Manual refresh button now respects rate limits
- Timeout monitoring is less aggressive but still functional
- User actions (join/leave) still provide immediate feedback

## Testing

The rate limiting can be tested by:
1. Observing the refresh countdown timer
2. Attempting manual refresh before cooldown expires
3. Verifying that join/leave actions trigger immediate updates
4. Checking that automatic updates occur at configured intervals
