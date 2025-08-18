'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Bus, Users, ArrowLeft, CheckCircle, XCircle, User } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, type Bus as BusType } from '@/lib/supabase'
import { useUser } from '@/contexts/UserContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { QueueManager } from '@/lib/queue-manager'

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
  const { currentUser, queuePosition, setQueuePosition } = useUser()
  const router = useRouter()



  const loadPassengersForAllBuses = useCallback(async (busesToLoad: BusWithPassengers[] = buses) => {
    try {
      const passengersMap: Record<number, Passenger[]> = {}
      
      for (const bus of busesToLoad) {
        const { data: bookings, error } = await supabase
          .from('bookings')
          .select(`
            user_id,
            delegates!inner(name)
          `)
          .eq('bus_id', bus.id)
        
        if (error) {
          console.error(`Error loading passengers for bus ${bus.id}:`, error)
          passengersMap[bus.id] = []
          continue
        }
        
        const passengers = bookings.map(booking => ({
          id: booking.user_id!,
          name: (booking as { delegates?: { name: string } }).delegates?.name || 'Unknown User'
        }))
        
        passengersMap[bus.id] = passengers
      }
      
      setPassengersByBus(passengersMap)
    } catch (error) {
      console.error('Error loading passengers:', error)
    }
  }, [buses])

  const loadBuses = useCallback(async () => {
    try {
      // First load all buses
      const { data: busesData, error: busesError } = await supabase
        .from('buses')
        .select('*')
        .order('id')
      
      if (busesError) throw busesError
      
      // Then load passenger counts for each bus
      const busesWithPassengers = await Promise.all(
        (busesData || []).map(async (bus) => {
          const { count: passengerCount, error: countError } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('bus_id', bus.id)
          
          if (countError) {
            console.error(`Error counting passengers for bus ${bus.id}:`, countError)
            return { ...bus, passengerCount: 0 }
          }
          
          return { ...bus, passengerCount: passengerCount || 0 }
        })
      )
      
      setBuses(busesWithPassengers)
      
      // Load passenger details for display
      await loadPassengersForAllBuses(busesWithPassengers)
      
    } catch (error) {
      console.error('Error loading buses:', error)
      toast.error('Failed to load buses')
    } finally {
      setLoading(false)
    }
  }, [loadPassengersForAllBuses])

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

    try {
      console.log('Starting booking process for bus:', busId)
      console.log('Current user:', currentUser)
      console.log('Available buses:', buses)
      
      // Check if user can book (must be in top 20 of queue)
      if (queuePosition !== null) {
        const canBook = await QueueManager.canUserBook(currentUser.id)
        if (!canBook) {
          toast.error(`You must be in the top 20 of the queue to book a bus. Your current position is ${queuePosition}.`)
          return
        }
      }
      
      // Check if bus has capacity
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
      
      if (selectedBus.passengerCount >= selectedBus.capacity) {
        toast.error('Bus is full. Please select another bus.')
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
        
        // Refresh passengers for both buses
        await loadPassengersForAllBuses()
        
        toast.success('Successfully changed bus!')
        return
      }
      
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
      await loadPassengersForAllBuses()
      
      // Reset confirm button state
      setShowConfirmButton(false)
      setPendingBusId(null)
      
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
      
      // Refresh passengers for the updated bus
      await loadPassengersForAllBuses()
      
      toast.success('Booking cancelled successfully!')
      
    } catch (error) {
      console.error('Error cancelling booking:', error)
      toast.error('Failed to cancel booking. Please try again.')
    }
  }

  const getBusStatus = (bus: BusWithPassengers) => {
    if (bus.capacity === null) {
      return { status: 'unknown', color: 'secondary' }
    }
    
    const percentage = (bus.passengerCount / bus.capacity) * 100
    
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
      default: return 'Unknown'
    }
  }

  // Add useEffect hooks after function definitions
  useEffect(() => {
    loadBuses()
  }, [loadBuses])

  useEffect(() => {
    if (currentUser) {
      loadUserBooking()
    }
  }, [currentUser, loadUserBooking])

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
            <p className="text-gray-600 mt-2">Choose from 26 available buses</p>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>

        {/* Queue Status Banner */}
        {queuePosition !== null && (
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
                        : `You need to be in position 1-20 to book a bus`
                      }
                    </p>
                  </div>
                </div>
                <Link href="/queue">
                  <Button variant="outline" size="sm">
                    View Queue
                  </Button>
                </Link>
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

        {/* Confirm Booking Button */}
        {showConfirmButton && pendingBusId && (
          <Card className="mb-8 border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <Bus className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-blue-800">
                      Confirm your booking on Bus {pendingBusId}
                    </p>
                    <p className="text-sm text-blue-600">
                      Click confirm to book your seat and remove yourself from the queue
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowConfirmButton(false)
                      setPendingBusId(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirmBooking}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Buses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {buses.map((bus) => {
            const { status, color } = getBusStatus(bus)
            const isBooked = userBooking?.busId === bus.id
            const isFull = bus.capacity ? bus.passengerCount >= bus.capacity : false
            const passengers = passengersByBus[bus.id] || []
            
            return (
              <Card 
                key={bus.id} 
                className={`transition-all duration-200 hover:shadow-lg ${
                  isBooked ? 'ring-2 ring-green-500 bg-green-50' : ''
                }`}
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
                        {bus.passengerCount}/{bus.capacity ?? 0}
                      </span>
                    </div>
                    <Progress 
                      value={bus.capacity ? (bus.passengerCount / bus.capacity) * 100 : 0} 
                      className="h-2"
                    />
                  </div>

                  {/* Passenger Count */}
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="w-4 h-4 mr-2" />
                    {bus.passengerCount} passengers
                  </div>

                  {/* Passenger Names List */}
                  {passengers.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">Passengers:</div>
                      <div className="max-h-24 overflow-y-auto border rounded-md p-2 bg-gray-50">
                        {passengers.map((passenger) => (
                          <div key={passenger.id} className="flex items-center space-x-2 py-1">
                            <User className="w-3 h-3 text-gray-500" />
                            <span className="text-sm text-gray-600">{passenger.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  {isBooked ? (
                    <Button className="w-full" variant="outline" disabled>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Booked
                    </Button>
                  ) : (
                    <Button 
                      className="w-full" 
                      disabled={isFull || (queuePosition !== null && queuePosition > 20)}
                      onClick={() => handleBookBus(bus.id)}
                    >
                      {isFull ? 'Full' : 
                       (queuePosition !== null && queuePosition > 20) ? 'Wait Your Turn' : 'Select This Bus'}
                    </Button>
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
