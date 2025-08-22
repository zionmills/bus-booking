# Queue Timeout System (Server-Side)

## Overview

The bus booking system now includes a **server-side** automatic timeout mechanism that ensures users in the booking zone (positions 1-20) complete their bookings within a reasonable time frame. This system works even if users close their browsers.

## How It Works

### Timeout Duration
- **Booking Zone**: Positions 1-20
- **Timeout**: 5 minutes (300 seconds) from when they enter the booking zone
- **Check Frequency**: Every minute (server-side cron job)

### Automatic Removal
When a user has been in positions 1-20 for more than 5 minutes:
1. The server automatically detects the timeout
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

### Database Functions
- `queue_cron_job()`: Main cron job function that handles both updating timeouts and cleanup
- `update_booking_zone_timeouts()`: Sets timeout_at for users entering the booking zone
- `cleanup_expired_queue_entries()`: Removes expired users and reorders positions
- `get_queue_timeout_info()`: Returns timeout information for all users in booking zone

### Queue Manager (`src/lib/queue-manager.ts`)
- `getBookingZoneTimeoutInfo()`: Gets server-side timeout information from database
- Fallback to client-side calculation if database function fails

### Queue Page (`src/app/queue/page.tsx`)
- Integrates with the server-side timeout system
- Shows countdown timers for each user in the booking zone
- Displays timeout warnings and personal countdowns
- Automatically refreshes timeout information every 5 seconds



## Database Operations

The timeout system performs these database operations:
1. **Update**: Set `timeout_at` timestamp for users entering positions 1-20
2. **Query**: Find users whose `timeout_at` has passed
3. **Remove**: Delete timed-out users from the queue
4. **Reorder**: Automatically adjust positions for remaining users

## Benefits

1. **Fair Queue Management**: Prevents users from holding positions indefinitely
2. **Improved Flow**: Ensures the queue moves efficiently
3. **User Awareness**: Clear countdown timers keep users informed
4. **Automatic Cleanup**: No manual intervention required
5. **Scalable**: Works with any queue size

## Configuration

The timeout system can be easily configured by modifying these settings:
- **Timeout Duration**: 5 minutes (300 seconds) - set in the `queue_cron_job()` function
- **Booking Zone Size**: 20 positions - set in the database functions
- **Check Frequency**: Every minute - configured in Supabase cron job settings
- **Client Refresh**: Every 5 seconds - set in the queue page component

## Monitoring and Logging

The system provides comprehensive monitoring:
- **Database Logs**: Function execution results and error handling
- **Cron Job History**: Execution history and performance metrics
- **Real-time Updates**: Live countdown timers in the UI
- **Error Handling**: Graceful fallback to client-side calculations if needed

## Future Enhancements

Potential improvements could include:
- Configurable timeout durations per user type
- Notification system for approaching timeouts
- Analytics on timeout patterns
- Integration with booking completion events
- Custom timeout rules for different queue scenarios
