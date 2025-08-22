-- Queue Management Functions for Supabase
-- Run this in your Supabase SQL editor to set up the queue position management

-- Add timeout_at column to queue table (run this first)
ALTER TABLE queue ADD COLUMN IF NOT EXISTS timeout_at TIMESTAMP WITH TIME ZONE;

-- Function to decrement queue positions after a user is removed
CREATE OR REPLACE FUNCTION decrement_queue_positions(start_position INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE queue 
  SET position = position - 1 
  WHERE position > start_position;
END;
$$ LANGUAGE plpgsql;

-- Function to get the next available queue position
CREATE OR REPLACE FUNCTION get_next_queue_position()
RETURNS INTEGER AS $$
DECLARE
  max_pos INTEGER;
BEGIN
  SELECT COALESCE(MAX(position), 0) INTO max_pos FROM queue;
  RETURN max_pos + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to add user to queue with automatic position assignment
CREATE OR REPLACE FUNCTION add_user_to_queue(user_id_param INTEGER)
RETURNS INTEGER AS $$
DECLARE
  new_position INTEGER;
BEGIN
  -- Check if user is already in queue
  IF EXISTS(SELECT 1 FROM queue WHERE user_id = user_id_param) THEN
    SELECT position INTO new_position FROM queue WHERE user_id = user_id_param;
    RETURN new_position;
  END IF;
  
  -- Get next available position
  SELECT get_next_queue_position() INTO new_position;
  
  -- Insert user into queue
  INSERT INTO queue (user_id, position) VALUES (user_id_param, new_position);
  
  RETURN new_position;
END;
$$ LANGUAGE plpgsql;

-- Function to remove user from queue and reorder positions
CREATE OR REPLACE FUNCTION remove_user_from_queue(user_id_param INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  removed_position INTEGER;
BEGIN
  -- Get user's current position
  SELECT position INTO removed_position FROM queue WHERE user_id = user_id_param;
  
  IF removed_position IS NULL THEN
    RETURN TRUE; -- User not in queue
  END IF;
  
  -- Remove user from queue
  DELETE FROM queue WHERE user_id = user_id_param;
  
  -- Reorder remaining positions
  PERFORM decrement_queue_positions(removed_position);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to update timeout_at for users in booking zone (positions 1-20)
CREATE OR REPLACE FUNCTION update_booking_zone_timeouts()
RETURNS VOID AS $$
BEGIN
  -- Set timeout_at to 5 minutes from now for users in positions 1-20
  -- Only update if timeout_at is NULL (first time entering booking zone)
  UPDATE queue 
  SET timeout_at = NOW() + INTERVAL '5 minutes'
  WHERE position <= 20 
    AND timeout_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired queue entries
CREATE OR REPLACE FUNCTION cleanup_expired_queue_entries()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete users whose timeout_at has passed
  WITH deleted AS (
    DELETE FROM queue 
    WHERE timeout_at IS NOT NULL 
      AND timeout_at < NOW()
    RETURNING position
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  -- If any users were deleted, reorder remaining positions
  IF deleted_count > 0 THEN
    -- Get the minimum position of deleted users to start reordering from
    -- Since we can't easily get this in a single query, we'll reorder from position 1
    PERFORM decrement_queue_positions(0);
  END IF;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get timeout information for all users
CREATE OR REPLACE FUNCTION get_queue_timeout_info()
RETURNS TABLE (
  user_id INTEGER,
  "position" INTEGER,
  timeout_at TIMESTAMP WITH TIME ZONE,
  time_remaining_ms BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.user_id,
    q.position,
    q.timeout_at,
    CASE 
      WHEN q.timeout_at IS NOT NULL THEN
        EXTRACT(EPOCH FROM (q.timeout_at - NOW())) * 1000
      ELSE 0
    END as time_remaining_ms
  FROM queue q
  WHERE q.position <= 20
  ORDER BY q.position;
END;
$$ LANGUAGE plpgsql;

-- Main cron job function that handles both updating timeouts and cleanup
-- This function should be called by Supabase's cron job system
CREATE OR REPLACE FUNCTION queue_cron_job()
RETURNS JSON AS $$
DECLARE
  updated_count INTEGER;
  deleted_count INTEGER;
  result JSON;
BEGIN
  -- First, update timeouts for users who just entered the booking zone
  UPDATE queue 
  SET timeout_at = NOW() + INTERVAL '5 minutes'
  WHERE position <= 20 
    AND timeout_at IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Then, clean up expired entries
  SELECT cleanup_expired_queue_entries() INTO deleted_count;
  
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

-- Function to manually trigger the cron job (for testing)
CREATE OR REPLACE FUNCTION trigger_queue_cleanup()
RETURNS JSON AS $$
BEGIN
  RETURN queue_cron_job();
END;
$$ LANGUAGE plpgsql;
