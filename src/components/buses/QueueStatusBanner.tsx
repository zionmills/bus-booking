import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'
import Link from 'next/link'

interface QueueStatusBannerProps {
  queuePosition: number | null
}

export function QueueStatusBanner({ queuePosition }: QueueStatusBannerProps) {
  // Only show this banner when user is in the queue
  if (queuePosition === null) {
    return null
  }

  const isEligible = queuePosition <= 20
  const borderColor = isEligible ? 'border-green-200' : 'border-orange-200'
  const bgColor = isEligible ? 'bg-green-50' : 'bg-orange-50'
  const iconBgColor = isEligible ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
  const textColor = isEligible ? 'text-green-800' : 'text-orange-800'
  const subTextColor = isEligible ? 'text-green-600' : 'text-orange-600'

  return (
    <Card className={`mb-8 border-2 ${borderColor} ${bgColor}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${iconBgColor}`}>
              {isEligible ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <span className="text-xs font-bold">{queuePosition}</span>
              )}
            </div>
            <div>
              <p className={`font-semibold ${textColor}`}>
                {isEligible 
                  ? `You can book a bus! (Position ${queuePosition})`
                  : `Waiting in queue (Position ${queuePosition})`
                }
              </p>
              <p className={`text-sm ${subTextColor}`}>
                {isEligible 
                  ? 'You are in the top 20 and can select a bus'
                  : `You need to be in position 1-20 to book a bus. Current position: ${queuePosition}`
                }
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Link href="/queue">
              <Button variant="outline" size="sm">
                View Queue
              </Button>
            </Link>
            {!isEligible && (
              <div className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                {queuePosition - 20} positions to go
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
