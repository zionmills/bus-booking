'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users } from 'lucide-react'
import Link from 'next/link'
import { UserData } from './types'
import { sanitizeQRCode } from './utils'

interface ReadyViewProps {
  userData: UserData | null
  currentUser: any
  queuePosition: number | null
  onBack: () => void
}

export function ReadyView({ userData, currentUser, queuePosition, onBack }: ReadyViewProps) {
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
              Welcome, {userData?.name}! You can now select your bus.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700">
                  QR Code: <span className="font-mono font-bold">{sanitizeQRCode(currentUser?.qr_code || userData?.qrCode)}</span>
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
                onClick={onBack}
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
