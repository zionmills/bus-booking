# Queue Timeout System

## Overview

The bus booking system now includes an automatic timeout mechanism that ensures users in the booking zone (positions 1-20) complete their bookings within a reasonable time frame.

## How It Works

### Timeout Duration
- **Booking Zone**: Positions 1-20
- **Timeout**: 5 minutes (300 seconds)
- **Check Frequency**: Every 10 seconds

### Automatic Removal
When a user has been in positions 1-20 for more than 5 minutes:
1. The system automatically detects the timeout
2. The user is removed from the queue
3. All subsequent positions are automatically reordered
4. The next user in line moves into the booking zone

### User Experience
- **Visual Countdown**: Users see a countdown timer showing time remaining
- **Color-coded Warnings**: 
  - 🟡 Yellow: More than 30 seconds remaining
  - 🟠 Orange: 30 seconds or less remaining
  - 🔴 Red: 10 seconds or less remaining
- **Personal Warning**: Users in the booking zone see their personal countdown
- **Queue-wide Warning**: All users can see timeout information for the booking zone

## Technical Implementation

### Queue Manager (`src/lib/queue-manager.ts`)
- `startTimeoutMonitoring()`: Starts the automatic timeout checking
- `stopTimeoutMonitoring()`: Stops the monitoring system
- `checkAndRemoveTimeouts()`: Private method that removes timed-out users
- `getUserTimeoutInfo()`: Gets timeout information for a specific user
- `getBookingZoneTimeoutInfo()`: Gets timeout information for all users in positions 1-20

### Queue Page (`src/app/queue/page.tsx`)
- Integrates with the timeout monitoring system
- Shows countdown timers for each user in the booking zone
- Displays timeout warnings and personal countdowns
- Automatically refreshes timeout information every second



## Database Operations

The timeout system performs these database operations:
1. **Query**: Find users in positions 1-20 who joined before the timeout threshold
2. **Remove**: Delete timed-out users from the queue
3. **Reorder**: Automatically adjust positions for remaining users

## Benefits

1. **Fair Queue Management**: Prevents users from holding positions indefinitely
2. **Improved Flow**: Ensures the queue moves efficiently
3. **User Awareness**: Clear countdown timers keep users informed
4. **Automatic Cleanup**: No manual intervention required
5. **Scalable**: Works with any queue size

## Configuration

The timeout system can be easily configured by modifying these constants in `QueueManager`:
- `BOOKING_TIMEOUT_MS`: Timeout duration in milliseconds (default: 300,000ms = 5 minutes)
- `BOOKING_ZONE_SIZE`: Number of positions in the booking zone (default: 20)
- Check interval: Currently set to 10 seconds (can be adjusted in `startTimeoutMonitoring`)

## Monitoring and Logging

The system logs timeout activities:
- Console logs when users are removed due to timeout
- Error logging for any issues during timeout processing
- Real-time updates in the UI

## Future Enhancements

Potential improvements could include:
- Configurable timeout durations per user type
- Notification system for approaching timeouts
- Analytics on timeout patterns
- Integration with booking completion events
- Custom timeout rules for different queue scenarios
