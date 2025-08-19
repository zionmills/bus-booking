'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bus, CheckCircle, ArrowLeft, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/contexts/UserContext'
import { useRouter } from 'next/navigation'
import { QueueManager } from '@/lib/queue-manager'

export default function BookingConfirmationPage() {
  const { currentUser, setQueuePosition } = useUser()
  const [loading, setLoading] = useState(false)
  const [userBooking, setUserBooking] = useState<{ busId: number | null }>({ busId: null })
  const [loadingBooking, setLoadingBooking] = useState(true)
  const router = useRouter()

  // Load user's booking information
  useEffect(() => {
    const loadUserBooking = async () => {
      if (!currentUser) return
      
      try {
        setLoadingBooking(true)
        const { data: booking, error } = await supabase
          .from('bookings')
          .select('bus_id')
          .eq('user_id', currentUser.id)
          .single()
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
          console.error('Error loading user booking:', error)
          return
        }
        
        if (booking) {
          console.log('Setting userBooking in confirmation page with busId:', booking.bus_id)
          setUserBooking({ busId: booking.bus_id })
        }
      } catch (error) {
        console.error('Error loading user booking:', error)
      } finally {
        setLoadingBooking(false)
      }
    }

    loadUserBooking()
  }, [currentUser])

  const handleRebook = async () => {
    if (!currentUser) {
      toast.error('Please log in first')
      return
    }

    setLoading(true)
    
    try {
      // Remove the current booking
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('user_id', currentUser.id)
      
      if (deleteError) throw deleteError

      // Check if queue is full
      const isFull = await QueueManager.isQueueFull()
      if (isFull) {
        toast.error('Queue is currently full. Please try again later.')
        return
      }

      // Add user back to the end of the queue
      const newPosition = await QueueManager.addUserToQueue(currentUser.id)
      
      // Update local state
      setQueuePosition(newPosition)
      
      toast.success('Successfully rebooked! You are now at the end of the queue.')
      
      // Redirect to buses page
      router.push('/buses')
      
    } catch (error) {
      console.error('Error rebooking:', error)
      toast.error('Failed to rebook. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-2xl mx-auto pt-20">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-6">Please log in to view your booking confirmation.</p>
            <Link href="/">
              <Button>Go to Login</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (loadingBooking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-2xl mx-auto pt-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your booking...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!userBooking.busId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-2xl mx-auto pt-20">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No Booking Found</h2>
            <p className="text-gray-600 mb-6">You don&apos;t have an active bus booking.</p>
            <Link href="/buses">
              <Button>Go to Buses</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  console.log('Rendering confirmation page with userBooking:', userBooking)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Booking Confirmed!</h1>
            <p className="text-gray-600 mt-2">Your bus has been successfully booked</p>
          </div>
          <Link href="/buses">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Buses
            </Button>
          </Link>
        </div>

        {/* Confirmation Card */}
        <Card className="mb-8 border-green-200 bg-green-50">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-800">
              You&apos;re Booked on Bus {userBooking.busId}!
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="flex items-center justify-center space-x-3">
              <Bus className="w-8 h-8 text-blue-600" />
              <span className="text-3xl font-bold text-blue-600">Bus {userBooking.busId}</span>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <p className="text-gray-700 mb-2">
                <span className="font-semibold">Passenger:</span> {currentUser.name}
              </p>
              <p className="text-gray-700 mb-2">
                <span className="font-semibold">Status:</span> 
                <Badge className="ml-2" variant="default">Confirmed</Badge>
              </p>
              <p className="text-gray-700">
                <span className="font-semibold">Booking Time:</span> {new Date().toLocaleString()}
              </p>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleRebook}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {loading ? 'Processing...' : 'Rebook Bus'}
              </Button>
              
              <Link href="/buses" className="block">
                <Button className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Buses
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What happens next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
              <p>Your booking is confirmed and you have been removed from the queue</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
              <p>If you need to change your bus, click &quot;Rebook Bus&quot; to join the queue again</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
              <p>You can view all buses and your current booking from the buses page</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
