'use client'

import { useEffect } from 'react'
import { QRScannerContainer } from '@/components/home/QRScannerContainer'
import { useStatePersistence } from '@/components/home/useStatePersistence'
import { appReducer, initialState } from '@/components/home/types'

export default function HomePage() {
  const { restoreState } = useStatePersistence(initialState)
  
  // Restore state on mount
  useEffect(() => {
    const savedState = restoreState()
    if (savedState) {
      if (savedState.status === 'registering' && savedState.userData) {
        // Restore form data
        Object.entries(savedState.userData).forEach(([key, value]) => {
          if (key !== 'qrCode') {
            // This will be handled by the QRScannerContainer
          }
        })
      }
    }
  }, [restoreState])
  
  return <QRScannerContainer />
}
