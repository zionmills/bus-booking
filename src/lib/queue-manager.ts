import { supabase } from './supabase'

export interface QueueEntry {
  id: number
  user_id: number
  position: number
  joined_at: string
  timeout_at?: string | null
}

export interface QueueUser {
  id: number
  name: string
  position: number
  joined_at: string
}

export interface TimeoutInfo {
  userId: number
  position: number
  timeRemaining: number
  isInBookingZone: boolean
  timeoutAt?: string | null
}

/**
 * Queue Manager - Handles all queue operations with automatic position management
 */
export class QueueManager {
  private static timeoutCheckInterval: NodeJS.Timeout | null = null
  private static readonly BOOKING_TIMEOUT_MS = 300 * 1000 // 300 seconds (5 minutes)
  private static readonly BOOKING_ZONE_SIZE = 20

  /**
   * Start the timeout monitoring system
   */
  static startTimeoutMonitoring(): void {
    if (this.timeoutCheckInterval) {
      return // Already running
    }

    // Check every 10 seconds for timeouts
    this.timeoutCheckInterval = setInterval(async () => {
      try {
        await this.checkAndRemoveTimeouts()
      } catch (error) {
        console.error('Error in timeout monitoring:', error)
      }
    }, 10000)
  }

  /**
   * Stop the timeout monitoring system
   */
  static stopTimeoutMonitoring(): void {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval)
      this.timeoutCheckInterval = null
    }
  }

  /**
   * Check for users who have exceeded the booking timeout and remove them
   */
  private static async checkAndRemoveTimeouts(): Promise<void> {
    try {
      const now = new Date()

      // Get users in positions 1-20 whose timeout_at has passed
      const { data: timeoutUsers, error } = await supabase
        .from('queue')
        .select('id, user_id, position, timeout_at')
        .lte('position', this.BOOKING_ZONE_SIZE)
        .not('timeout_at', 'is', null)
        .lt('timeout_at', now.toISOString())
        .order('position')

      if (error) throw error

      if (timeoutUsers && timeoutUsers.length > 0) {
        console.log(`Removing ${timeoutUsers.length} users due to timeout`)
        
        // Remove each timed-out user
        for (const user of timeoutUsers) {
          if (user.user_id && user.position !== null) {
            await this.removeUserFromQueue(user.user_id)
          }
        }
      }
    } catch (error) {
      console.error('Error checking timeouts:', error)
    }
  }

  /**
   * Get timeout information for a specific user
   * @param userId - The user's ID
   * @returns Timeout information or null if user not in queue
   */
  static async getUserTimeoutInfo(userId: number): Promise<TimeoutInfo | null> {
    try {
      const { data: entry } = await supabase
        .from('queue')
        .select('position, timeout_at')
        .eq('user_id', userId)
        .single()

      if (!entry || entry.position === null) return null

      const isInBookingZone = entry.position <= this.BOOKING_ZONE_SIZE
      
      if (isInBookingZone && entry.timeout_at) {
        const now = new Date()
        const timeoutAt = new Date(entry.timeout_at)
        const timeRemaining = Math.max(0, timeoutAt.getTime() - now.getTime())
        
        return {
          userId,
          position: entry.position,
          timeRemaining,
          isInBookingZone: true,
          timeoutAt: entry.timeout_at
        }
      } else {
        return {
          userId,
          position: entry.position,
          timeRemaining: 0,
          isInBookingZone: false
        }
      }
    } catch (error) {
      console.error('Error getting user timeout info:', error)
      return null
    }
  }

  /**
   * Get timeout information for all users in the booking zone (positions 1-20)
   * @returns Array of timeout information for users in booking zone
   */
  static async getBookingZoneTimeoutInfo(): Promise<TimeoutInfo[]> {
    try {
      // Use the new database function to get server-side timeout info
      const { data: timeoutData, error } = await supabase.rpc('get_queue_timeout_info')

      if (error) throw error

      if (!timeoutData || !Array.isArray(timeoutData)) {
        return this.getBookingZoneTimeoutInfoFallback()
      }

      return timeoutData
        .filter(entry => entry.user_id !== null && entry["position"] !== null)
        .map(entry => ({
          userId: entry.user_id!,
          position: entry["position"]!,
          timeRemaining: Math.max(0, entry.time_remaining_ms || 0),
          isInBookingZone: true,
          timeoutAt: entry.timeout_at
        }))
    } catch (error) {
      console.error('Error getting booking zone timeout info:', error)
      // Fallback to old method if RPC fails
      return this.getBookingZoneTimeoutInfoFallback()
    }
  }

  /**
   * Fallback method for getting timeout info (old implementation)
   * @returns Array of timeout information for users in booking zone
   */
  private static async getBookingZoneTimeoutInfoFallback(): Promise<TimeoutInfo[]> {
    try {
      const { data: entries, error } = await supabase
        .from('queue')
        .select('user_id, position, timeout_at')
        .order('position')

      if (error) throw error

      const now = new Date()
      return (entries || [])
        .filter(entry => entry.user_id !== null && entry.position !== null && entry.position <= this.BOOKING_ZONE_SIZE)
        .map(entry => {
          let timeRemaining = 0
          
          if (entry.timeout_at) {
            const timeoutAt = new Date(entry.timeout_at)
            timeRemaining = Math.max(0, timeoutAt.getTime() - now.getTime())
          }
          
          return {
            userId: entry.user_id!,
            position: entry.position!,
            timeRemaining,
            isInBookingZone: true,
            timeoutAt: entry.timeout_at
          }
        })
    } catch (error) {
      console.error('Error in fallback timeout info method:', error)
      return []
    }
  }

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
        // After adding user, check if they're in booking zone and set timeout if needed
        await this.setTimeoutForBookingZoneUser(userId, result)
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
        // Check if they're in booking zone and set timeout if needed
        await this.setTimeoutForBookingZoneUser(userId, existingEntry.position)
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

      // Check if they're in booking zone and set timeout if needed
      await this.setTimeoutForBookingZoneUser(userId, newPosition)

      return newPosition
    } catch (error) {
      console.error('Error adding user to queue:', error)
      throw error
    }
  }

  /**
   * Set timeout for a user if they're in the booking zone (positions 1-20)
   * @param userId - The user's ID
   * @param position - The user's queue position
   */
  private static async setTimeoutForBookingZoneUser(userId: number, position: number): Promise<void> {
    try {
      // Only set timeout for users in positions 1-20
      if (position <= this.BOOKING_ZONE_SIZE) {
        const timeoutAt = new Date(Date.now() + this.BOOKING_TIMEOUT_MS)
        
        const { error } = await supabase
          .from('queue')
          .update({ timeout_at: timeoutAt.toISOString() })
          .eq('user_id', userId)
          .is('timeout_at', null) // Only update if timeout_at is not already set

        if (error) {
          console.error('Error setting timeout for user:', error)
        } else {
          console.log(`Set timeout for user ${userId} at position ${position}`)
        }
      }
    } catch (error) {
      console.error('Error setting timeout for booking zone user:', error)
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

      // After reordering, check if any users moved into the booking zone and need timeouts set
      await this.updateTimeoutsForMovedUsers(removedPosition)

      return true
    } catch (error) {
      console.error('Error removing user from queue:', error)
      throw error
    }
  }

  /**
   * Update timeouts for users who moved into the booking zone after queue reordering
   * @param removedPosition - The position that was removed
   */
  private static async updateTimeoutsForMovedUsers(removedPosition: number): Promise<void> {
    try {
      // Get users who moved into positions 1-20 after the removal
      const { data: movedUsers, error } = await supabase
        .from('queue')
        .select('user_id, position')
        .gte('position', Math.max(1, removedPosition - 19)) // Check positions that could have moved into booking zone
        .lte('position', 20)
        .is('timeout_at', null) // Only users without timeouts
        .order('position')

      if (error) throw error

      // Set timeouts for users who moved into the booking zone
      for (const user of movedUsers || []) {
        if (user.user_id && user.position !== null) {
          await this.setTimeoutForBookingZoneUser(user.user_id, user.position)
        }
      }
    } catch (error) {
      console.error('Error updating timeouts for moved users:', error)
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
   * @param maxSize - Maximum queue size (optional, no default limit)
   * @returns True if queue is full (only if maxSize is specified)
   */
  static async isQueueFull(maxSize?: number): Promise<boolean> {
    if (maxSize === undefined) {
      return false // No limit set, queue is never full
    }
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

  /**
   * Manually update timeouts for all users in the booking zone who don't have timeouts set
   * This is useful for maintenance or when the system needs to be synchronized
   */
  static async updateAllBookingZoneTimeouts(): Promise<void> {
    try {
      // Get all users in positions 1-20 without timeouts
      const { data: usersWithoutTimeouts, error } = await supabase
        .from('queue')
        .select('user_id, position')
        .lte('position', this.BOOKING_ZONE_SIZE)
        .is('timeout_at', null)
        .order('position')

      if (error) throw error

      // Set timeouts for each user
      for (const user of usersWithoutTimeouts || []) {
        if (user.user_id && user.position !== null) {
          await this.setTimeoutForBookingZoneUser(user.user_id, user.position)
        }
      }

      console.log(`Updated timeouts for ${usersWithoutTimeouts?.length || 0} users in booking zone`)
    } catch (error) {
      console.error('Error updating all booking zone timeouts:', error)
    }
  }

  /**
   * Get the current timeout status for all users in the queue
   * This is useful for debugging and monitoring the timeout system
   * @returns Array of timeout status information
   */
  static async getQueueTimeoutStatus(): Promise<Array<{
    userId: number
    position: number
    timeoutAt: string | null
    timeRemaining: number
    isInBookingZone: boolean
  }>> {
    try {
      const { data: queueData, error } = await supabase
        .from('queue')
        .select('user_id, position, timeout_at')
        .order('position')

      if (error) throw error

      const now = new Date()
      return (queueData || []).map(entry => {
        const isInBookingZone = entry.position !== null && entry.position <= this.BOOKING_ZONE_SIZE
        let timeRemaining = 0

        if (entry.timeout_at && isInBookingZone) {
          const timeoutAt = new Date(entry.timeout_at)
          timeRemaining = Math.max(0, timeoutAt.getTime() - now.getTime())
        }

        return {
          userId: entry.user_id!,
          position: entry.position!,
          timeoutAt: entry.timeout_at,
          timeRemaining,
          isInBookingZone
        }
      })
    } catch (error) {
      console.error('Error getting queue timeout status:', error)
      return []
    }
  }

  /**
   * Test method to verify the timeout system is working correctly
   * This can be called from the browser console for debugging
   * @param userId - The user ID to test with
   */
  static async testTimeoutSystem(userId: number): Promise<void> {
    try {
      console.log('🧪 Testing timeout system for user:', userId)
      
      // Get current queue status
      const queueStatus = await this.getQueueTimeoutStatus()
      console.log('📊 Current queue status:', queueStatus)
      
      // Check if user is in queue
      const userPosition = await this.getUserQueuePosition(userId)
      console.log('📍 User position:', userPosition)
      
      if (userPosition !== null) {
        // Get user's timeout info
        const timeoutInfo = await this.getUserTimeoutInfo(userId)
        console.log('⏰ User timeout info:', timeoutInfo)
        
        if (userPosition <= 20) {
          console.log('✅ User is in booking zone (positions 1-20)')
          if (timeoutInfo?.timeoutAt) {
            console.log('⏰ Timeout set for:', new Date(timeoutInfo.timeoutAt).toLocaleString())
            console.log('⏱️ Time remaining:', Math.ceil(timeoutInfo.timeRemaining / 1000), 'seconds')
          } else {
            console.log('⚠️ No timeout set - this might indicate an issue')
          }
        } else {
          console.log('⏳ User is waiting (position > 20)')
        }
      } else {
        console.log('❌ User not in queue')
      }
      
      console.log('🧪 Test completed')
    } catch (error) {
      console.error('❌ Error testing timeout system:', error)
    }
  }
}
