# Queue Management System Setup

This document explains how to set up the automatic queue management system for the bus booking application.

## Overview

The queue management system automatically:
- Adds users to the queue when they scan their QR code
- Removes users from the queue when they confirm a bus booking
- Automatically reorders queue positions when someone is removed
- Prevents queue jumping and maintains fair ordering

## Database Setup

### 1. Run the SQL Functions

Copy and paste the contents of `src/lib/queue-setup.sql` into your Supabase SQL editor and run it. This will create the necessary database functions:

- `add_user_to_queue(user_id_param INTEGER)` - Adds a user to the end of the queue
- `remove_user_from_queue(user_id_param INTEGER)` - Removes a user and reorders positions
- `decrement_queue_positions(start_position INTEGER)` - Helper function for reordering
- `get_next_queue_position()` - Gets the next available position

### 2. Verify Table Structure

Ensure your `queue` table has the following structure:

```sql
CREATE TABLE IF NOT EXISTS queue (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES delegates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(position)
);
```

## How It Works

### Automatic Queue Addition
1. User scans QR code on the front page
2. If they're not already in the queue, they're automatically added
3. If the queue is full, they receive an error message
4. Their position is displayed and stored in the user context

### Queue Position Management
1. When a user confirms a bus booking, they're removed from the queue
2. All users behind them automatically move up one position
3. The system maintains sequential numbering (1, 2, 3, 4...)
4. No gaps in position numbers are created

### Rebooking Process
1. User clicks "Rebook Bus" on the confirmation page
2. Their current booking is cancelled
3. They're automatically added to the end of the queue
4. They can then select a different bus

## Key Features

- **Automatic Position Management**: No manual position updates needed
- **Queue Integrity**: Prevents duplicate entries and maintains order
- **Fair System**: Users always join at the end, no cutting in line
- **Real-time Updates**: Queue positions update immediately across all users
- **Error Handling**: Graceful fallbacks if database functions aren't available

## Testing the System

1. **Add Multiple Users**: Scan different QR codes to add users to the queue
2. **Confirm Bookings**: Book buses to see users removed from queue
3. **Check Positions**: Verify that remaining users' positions are updated
4. **Rebook Users**: Test the rebooking functionality
5. **Queue Full**: Try adding users when the queue is at capacity

## Troubleshooting

### Common Issues

1. **Queue positions not updating**: Ensure the SQL functions are properly installed
2. **Users not being added**: Check that the queue table exists and has correct structure
3. **Position conflicts**: Verify the UNIQUE constraints on the queue table

### Manual Queue Reset

If you need to reset the queue:

```sql
-- Clear all queue entries
DELETE FROM queue;

-- Reset the position sequence (if using SERIAL)
ALTER SEQUENCE queue_id_seq RESTART WITH 1;
```

## Performance Considerations

- The system uses database functions for optimal performance
- Queue operations are atomic and consistent
- Fallback implementations ensure reliability even without custom functions
- Regular queue refreshes provide real-time updates

## Security

- Users can only see their own queue position
- Queue operations are validated at the database level
- No unauthorized queue manipulation is possible
- User authentication is required for all queue operations
