import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Timer } from 'lucide-react'
import { TimeoutInfo } from '@/lib/queue-manager'
import { formatTimeRemaining, getTimeoutWarningColor } from '@/lib/bus-utils'
import Link from 'next/link'

interface BookingEligibilitySummaryProps {
  queuePosition: number | null
  userTimeoutInfo: TimeoutInfo | null
}

export function BookingEligibilitySummary({ 
  queuePosition, 
  userTimeoutInfo 
}: BookingEligibilitySummaryProps) {
  const getStatusInfo = () => {
    if (queuePosition === null) {
      return {
        icon: <span className="text-sm font-bold">!</span>,
        iconBg: 'bg-blue-100 text-blue-600',
        title: 'Join the Queue First',
        description: 'You need to join the queue before you can book a bus',
        position: 'N/A',
        showJoinButton: true
      }
    }
    
    if (queuePosition <= 20) {
      return {
        icon: <CheckCircle className="w-5 h-5" />,
        iconBg: 'bg-green-100 text-green-600',
        title: 'Eligible to Book',
        description: `You are in position ${queuePosition} and can book a bus`,
        position: queuePosition.toString(),
        showJoinButton: false
      }
    }
    
    return {
      icon: <span className="text-xs font-bold">{queuePosition}</span>,
      iconBg: 'bg-orange-100 text-orange-600',
      title: 'Not Eligible to Book',
      description: `You are in position ${queuePosition} and need to be in the top 20 to book`,
      position: queuePosition.toString(),
      showJoinButton: false
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <Card className="mb-6 border-2 border-gray-200 bg-gray-50">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${statusInfo.iconBg}`}>
              {statusInfo.icon}
            </div>
            <div>
              <p className="font-semibold text-gray-800">
                {statusInfo.title}
              </p>
              <p className="text-sm text-gray-600">
                {statusInfo.description}
              </p>
              {/* Timeout info for users in booking zone */}
              {userTimeoutInfo && userTimeoutInfo.isInBookingZone && (
                <div className="mt-2 flex items-center space-x-2">
                  <Timer className="w-4 h-4 text-yellow-600" />
                  <span className={`text-sm font-medium ${getTimeoutWarningColor(userTimeoutInfo.timeRemaining)}`}>
                    {formatTimeRemaining(userTimeoutInfo.timeRemaining)} to complete booking
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-800">
                {statusInfo.position}
              </div>
              <div className="text-xs text-gray-500">Queue Position</div>
              {/* Timeout countdown for users in booking zone */}
              {userTimeoutInfo && userTimeoutInfo.isInBookingZone && (
                <div className="mt-2">
                  <div className={`text-lg font-bold ${getTimeoutWarningColor(userTimeoutInfo.timeRemaining)}`}>
                    {formatTimeRemaining(userTimeoutInfo.timeRemaining)}
                  </div>
                  <div className="text-xs text-yellow-600">Time Left</div>
                </div>
              )}
            </div>
            {/* Join Queue Button - only show when not in queue */}
            {statusInfo.showJoinButton && (
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/queue">
                  Join Queue
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
