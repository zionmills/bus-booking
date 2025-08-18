-- Queue Management Functions for Supabase
-- Run this in your Supabase SQL editor to set up the queue position management

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
