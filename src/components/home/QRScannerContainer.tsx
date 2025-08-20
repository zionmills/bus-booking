'use client'

import { useState, useEffect, useReducer, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { QueueManager } from '@/lib/queue-manager'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { appReducer, initialState, UserBooking } from './types'
import { sanitizeQRCode } from './utils'
import { ScanningView } from './ScanningView'
import { RegistrationView } from './RegistrationView'
import { ErrorView } from './ErrorView'
import { ReadyView } from './ReadyView'
import type { Delegate } from '@/lib/supabase'

export function QRScannerContainer() {
  const router = useRouter()
  const [state, dispatch] = useReducer(appReducer, initialState)
  const { currentUser, setCurrentUser, queuePosition, setQueuePosition } = useUser()
  const [existingBooking, setExistingBooking] = useState<UserBooking | null>(null)
  const [checkingBooking, setCheckingBooking] = useState(false)
  
  // Check for existing booking when user is loaded
  useEffect(() => {
    const checkExistingBooking = async () => {
      if (!currentUser) {
        setExistingBooking(null)
        return
      }
      
      setCheckingBooking(true)
      try {
        const { data: booking, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('user_id', currentUser.id)
          .single()
        
        if (error && error.code !== 'PGRST116') {
          console.error('Error checking existing booking:', error)
          return
        }
        
        if (booking) {
          setExistingBooking(booking)
        } else {
          setExistingBooking(null)
        }
      } catch (error) {
        console.error('Error checking existing booking:', error)
        setExistingBooking(null)
      } finally {
        setCheckingBooking(false)
      }
    }

    checkExistingBooking()
  }, [currentUser])

  // Check queue position when user is loaded
  useEffect(() => {
    const checkQueuePosition = async () => {
      if (!currentUser) return
      
      try {
        const position = await QueueManager.getUserQueuePosition(currentUser.id)
        setQueuePosition(position)
      } catch (error) {
        console.error('Error checking queue position:', error)
        setQueuePosition(null)
      }
    }

    checkQueuePosition()
  }, [currentUser, setQueuePosition])

  // Function to refresh user's booking and queue information
  const refreshUserInfo = useCallback(async () => {
    if (!currentUser) return
    
    setCheckingBooking(true)
    try {
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', currentUser.id)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error checking existing booking:', error)
        return
      }
      
      setExistingBooking(booking || null)
      
      const position = await QueueManager.getUserQueuePosition(currentUser.id)
      setQueuePosition(position)
      
    } catch (error) {
      console.error('Error refreshing user info:', error)
    } finally {
      setCheckingBooking(false)
    }
  }, [currentUser, setQueuePosition])
  
  const handleExistingUser = useCallback(async (delegate: Delegate) => {
    setCurrentUser(delegate)
    
    let currentPosition = await QueueManager.getUserQueuePosition(delegate.id)
    
    if (currentPosition !== null && currentPosition !== undefined) {
      setQueuePosition(currentPosition)
      toast.info(`Welcome back! You're in the queue at position ${currentPosition}`)
    } else {
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
    
    router.push('/buses')
  }, [setCurrentUser, setQueuePosition, router])
  
  const handleQRScan = useCallback(async (scannedQR: string) => {
    const now = Date.now()
    
    const sanitizedQR = sanitizeQRCode(scannedQR)
    if (!sanitizedQR) {
      toast.error('Invalid QR code format')
      return
    }
    
    if (state.isProcessingQR || state.isLoading) {
      console.log('QR processing already in progress, ignoring new scan')
      return
    }
    
    if (now - state.lastScanTime < 1000) {
      console.log('Debouncing: ignoring rapid successive scan')
      return
    }
    
    if (state.processedQRs.has(sanitizedQR)) {
      console.log('QR code already processed, ignoring duplicate scan')
      return
    }
    
    dispatch({ type: 'QR_SCANNED', payload: sanitizedQR })
    dispatch({ type: 'SET_PROCESSING_QR', payload: true })
    dispatch({ type: 'SET_LOADING', payload: true })
    
    try {
      const { data: delegate, error: delegateError } = await supabase
        .from('delegates')
        .select('*')
        .eq('qr_code', sanitizedQR)
        .single()
      
      if (delegateError && delegateError.code === 'PGRST116') {
        dispatch({ type: 'START_REGISTRATION', payload: sanitizedQR })
        toast.info('New QR code detected. Please enter your name to continue.')
        
        // Remove the setTimeout(window.location.reload()) pattern
        // The component will naturally transition to registration view
        // No need to reload the page
      } else if (delegateError) {
        throw new Error(`Failed to check QR code: ${delegateError.message}`)
      } else if (delegate) {
        await handleExistingUser(delegate)
      }
      
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
  }, [state.isProcessingQR, state.isLoading, state.lastScanTime, state.processedQRs, handleExistingUser])
  
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
      <ScanningView
        currentUser={currentUser}
        existingBooking={existingBooking}
        checkingBooking={checkingBooking}
        queuePosition={queuePosition}
        manualQr={state.manualQr}
        isLoading={state.isLoading}
        isProcessingQR={state.isProcessingQR}
        onQRScan={handleQRScan}
        onManualQRSubmit={handleManualQRSubmit}
        onManualQRChange={(value) => dispatch({ type: 'UPDATE_MANUAL_QR', payload: value })}
        onRefreshUserInfo={refreshUserInfo}
        onJoinQueue={() => currentUser && handleExistingUser(currentUser)}
        onSwitchUser={() => {
          setCurrentUser(null)
          setQueuePosition(null)
          localStorage.removeItem('bus-booking-user')
          localStorage.removeItem('bus-booking-queue-position')
        }}
      />
    )
  }
  
  if (state.status === 'registering') {
    return (
      <RegistrationView
        userData={state.userData}
        isLoading={state.isLoading}
        onSubmit={handleNameSubmit}
        onUserDataChange={(updates) => dispatch({ type: 'UPDATE_USER_DATA', payload: updates })}
        onBack={resetToScanning}
      />
    )
  }
  
  if (state.status === 'error') {
    return (
      <ErrorView
        error={state.error}
        onRetry={resetToScanning}
      />
    )
  }
  
  return (
    <ReadyView
      userData={state.userData}
      currentUser={currentUser}
      queuePosition={queuePosition}
      onBack={resetToScanning}
    />
  )
}
