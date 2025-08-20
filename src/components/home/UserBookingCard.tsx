'use client'

import { Button } from '@/components/ui/button'
import { Bus, Ticket, Users } from 'lucide-react'
import Link from 'next/link'

interface UserBookingCardProps {
  currentUser: any
  existingBooking: any
  checkingBooking: boolean
  queuePosition: number | null
  onRefreshUserInfo: () => void
  onJoinQueue: () => void
  onSwitchUser: () => void
}

export function UserBookingCard({
  currentUser,
  existingBooking,
  checkingBooking,
  queuePosition,
  onRefreshUserInfo,
  onJoinQueue,
  onSwitchUser
}: UserBookingCardProps) {
  return (
    <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Ticket className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-800 font-medium">Welcome back, {currentUser.name}!</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRefreshUserInfo}
          disabled={checkingBooking}
          className="text-green-600 hover:text-green-700 hover:bg-green-100"
        >
          <svg className={`w-4 h-4 ${checkingBooking ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </Button>
      </div>
      
      {checkingBooking ? (
        <div className="text-sm text-green-600">Checking your booking...</div>
      ) : existingBooking ? (
        <div className="space-y-3">
          <div className="text-sm text-green-700">
            <p>✅ You have an existing booking on <strong>Bus {existingBooking.bus_id}</strong></p>
            <p className="text-xs text-green-600 mt-1">Booked on {new Date(existingBooking.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex space-x-2">
            <Link href="/buses" className="flex-1">
              <Button size="sm" className="w-full bg-green-600 hover:bg-green-700">
                <Bus className="w-4 h-4 mr-2" />
                View My Booking
              </Button>
            </Link>
            <Link href="/booking-confirmation" className="flex-1">
              <Button size="sm" variant="outline" className="w-full">
                <Ticket className="w-4 h-4 mr-2" />
                Booking Details
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-green-700">
            {queuePosition ? (
              <>
                <p>You're in the queue at position <strong>{queuePosition}</strong></p>
                {queuePosition <= 20 ? (
                  <p className="text-xs text-green-600 mt-1">🎉 You can book a bus now!</p>
                ) : (
                  <p className="text-xs text-green-600 mt-1">⏳ Wait for position 1-20 to book a bus</p>
                )}
              </>
            ) : (
              <>
                <p>You don't have an active booking yet.</p>
                <p className="text-xs text-green-600 mt-1">Join the queue to book a bus when it's your turn.</p>
              </>
            )}
          </div>
          <div className="flex space-x-2">
            <Link href="/buses" className="flex-1">
              <Button size="sm" variant="outline" className="w-full">
                <Bus className="w-4 h-4 mr-2" />
                View Buses
              </Button>
            </Link>
            {!queuePosition ? (
              <Button 
                size="sm" 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={onJoinQueue}
              >
                <Users className="w-4 h-4 mr-2" />
                Join Queue
              </Button>
            ) : (
              <Button 
                size="sm" 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => window.location.href = '/buses'}
              >
                <Users className="w-4 h-4 mr-2" />
                Go to Buses
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
