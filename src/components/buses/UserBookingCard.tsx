import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Eye } from 'lucide-react'
import Link from 'next/link'

interface UserBookingCardProps {
  userBooking?: { busId: number; userName: string } | null
  onChangeBus?: () => void
}

export function UserBookingCard({ userBooking }: UserBookingCardProps) {
  // Guard against null/undefined userBooking
  if (!userBooking) {
    return null
  }

  return (
    <Card className="mb-8 border-green-200 bg-green-50">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-semibold text-green-800">
                You&apos;re booked on Bus {userBooking.busId}
              </p>
              <p className="text-sm text-green-600">
                {userBooking.userName}
              </p>
            </div>
          </div>
          <Link href="/booking-confirmation">
            <Button
              variant="outline"
              size="sm"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Existing Reservation
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
