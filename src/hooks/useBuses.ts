import { useState, useEffect, useCallback } from 'react'
import { supabase, type Bus as BusType } from '@/lib/supabase'
import { toast } from 'sonner'
import { QueueManager, TimeoutInfo } from '@/lib/queue-manager'

interface Passenger {
  id: number
  name: string
}

interface BusWithPassengers extends BusType {
  passengerCount: number
}

interface UserBooking {
  busId: number
  userName: string
}

interface PendingPassenger {
  id: number
  name: string
}

export function useBuses(currentUserId: number | null, currentUserName: string | null) {
  const [buses, setBuses] = useState<BusWithPassengers[]>([])
  const [loading, setLoading] = useState(true)
  const [userBooking, setUserBooking] = useState<UserBooking | null>(null)
  const [passengersByBus, setPassengersByBus] = useState<Record<number, Passenger[]>>({})
  const [pendingPassengers, setPendingPassengers] = useState<Record<number, PendingPassenger[]>>({})
  const [error, setError] = useState<string | null>(null)

  const loadPassengersForBus = useCallback(async (busId: number) => {
    if (passengersByBus[busId] && passengersByBus[busId].length > 0) {
      return passengersByBus[busId]
    }
    
    try {
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
        return []
      }
      
      if (!bookings) {
        return []
      }
      
      const passengers = bookings.map(booking => ({
        id: booking.user_id!,
        name: (booking as { delegates?: { name: string } }).delegates?.name || 'Unknown User'
      }))
      
      setPassengersByBus(prev => ({
        ...prev,
        [busId]: passengers
      }))
      
      return passengers
    } catch (error) {
      console.error(`Unexpected error loading passengers for bus ${busId}:`, error)
      return []
    }
  }, [passengersByBus])

  const checkBusCapacity = useCallback(async (busId: number) => {
    try {
      const { count: passengerCount, error: countError } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('bus_id', busId)
        .not('bus_id', 'is', null)
      
      if (countError) {
        throw new Error(`Failed to check bus capacity: ${countError.message}`)
      }
      
      const currentPassengers = passengerCount || 0
      
      setBuses(prev => prev.map(bus => 
        bus.id === busId 
          ? { ...bus, passengerCount: currentPassengers }
          : bus
      ))
      
      return currentPassengers
    } catch (error) {
      console.error(`Error checking bus capacity for bus ${busId}:`, error)
      throw error
    }
  }, [])

  const loadBuses = useCallback(async () => {
    try {
      // Test database connectivity
      const { error: testError } = await supabase
        .from('buses')
        .select('id')
        .limit(1)
      
      if (testError) {
        throw new Error(`Database connection failed: ${testError.message}`)
      }
      
      const { error: bookingsTestError } = await supabase
        .from('bookings')
        .select('id')
        .limit(1)
      
      if (bookingsTestError) {
        throw new Error(`Bookings table access failed: ${bookingsTestError.message}`)
      }
      
      // Load all buses
      const { data: busesData, error: busesError } = await supabase
        .from('buses')
        .select('*')
        .order('id')
      
      if (busesError) {
        throw busesError
      }
      
      if (!busesData || busesData.length === 0) {
        setBuses([])
        setLoading(false)
        return
      }
      
      const validBuses = busesData.filter(bus => bus && typeof bus.id === 'number')
      
      if (validBuses.length === 0) {
        setError('No valid buses found in the database')
        setLoading(false)
        return
      }
      
      const busesWithPassengers = validBuses.map(bus => ({ ...bus, passengerCount: 0 }))
      setBuses(busesWithPassengers)
      
      // Load passengers for all buses in parallel
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
          return { busId: bus.id, passengers: [], count: 0 }
        }
      })
      
      const passengerResults = await Promise.all(passengerPromises)
      
      setBuses(prev => prev.map(bus => {
        const result = passengerResults.find(r => r.busId === bus.id)
        return result ? { ...bus, passengerCount: result.count } : bus
      }))
      
      const newPassengersByBus: Record<number, Passenger[]> = {}
      passengerResults.forEach(result => {
        newPassengersByBus[result.busId] = result.passengers
      })
      setPassengersByBus(newPassengersByBus)
      
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
    if (!currentUserId) return
    
    try {
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', currentUserId)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading user booking:', error)
        return
      }
      
      if (booking && currentUserName) {
        setUserBooking({ 
          busId: booking.bus_id!, 
          userName: currentUserName
        })
      }
    } catch (error) {
      console.error('Error loading user booking:', error)
    }
  }, [currentUserId, currentUserName])

  const bookBus = useCallback(async (busId: number) => {
    if (!currentUserId || !currentUserName) {
      throw new Error('User not authenticated')
    }

    try {
      const currentPassengers = await checkBusCapacity(busId)
      const selectedBus = buses.find(bus => bus.id === busId)
      
      if (!selectedBus) {
        throw new Error('Bus not found')
      }
      
      if (selectedBus.capacity === null) {
        throw new Error('Bus capacity information is unavailable')
      }
      
      if (currentPassengers >= selectedBus.capacity) {
        throw new Error('Bus is full. Please select another bus.')
      }
      
      // Create the booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert([{ bus_id: busId, user_id: currentUserId }])
        .select()
        .single()
      
      if (bookingError) {
        throw bookingError
      }
      
      // Update local state
      setBuses(prev => prev.map(bus => 
        bus.id === busId 
          ? { ...bus, passengerCount: bus.passengerCount + 1 }
          : bus
      ))
      
      setUserBooking({ busId, userName: currentUserName })
      
      // Refresh passengers for the updated bus
      await loadPassengersForBus(busId)
      
      return booking
    } catch (error) {
      console.error('Error booking bus:', error)
      throw error
    }
  }, [currentUserId, currentUserName, buses, checkBusCapacity, loadPassengersForBus])

  const changeBus = useCallback(async (newBusId: number) => {
    if (!currentUserId || !currentUserName || !userBooking) {
      throw new Error('Invalid booking state')
    }

    try {
      const currentPassengers = await checkBusCapacity(newBusId)
      const selectedBus = buses.find(bus => bus.id === newBusId)
      
      if (selectedBus && selectedBus.capacity !== null && currentPassengers >= selectedBus.capacity) {
        throw new Error('The new bus is full. Please select another bus.')
      }
      
      // Update the existing booking
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ bus_id: newBusId })
        .eq('user_id', currentUserId)
        .eq('bus_id', userBooking.busId)
      
      if (updateError) throw updateError
      
      // Update local state
      setBuses(prev => prev.map(bus => {
        if (bus.id === userBooking.busId) {
          return { ...bus, passengerCount: bus.passengerCount - 1 }
        }
        if (bus.id === newBusId) {
          return { ...bus, passengerCount: bus.passengerCount + 1 }
        }
        return bus
      }))
      
      setUserBooking({ busId: newBusId, userName: currentUserName })
      
      // Refresh passengers for both buses
      await Promise.all([
        loadPassengersForBus(userBooking.busId),
        loadPassengersForBus(newBusId)
      ])
      
    } catch (error) {
      console.error('Error changing bus:', error)
      throw error
    }
  }, [currentUserId, currentUserName, userBooking, buses, checkBusCapacity, loadPassengersForBus])

  const cancelBooking = useCallback(async () => {
    if (!currentUserId || !userBooking) return
    
    try {
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('user_id', currentUserId)
        .eq('bus_id', userBooking.busId)
      
      if (deleteError) throw deleteError
      
      // Update local state
      setBuses(prev => prev.map(bus => 
        bus.id === userBooking.busId 
          ? { ...bus, passengerCount: bus.passengerCount - 1 }
          : bus
      ))
      
      setUserBooking(null)
      
      // Refresh passengers for the updated bus
      await loadPassengersForBus(userBooking.busId)
      
    } catch (error) {
      console.error('Error cancelling booking:', error)
      throw error
    }
  }, [currentUserId, userBooking, loadPassengersForBus])

  const addPendingPassenger = useCallback((busId: number) => {
    if (!currentUserId || !currentUserName) return
    
    const pendingPassenger: PendingPassenger = {
      id: currentUserId,
      name: currentUserName
    }
    
    setPendingPassengers(prev => {
      const newState = { ...prev }
      // Remove from all other buses
      Object.keys(newState).forEach(busKey => {
        const busIdNum = parseInt(busKey)
        if (busIdNum !== busId) {
          newState[busIdNum] = newState[busIdNum]?.filter(p => p.id !== currentUserId) || []
          if (newState[busIdNum]?.length === 0) {
            delete newState[busIdNum]
          }
        }
      })
      
      newState[busId] = [pendingPassenger]
      return newState
    })
  }, [currentUserId, currentUserName])

  const removePendingPassenger = useCallback((busId: number) => {
    setPendingPassengers(prev => {
      const newState = { ...prev }
      delete newState[busId]
      return newState
    })
  }, [])

  const clearPendingPassengers = useCallback(() => {
    setPendingPassengers({})
  }, [])

  useEffect(() => {
    loadBuses()
  }, [loadBuses])

  useEffect(() => {
    if (currentUserId) {
      loadUserBooking()
    }
  }, [currentUserId, loadUserBooking])

  return {
    // State
    buses,
    loading,
    userBooking,
    passengersByBus,
    pendingPassengers,
    error,
    
    // Actions
    loadBuses,
    loadPassengersForBus,
    bookBus,
    changeBus,
    cancelBooking,
    addPendingPassenger,
    removePendingPassenger,
    clearPendingPassengers,
    
    // Utilities
    setError
  }
}
