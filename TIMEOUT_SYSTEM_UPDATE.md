# Timeout System Update

## Overview
The queue timeout system has been updated to automatically set the `timeout_at` column when users join the queue and their position is already less than 20 (in the booking zone).

## Changes Made

### 1. Updated `addUserToQueue` Method
- **File**: `src/lib/queue-manager.ts`
- **Change**: Now automatically sets `timeout_at` for users who join in positions 1-20
- **Logic**: After adding a user to the queue, checks if their position is ≤ 20 and sets a 5-minute timeout

### 2. Added `setTimeoutForBookingZoneUser` Method
- **Purpose**: Private method to set timeout for users in the booking zone
- **Logic**: Only sets timeout if user is in positions 1-20 and doesn't already have a timeout
- **Timeout**: 5 minutes (300 seconds) from the current time

### 3. Updated `checkAndRemoveTimeouts` Method
- **Change**: Now uses `timeout_at` column instead of calculating from `joined_at`
- **Logic**: Finds users whose `timeout_at` has passed and removes them from the queue

### 4. Updated `getUserTimeoutInfo` Method
- **Change**: Now uses `timeout_at` column for accurate timeout calculations
- **Logic**: Calculates remaining time based on the actual timeout timestamp

### 5. Updated `getBookingZoneTimeoutInfoFallback` Method
- **Change**: Now uses `timeout_at` column in the fallback implementation
- **Logic**: Consistent with the main timeout system

### 6. Enhanced `removeUserFromQueue` Method
- **Change**: Now calls `updateTimeoutsForMovedUsers` after reordering
- **Purpose**: Ensures users who move into the booking zone get timeouts set

### 7. Added `updateTimeoutsForMovedUsers` Method
- **Purpose**: Sets timeouts for users who move into positions 1-20 after queue reordering
- **Logic**: Called after removing a user to handle position changes

### 8. Added `updateAllBookingZoneTimeouts` Method
- **Purpose**: Manually update timeouts for all users in the booking zone
- **Use Case**: Maintenance, system synchronization, or testing

### 9. Added `getQueueTimeoutStatus` Method
- **Purpose**: Get comprehensive timeout status for all users in the queue
- **Use Case**: Debugging, monitoring, and system health checks

### 10. Added `testTimeoutSystem` Method
- **Purpose**: Test method for debugging the timeout system
- **Use Case**: Browser console testing and verification

## How It Works

### When a User Joins the Queue:
1. User is added to the queue with a position
2. If position ≤ 20, `timeout_at` is automatically set to 5 minutes from now
3. If position > 20, no timeout is set (user is waiting)

### When a User Leaves the Queue:
1. User is removed from their position
2. Remaining users' positions are decremented
3. Users who move into positions 1-20 get timeouts set automatically

### Timeout Monitoring:
1. System checks every 10 seconds for expired timeouts
2. Users whose `timeout_at` has passed are automatically removed
3. Queue positions are reordered after removals

## Benefits

1. **Automatic Timeout Management**: No manual intervention needed
2. **Accurate Timing**: Uses database timestamps instead of calculations
3. **Position-Aware**: Only sets timeouts for users who can actually book
4. **Self-Healing**: Automatically handles queue reordering and timeout updates
5. **Debugging Tools**: Comprehensive methods for testing and monitoring

## Testing

You can test the new system using the browser console:

```javascript
// Test timeout system for a specific user
await QueueManager.testTimeoutSystem(userId)

// Get current timeout status
const status = await QueueManager.getQueueTimeoutStatus()
console.log(status)

// Manually update all timeouts
await QueueManager.updateAllBookingZoneTimeouts()
```

## Database Requirements

The system requires the `timeout_at` column in the `queue` table:
```sql
ALTER TABLE queue ADD COLUMN IF NOT EXISTS timeout_at TIMESTAMP WITH TIME ZONE;
```

## Cron Job Integration

The existing cron job system will continue to work with these changes, as it already handles the `timeout_at` column updates and cleanup.
