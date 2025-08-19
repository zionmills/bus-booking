import { Card, CardContent } from '@/components/ui/card'
import { Timer } from 'lucide-react'
import { TimeoutInfo } from '@/lib/queue-manager'
import { formatTimeRemaining, getTimeoutWarningColor } from '@/lib/bus-utils'

interface TimeoutWarningBannerProps {
  userTimeoutInfo: TimeoutInfo | null
}

export function TimeoutWarningBanner({ userTimeoutInfo }: TimeoutWarningBannerProps) {
  if (!userTimeoutInfo || !userTimeoutInfo.isInBookingZone) {
    return null
  }

  return (
    <Card className="mb-6 border-2 border-yellow-200 bg-yellow-50">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-yellow-100 text-yellow-600">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-yellow-800">
                Booking Timeout Warning
              </p>
              <p className="text-sm text-yellow-600">
                You have limited time to complete your bus booking
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getTimeoutWarningColor(userTimeoutInfo.timeRemaining)}`}>
              {formatTimeRemaining(userTimeoutInfo.timeRemaining)}
            </div>
            <div className="text-xs text-yellow-600">Time Remaining</div>
          </div>
        </div>
        <div className="mt-3 p-3 bg-yellow-100 rounded border border-yellow-300">
          <p className="text-sm text-yellow-800">
            <strong>Important:</strong> You have 5 minutes from when you joined the queue to complete your bus booking. 
            After this time, you will be automatically removed from the queue and will need to rejoin.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
