import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Bus, Users, CheckCircle, User } from 'lucide-react'
import type { Bus as BusType } from '@/lib/supabase'
import { 
  getBusStatus, 
  getStatusText, 
  isBusFull, 
  getBusCapacityPercentage,
  getTotalPassengers
} from '@/lib/bus-utils'

interface Passenger {
  id: number
  name: string
}

interface PendingPassenger {
  id: number
  name: string
}

interface BusWithPassengers extends BusType {
  passengerCount: number
}

interface BusCardProps {
  bus: BusWithPassengers
  passengers: Passenger[]
  pendingPassengers: PendingPassenger[]
  userBooking: { busId: number; userName: string } | null
  queuePosition: number | null
  canBookBus: boolean
  isPendingForBus: (busId: number) => boolean
  onBookBus: (busId: number) => void
  onConfirmBooking: () => void
  onCancelSelection: () => void

  onLoadPassengers: (busId: number) => void
}

export function BusCard({
  bus,
  passengers,
  pendingPassengers,
  userBooking,
  queuePosition,
  canBookBus,
  isPendingForBus,
  onBookBus,
  onConfirmBooking,
  onCancelSelection,

  onLoadPassengers
}: BusCardProps) {
  const pendingCount = pendingPassengers.length
  const { status, color } = getBusStatus(bus, false, pendingCount)
  const isBooked = userBooking?.busId === bus.id
  const isFull = isBusFull(bus, pendingCount)
  const isPending = isPendingForBus(bus.id)
  
  const handleCardClick = () => {
    // Load passengers when card is clicked (only if not already loaded)
    if (passengers.length === 0) {
      onLoadPassengers(bus.id)
    }
  }

  const renderActionButton = () => {
    if (isBooked) {
      return (
        <Button className="w-full" variant="outline" disabled>
          <CheckCircle className="w-4 h-4 mr-2" />
          Booked
        </Button>
      )
    }

    if (isPending) {
      return (
        <div className="space-y-2">
          <Button className="w-full" onClick={onConfirmBooking}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Confirm Booking
          </Button>
          <Button className="w-full" variant="outline" onClick={onCancelSelection}>
            Cancel Selection
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <Button
          className="w-full"
          disabled={isFull || !canBookBus}
          onClick={() => onBookBus(bus.id)}
        >
          {isFull ? 'Full' : 
           !canBookBus ? 'Join Queue First' : 
           userBooking ? 'Change to This Bus' : 'Select This Bus'}
        </Button>
        {!canBookBus && (
          <div className="text-xs text-center text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {queuePosition === null 
              ? 'Join queue to book buses' 
              : `Need position 1-20, currently ${queuePosition}`}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card 
      className={`transition-all duration-200 hover:shadow-lg cursor-pointer ${
        isBooked ? 'ring-2 ring-green-500 bg-green-50' : 
        !canBookBus ? 'ring-2 ring-gray-300 bg-gray-50' : ''
      }`}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center">
            <Bus className="w-5 h-5 mr-2 text-blue-600" />
            Bus {bus.id}
          </CardTitle>
          <Badge variant={color as "default" | "secondary" | "destructive" | "outline"}>
            {getStatusText(status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Capacity Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Capacity</span>
            <span className="font-medium">
              <span>
                {getTotalPassengers(bus, pendingCount)}/{bus.capacity ?? 0}
                {pendingCount > 0 && (
                  <span className="text-blue-600 text-xs ml-1">
                    (+{pendingCount})
                  </span>
                )}
              </span>
            </span>
          </div>
          <Progress 
            value={getBusCapacityPercentage(bus, pendingCount)} 
            className="h-2"
          />
        </div>

        {/* Passenger Count */}
        <div className="flex items-center text-sm text-gray-600">
          <Users className="w-4 h-4 mr-2" />
          <span>
            {getTotalPassengers(bus, pendingCount)} passengers
            {pendingCount > 0 && (
              <span className="text-blue-600 text-xs ml-1">
                (+{pendingCount} pending)
              </span>
            )}
          </span>
        </div>

        {/* Passenger Names List */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Passengers:</div>
          <div className="max-h-24 overflow-y-auto border rounded-md p-2 bg-gray-50">
            {/* Show actual passengers */}
            {passengers.map((passenger) => (
              <div key={passenger.id} className="flex items-center space-x-2 py-1">
                <User className="w-3 h-3 text-gray-500" />
                <span className="text-sm text-gray-600">{passenger.name}</span>
              </div>
            ))}
            {/* Show pending passengers */}
            {pendingPassengers.map((passenger) => (
              <div key={`pending-${passenger.id}`} className="flex items-center space-x-2 py-1">
                <User className="w-3 h-3 text-blue-500" />
                <span className="text-sm text-blue-600 italic">{passenger.name} (pending)</span>
              </div>
            ))}
            {/* Show "no passengers" message if both lists are empty */}
            {passengers.length === 0 && pendingCount === 0 && (
              <div className="flex items-center justify-center py-2">
                <span className="text-sm text-gray-500">No passengers yet</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        {renderActionButton()}
      </CardContent>
    </Card>
  )
}
