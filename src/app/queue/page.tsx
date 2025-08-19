'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Users, Clock, ArrowLeft, CheckCircle, AlertCircle, Timer } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

import { useUser } from '@/contexts/UserContext'
import { QueueManager, TimeoutInfo } from '@/lib/queue-manager'

interface QueueEntry {
  id: number
  position: number
  userName: string
  joinedAt: string
  timeoutInfo?: TimeoutInfo
}

export default function QueuePage() {
  const { currentUser, queuePosition, setQueuePosition } = useUser()
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([])
  const [isInQueue, setIsInQueue] = useState(false)
  const [loading, setLoading] = useState(false)
  const [queueSize, setQueueSize] = useState(0)
  const [timeoutInfos, setTimeoutInfos] = useState<TimeoutInfo[]>([])
  const maxQueueSize = 40

  // Check if user is in queue based on context
  useEffect(() => {
    const wasInQueue = isInQueue
    setIsInQueue(queuePosition !== null)
    
    // If user just left the queue, clear timeout info
    if (wasInQueue && queuePosition === null) {
      setTimeoutInfos([])
    }
  }, [queuePosition, isInQueue])



  const loadQueueData = useCallback(async () => {
    setLoading(true)
    
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
      
      setQueueEntries(formattedQueue)
      setQueueSize(queueSize)
      
             // Clear timeout info if user is not in queue
       if (!isInQueue || queuePosition === null) {
         setTimeoutInfos([])
       }
      
    } catch (error) {
      console.error('Error loading queue:', error)
      toast.error('Failed to load queue data')
    } finally {
      setLoading(false)
    }
  }, [isInQueue, queuePosition])

  const updateTimeoutInfo = useCallback(async () => {
    try {
      // Only update timeout info if there are actually people in the queue
      if (queueSize === 0) {
        setTimeoutInfos([])
        return
      }
      
      const timeoutData = await QueueManager.getBookingZoneTimeoutInfo()
      setTimeoutInfos(timeoutData)
      
      // Update queue entries with timeout info
      setQueueEntries(prev => prev.map(entry => {
        const timeoutInfo = timeoutData.find(t => t.userId === entry.id)
        return {
          ...entry,
          timeoutInfo
        }
      }))
    } catch (error) {
      console.error('Error updating timeout info:', error)
    }
  }, [queueSize])

  // Add useEffect hook after function declarations
  useEffect(() => {
    // Start timeout monitoring when component mounts
    QueueManager.startTimeoutMonitoring()
    
    // Load queue data
    loadQueueData()
    
    // Set up periodic refresh for timeout info only when user is in queue
    const timeoutInterval = setInterval(() => {
      if (isInQueue && queuePosition !== null && queueSize > 0) {
        updateTimeoutInfo()
      }
    }, 1000) // Update every second for countdown

    // Cleanup function
    return () => {
      clearInterval(timeoutInterval)
      QueueManager.stopTimeoutMonitoring()
    }
  }, [isInQueue, queuePosition, queueSize, loadQueueData, updateTimeoutInfo])

  const formatTimeRemaining = (milliseconds: number): string => {
    const seconds = Math.ceil(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getTimeoutWarningColor = (timeRemaining: number): string => {
    if (timeRemaining <= 10000) return 'text-red-600' // 10 seconds or less
    if (timeRemaining <= 30000) return 'text-orange-600' // 30 seconds or less
    return 'text-yellow-600' // More than 30 seconds
  }

  const joinQueue = async () => {
    setLoading(true)
    
    try {
      if (!currentUser) {
        toast.error('Please enter your name and QR code first')
        return
      }
      
      // Check if queue is full
      const isFull = await QueueManager.isQueueFull(maxQueueSize)
      if (isFull) {
        toast.error('Queue is full. Please try again later.')
        return
      }
      
      // Add user to queue using QueueManager
      const newPosition = await QueueManager.addUserToQueue(currentUser.id)
      
      // Update local state
      const newEntry: QueueEntry = {
        id: currentUser.id, // Using user ID as temporary ID
        position: newPosition,
        userName: 'You',
        joinedAt: new Date().toLocaleTimeString()
      }
      
      setQueueEntries(prev => [...prev, newEntry])
      setQueueSize(prev => prev + 1)
      setQueuePosition(newPosition)
      setIsInQueue(true)
      
      toast.success(`Joined queue at position ${newPosition}`)
      
    } catch (error) {
      console.error('Error joining queue:', error)
      toast.error('Failed to join queue. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const leaveQueue = async () => {
    if (!isInQueue || !currentUser) return
    
    setLoading(true)
    
    try {
      // Remove user from queue using QueueManager
      await QueueManager.removeUserFromQueue(currentUser.id)
      
      // Refresh queue data to get updated positions
      await loadQueueData()
      
      // Update local state
      setQueuePosition(null)
      setIsInQueue(false)
      
      toast.success('Left the queue')
      
    } catch (error) {
      console.error('Error leaving queue:', error)
      toast.error('Failed to leave queue. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getQueueStatus = () => {
    const percentage = (queueSize / maxQueueSize) * 100
    
    if (percentage >= 100) return { status: 'full', color: 'destructive' }
    if (percentage >= 80) return { status: 'almost-full', color: 'warning' }
    if (percentage >= 50) return { status: 'moderate', color: 'default' }
    return { status: 'available', color: 'secondary' }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'full': return 'Queue Full'
      case 'almost-full': return 'Almost Full'
      case 'moderate': return 'Moderate'
      case 'available': return 'Available'
      default: return 'Unknown'
    }
  }

  if (loading && queueEntries.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-2xl mx-auto pt-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading queue...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Queue Status</h1>
            <p className="text-gray-600 mt-2">Join the queue to book your bus</p>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>

        {/* Queue Status Card */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-600" />
                Queue Status
              </CardTitle>
              <Badge variant={getQueueStatus().color as "default" | "secondary" | "destructive" | "outline"}>
                {getStatusText(getQueueStatus().status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Current Queue Size</span>
                <span className="font-medium">{queueSize}/{maxQueueSize}</span>
              </div>
              <Progress 
                value={(queueSize / maxQueueSize) * 100} 
                className="h-2"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Booking Zone (Top 20)</span>
                <span className="font-medium text-green-600">
                  {Math.min(queueSize, 20)}/20
                </span>
              </div>
              <Progress 
                value={(Math.min(queueSize, 20) / 20) * 100} 
                className="h-2 bg-gray-200"
              />
              <p className="text-xs text-gray-500">
                Only people in positions 1-20 can book buses
              </p>
            </div>

            {/* Timeout Warning - Only show when there are people in queue */}
            {timeoutInfos.length > 0 && queueSize > 0 && isInQueue && (
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center space-x-3">
                  <Timer className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="font-semibold text-yellow-800">
                      Booking Timeout Warning
                    </p>
                    <p className="text-sm text-yellow-600">
                                             Users in positions 1-20 have 5 minutes to book. After that, they&apos;ll be removed from the queue.
                    </p>
                    <div className="mt-2 space-y-1">
                      {timeoutInfos.slice(0, 3).map((timeout) => (
                        <div key={timeout.userId} className="flex justify-between text-xs">
                          <span>Position {timeout.position}:</span>
                          <span className={getTimeoutWarningColor(timeout.timeRemaining)}>
                            {formatTimeRemaining(timeout.timeRemaining)} remaining
                          </span>
                        </div>
                      ))}
                      {timeoutInfos.length > 3 && (
                        <p className="text-xs text-yellow-600">
                          ...and {timeoutInfos.length - 3} more users with timeouts
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {isInQueue ? (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800">
                      You&apos;re in the queue!
                    </p>
                    <p className="text-sm text-green-600">
                      Position: <span className="font-bold">{queuePosition}</span>
                    </p>
                    {/* Personal timeout warning */}
                    {queuePosition && queuePosition <= 20 && queueSize > 0 && (() => {
                      const userTimeout = timeoutInfos.find(t => t.userId === currentUser?.id)
                      return userTimeout && userTimeout.timeRemaining > 0 ? (
                        <div className="mt-2 p-2 bg-yellow-100 rounded border border-yellow-300">
                          <div className="flex items-center space-x-2">
                            <Timer className="w-4 h-4 text-yellow-600" />
                            <span className="text-xs text-yellow-800">
                              You have <span className="font-bold">
                                {formatTimeRemaining(userTimeout.timeRemaining)}
                              </span> to book your bus
                            </span>
                          </div>
                        </div>
                      ) : null
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="font-semibold text-blue-800">
                      Not in queue
                    </p>
                    <p className="text-sm text-blue-600">
                      Join the queue to start booking
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {!isInQueue ? (
                <Button 
                  onClick={joinQueue} 
                  disabled={loading || queueSize >= maxQueueSize}
                  className="flex-1"
                >
                  {loading ? 'Joining...' : 'Join Queue'}
                </Button>
              ) : (
                <Button 
                  onClick={leaveQueue} 
                  variant="outline"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Leaving...' : 'Leave Queue'}
                </Button>
              )}
              
              <Button 
                onClick={loadQueueData} 
                variant="outline"
                disabled={loading}
              >
                Refresh
              </Button>
              

            </div>
          </CardContent>
        </Card>

                {/* Current Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2 text-gray-600" />
              Current Queue ({queueEntries.length} people)
            </CardTitle>
                         <CardDescription>
               Only positions 1-20 can book buses. Positions 21+ must wait their turn. Users in the booking zone have 5 minutes to complete their booking.
             </CardDescription>
          </CardHeader>
          <CardContent>
            {queueEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No one in the queue yet
              </div>
            ) : (
              <div className="space-y-3">
                {/* Booking Zone Header */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-800">Booking Zone (Positions 1-20)</span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">
                    People in these positions can book buses
                  </p>
                </div>

                {queueEntries.map((entry) => {
                  const isInBookingZone = entry.position <= 20
                  const isCurrentUser = entry.position === queuePosition
                  
                  return (
                    <div 
                      key={entry.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isCurrentUser 
                          ? 'bg-green-50 border-green-200' 
                          : isInBookingZone
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isInBookingZone 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-orange-100 text-orange-600'
                        }`}>
                          <span className="text-sm font-bold">
                            {entry.position}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {entry.userName}
                          </p>
                          <p className="text-sm text-gray-500">
                            Joined at {entry.joinedAt}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {isInBookingZone && (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            Can Book
                          </Badge>
                        )}
                        {!isInBookingZone && (
                          <Badge variant="secondary">
                            Waiting
                          </Badge>
                        )}
                        {isCurrentUser && (
                          <Badge variant="outline" className="border-green-500 text-green-700">
                            You
                          </Badge>
                        )}
                        {/* Timeout Countdown */}
                        {entry.timeoutInfo && entry.timeoutInfo.isInBookingZone && entry.timeoutInfo.timeRemaining > 0 && (
                          <div className="flex items-center space-x-1">
                            <Timer className="w-3 h-3 text-gray-500" />
                            <span className={`text-xs font-mono ${getTimeoutWarningColor(entry.timeoutInfo.timeRemaining)}`}>
                              {formatTimeRemaining(entry.timeoutInfo.timeRemaining)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
