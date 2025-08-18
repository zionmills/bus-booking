'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Bus, User, QrCode, Users } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import QRScanner from '@/components/QRScanner'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/contexts/UserContext'
import { QueueManager } from '@/lib/queue-manager'

export default function HomePage() {
  const [step, setStep] = useState<'qr' | 'name' | 'booking'>('qr')
  const [userName, setUserName] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)
  const { currentUser, setCurrentUser, queuePosition, setQueuePosition } = useUser()

  // Add demo page link in the header
  const renderHeader = () => (
    <div className="absolute top-4 right-4">
      <Link 
        href="/qr-demo" 
        className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
      >
        <QrCode className="w-4 h-4 mr-2" />
        Test Scanner
      </Link>
    </div>
  )

  const handleQRScan = async (scannedQR: string) => {
    setQrCode(scannedQR)
    setIsLoading(true)
    
    try {
      // Check if delegate exists with this QR code
      console.log('Checking for delegate with QR code:', scannedQR)
      const { data: delegate, error: delegateError } = await supabase
        .from('delegates')
        .select('*')
        .eq('qr_code', scannedQR)
        .single()
      
      console.log('Delegate lookup result:', { delegate, delegateError })
      
      if (delegateError && delegateError.code === 'PGRST116') {
        // No delegate found with this QR code, prompt for name
        setStep('name')
        toast.info('New QR code detected. Please enter your name to continue.')
      } else if (delegateError) {
        // Other error occurred
        console.error('Delegate lookup error:', delegateError)
        throw new Error(`Failed to check QR code: ${delegateError.message}`)
      } else if (delegate) {
        // Delegate exists, set as current user
        setCurrentUser(delegate)
        
        // Check if user is already in queue
        let currentPosition = await QueueManager.getUserQueuePosition(delegate.id)
        
        if (currentPosition) {
          // User is already in queue
          setQueuePosition(currentPosition)
          toast.info(`Welcome back! You're in the queue at position ${currentPosition}`)
        } else {
          // User is not in queue, add them automatically
          try {
            const isFull = await QueueManager.isQueueFull()
            if (isFull) {
              toast.error('Queue is currently full. Please try again later.')
              return
            }
            
            currentPosition = await QueueManager.addUserToQueue(delegate.id)
            setQueuePosition(currentPosition)
            toast.success(`Welcome! You've been added to the queue at position ${currentPosition}`)
          } catch (error) {
            console.error('Error adding user to queue:', error)
            toast.error('Failed to add you to the queue. Please try again.')
            return
          }
        }
        
        // Redirect to buses page
        window.location.href = '/buses'
      }
      
    } catch (error) {
      console.error('Error:', error)
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Failed to process QR code. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userName.trim()) {
      toast.error('Please enter your name')
      return
    }
    if (!consentGiven) {
      toast.error('Please consent to the terms before continuing')
      return
    }
    
    setIsLoading(true)
    
    try {
      // Create new delegate with the scanned QR code and name
      console.log('Creating new delegate with:', { name: userName, qr_code: qrCode })
      const { data: newDelegate, error: createError } = await supabase
        .from('delegates')
        .insert([{ name: userName, qr_code: qrCode }])
        .select()
        .single()
      
      if (createError) {
        console.error('Create delegate error:', createError)
        throw new Error(`Failed to create delegate: ${createError.message}`)
      }
      
      console.log('New delegate created:', newDelegate)
      setCurrentUser(newDelegate)
      
      // Add new user to queue automatically
      try {
        const isFull = await QueueManager.isQueueFull()
        if (isFull) {
          toast.error('Queue is currently full. Please try again later.')
          return
        }
        
        const queuePosition = await QueueManager.addUserToQueue(newDelegate.id)
        setQueuePosition(queuePosition)
        toast.success(`Registration successful! You've been added to the queue at position ${queuePosition}`)
      } catch (error) {
        console.error('Error adding user to queue:', error)
        toast.error('Registration successful, but failed to add you to the queue. Please try again.')
        return
      }
      
      setStep('booking')
      
    } catch (error) {
      console.error('Error:', error)
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Failed to create registration. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (step === 'qr') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
        {renderHeader()}
        <div className="max-w-md mx-auto pt-20">
          {/* Queue Status Banner */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600" />
                <div>
                  <span className="text-sm text-blue-800 font-medium">Queue Status</span>
                  <p className="text-xs text-blue-600">Only top 20 can book buses</p>
                </div>
              </div>
              <Link href="/queue" className="text-sm text-blue-600 hover:underline">
                View Queue →
              </Link>
            </div>
          </div>
          
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <QrCode className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Welcome to Bus Booking</CardTitle>
              <CardDescription>
                Scan your QR code to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <QRScanner 
                    onScan={handleQRScan}
                  />
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
                    value={qrCode}
                    onChange={(e) => setQrCode(e.target.value)}
                    className="text-lg"
                  />
                </div>
                
                <Button 
                  onClick={() => handleQRScan(qrCode)}
                  className="w-full" 
                  size="lg"
                  disabled={!qrCode.trim() || isLoading}
                >
                  {isLoading ? 'Processing...' : 'Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (step === 'name') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
        {renderHeader()}
        <div className="max-w-md mx-auto pt-20">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Complete Registration</CardTitle>
              <CardDescription>
                Please enter your name to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleNameSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="text-lg"
                    autoFocus
                  />
                </div>
                
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Consent Form</Label>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="consent"
                        checked={consentGiven}
                        onCheckedChange={(checked) => setConsentGiven(checked)}
                        className="mt-1"
                      />
                      <div className="text-sm text-gray-700 leading-relaxed">
                        <p className="font-medium mb-2">By entering your name and selecting a bus, you acknowledge and agree that:</p>
                        <ul className="space-y-1 text-gray-600">
                          <li>• Your name will be displayed on the bus roster visible to other riders for the purpose of seat assignment and coordination.</li>
                          <li>• Your information will only be used for this event and will not be shared outside the group.</li>
                          <li>• The roster will be deleted/disabled after the event.</li>
                          <li>• You may request correction or removal of your data at any time by contacting the organizers.</li>
                        </ul>
                        <p className="font-medium text-gray-800 mt-2">
                          ✅ I consent to my name being displayed on the bus roster for this event.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={!userName.trim() || !consentGiven || isLoading}
                >
                  {isLoading ? 'Creating Registration...' : 'Continue'}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('qr')}
                  className="w-full"
                >
                  Back to QR Scan
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
      {renderHeader()}
      <div className="max-w-md mx-auto pt-20">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-indigo-600" />
            </div>
            <CardTitle className="text-2xl">Ready to Book!</CardTitle>
            <CardDescription>
              Welcome, {userName}! You can now select your bus.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700">
                  QR Code: <span className="font-mono font-bold">{currentUser?.qr_code || qrCode}</span>
                </p>
                {queuePosition && (
                  <div className="mt-2">
                    <p className="text-sm text-green-600">
                      Queue Position: <span className="font-bold">{queuePosition}</span>
                    </p>
                    {queuePosition <= 20 ? (
                      <p className="text-sm text-green-700 font-semibold mt-1">
                        ✅ You can book a bus now!
                      </p>
                    ) : (
                      <p className="text-sm text-orange-600 mt-1">
                        ⏳ Wait for position 1-20 to book a bus
                      </p>
                    )}
                  </div>
                )}
              </div>
              <Link href="/buses" className="w-full">
                <Button className="w-full" size="lg">
                  Select Your Bus
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => setStep('qr')}
                className="w-full"
              >
                Back to QR Scan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
