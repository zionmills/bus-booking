import { useState, useEffect, useCallback } from 'react'
import { QueueManager, TimeoutInfo } from '@/lib/queue-manager'
import { toast } from 'sonner'

export function useQueue(currentUserId: number | null) {
  const [queuePosition, setQueuePosition] = useState<number | null>(null)
  const [userTimeoutInfo, setUserTimeoutInfo] = useState<TimeoutInfo | null>(null)
  const [loading, setLoading] = useState(false)

  const joinQueue = useCallback(async () => {
    if (!currentUserId) {
      toast.error('Please log in first')
      return false
    }

    setLoading(true)
    try {
      const position = await QueueManager.joinQueue(currentUserId)
      setQueuePosition(position)
      toast.success(`Joined queue at position ${position}`)
      return true
    } catch (error) {
      console.error('Error joining queue:', error)
      toast.error('Failed to join queue. Please try again.')
      return false
    } finally {
      setLoading(false)
    }
  }, [currentUserId])

  const leaveQueue = useCallback(async () => {
    if (!currentUserId || queuePosition === null) return false

    setLoading(true)
    try {
      await QueueManager.removeUserFromQueue(currentUserId)
      setQueuePosition(null)
      toast.success('Left the queue')
      return true
    } catch (error) {
      console.error('Error leaving queue:', error)
      toast.error('Failed to leave queue. Please try again.')
      return false
    } finally {
      setLoading(false)
    }
  }, [currentUserId, queuePosition])

  const checkQueuePosition = useCallback(async () => {
    if (!currentUserId) return

    try {
      const position = await QueueManager.getUserQueuePosition(currentUserId)
      setQueuePosition(position)
    } catch (error) {
      console.error('Error checking queue position:', error)
      setQueuePosition(null)
    }
  }, [currentUserId])

  const canBookBus = useCallback(() => {
    return queuePosition !== null && queuePosition <= 20
  }, [queuePosition])

  const isInBookingZone = useCallback(() => {
    return queuePosition !== null && queuePosition <= 20
  }, [queuePosition])

  // Monitor user timeout when in booking zone
  useEffect(() => {
    if (!currentUserId || queuePosition === null || queuePosition > 20) {
      setUserTimeoutInfo(null)
      return
    }

    const updateTimeoutInfo = async () => {
      try {
        const timeoutInfo = await QueueManager.getUserTimeoutInfo(currentUserId)
        setUserTimeoutInfo(timeoutInfo)
      } catch (error) {
        console.error('Error updating timeout info:', error)
      }
    }

    // Update immediately
    updateTimeoutInfo()

    // Update every second for countdown
    const interval = setInterval(updateTimeoutInfo, 1000)

    return () => clearInterval(interval)
  }, [currentUserId, queuePosition])

  // Check queue position on mount and when user changes
  useEffect(() => {
    if (currentUserId) {
      checkQueuePosition()
    }
  }, [currentUserId, checkQueuePosition])

  return {
    // State
    queuePosition,
    userTimeoutInfo,
    loading,
    
    // Actions
    joinQueue,
    leaveQueue,
    checkQueuePosition,
    
    // Computed values
    canBookBus,
    isInBookingZone
  }
}
