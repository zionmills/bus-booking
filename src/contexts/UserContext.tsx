'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Delegate } from '@/lib/supabase'

interface UserContextType {
  currentUser: Delegate | null
  setCurrentUser: (user: Delegate | null) => void
  queuePosition: number | null
  setQueuePosition: (position: number | null) => void
  clearUser: () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Delegate | null>(null)
  const [queuePosition, setQueuePosition] = useState<number | null>(null)

  const clearUser = () => {
    setCurrentUser(null)
    setQueuePosition(null)
  }

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('bus-booking-user')
    const savedQueuePosition = localStorage.getItem('bus-booking-queue-position')
    
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser))
      } catch (error) {
        console.error('Error parsing saved user:', error)
        localStorage.removeItem('bus-booking-user')
      }
    }
    
    if (savedQueuePosition) {
      try {
        setQueuePosition(parseInt(savedQueuePosition))
      } catch (error) {
        console.error('Error parsing saved queue position:', error)
        localStorage.removeItem('bus-booking-queue-position')
      }
    }
  }, [])

  // Save user to localStorage when it changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('bus-booking-user', JSON.stringify(currentUser))
    } else {
      localStorage.removeItem('bus-booking-user')
    }
  }, [currentUser])

  // Save queue position to localStorage when it changes
  useEffect(() => {
    if (queuePosition !== null) {
      localStorage.setItem('bus-booking-queue-position', queuePosition.toString())
    } else {
      localStorage.removeItem('bus-booking-queue-position')
    }
  }, [queuePosition])

  return (
    <UserContext.Provider value={{
      currentUser,
      setCurrentUser,
      queuePosition,
      setQueuePosition,
      clearUser
    }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
