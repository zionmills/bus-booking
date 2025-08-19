'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Bus, Users, ArrowLeft, CheckCircle, XCircle, User, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, type Bus as BusType } from '@/lib/supabase'
import { useUser } from '@/contexts/UserContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { QueueManager, TimeoutInfo } from '@/lib/queue-manager'

interface Passenger {
  id: number
  name: string
}

interface BusWithPassengers extends BusType {
  passengerCount: number
}

export default function BusesPage() {
  const [buses, setBuses] = useState<BusWithPassengers[]>([])
  const [loading, setLoading] = useState(true)
  const [userBooking, setUserBooking] = useState<{ busId: number; userName: string } | null>(null)
  const [passengersByBus, setPassengersByBus] = useState<Record<number, Passenger[]>>({})
  const [showConfirmButton, setShowConfirmButton] = useState(false)
  const [pendingBusId, setPendingBusId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [pendingPassengers, setPendingPassengers] = useState<Record<number, Passenger[]>>({})
  const [userTimeoutInfo, setUserTimeoutInfo] = useState<TimeoutInfo | null>(null)
  const { currentUser, queuePosition, setQueuePosition } = useUser()
  const router = useRouter()



  const loadPassengersForBus = useCallback(async (busId: number) => {
    // Check if passengers are already loaded for this bus
    if (passengersByBus[busId] && passengersByBus[busId].length > 0) {
      console.log(`Passengers for bus ${busId} already loaded, skipping...`)
      return passengersByBus[busId]
    }
    
    try {
      console.log(`Loading passengers for bus ${busId}...`)

      
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          user_id,
          delegates!inner(name)
        `)
        .eq('bus_id', busId)
        .not('bus_id', 'is', null)
      
      if (error) {
        console.error(`Error loading passengers for bus ${busId}:`, error)
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        return []
      }
      
      if (!bookings) {
        console.log(`No bookings found for bus ${busId}`)
        return []
      }
      
      const passengers = bookings.map(booking => ({
        id: booking.user_id!,
        name: (booking as { delegates?: { name: string } }).delegates?.name || 'Unknown User'
      }))
      
      console.log(`Bus ${busId}: ${passengers.length} passengers loaded`)
      
      // Update the passengers map for this specific bus
      setPassengersByBus(prev => ({
        ...prev,
        [busId]: passengers
      }))
      
      return passengers
    } catch (error) {
      console.error(`Unexpected error loading passengers for bus ${busId}:`, error)
      return []
    } finally {

    }
  }, [passengersByBus])



  const checkBusCapacity = useCallback(async (busId: number) => {
    try {
      console.log(`Checking capacity for bus ${busId}...`)
      
      const { count: passengerCount, error: countError } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('bus_id', busId)
        .not('bus_id', 'is', null)
      
      if (countError) {
        console.error(`Error checking capacity for bus ${busId}:`, countError)
        throw new Error(`Failed to check bus capacity: ${countError.message}`)
      }
      
      const currentPassengers = passengerCount || 0
      console.log(`Bus ${busId} currently has ${currentPassengers} passengers`)
      
      // Update the bus state with the current passenger count
      setBuses(prev => prev.map(bus => 
        bus.id === busId 
          ? { ...bus, passengerCount: currentPassengers }
          : bus
      ))
      
      // Note: Passenger details will be loaded separately when needed
      
      return currentPassengers
    } catch (error) {
      console.error(`Error checking bus capacity for bus ${busId}:`, error)
      throw error
    }
  }, [])

  const loadBuses = useCallback(async () => {
    try {
      console.log('Starting to load buses...')
      
      // Check database health first
      try {
        const { error: testError } = await supabase
          .from('buses')
          .select('id')
          .limit(1)
        
        if (testError) {
          throw new Error(`Database connection failed: ${testError.message}`)
        }
        
        // Test bookings table access
        const { error: bookingsTestError } = await supabase
          .from('bookings')
          .select('id')
          .limit(1)
        
        if (bookingsTestError) {
          throw new Error(`Bookings table access failed: ${bookingsTestError.message}`)
        }
      } catch {
        throw new Error('Database is not accessible. Please check your connection.')
      }
      
      // First load all buses
      const { data: busesData, error: busesError } = await supabase
        .from('buses')
        .select('*')
        .order('id')
      
      if (busesError) {
        console.error('Error loading buses:', busesError)
        throw busesError
      }
      
      if (!busesData || busesData.length === 0) {
        console.log('No buses found')
        setBuses([])
        setLoading(false)
        return
      }
      
      // Validate bus data structure
      const validBuses = busesData.filter(bus => {
        if (!bus || typeof bus.id !== 'number') {
          console.warn('Invalid bus data:', bus)
          return false
        }
        return true
      })
      
      if (validBuses.length === 0) {
        console.error('No valid buses found after validation')
        setError('No valid buses found in the database')
        setLoading(false)
        return
      }
      
      console.log('Loaded buses:', validBuses)
      
      // Initialize buses with 0 passengers initially
      const busesWithPassengers = validBuses.map(bus => ({ ...bus, passengerCount: 0 }))
      
      console.log('Buses initialized:', busesWithPassengers)
      setBuses(busesWithPassengers)
      
      // Load passengers for all buses in parallel
      console.log('Loading passengers for all buses...')
      const passengerPromises = validBuses.map(async (bus) => {
        try {
          const { data: bookings, error } = await supabase
            .from('bookings')
            .select(`
              user_id,
              delegates!inner(name)
            `)
            .eq('bus_id', bus.id)
            .not('bus_id', 'is', null)
          
          if (error) {
            console.error(`Error loading passengers for bus ${bus.id}:`, error)
            return { busId: bus.id, passengers: [], count: 0 }
          }
          
          if (!bookings) {
            return { busId: bus.id, passengers: [], count: 0 }
          }
          
          const passengers = bookings.map(booking => ({
            id: booking.user_id!,
            name: (booking as { delegates?: { name: string } }).delegates?.name || 'Unknown User'
          }))
          
          return { busId: bus.id, passengers, count: passengers.length }
        } catch (error) {
          console.error(`Unexpected error loading passengers for bus ${bus.id}:`, error)
          return { busId: bus.id, passengers: [], count: 0 }
        }
      })
      
      const passengerResults = await Promise.all(passengerPromises)
      
      // Update buses with passenger counts and passengers map
      setBuses(prev => prev.map(bus => {
        const result = passengerResults.find(r => r.busId === bus.id)
        return result ? { ...bus, passengerCount: result.count } : bus
      }))
      
      // Update passengers map
      const newPassengersByBus: Record<number, Passenger[]> = {}
      passengerResults.forEach(result => {
        newPassengersByBus[result.busId] = result.passengers
      })
      setPassengersByBus(newPassengersByBus)
      
      console.log('All passengers loaded successfully')
      
    } catch (error) {
      console.error('Error loading buses:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to load buses'
      setError(errorMessage)
      toast.error('Failed to load buses')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadUserBooking = useCallback(async () => {
    if (!currentUser) return
    
    try {
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', currentUser.id)
        .single()
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error loading user booking:', error)
        return
      }
      
      if (booking) {
        setUserBooking({ 
          busId: booking.bus_id!, 
          userName: currentUser.name || 'Unknown User' 
        })
      }
    } catch (error) {
      console.error('Error loading user booking:', error)
    }
  }, [currentUser])

  const handleBookBus = async (busId: number) => {
    if (!currentUser) {
      toast.error('Please log in first')
      return
    }

    // Check if user is in queue and in top 20
    if (queuePosition === null) {
      toast.error('You must join the queue first before booking a bus')
      return
    }
    
    if (queuePosition > 20) {
      toast.error(`You must be in the top 20 of the queue to book a bus. Your current position is ${queuePosition}.`)
      return
    }

    try {
      console.log('Starting booking process for bus:', busId)
      console.log('Current user:', currentUser)
      console.log('Available buses:', buses)
      console.log('Queue position:', queuePosition)
      
      // Additional check using QueueManager for extra validation
      const canBook = await QueueManager.canUserBook(currentUser.id)
      if (!canBook) {
        toast.error(`You must be in the top 20 of the queue to book a bus. Your current position is ${queuePosition}.`)
        return
      }
      
      // Check if bus has capacity by getting the current passenger count
      try {
        const currentPassengers = await checkBusCapacity(busId)
        
        const selectedBus = buses.find(bus => bus.id === busId)
        if (!selectedBus) {
          toast.error('Bus not found')
          return
        }
        
        console.log('Selected bus:', selectedBus)
        
        if (selectedBus.capacity === null) {
          toast.error('Bus capacity information is unavailable')
          return
        }
        
        if (currentPassengers >= selectedBus.capacity) {
          toast.error('Bus is full. Please select another bus.')
          return
        }
      } catch (error) {
        console.error('Error checking bus capacity:', error)
        toast.error('Unable to verify bus capacity. Please try again.')
        return
      }
      
      // Check if user already has a booking
      if (userBooking) {
        // User already has a booking, so change to the new bus
        toast.loading('Changing your bus...')
        
        // Check if the new bus is the same as current booking
        if (userBooking.busId === busId) {
          toast.error('You are already booked on this bus')
          return
        }
        
        // Check capacity for the new bus before changing
        try {
          const currentPassengers = await checkBusCapacity(busId)
          const selectedBus = buses.find(bus => bus.id === busId)
          
          if (selectedBus && selectedBus.capacity !== null && currentPassengers >= selectedBus.capacity) {
            toast.error('The new bus is full. Please select another bus.')
            return
          }
        } catch (error) {
          console.error('Error checking new bus capacity:', error)
          toast.error('Unable to verify new bus capacity. Please try again.')
          return
        }
        
        // Update the existing booking to point to the new bus
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ bus_id: busId })
          .eq('user_id', currentUser.id)
          .eq('bus_id', userBooking.busId)
        
        if (updateError) throw updateError
        
        // Update local state - decrement old bus, increment new bus
        setBuses(prev => prev.map(bus => {
          if (bus.id === userBooking.busId) {
            return { ...bus, passengerCount: bus.passengerCount - 1 }
          }
          if (bus.id === busId) {
            return { ...bus, passengerCount: bus.passengerCount + 1 }
          }
          return bus
        }))
        
                 setUserBooking({ busId, userName: currentUser.name || 'Unknown User' })
         
         // Clear any pending passengers
         setPendingPassengers(prev => {
           const newState = { ...prev }
           delete newState[userBooking.busId]
           delete newState[busId]
           return newState
         })
         
         // Refresh passengers for both buses
         await Promise.all([
           loadPassengersForBus(userBooking.busId),
           loadPassengersForBus(busId)
         ])
         
         toast.success('Successfully changed bus!')
         return
      }
      
             // Create pending passenger object
       const pendingPassenger: Passenger = {
         id: currentUser.id,
         name: currentUser.name || 'Unknown User'
       }
       
       // Remove user from any previously selected bus's pending passengers
       setPendingPassengers(prev => {
         const newState = { ...prev }
         // Remove from all buses except the current selection
         Object.keys(newState).forEach(busKey => {
           const busIdNum = parseInt(busKey)
           if (busIdNum !== busId) {
             newState[busIdNum] = newState[busIdNum]?.filter(p => p.id !== currentUser.id) || []
             // Remove the bus entry entirely if no pending passengers left
             if (newState[busIdNum]?.length === 0) {
               delete newState[busIdNum]
             }
           }
         })
         
         // Add user to pending passengers for the newly selected bus
         newState[busId] = [pendingPassenger]
         return newState
       })
       
       // Show confirm button instead of immediately booking
       setPendingBusId(busId)
       setShowConfirmButton(true)
       toast.info('Please confirm your bus selection')
      
    } catch (error) {
      console.error('Error in bus selection:', error)
      toast.error('Failed to select bus. Please try again.')
    }
  }

  const handleConfirmBooking = async () => {
    if (!pendingBusId || !currentUser) return
    
    try {
      toast.loading('Confirming your booking...')
      
      // Create the booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert([{ bus_id: pendingBusId, user_id: currentUser.id }])
        .select()
        .single()
      
      if (bookingError) {
        console.error('Booking error:', bookingError)
        throw bookingError
      }
      
      console.log('Booking created successfully:', booking)
      
      // Update local state - increment passenger count for the selected bus
      setBuses(prev => prev.map(bus => 
        bus.id === pendingBusId 
          ? { ...bus, passengerCount: bus.passengerCount + 1 }
          : bus
      ))
      
      setUserBooking({ 
        busId: pendingBusId, 
        userName: currentUser.name || 'Unknown User' 
      })
      
      // Remove user from queue if they were in it
      if (queuePosition !== null) {
        try {
          await QueueManager.removeUserFromQueue(currentUser.id)
          setQueuePosition(null)
        } catch (error) {
          console.error('Error removing from queue:', error)
          // Continue with booking even if queue removal fails
        }
      }
      
      // Refresh passengers for the updated bus
      await loadPassengersForBus(pendingBusId)
      
             // Reset confirm button state and clear pending passengers
       setShowConfirmButton(false)
       setPendingBusId(null)
       setPendingPassengers(prev => {
         const newState = { ...prev }
         delete newState[pendingBusId]
         return newState
       })
      
      toast.success('Booking confirmed!')
      
      // Redirect to confirmation page
      router.push('/booking-confirmation')
      
    } catch (error) {
      console.error('Error confirming booking:', error)
      toast.error('Failed to confirm booking. Please try again.')
    }
  }

  const handleCancelBooking = async () => {
    if (!userBooking || !currentUser) return
    
    try {
      toast.loading('Cancelling your booking...')
      
      // Delete the booking
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('bus_id', userBooking.busId)
      
      if (deleteError) throw deleteError
      
      // Update local state - decrement passenger count for the cancelled bus
      setBuses(prev => prev.map(bus => 
        bus.id === userBooking.busId 
          ? { ...bus, passengerCount: bus.passengerCount - 1 }
          : bus
      ))
      
             setUserBooking(null)
       
       // Clear any pending passengers
       setPendingPassengers(prev => {
         const newState = { ...prev }
         delete newState[userBooking.busId]
         return newState
       })
       
       // Refresh passengers for the updated bus
       await loadPassengersForBus(userBooking.busId)
      
      toast.success('Booking cancelled successfully!')
      
    } catch (error) {
      console.error('Error cancelling booking:', error)
      toast.error('Failed to cancel booking. Please try again.')
    }
  }

  const getBusStatus = (bus: BusWithPassengers, isLoadingPassengers: boolean, pendingCount: number = 0) => {
    if (isLoadingPassengers) {
      return { status: 'loading', color: 'secondary' }
    }
    
    if (bus.capacity === null) {
      return { status: 'unknown', color: 'secondary' }
    }
    
    const totalPassengers = bus.passengerCount + pendingCount
    const percentage = (totalPassengers / bus.capacity) * 100
    
    if (percentage >= 100) return { status: 'full', color: 'destructive' }
    if (percentage >= 80) return { status: 'almost-full', color: 'warning' }
    if (percentage >= 50) return { status: 'moderate', color: 'default' }
    return { status: 'available', color: 'secondary' }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'full': return 'Full'
      case 'almost-full': return 'Almost Full'
      case 'moderate': return 'Moderate'
      case 'available': return 'Available'
      case 'unknown': return 'Unknown'
      case 'loading': return 'Loading...'
      default: return 'Unknown'
    }
  }

  const clearPendingSelection = () => {
    if (pendingBusId) {
      setPendingPassengers(prev => {
        const newState = { ...prev }
        delete newState[pendingBusId]
        return newState
      })
      setShowConfirmButton(false)
      setPendingBusId(null)
    }
  }

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

  // Add useEffect hooks after function definitions
  useEffect(() => {
    loadBuses()
  }, [loadBuses])

  // Monitor user timeout when in booking zone
  useEffect(() => {
    if (!currentUser || queuePosition === null || queuePosition > 20) {
      setUserTimeoutInfo(null)
      return
    }

    // Start monitoring timeout for user in booking zone
    const updateTimeoutInfo = async () => {
      try {
        const timeoutInfo = await QueueManager.getUserTimeoutInfo(currentUser.id)
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
  }, [currentUser, queuePosition])

  useEffect(() => {
    if (currentUser) {
      loadUserBooking()
    }
  }, [currentUser, loadUserBooking])

  // Cleanup pending passengers when component unmounts
  useEffect(() => {
    return () => {
      setPendingPassengers({})
      setShowConfirmButton(false)
      setPendingBusId(null)
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto pt-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading buses...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto pt-20">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-6">Please log in to view and book buses.</p>
            <Link href="/">
              <Button>
                Go to Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Select Your Bus</h1>
            <p className="text-gray-600 mt-2">
              {queuePosition === null 
                ? 'Join the queue first to book a bus'
                : queuePosition <= 20 
                  ? `You can book a bus (Queue position: ${queuePosition})`
                  : `Waiting in queue (Position: ${queuePosition}, need 1-20 to book)`
              }
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>

        {/* Timeout Warning Banner */}
        {userTimeoutInfo && userTimeoutInfo.isInBookingZone && (
          <Card className="mb-6 border-2 border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-yellow-100 text-yellow-600">
                    <Timer className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-yellow-800">
                      Booking Timeout Warning
                    </p>
                    <p className="text-sm text-yellow-600">
                      You have limited time to complete your bus booking
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getTimeoutWarningColor(userTimeoutInfo.timeRemaining)}`}>
                    {formatTimeRemaining(userTimeoutInfo.timeRemaining)}
                  </div>
                  <div className="text-xs text-yellow-600">Time Remaining</div>
                </div>
              </div>
              <div className="mt-3 p-3 bg-yellow-100 rounded border border-yellow-300">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> You have 5 minutes from when you joined the queue to complete your bus booking. 
                  After this time, you will be automatically removed from the queue and will need to rejoin.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-3">
                <XCircle className="w-6 h-6 text-red-600" />
                <div>
                  <p className="font-semibold text-red-800">Error Loading Buses</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError(null)
                    loadBuses()
                  }}
                >
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}





        {/* Booking Eligibility Summary */}
        <Card className="mb-6 border-2 border-gray-200 bg-gray-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  queuePosition === null 
                    ? 'bg-blue-100 text-blue-600' 
                    : queuePosition <= 20 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-orange-100 text-orange-600'
                }`}>
                  {queuePosition === null ? (
                    <span className="text-sm font-bold">?</span>
                  ) : queuePosition <= 20 ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <span className="text-xs font-bold">{queuePosition}</span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">
                    {queuePosition === null 
                      ? 'Not in Queue'
                      : queuePosition <= 20 
                        ? 'Eligible to Book'
                        : 'Not Eligible to Book'
                    }
                  </p>
                  <p className="text-sm text-gray-600">
                    {queuePosition === null 
                      ? 'Join the queue to start booking buses'
                      : queuePosition <= 20 
                        ? `You are in position ${queuePosition} and can book a bus`
                        : `You are in position ${queuePosition} and need to be in the top 20 to book`
                    }
                  </p>
                  {/* Timeout info for users in booking zone */}
                  {userTimeoutInfo && userTimeoutInfo.isInBookingZone && (
                    <div className="mt-2 flex items-center space-x-2">
                      <Timer className="w-4 h-4 text-yellow-600" />
                      <span className={`text-sm font-medium ${getTimeoutWarningColor(userTimeoutInfo.timeRemaining)}`}>
                        {formatTimeRemaining(userTimeoutInfo.timeRemaining)} to complete booking
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">
                  {queuePosition === null ? 'N/A' : queuePosition}
                </div>
                <div className="text-xs text-gray-500">Queue Position</div>
                {/* Timeout countdown for users in booking zone */}
                {userTimeoutInfo && userTimeoutInfo.isInBookingZone && (
                  <div className="mt-2">
                    <div className={`text-lg font-bold ${getTimeoutWarningColor(userTimeoutInfo.timeRemaining)}`}>
                      {formatTimeRemaining(userTimeoutInfo.timeRemaining)}
                    </div>
                    <div className="text-xs text-yellow-600">Time Left</div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Queue Status Banner */}
        {queuePosition === null ? (
          <Card className="mb-8 border-2 border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                    <span className="text-xs font-bold">!</span>
                  </div>
                  <div>
                    <p className="font-semibold text-blue-800">
                      Join the Queue First
                    </p>
                    <p className="text-sm text-blue-600">
                      You need to join the queue before you can book a bus
                    </p>
                  </div>
                </div>
                <Link href="/queue">
                  <Button size="sm">
                    Join Queue
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className={`mb-8 border-2 ${
            queuePosition <= 20 
              ? 'border-green-200 bg-green-50' 
              : 'border-orange-200 bg-orange-50'
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    queuePosition <= 20 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-orange-100 text-orange-600'
                  }`}>
                    {queuePosition <= 20 ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <span className="text-xs font-bold">{queuePosition}</span>
                    )}
                  </div>
                  <div>
                    <p className={`font-semibold ${
                      queuePosition <= 20 ? 'text-green-800' : 'text-orange-800'
                    }`}>
                      {queuePosition <= 20 
                        ? `You can book a bus! (Position ${queuePosition})`
                        : `Waiting in queue (Position ${queuePosition})`
                      }
                    </p>
                    <p className={`text-sm ${
                      queuePosition <= 20 ? 'text-green-600' : 'text-orange-600'
                    }`}>
                      {queuePosition <= 20 
                        ? 'You are in the top 20 and can select a bus'
                        : `You need to be in position 1-20 to book a bus. Current position: ${queuePosition}`
                      }
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Link href="/queue">
                    <Button variant="outline" size="sm">
                      View Queue
                    </Button>
                  </Link>
                  {queuePosition > 20 && (
                    <div className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                      {queuePosition - 20} positions to go
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User's Current Booking */}
        {userBooking && (
          <Card className="mb-8 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800">
                      You&apos;re booked on Bus {userBooking.busId}
                    </p>
                    <p className="text-sm text-green-600">
                      {userBooking.userName}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelBooking}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}



        {/* Buses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Legend */}
          <div className="col-span-full mb-4">
                          <div className="flex items-center justify-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">Bookable (Top 20 in queue)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-gray-600">Not bookable (Queue position &gt; 20)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">Your booked bus</span>
                </div>
              </div>
          </div>
          {buses.map((bus) => {
            const pendingCount = pendingPassengers[bus.id]?.length || 0
            const { status, color } = getBusStatus(bus, false, pendingCount)
            const isBooked = userBooking?.busId === bus.id
            const isFull = bus.capacity ? (bus.passengerCount + pendingCount) >= bus.capacity : false
            const passengers = passengersByBus[bus.id] || []
            
            return (
              <Card 
                key={bus.id} 
                className={`transition-all duration-200 hover:shadow-lg cursor-pointer ${
                  isBooked ? 'ring-2 ring-green-500 bg-green-50' : 
                  (queuePosition === null || queuePosition > 20) ? 'ring-2 ring-gray-300 bg-gray-50' : ''
                }`}
                onClick={() => {
                  // Load passengers when card is clicked (only if not already loaded)
                  if (!passengersByBus[bus.id] || passengersByBus[bus.id].length === 0) {
                    loadPassengersForBus(bus.id)
                  }
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl flex items-center">
                      <Bus className="w-5 h-5 mr-2 text-blue-600" />
                      Bus {bus.id}
                    </CardTitle>
                    <Badge variant={color as "default" | "secondary" | "destructive" | "outline"}>
                      {getStatusText(status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Capacity Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Capacity</span>
                      <span className="font-medium">
                        <span>
                          {bus.passengerCount + (pendingPassengers[bus.id]?.length || 0)}/{bus.capacity ?? 0}
                          {pendingPassengers[bus.id]?.length > 0 && (
                            <span className="text-blue-600 text-xs ml-1">
                              (+{pendingPassengers[bus.id].length})
                            </span>
                          )}
                        </span>
                      </span>
                    </div>
                    <Progress 
                      value={bus.capacity ? ((bus.passengerCount + (pendingPassengers[bus.id]?.length || 0)) / bus.capacity) * 100 : 0} 
                      className="h-2"
                    />
                  </div>

                  {/* Passenger Count */}
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="w-4 h-4 mr-2" />
                    <span>
                      {bus.passengerCount + (pendingPassengers[bus.id]?.length || 0)} passengers
                      {pendingPassengers[bus.id]?.length > 0 && (
                        <span className="text-blue-600 text-xs ml-1">
                          (+{pendingPassengers[bus.id].length} pending)
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Passenger Names List */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">Passengers:</div>
                    <div className="max-h-24 overflow-y-auto border rounded-md p-2 bg-gray-50">
                      {/* Show actual passengers */}
                      {passengers.map((passenger) => (
                        <div key={passenger.id} className="flex items-center space-x-2 py-1">
                          <User className="w-3 h-3 text-gray-500" />
                          <span className="text-sm text-gray-600">{passenger.name}</span>
                        </div>
                      ))}
                      {/* Show pending passengers */}
                      {pendingPassengers[bus.id]?.map((passenger) => (
                        <div key={`pending-${passenger.id}`} className="flex items-center space-x-2 py-1">
                          <User className="w-3 h-3 text-blue-500" />
                          <span className="text-sm text-blue-600 italic">{passenger.name} (pending)</span>
                        </div>
                      ))}
                      {/* Show "no passengers" message if both lists are empty */}
                      {passengers.length === 0 && (!pendingPassengers[bus.id] || pendingPassengers[bus.id].length === 0) && (
                        <div className="flex items-center justify-center py-2">
                          <span className="text-sm text-gray-500">No passengers yet</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  {isBooked ? (
                    <Button className="w-full" variant="outline" disabled>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Booked
                    </Button>
                  ) : pendingBusId === bus.id && showConfirmButton ? (
                    <div className="space-y-2">
                      <Button 
                        className="w-full" 
                        onClick={handleConfirmBooking}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirm Booking
                      </Button>
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={clearPendingSelection}
                      >
                        Cancel Selection
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button 
                        className="w-full" 
                        disabled={isFull || queuePosition === null || queuePosition > 20}
                        onClick={() => {
                          // Double-check that user can book before proceeding
                          if (queuePosition === null || queuePosition > 20) {
                            toast.error('You must be in the top 20 of the queue to book a bus')
                            return
                          }
                          handleBookBus(bus.id)
                        }}
                      >
                        {isFull ? 'Full' : 
                         queuePosition === null ? 'Join Queue First' :
                         queuePosition > 20 ? `Position ${queuePosition} - Wait Your Turn` : 'Select This Bus'}
                      </Button>
                      {/* Show reason why button is disabled */}
                      {(queuePosition === null || queuePosition > 20) && (
                        <div className="text-xs text-center text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {queuePosition === null 
                            ? 'Join queue to book buses' 
                            : `Need position 1-20, currently ${queuePosition}`}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
