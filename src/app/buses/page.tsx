'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useUser } from '@/contexts/UserContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useBuses } from '@/hooks/useBuses'
import { useQueue } from '@/hooks/useQueue'
import { useBooking } from '@/hooks/useBooking'
import { TimeoutWarningBanner } from '@/components/buses/TimeoutWarningBanner'
import { BookingEligibilitySummary } from '@/components/buses/BookingEligibilitySummary'
import { QueueStatusBanner } from '@/components/buses/QueueStatusBanner'
import { UserBookingCard } from '@/components/buses/UserBookingCard'
import { ErrorDisplay } from '@/components/buses/ErrorDisplay'
import { BusLegend } from '@/components/buses/BusLegend'
import { BusCard } from '@/components/buses/BusCard'

export default function BusesPage() {
  const { currentUser } = useUser()
  const router = useRouter()
  
  // State for rebooking confirmation
  const [rebookingBusId, setRebookingBusId] = useState<number | null>(null)
  const [showRebookingConfirm, setShowRebookingConfirm] = useState(false)
  
  // Custom hooks for different concerns
  const {
    buses,
    loading,
    userBooking,
    passengersByBus,
    pendingPassengers,
    error,
    loadBuses,
    loadPassengersForBus,
    bookBus,
    changeBusWithConfirmation,
    cancelBooking,
    addPendingPassenger,
    clearPendingPassengers
  } = useBuses(currentUser?.id || null, currentUser?.name || null)

  const {
    queuePosition,
    userTimeoutInfo,
    canBookBus
  } = useQueue(currentUser?.id || null)

  const {
    pendingBusId,
    handleBookBus,
    handleConfirmBooking,
    clearPendingSelection,
    isPendingForBus
  } = useBooking(
    currentUser?.id || null,
    currentUser?.name || null,
    queuePosition,
    canBookBus(),
    () => {
      // Callback when booking is successful
      clearPendingPassengers()
    }
  )

  // Handle bus selection with pending passenger logic
  const handleBusSelection = async (busId: number) => {
    if (userBooking) {
      // User already has a booking, show confirmation dialog for rebooking
      setRebookingBusId(busId)
      setShowRebookingConfirm(true)
      return
    }

    // Add pending passenger and show confirm button
    addPendingPassenger(busId)
    handleBookBus(busId)
  }

  // Handle rebooking confirmation
  const handleRebookingConfirm = async () => {
    if (!rebookingBusId) return
    
    try {
      toast.loading('Changing your bus...')
      const success = await changeBusWithConfirmation(rebookingBusId, queuePosition)
      
      if (success) {
        toast.success('Successfully changed bus!')
        // Redirect to confirmation page after successful rebooking
        router.push('/booking-confirmation')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to change bus'
      toast.error(errorMessage)
    } finally {
      setShowRebookingConfirm(false)
      setRebookingBusId(null)
    }
  }

  // Handle rebooking cancellation
  const handleRebookingCancel = () => {
    setShowRebookingConfirm(false)
    setRebookingBusId(null)
  }

  // Handle booking confirmation
  const handleConfirmBookingAction = async () => {
    if (pendingBusId) {
      await handleConfirmBooking(bookBus)
    }
  }

  // Handle booking cancellation
  const handleCancelBookingAction = async () => {
    try {
      toast.loading('Cancelling your booking...')
      await cancelBooking()
      toast.success('Booking cancelled successfully!')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel booking'
      toast.error(errorMessage)
    }
  }

  // Cleanup pending passengers when component unmounts
  useEffect(() => {
    return () => {
      clearPendingPassengers()
    }
  }, [clearPendingPassengers])

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
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
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
        <TimeoutWarningBanner userTimeoutInfo={userTimeoutInfo} />

        {/* Error Display */}
        <ErrorDisplay error={error} onRetry={loadBuses} />

        {/* Booking Eligibility Summary */}
        <BookingEligibilitySummary 
          queuePosition={queuePosition} 
          userTimeoutInfo={userTimeoutInfo} 
        />

        {/* Queue Status Banner */}
        <QueueStatusBanner queuePosition={queuePosition} />

        {/* Rebooking Confirmation Dialog */}
        {showRebookingConfirm && rebookingBusId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-blue-900 mb-2">
                  Confirm Bus Change
                </h3>
                <p className="text-blue-700 mb-4">
                  You&apos;re about to change from Bus {userBooking?.busId} to Bus {rebookingBusId}. 
                  This will remove you from the queue and confirm your new bus selection.
                </p>
                <div className="flex space-x-3">
                  <Button 
                    onClick={handleRebookingConfirm}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Confirm Change
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleRebookingCancel}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User's Current Booking */}
        {userBooking && (
          <UserBookingCard 
            userBooking={userBooking} 
            onCancelBooking={handleCancelBookingAction} 
          />
        )}

        {/* Buses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Legend */}
          <BusLegend />
          
          {/* Bus Cards */}
          {buses.map((bus) => {
            const passengers = passengersByBus[bus.id] || []
            const pendingPassengersForBus = pendingPassengers[bus.id] || []
            
            return (
              <BusCard
                key={bus.id}
                bus={bus}
                passengers={passengers}
                pendingPassengers={pendingPassengersForBus}
                userBooking={userBooking}
                queuePosition={queuePosition}
                                 canBookBus={canBookBus()}
                isPendingForBus={isPendingForBus}
                onBookBus={handleBusSelection}
                onConfirmBooking={handleConfirmBookingAction}
                onCancelSelection={clearPendingSelection}

                onLoadPassengers={loadPassengersForBus}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
