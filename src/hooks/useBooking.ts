import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { QueueManager } from '@/lib/queue-manager'

interface BookingState {
  showConfirmButton: boolean
  pendingBusId: number | null
}

export function useBooking(
  currentUserId: number | null,
  currentUserName: string | null,
  queuePosition: number | null,
  canBookBus: boolean,
  onBookingSuccess: () => void,
  userBooking: { busId: number; userName: string } | null
) {
  const [bookingState, setBookingState] = useState<BookingState>({
    showConfirmButton: false,
    pendingBusId: null
  })
  const router = useRouter()

  const handleBookBus = useCallback(async (busId: number) => {
    if (!currentUserId || !currentUserName) {
      toast.error('Please log in first')
      return
    }

    if (!canBookBus) {
      if (queuePosition === null) {
        toast.error('You must join the queue first before booking a bus')
      } else {
        toast.error(`You must be in the top 20 of the queue to book a bus. Your current position is ${queuePosition}.`)
      }
      return
    }

    try {
      // Additional check using QueueManager for extra validation
      const canBook = await QueueManager.canUserBook(currentUserId)
      if (!canBook) {
        toast.error(`You must be in the top 20 of the queue to book a bus. Your current position is ${queuePosition}.`)
        return
      }

      // Set pending state
      setBookingState({
        showConfirmButton: true,
        pendingBusId: busId
      })
      
      if (userBooking) {
        toast.info('Please confirm your bus change')
      } else {
        toast.info('Please confirm your bus selection')
      }
      
    } catch (error) {
      console.error('Error in bus selection:', error)
      toast.error('Failed to select bus. Please try again.')
    }
  }, [currentUserId, currentUserName, canBookBus, queuePosition, userBooking])

  const handleConfirmBooking = useCallback(async (bookBus: (busId: number) => Promise<{ bus_id: number | null; created_at: string; id: number; user_id: number | null }>) => {
    if (!bookingState.pendingBusId || !currentUserId) return
    
    try {
      toast.loading('Confirming your booking...')
      
      // Book the bus using the provided function
      await bookBus(bookingState.pendingBusId)
      
      // Remove user from queue if they were in it
      if (queuePosition !== null) {
        try {
          await QueueManager.removeUserFromQueue(currentUserId)
        } catch (error) {
          console.error('Error removing from queue:', error)
          // Continue with booking even if queue removal fails
        }
      }
      
      // Reset booking state
      setBookingState({
        showConfirmButton: false,
        pendingBusId: null
      })
      
      toast.success('Booking confirmed!')
      
      // Call the success callback
      onBookingSuccess()
      
      // Redirect to confirmation page
      router.push('/booking-confirmation')
      
    } catch (error) {
      console.error('Error confirming booking:', error)
      toast.error('Failed to confirm booking. Please try again.')
    }
  }, [bookingState.pendingBusId, currentUserId, queuePosition, onBookingSuccess, router])

  const clearPendingSelection = useCallback(() => {
    setBookingState({
      showConfirmButton: false,
      pendingBusId: null
    })
  }, [])

  const isPendingForBus = useCallback((busId: number) => {
    return bookingState.pendingBusId === busId && bookingState.showConfirmButton
  }, [bookingState])

  return {
    // State
    showConfirmButton: bookingState.showConfirmButton,
    pendingBusId: bookingState.pendingBusId,
    
    // Actions
    handleBookBus,
    handleConfirmBooking,
    clearPendingSelection,
    
    // Utilities
    isPendingForBus
  }
}
