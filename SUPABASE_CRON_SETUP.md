# Supabase Cron Job Setup for Queue Cleanup

## Overview

This guide explains how to set up a cron job directly in Supabase to handle server-side queue timeout management. This approach is simpler and more efficient than Edge Functions.

## 1. Database Schema Updates

First, run the SQL commands from `src/lib/queue-setup.sql` in your Supabase SQL Editor:

```sql
-- Add timeout_at column to queue table
ALTER TABLE queue ADD COLUMN IF NOT EXISTS timeout_at TIMESTAMP WITH TIME ZONE;

-- Run all the CREATE OR REPLACE FUNCTION statements from queue-setup.sql
-- This will create:
-- - update_booking_zone_timeouts()
-- - cleanup_expired_queue_entries()
-- - get_queue_timeout_info()
-- - queue_cron_job() (main cron function)
-- - trigger_queue_cleanup() (manual trigger)
```

## 2. Set Up the Cron Job in Supabase

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **Database** → **Functions**
3. Find the `queue_cron_job` function
4. Click on **Settings** → **Cron Jobs**
5. Add a new cron job:
   - **Name**: `queue-cleanup-cron`
   - **Schedule**: `*/1 * * * *` (every minute)
   - **Function**: `queue_cron_job`
   - **HTTP Method**: `POST`

### Option B: Using SQL (Alternative)

Run this SQL in your Supabase SQL Editor:

```sql
-- Create a cron job that runs every minute
SELECT cron.schedule(
  'queue-cleanup-cron',
  '*/1 * * * *',
  'SELECT queue_cron_job();'
);
```

## 3. Test the Cron Job Function

### Manual Test via SQL
```sql
-- Test the function manually
SELECT queue_cron_job();

-- Or use the manual trigger function
SELECT trigger_queue_cleanup();
```

### Expected Response
```json
{
  "success": true,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "updated_timeouts": 2,
  "deleted_expired": 0,
  "message": "Queue cron job completed successfully"
}
```

## 4. Monitor the Cron Job

### Check Cron Job Status
In your Supabase Dashboard:
1. Go to **Database** → **Functions**
2. Click on your `queue_cron_job` function
3. Check the **Logs** tab for execution history

### View Cron Job History
```sql
-- Check cron job execution history
SELECT * FROM cron.job_run_details 
WHERE jobid = (
  SELECT jobid FROM cron.job 
  WHERE jobname = 'queue-cleanup-cron'
)
ORDER BY start_time DESC
LIMIT 10;
```

## 5. How It Works

### The Cron Job Function (`queue_cron_job`)
1. **Updates Timeouts**: Sets `timeout_at` to 5 minutes from now for users in positions 1-20 who don't have a timeout set
2. **Cleans Up Expired**: Removes users whose `timeout_at` has passed
3. **Reorders Queue**: Automatically adjusts positions for remaining users
4. **Returns Status**: Provides detailed information about what was processed

### Execution Flow
```
Every Minute:
├── Update timeouts for new booking zone users
├── Remove expired users
├── Reorder remaining positions
└── Log results
```

## 6. Verification

### Check Database Functions
Verify these functions exist in your Supabase database:
```sql
-- List all queue-related functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%queue%'
ORDER BY routine_name;
```

### Test Queue Operations
1. Add users to the queue
2. Move users to positions 1-20
3. Wait for the cron job to run (check logs)
4. Verify users get `timeout_at` set
5. Wait for timeout to expire
6. Verify users are automatically removed

## 7. Troubleshooting

### Common Issues

1. **Function not found**
   ```sql
   -- Check if function exists
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name = 'queue_cron_job';
   ```

2. **Cron job not running**
   ```sql
   -- Check cron job status
   SELECT * FROM cron.job WHERE jobname = 'queue-cleanup-cron';
   
   -- Check if cron extension is enabled
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

3. **Permission errors**
   ```sql
   -- Grant necessary permissions
   GRANT USAGE ON SCHEMA cron TO postgres;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
   ```

4. **Database errors**
   ```sql
   -- Check function definition
   SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'queue_cron_job';
   ```

### Debug Mode

To add debug logging, modify the function:

```sql
CREATE OR REPLACE FUNCTION queue_cron_job()
RETURNS JSON AS $$
DECLARE
  updated_count INTEGER;
  deleted_count INTEGER;
  result JSON;
BEGIN
  -- Add debug logging
  RAISE NOTICE 'Starting queue cron job at %', NOW();
  
  -- First, update timeouts for users who just entered the booking zone
  UPDATE queue 
  SET timeout_at = NOW() + INTERVAL '5 minutes'
  WHERE position <= 20 
    AND timeout_at IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % users with new timeouts', updated_count;
  
  -- Then, clean up expired entries
  SELECT cleanup_expired_queue_entries() INTO deleted_count;
  RAISE NOTICE 'Deleted % expired users', deleted_count;
  
  -- Return result as JSON
  result := json_build_object(
    'success', true,
    'timestamp', NOW(),
    'updated_timeouts', updated_count,
    'deleted_expired', deleted_count,
    'message', 'Queue cron job completed successfully'
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

## 8. Performance Considerations

- **Frequency**: Running every minute provides good responsiveness
- **Database Load**: The operations are lightweight and optimized
- **Scalability**: Can handle queues of any size efficiently
- **Monitoring**: Built-in logging and error handling

## 9. Security Notes

- The cron job runs with database privileges
- No external HTTP endpoints needed
- All operations happen within the database
- Secure by default

## 10. Alternative Schedules

You can adjust the cron frequency based on your needs:

```sql
-- Every 30 seconds (requires pg_cron extension)
'*/0.5 * * * *'

-- Every 2 minutes
'*/2 * * * *'

-- Every 5 minutes
'*/5 * * * *'

-- Every hour
'0 * * * *'
```

## 11. Next Steps

After successful setup:

1. **Monitor**: Watch the function logs for the first few days
2. **Optimize**: Adjust the cron frequency if needed
3. **Scale**: Consider adding more sophisticated monitoring
4. **Backup**: Ensure your queue data is properly backed up

## 12. Migration from Edge Functions

If you were previously using Edge Functions:

1. **Remove Edge Function**: Delete the `supabase/functions/queue-cleanup` directory
2. **Update Cron Job**: Point your cron job to `queue_cron_job()` instead
3. **Test**: Verify the new system works correctly
4. **Clean Up**: Remove any Edge Function related environment variables

## 13. Benefits of This Approach

- **Simpler**: No Edge Function deployment needed
- **Faster**: Direct database execution
- **More Reliable**: No HTTP timeouts or network issues
- **Easier to Debug**: All logic is in the database
- **Better Performance**: No serialization/deserialization overhead
- **Cost Effective**: No Edge Function execution costs
