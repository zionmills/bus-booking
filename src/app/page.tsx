'use client'

import { useEffect } from 'react'
import { QRScannerContainer } from '@/components/home/QRScannerContainer'
import { useStatePersistence } from '@/components/home/useStatePersistence'
import { initialState } from '@/components/home/types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'

export default function HomePage() {
  const { restoreState } = useStatePersistence(initialState)
  
  // Restore state on mount
  useEffect(() => {
    const savedState = restoreState()
    if (savedState) {
      if (savedState.status === 'registering' && savedState.userData) {
        // Restore form data
        Object.entries(savedState.userData).forEach(([key]) => {
          if (key !== 'qrCode') {
            // This will be handled by the QRScannerContainer
          }
        })
      }
    }
  }, [restoreState])
  
  return (
    <div>
      {/* Navigation Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">Bus Booking System</h1>
          <Link href="/view-passengers">
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              View Passengers
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Main Content */}
      <QRScannerContainer />
    </div>
  )
}
