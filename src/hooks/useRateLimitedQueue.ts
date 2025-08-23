import { useState, useEffect, useCallback, useRef } from 'react'
import { QueueManager, TimeoutInfo } from '@/lib/queue-manager'
import { QUEUE_CONFIG } from '@/lib/queue-config'

interface QueueEntry {
  id: number
  position: number
  userName: string
  joinedAt: string
  timeoutInfo?: TimeoutInfo
}

interface RateLimitedQueueState {
  queueEntries: QueueEntry[]
  queueSize: number
  timeoutInfos: TimeoutInfo[]
  loading: boolean
  lastRefresh: Date | null
  nextRefreshTime: Date | null
}

export function useRateLimitedQueue(
  isInQueue: boolean,
  queuePosition: number | null,
  refreshIntervalMs: number = QUEUE_CONFIG.REFRESH_INTERVAL_MS
) {
  const [state, setState] = useState<RateLimitedQueueState>({
    queueEntries: [],
    queueSize: 0,
    timeoutInfos: [],
    loading: false,
    lastRefresh: null,
    nextRefreshTime: null
  })

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastRefreshRef = useRef<Date | null>(null)

  const canRefresh = useCallback(() => {
    if (!lastRefreshRef.current) return true
    
    const timeSinceLastRefresh = Date.now() - lastRefreshRef.current.getTime()
    return timeSinceLastRefresh >= refreshIntervalMs
  }, [refreshIntervalMs])

  const getTimeUntilNextRefresh = useCallback(() => {
    if (!lastRefreshRef.current) return 0
    
    const timeSinceLastRefresh = Date.now() - lastRefreshRef.current.getTime()
    return Math.max(0, refreshIntervalMs - timeSinceLastRefresh)
  }, [refreshIntervalMs])

  const loadQueueData = useCallback(async (force: boolean = false) => {
    if (!force && !canRefresh()) {
      console.log('Rate limit active, skipping queue refresh')
      return
    }

    setState(prev => ({ ...prev, loading: true }))
    
    try {
      // Load queue entries using QueueManager
      const queueData = await QueueManager.getCurrentQueue()
      const queueSize = await QueueManager.getQueueSize()
      
      const formattedQueue: QueueEntry[] = queueData.map((entry) => ({
        id: entry.id,
        position: entry.position,
        userName: entry.name,
        joinedAt: new Date(entry.joined_at).toLocaleTimeString()
      }))
      
      const now = new Date()
      const nextRefresh = new Date(now.getTime() + refreshIntervalMs)
      
      setState(prev => ({
        ...prev,
        queueEntries: formattedQueue,
        queueSize,
        loading: false,
        lastRefresh: now,
        nextRefreshTime: nextRefresh
      }))

      lastRefreshRef.current = now
      
      // Clear timeout info if user is not in queue
      if (!isInQueue || queuePosition === null) {
        setState(prev => ({ ...prev, timeoutInfos: [] }))
      }
      
    } catch (error) {
      console.error('Error loading queue:', error)
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [isInQueue, queuePosition, canRefresh, refreshIntervalMs])

  const updateTimeoutInfo = useCallback(async (force: boolean = false) => {
    // Only update timeout info if there are actually people in the queue
    if (state.queueSize === 0) {
      setState(prev => ({ ...prev, timeoutInfos: [] }))
      return
    }

    // Rate limit timeout info updates using configurable interval
    if (!force && lastRefreshRef.current) {
      const timeSinceLastTimeoutUpdate = Date.now() - lastRefreshRef.current.getTime()
      if (timeSinceLastTimeoutUpdate < QUEUE_CONFIG.TIMEOUT_UPDATE_INTERVAL_MS) {
        return
      }
    }

    try {
      const timeoutData = await QueueManager.getBookingZoneTimeoutInfo()
      
      setState(prev => ({ ...prev, timeoutInfos: timeoutData }))
      
      // Update queue entries with timeout info
      setState(prev => ({
        ...prev,
        queueEntries: prev.queueEntries.map((entry) => {
          const timeoutInfo = timeoutData.find(t => t.userId === entry.id)
          return {
            ...entry,
            timeoutInfo
          }
        })
      }))
    } catch (error) {
      console.error('Error updating timeout info:', error)
    }
  }, [state.queueSize])

  // Set up periodic refresh with rate limiting
  useEffect(() => {
    // Initial load
    loadQueueData(true)
    
    // Set up periodic refresh
    const interval = setInterval(() => {
      if (canRefresh()) {
        loadQueueData()
        updateTimeoutInfo()
      }
    }, refreshIntervalMs)

    // Set up timeout info updates (less frequent)
    const timeoutInterval = setInterval(() => {
      if (isInQueue && queuePosition !== null && state.queueSize > 0) {
        updateTimeoutInfo()
      }
    }, QUEUE_CONFIG.TIMEOUT_UPDATE_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      clearInterval(timeoutInterval)
      // Capture ref value for cleanup
      const currentTimeout = refreshTimeoutRef.current
      if (currentTimeout) {
        clearTimeout(currentTimeout)
      }
    }
  }, [isInQueue, queuePosition, state.queueSize, loadQueueData, updateTimeoutInfo, canRefresh, refreshIntervalMs])

  const forceRefresh = useCallback(() => {
    loadQueueData(true)
    updateTimeoutInfo(true)
  }, [loadQueueData, updateTimeoutInfo])

  return {
    ...state,
    loadQueueData,
    updateTimeoutInfo,
    forceRefresh,
    canRefresh,
    getTimeUntilNextRefresh
  }
}
