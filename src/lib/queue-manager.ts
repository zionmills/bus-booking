import { supabase } from './supabase'

export interface QueueEntry {
  id: number
  user_id: number
  position: number
  joined_at: string
}

export interface QueueUser {
  id: number
  name: string
  position: number
  joined_at: string
}

/**
 * Queue Manager - Handles all queue operations with automatic position management
 */
export class QueueManager {
  /**
   * Add a user to the end of the queue
   * @param userId - The user's ID to add
   * @returns The new queue position
   */
  static async addUserToQueue(userId: number): Promise<number> {
    try {
      // Try to use the database function first
      const { data: result, error: rpcError } = await supabase.rpc('add_user_to_queue', {
        user_id_param: userId
      })

      if (!rpcError && result !== null) {
        return result
      }

      // Fallback to manual implementation if RPC doesn't exist
      // Check if user is already in queue
      const { data: existingEntry } = await supabase
        .from('queue')
        .select('position')
        .eq('user_id', userId)
        .single()

      if (existingEntry && existingEntry.position !== null) {
        return existingEntry.position
      }

      // Get the highest position number
      const { data: maxPositionData } = await supabase
        .from('queue')
        .select('position')
        .order('position', { ascending: false })
        .limit(1)
        .single()

      const newPosition = (maxPositionData?.position || 0) + 1

      // Add user to queue
      const { error: insertError } = await supabase
        .from('queue')
        .insert([{
          user_id: userId,
          position: newPosition
        }])

      if (insertError) throw insertError

      return newPosition
    } catch (error) {
      console.error('Error adding user to queue:', error)
      throw error
    }
  }

  /**
   * Remove a user from the queue and reorder remaining positions
   * @param userId - The user's ID to remove
   * @returns Success status
   */
  static async removeUserFromQueue(userId: number): Promise<boolean> {
    try {
      // Get the user's current position
      const { data: userEntry } = await supabase
        .from('queue')
        .select('position')
        .eq('user_id', userId)
        .single()

      if (!userEntry) {
        return true // User not in queue
      }

      const removedPosition = userEntry.position
      if (removedPosition === null) {
        return true // Position is null, nothing to reorder
      }

      // Remove the user from queue
      const { error: deleteError } = await supabase
        .from('queue')
        .delete()
        .eq('user_id', userId)

      if (deleteError) throw deleteError

      // Reorder remaining positions (decrement all positions after the removed one)
      // We need to use a raw SQL query for this operation
      const { error: updateError } = await supabase.rpc('decrement_queue_positions', {
        start_position: removedPosition
      })

      if (updateError) {
        // Fallback: manual update if RPC doesn't exist
        const { data: entriesToUpdate } = await supabase
          .from('queue')
          .select('id, position')
          .gt('position', removedPosition)
          .order('position')
        
        if (entriesToUpdate && entriesToUpdate.length > 0) {
          for (const entry of entriesToUpdate) {
            if (entry.position !== null) {
              await supabase
                .from('queue')
                .update({ position: entry.position - 1 })
                .eq('id', entry.id)
            }
          }
        }
      }

      return true
    } catch (error) {
      console.error('Error removing user from queue:', error)
      throw error
    }
  }

  /**
   * Get the current queue with user details
   * @returns Array of queue entries with user information
   */
  static async getCurrentQueue(): Promise<QueueUser[]> {
    try {
      const { data: queueData, error } = await supabase
        .from('queue')
        .select(`
          *,
          delegates!queue_user_id_fkey(id, name)
        `)
        .order('position')

      if (error) throw error

      return (queueData || []).map((entry: { id: number; delegates?: { name: string | null } | null; position: number | null; joined_at: string }) => ({
        id: entry.id,
        name: entry.delegates?.name || 'Unknown User',
        position: entry.position || 0,
        joined_at: entry.joined_at
      }))
    } catch (error) {
      console.error('Error getting current queue:', error)
      throw error
    }
  }

  /**
   * Get a user's current queue position
   * @param userId - The user's ID
   * @returns The user's queue position or null if not in queue
   */
  static async getUserQueuePosition(userId: number): Promise<number | null> {
    try {
      const { data: entry } = await supabase
        .from('queue')
        .select('position')
        .eq('user_id', userId)
        .single()

      return entry?.position || null
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'PGRST116') {
        return null // User not in queue
      }
      console.error('Error getting user queue position:', error)
      throw error
    }
  }

  /**
   * Get the current queue size
   * @returns The number of people in the queue
   */
  static async getQueueSize(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('queue')
        .select('*', { count: 'exact', head: true })

      if (error) throw error
      return count || 0
    } catch (error) {
      console.error('Error getting queue size:', error)
      throw error
    }
  }

  /**
   * Check if queue is full
   * @param maxSize - Maximum queue size (default: 40)
   * @returns True if queue is full
   */
  static async isQueueFull(maxSize: number = 40): Promise<boolean> {
    const currentSize = await this.getQueueSize()
    return currentSize >= maxSize
  }

  /**
   * Check if a user can book a bus (must be in top 20 of queue)
   * @param userId - The user's ID to check
   * @returns True if user can book, false otherwise
   */
  static async canUserBook(userId: number): Promise<boolean> {
    try {
      const position = await this.getUserQueuePosition(userId)
      return position !== null && position <= 20
    } catch (error) {
      console.error('Error checking if user can book:', error)
      return false
    }
  }

  /**
   * Get the number of people who can currently book (top 20)
   * @returns Number of people who can book (0-20)
   */
  static async getBookableQueueSize(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('queue')
        .select('*', { count: 'exact', head: true })
        .lte('position', 20)

      if (error) throw error
      return count || 0
    } catch (error) {
      console.error('Error getting bookable queue size:', error)
      return 0
    }
  }

  /**
   * Move a user to the end of the queue (for rebooking)
   * @param userId - The user's ID to move
   * @returns The new queue position
   */
  static async moveUserToEndOfQueue(userId: number): Promise<number> {
    try {
      // First remove the user from their current position
      await this.removeUserFromQueue(userId)
      
      // Then add them to the end
      return await this.addUserToQueue(userId)
    } catch (error) {
      console.error('Error moving user to end of queue:', error)
      throw error
    }
  }
}
