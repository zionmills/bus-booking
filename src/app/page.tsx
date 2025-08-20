'use client'

import { useState, useEffect, useReducer, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { User, Users, Scan, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import QRScanner from '@/components/QRScanner'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/contexts/UserContext'
import { QueueManager } from '@/lib/queue-manager'

// QR Code sanitizer function
const sanitizeQRCode = (qrCode: string | undefined): string => {
  if (!qrCode) return ''
  
  // Remove HTML tags and decode HTML entities
  let sanitized = qrCode
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Replace HTML entities with spaces
    .trim()
  
  // Enforce max length
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100)
  }
  
  // Only allow alphanumeric, hyphens, underscores, and common URL-safe characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9\-_./:?=&%#]/g, '')
  
  return sanitized
}

// Types for better type safety
interface UserData {
  qrCode: string
  name: string
  consent: boolean
}

interface AppState {
  status: 'scanning' | 'registering' | 'ready' | 'error'
  userData: UserData | null
  error: string | null
  isLoading: boolean
  isProcessingQR: boolean
  lastScanTime: number
  processedQRs: Set<string>
  manualQr: string
}

// Action types for the reducer
type AppAction =
  | { type: 'START_SCANNING' }
  | { type: 'QR_SCANNED'; payload: string }
  | { type: 'START_REGISTRATION'; payload: string }
  | { type: 'UPDATE_USER_DATA'; payload: Partial<UserData> }
  | { type: 'REGISTRATION_COMPLETE'; payload: { user: { id: number; name: string | null; qr_code: string | null; created_at: string }; queuePosition: number } }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_PROCESSING_QR'; payload: boolean }
  | { type: 'RESET' }
  | { type: 'ADD_PROCESSED_QR'; payload: string }
  | { type: 'UPDATE_MANUAL_QR'; payload: string }

// Initial state
const initialState: AppState = {
  status: 'scanning',
  userData: null,
  error: null,
  isLoading: false,
  isProcessingQR: false,
  lastScanTime: 0,
  processedQRs: new Set(),
  manualQr: ''
}

// Reducer function for predictable state updates
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'START_SCANNING':
      return {
        ...state,
        status: 'scanning',
        error: null,
        userData: null,
        processedQRs: new Set(),
        manualQr: ''
      }
    
    case 'QR_SCANNED':
      return {
        ...state,
        lastScanTime: Date.now()
      }
    
    case 'START_REGISTRATION':
      return {
        ...state,
        status: 'registering',
        userData: {
          qrCode: sanitizeQRCode(action.payload),
          name: '',
          consent: false
        },
        error: null
      }
    
    case 'UPDATE_USER_DATA':
      return {
        ...state,
        userData: state.userData ? { ...state.userData, ...action.payload } : null
      }
    
    case 'REGISTRATION_COMPLETE':
      return {
        ...state,
        status: 'ready',
        isLoading: false,
        error: null
      }
    
    case 'SET_ERROR':
      return {
        ...state,
        status: 'error',
        error: action.payload,
        isLoading: false,
        isProcessingQR: false
      }
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      }
    
    case 'SET_PROCESSING_QR':
      return {
        ...state,
        isProcessingQR: action.payload
      }
    
    case 'RESET':
      return initialState
    
    case 'ADD_PROCESSED_QR':
      return {
        ...state,
        processedQRs: new Set([...state.processedQRs, action.payload])
      }
    
    case 'UPDATE_MANUAL_QR':
      return {
        ...state,
        manualQr: action.payload
      }
    
    default:
      return state
  }
}

// Custom hook for mobile detection
const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === 'undefined') return false
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    }
    
    setIsMobile(checkMobile())
  }, [])
  
  return isMobile
}

// Custom hook for state persistence
const useStatePersistence = (state: AppState) => {
  useEffect(() => {
    if (state.status !== 'scanning') {
      try {
        localStorage.setItem('bus-booking-state', JSON.stringify({
          status: state.status,
          userData: state.userData,
          lastScanTime: state.lastScanTime,
          savedAt: Date.now()
        }))
      } catch (error) {
        console.error('Failed to save state to localStorage:', error)
        // Safely return without crashing the app
        return
      }
    }
  }, [state.status, state.userData, state.lastScanTime])
  
  const restoreState = useCallback(() => {
    try {
      const saved = localStorage.getItem('bus-booking-state')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          
          // Check if saved state is older than 30 minutes
          const savedAt = parsed.savedAt || 0
          const now = Date.now()
          const thirtyMinutes = 30 * 60 * 1000
          
          if (now - savedAt > thirtyMinutes) {
            // State is too old, clear sensitive data
            if (parsed.userData) {
              delete parsed.userData.qrCode
            }
            // Skip START_REGISTRATION for old state
            return null
          }
          
          return parsed
        } catch (e) {
          console.error('Failed to parse saved state:', e)
          return null
        }
      }
      return null
    } catch (error) {
      console.error('Failed to restore state from localStorage:', error)
      return null
    }
  }, [])
  
  return { restoreState }
}

export default function HomePage() {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const { currentUser, setCurrentUser, queuePosition, setQueuePosition } = useUser()
  const isMobile = useMobileDetection()
  const { restoreState } = useStatePersistence(state)
  const router = useRouter()
  
  // Restore state on mount
  useEffect(() => {
    const savedState = restoreState()
    if (savedState) {
      if (savedState.status === 'registering' && savedState.userData) {
        dispatch({ type: 'START_REGISTRATION', payload: savedState.userData.qrCode })
        // Restore form data
        Object.entries(savedState.userData).forEach(([key, value]) => {
          if (key !== 'qrCode') {
            dispatch({ type: 'UPDATE_USER_DATA', payload: { [key]: value } })
          }
        })
      }
    }
  }, [restoreState])
  
  // Clear localStorage when returning to scanning
  useEffect(() => {
    if (state.status === 'scanning') {
      localStorage.removeItem('bus-booking-state')
    }
  }, [state.status])
  
  // Mobile-specific debouncing - memoized to maintain stable identity
  const debounceTime = useMemo(() => isMobile ? 1500 : 1000, [isMobile])
  
  const handleExistingUser = useCallback(async (delegate: { id: number; name: string | null; qr_code: string | null; created_at: string }) => {
    setCurrentUser(delegate)
    
    // Check if user is already in queue
    let currentPosition = await QueueManager.getUserQueuePosition(delegate.id)
    
    if (currentPosition !== null && currentPosition !== undefined) {
      // User is already in queue
      setQueuePosition(currentPosition)
      toast.info(`Welcome back! You're in the queue at position ${currentPosition}`)
    } else {
      // User is not in queue, add them automatically
      try {
        const isFull = await QueueManager.isQueueFull()
        if (isFull) {
          dispatch({ type: 'SET_ERROR', payload: 'Queue is currently full. Please try again later.' })
          toast.error('Queue is currently full. Please try again later.')
          return
        }
        
        currentPosition = await QueueManager.addUserToQueue(delegate.id)
        setQueuePosition(currentPosition)
        toast.success(`Welcome! You've been added to the queue at position ${currentPosition}`)
      } catch (error) {
        console.error('Error adding user to queue:', error)
        dispatch({ type: 'SET_ERROR', payload: 'Failed to add you to the queue. Please try again.' })
        toast.error('Failed to add you to the queue. Please try again.')
        return
      }
    }
    
    // Redirect to buses page with full page refresh to ensure clean state
    window.location.href = '/buses'
  }, [setCurrentUser, setQueuePosition])
  
  const handleQRScan = useCallback(async (scannedQR: string) => {
    const now = Date.now()
    
    // Sanitize the QR code before processing
    const sanitizedQR = sanitizeQRCode(scannedQR)
    if (!sanitizedQR) {
      toast.error('Invalid QR code format')
      return
    }
    
    // Prevent multiple simultaneous QR processing
    if (state.isProcessingQR || state.isLoading) {
      console.log('QR processing already in progress, ignoring new scan')
      return
    }
    
    // Mobile-specific debouncing
    if (now - state.lastScanTime < debounceTime) {
      console.log('Debouncing: ignoring rapid successive scan')
      return
    }
    
    // Prevent processing the same QR code multiple times
    if (state.processedQRs.has(sanitizedQR)) {
      console.log('QR code already processed, ignoring duplicate scan')
      return
    }
    
    dispatch({ type: 'QR_SCANNED', payload: sanitizedQR })
    dispatch({ type: 'SET_PROCESSING_QR', payload: true })
    dispatch({ type: 'SET_LOADING', payload: true })
    
    try {
      // Check if delegate exists with this QR code
      console.log('Checking for delegate with QR code:', sanitizedQR)
      const { data: delegate, error: delegateError } = await supabase
        .from('delegates')
        .select('*')
        .eq('qr_code', sanitizedQR)
        .single()
      
      console.log('Delegate lookup result:', { delegate, delegateError })
      
      if (delegateError && delegateError.code === 'PGRST116') {
        // No delegate found, start registration
        dispatch({ type: 'START_REGISTRATION', payload: sanitizedQR })
        toast.info('New QR code detected. Please enter your name to continue.')
        
        // Refresh the page after a short delay to ensure clean state for registration
        setTimeout(() => {
          window.location.reload()
        }, 500)
      } else if (delegateError) {
        throw new Error(`Failed to check QR code: ${delegateError.message}`)
      } else if (delegate) {
        // Delegate exists, handle existing user
        await handleExistingUser(delegate)
      }
      
      // Mark this QR code as processed
      dispatch({ type: 'ADD_PROCESSED_QR', payload: sanitizedQR })
      
    } catch (error) {
      console.error('Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to process QR code. Please try again.'
      dispatch({ type: 'SET_ERROR', payload: errorMessage })
      toast.error(errorMessage)
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
      dispatch({ type: 'SET_PROCESSING_QR', payload: false })
    }
  }, [state.isProcessingQR, state.isLoading, state.lastScanTime, state.processedQRs, debounceTime, handleExistingUser])
  
  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!state.userData?.name.trim()) {
      toast.error('Please enter your name')
      return
    }
    
    if (!state.userData?.consent) {
      toast.error('Please consent to the terms before continuing')
      return
    }
    
    dispatch({ type: 'SET_LOADING', payload: true })
    
    try {
      // Create new delegate
      const { data: newDelegate, error: createError } = await supabase
        .from('delegates')
        .insert([{ 
          name: state.userData.name.trim(), 
          qr_code: state.userData.qrCode 
        }])
        .select()
        .single()
      
      if (createError) {
        throw new Error(`Failed to create delegate: ${createError.message}`)
      }
      
      setCurrentUser(newDelegate)
      
      // Add new user to queue automatically
      try {
        const isFull = await QueueManager.isQueueFull()
        if (isFull) {
          dispatch({ type: 'SET_ERROR', payload: 'Queue is currently full. Please try again later.' })
          toast.error('Queue is currently full. Please try again later.')
          return
        }
        
        const queuePosition = await QueueManager.addUserToQueue(newDelegate.id)
        setQueuePosition(queuePosition)
        toast.success(`Registration successful! You've been added to the queue at position ${queuePosition}`)
        
        dispatch({ type: 'REGISTRATION_COMPLETE', payload: { user: newDelegate, queuePosition } })
        
      } catch (error) {
        console.error('Error adding user to queue:', error)
        dispatch({ type: 'SET_ERROR', payload: 'Registration successful, but failed to add you to the queue. Please try again.' })
        toast.error('Registration successful, but failed to add you to the queue. Please try again.')
        return
      }
      
    } catch (error) {
      console.error('Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create registration. Please try again.'
      dispatch({ type: 'SET_ERROR', payload: errorMessage })
      toast.error(errorMessage)
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }
  
  const handleManualQRSubmit = () => {
    if (!state.manualQr?.trim() || state.isLoading || state.isProcessingQR) return
    
    // Additional mobile protection for manual submission
    if (isMobile) {
      const now = Date.now()
      if (now - state.lastScanTime < debounceTime) {
        console.log('Mobile debouncing: ignoring rapid manual submission')
        return
      }
    }
    
    // Sanitize the manual QR input before processing
    const sanitizedQR = sanitizeQRCode(state.manualQr.trim())
    if (!sanitizedQR) {
      toast.error('Please enter a valid QR code')
      return
    }
    
    handleQRScan(sanitizedQR)
  }
  
  const resetToScanning = () => {
    dispatch({ type: 'RESET' })
  }
  
  // Render based on state
  if (state.status === 'scanning') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
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
                  <QRScanner onScan={handleQRScan} />
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
                    value={state.manualQr}
                    onChange={(e) => dispatch({ 
                      type: 'UPDATE_MANUAL_QR', 
                      payload: e.target.value 
                    })}
                    className="text-lg"
                  />
                </div>
                
                <Button 
                  onClick={handleManualQRSubmit}
                  className="w-full" 
                  size="lg"
                  disabled={!state.manualQr?.trim() || state.isLoading || state.isProcessingQR}
                >
                  {state.isLoading ? 'Processing...' : 'Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
  
  if (state.status === 'registering') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
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
                    value={state.userData?.name || ''}
                    onChange={(e) => dispatch({ 
                      type: 'UPDATE_USER_DATA', 
                      payload: { name: e.target.value } 
                    })}
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
                        checked={state.userData?.consent || false}
                        onCheckedChange={(checked) => dispatch({ 
                          type: 'UPDATE_USER_DATA', 
                          payload: { consent: checked } 
                        })}
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
                  disabled={!state.userData?.name?.trim() || !state.userData?.consent || state.isLoading}
                >
                  {state.isLoading ? 'Creating Registration...' : 'Continue'}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetToScanning}
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
  
  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
        <div className="max-w-md mx-auto pt-20">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl">Something went wrong</CardTitle>
              <CardDescription>
                {state.error}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  onClick={resetToScanning}
                  className="w-full" 
                  size="lg"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
  
  // Ready state (step === 'booking')
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
      <div className="max-w-md mx-auto pt-20">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-indigo-600" />
            </div>
            <CardTitle className="text-2xl">Ready to Book!</CardTitle>
            <CardDescription>
              Welcome, {state.userData?.name}! You can now select your bus.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700">
                  QR Code: <span className="font-mono font-bold">{sanitizeQRCode(currentUser?.qr_code || state.userData?.qrCode)}</span>
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
                onClick={resetToScanning}
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
