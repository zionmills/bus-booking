import { useEffect, useCallback } from 'react'
import { AppState } from './types'

export function useStatePersistence(state: AppState) {
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
