'use client'

import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useUser } from '@/contexts/UserContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useBuses } from '@/hooks/useBuses'
import { useQueue } from '@/hooks/useQueue'
import { useBooking } from '@/hooks/useBooking'
import { BookingEligibilitySummary } from '@/components/buses/BookingEligibilitySummary'
import { QueueStatusBanner } from '@/components/buses/QueueStatusBanner'
import { UserBookingCard } from '@/components/buses/UserBookingCard'
import { ErrorDisplay } from '@/components/buses/ErrorDisplay'
import { BusLegend } from '@/components/buses/BusLegend'
import { BusCard } from '@/components/buses/BusCard'

export default function BusesPage() {
  const { currentUser } = useUser()
  const router = useRouter()
  
  // Remove rebooking-specific state since we'll use the same pending mechanism
  
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
    },
    userBooking
  )

  // Handle bus selection with pending passenger logic
  const handleBusSelection = async (busId: number) => {
    // For both initial booking and rebooking, use the same pending state mechanism
    addPendingPassenger(busId)
    handleBookBus(busId)
  }

  // Handle booking confirmation for both initial booking and rebooking
  const handleConfirmBookingAction = async () => {
    if (pendingBusId) {
      if (userBooking) {
        // User is rebooking - change bus instead of creating new booking
        try {
          toast.loading('Changing your bus...')
          const success = await changeBusWithConfirmation(pendingBusId, queuePosition)
          
          if (success) {
            toast.success('Successfully changed bus!')
            // Redirect to confirmation page after successful rebooking
            router.push('/booking-confirmation')
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to change bus'
          toast.error(errorMessage)
        }
      } else {
        // User is doing initial booking
        await handleConfirmBooking(bookBus)
      }
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

        {/* Error Display */}
        <ErrorDisplay error={error} onRetry={loadBuses} />

        {/* Booking Eligibility Summary */}
        <BookingEligibilitySummary 
          queuePosition={queuePosition} 
          userTimeoutInfo={userTimeoutInfo} 
        />

        {/* Queue Status Banner */}
        <QueueStatusBanner queuePosition={queuePosition} />

        {/* User's Current Booking */}
        {userBooking && (
          <UserBookingCard 
            userBooking={userBooking} 
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
