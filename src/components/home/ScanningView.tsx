'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Users, Scan, Bus, Ticket } from 'lucide-react'
import Link from 'next/link'
import QRScanner from '@/components/QRScanner'
import { QueueStatusBanner } from './QueueStatusBanner'
import { UserBookingCard } from './UserBookingCard'
import type { Delegate } from '@/lib/supabase'
import { UserBooking } from './types'

interface ScanningViewProps {
  currentUser: Delegate | null
  existingBooking: UserBooking | null
  checkingBooking: boolean
  queuePosition: number | null
  manualQr: string
  isLoading: boolean
  isProcessingQR: boolean
  onQRScan: (qrCode: string) => void
  onManualQRSubmit: () => void
  onManualQRChange: (value: string) => void
  onRefreshUserInfo: () => void
  onJoinQueue: () => void
  onSwitchUser: () => void
}

export function ScanningView({
  currentUser,
  existingBooking,
  checkingBooking,
  queuePosition,
  manualQr,
  isLoading,
  isProcessingQR,
  onQRScan,
  onManualQRSubmit,
  onManualQRChange,
  onRefreshUserInfo,
  onJoinQueue,
  onSwitchUser
}: ScanningViewProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
      <div className="max-w-md mx-auto pt-20">
        {/* Queue Status Banner */}
        <QueueStatusBanner />

        {/* Existing Booking Information */}
        {currentUser && (
          <UserBookingCard
            currentUser={currentUser}
            existingBooking={existingBooking}
            checkingBooking={checkingBooking}
            queuePosition={queuePosition}
            onRefreshUserInfo={onRefreshUserInfo}
            onJoinQueue={onJoinQueue}
          />
        )}
        
        {!currentUser ? (
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Scan className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Welcome to Bus Booking</CardTitle>
              <CardDescription>
                Scan your QR code to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <QRScanner onScan={onQRScan} />
                </div>
                
                <div className="text-center text-sm text-gray-600">
                  <p>Point your camera at the QR code</p>
                  <p>or enter it manually below</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="qr">QR Code (Manual Entry)</Label>
                  <Input
                    id="qr"
                    type="text"
                    placeholder="Enter QR code manually"
                    value={manualQr}
                    onChange={(e) => onManualQRChange(e.target.value)}
                    className="text-lg"
                  />
                </div>
                
                <Button 
                  onClick={onManualQRSubmit}
                  className="w-full" 
                  size="lg"
                  disabled={!manualQr?.trim() || isLoading || isProcessingQR}
                >
                  {isLoading ? 'Processing...' : 'Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Welcome back, {currentUser.name}!</CardTitle>
              <CardDescription>
                {existingBooking 
                  ? `You&apos;re booked on Bus ${existingBooking.bus_id}` 
                  : queuePosition 
                    ? `You&apos;re in the queue at position ${queuePosition}` 
                    : 'Ready to join the queue and book a bus'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {existingBooking ? (
                  <div className="text-center space-y-4">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-green-700 font-medium">✅ Your booking is confirmed!</p>
                      <p className="text-sm text-green-600 mt-1">Bus {existingBooking.bus_id} • {new Date(existingBooking.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="w-full">
                      <Link href="/buses" className="w-full">
                        <Button className="w-full bg-green-600 hover:bg-green-700">
                          <Bus className="w-4 h-4 mr-2" />
                          View My Booking
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : queuePosition ? (
                  <div className="text-center space-y-4">
                    <div className={`p-4 rounded-lg border ${
                      queuePosition <= 20 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <p className={`font-medium ${
                        queuePosition <= 20 ? 'text-green-700' : 'text-blue-700'
                      }`}>
                        {queuePosition <= 20 ? '🎉 You can book a bus now!' : '⏳ Waiting in queue...'}
                      </p>
                      <p className={`text-sm mt-1 ${
                        queuePosition <= 20 ? 'text-green-600' : 'text-blue-600'
                      }`}>
                        Position: {queuePosition} {queuePosition <= 20 ? '(Booking Zone)' : '(Waiting Zone)'}
                      </p>
                    </div>
                    <Link href="/buses" className="w-full">
                      <Button className="w-full bg-blue-600 hover:bg-blue-700">
                        <Bus className="w-4 h-4 mr-2" />
                        {queuePosition <= 20 ? 'Book Your Bus Now' : 'View Buses'}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-blue-700 font-medium">Ready to join the queue?</p>
                      <p className="text-sm text-blue-600 mt-1">Join the queue to book a bus when it&apos;s your turn</p>
                    </div>
                    <div className="flex space-x-2">
                      <Link href="/buses" className="flex-1">
                        <Button variant="outline" className="w-full">
                          <Bus className="w-4 h-4 mr-2" />
                          View Buses
                        </Button>
                      </Link>
                      <Button 
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        onClick={onJoinQueue}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Join Queue
                      </Button>
                    </div>
                  </div>
                )}
                
                <Button
                  variant="outline"
                  onClick={onSwitchUser}
                  className="w-full"
                >
                  <User className="w-4 h-4 mr-2" />
                  Switch User
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
