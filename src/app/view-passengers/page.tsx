'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Bus, Users, Printer, Download, Eye, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Bus as BusType } from '@/lib/supabase'
import { getBusStatus, getStatusText, getBusCapacityPercentage } from '@/lib/bus-utils'
import Link from 'next/link'

interface Passenger {
  id: number
  name: string
  created_at: string
}

interface BusWithPassengers extends BusType {
  passengers: Passenger[]
  passengerCount: number
}

interface BookingWithDelegate {
  id: number
  created_at: string
  delegates: {
    name: string | null
  }
}

interface UnassignedDelegate {
  id: number
  name: string | null
  qr_code: string | null
  created_at: string
}

export default function ViewPassengersPage() {
  const [buses, setBuses] = useState<BusWithPassengers[]>([])
  const [unassignedDelegates, setUnassignedDelegates] = useState<UnassignedDelegate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedBuses, setExpandedBuses] = useState<Set<number>>(new Set())
  const [showUnassigned, setShowUnassigned] = useState(false)

  useEffect(() => {
    loadBusesWithPassengers()
    loadUnassignedDelegates()
  }, [])

  const loadBusesWithPassengers = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all buses
      const { data: busesData, error: busesError } = await supabase
        .from('buses')
        .select('*')
        .order('id')

      if (busesError) throw busesError

      // Fetch passengers for each bus
      const busesWithPassengers = await Promise.all(
        busesData.map(async (bus) => {
          const { data: passengersData, error: passengersError } = await supabase
            .from('bookings')
            .select(`
              id,
              created_at,
              delegates!inner(name)
            `)
            .eq('bus_id', bus.id)

          if (passengersError) throw passengersError

          const passengers = passengersData.map((booking: BookingWithDelegate) => ({
            id: booking.id,
            name: booking.delegates.name || 'Unknown',
            created_at: booking.created_at
          }))

          return {
            ...bus,
            passengers,
            passengerCount: passengers.length
          }
        })
      )

      setBuses(busesWithPassengers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load buses')
    } finally {
      setLoading(false)
    }
  }

  const loadUnassignedDelegates = async () => {
    try {
      // Get all delegates
      const { data: allDelegates, error: delegatesError } = await supabase
        .from('delegates')
        .select('*')
        .order('name')

      if (delegatesError) throw delegatesError

      // Get all delegates with bookings
      const { data: bookedDelegates, error: bookingsError } = await supabase
        .from('bookings')
        .select('user_id')

      if (bookingsError) throw bookingsError

      // Filter out delegates who have bookings
      const bookedIds = new Set(bookedDelegates.map(booking => booking.user_id))
      const unassigned = allDelegates.filter(delegate => !bookedIds.has(delegate.id))

      setUnassignedDelegates(unassigned)
    } catch (err) {
      console.error('Failed to load unassigned delegates:', err)
    }
  }

  const toggleBusExpansion = (busId: number) => {
    const newExpanded = new Set(expandedBuses)
    if (newExpanded.has(busId)) {
      newExpanded.delete(busId)
    } else {
      newExpanded.add(busId)
    }
    setExpandedBuses(newExpanded)
  }

  const printPassengerList = (bus: BusWithPassengers) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Passenger List - Bus ${bus.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .bus-info { margin-bottom: 20px; padding: 15px; border: 1px solid #ccc; }
            .passenger-list { margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .no-passengers { text-align: center; color: #666; padding: 20px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Passenger List</h1>
            <h2>Bus ${bus.id}</h2>
            <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="bus-info">
            <h3>Bus Information</h3>
            <p><strong>Bus ID:</strong> ${bus.id}</p>
            <p><strong>Capacity:</strong> ${bus.capacity || 'Unknown'}</p>
            <p><strong>Current Passengers:</strong> ${bus.passengerCount}</p>
            <p><strong>Available Seats:</strong> ${bus.capacity ? bus.capacity - bus.passengerCount : 'Unknown'}</p>
          </div>
          
          <div class="passenger-list">
            <h3>Passenger List (${bus.passengerCount} passengers)</h3>
            ${bus.passengers.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Booking Time</th>
                  </tr>
                </thead>
                <tbody>
                  ${bus.passengers.map((passenger, index) => `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${passenger.name}</td>
                      <td>${new Date(passenger.created_at).toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<div class="no-passengers">No passengers on this bus</div>'}
          </div>
          
          <div class="no-print" style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()">Print</button>
            <button onclick="window.close()">Close</button>
          </div>
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
  }

  const downloadPassengerList = (bus: BusWithPassengers) => {
    const csvContent = [
      ['Bus ID', 'Capacity', 'Current Passengers', 'Available Seats'],
      [bus.id.toString(), (bus.capacity || 'Unknown').toString(), bus.passengerCount.toString(), (bus.capacity ? (bus.capacity - bus.passengerCount).toString() : 'Unknown')],
      [],
      ['#', 'Name', 'Booking Time'],
      ...bus.passengers.map((passenger, index) => [
        (index + 1).toString(),
        passenger.name,
        new Date(passenger.created_at).toLocaleString()
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bus-${bus.id}-passengers-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const downloadUnassignedList = () => {
    const csvContent = [
      ['#', 'Name', 'QR Code', 'Registration Time'],
      ...unassignedDelegates.map((delegate, index) => [
        (index + 1).toString(),
        delegate.name || 'Unknown',
        delegate.qr_code || 'N/A',
        new Date(delegate.created_at).toLocaleString()
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `unassigned-delegates-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const printUnassignedList = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unassigned Delegates List</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .no-delegates { text-align: center; color: #666; padding: 20px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Unassigned Delegates List</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <p>Total Unassigned: ${unassignedDelegates.length}</p>
          </div>
          
          <div class="delegates-list">
            <h3>Delegates Without Bus Bookings</h3>
            ${unassignedDelegates.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>QR Code</th>
                    <th>Registration Time</th>
                  </tr>
                </thead>
                <tbody>
                  ${unassignedDelegates.map((delegate, index) => `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${delegate.name || 'Unknown'}</td>
                      <td>${delegate.qr_code || 'N/A'}</td>
                      <td>${new Date(delegate.created_at).toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<div class="no-delegates">All delegates have been assigned to buses</div>'}
          </div>
          
          <div class="no-print" style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()">Print</button>
            <button onclick="window.close()">Close</button>
          </div>
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading buses and passengers...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="font-bold">Error</p>
            <p>{error}</p>
            <Button 
              onClick={loadBusesWithPassengers} 
              className="mt-4"
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Navigation */}
      <div className="mb-6">
        <Link href="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bus Passenger View</h1>
        <p className="text-gray-600">View all buses and their current passengers</p>
        <div className="flex justify-center space-x-4 mt-4">
          <Button 
            onClick={loadBusesWithPassengers} 
            variant="outline"
          >
            Refresh Data
          </Button>
          <Button 
            onClick={() => setShowUnassigned(!showUnassigned)} 
            variant={showUnassigned ? "default" : "outline"}
          >
            {showUnassigned ? 'Hide' : 'Show'} Unassigned Delegates ({unassignedDelegates.length})
          </Button>
        </div>
      </div>

      {/* Unassigned Delegates Section */}
      {showUnassigned && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-orange-600" />
                  <span>Unassigned Delegates ({unassignedDelegates.length})</span>
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={printUnassignedList}
                    variant="outline"
                    size="sm"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                  <Button
                    onClick={downloadUnassignedList}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {unassignedDelegates.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {unassignedDelegates.map((delegate, index) => (
                    <div 
                      key={delegate.id} 
                      className="p-3 bg-orange-50 border border-orange-200 rounded-lg"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">
                            {index + 1}. {delegate.name || 'Unknown Name'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            QR: {delegate.qr_code || 'N/A'}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(delegate.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p>All delegates have been assigned to buses!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {buses.map((bus) => {
          const { status, color } = getBusStatus(bus, false)
          const capacityPercentage = getBusCapacityPercentage(bus)
          const isExpanded = expandedBuses.has(bus.id)

          return (
            <Card key={bus.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bus className="w-5 h-5 text-blue-600" />
                    <span>Bus {bus.id}</span>
                  </div>
                  <Badge variant={color as 'secondary' | 'destructive' | 'outline' | 'default'}>{getStatusText(status)}</Badge>
                </CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Capacity:</span>
                    <span className="font-medium">{bus.capacity || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Passengers:</span>
                    <span className="font-medium">{bus.passengerCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Available:</span>
                    <span className="font-medium">
                      {bus.capacity ? bus.capacity - bus.passengerCount : 'Unknown'}
                    </span>
                  </div>
                </div>

                {bus.capacity && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Occupancy:</span>
                      <span className="font-medium">{Math.round(capacityPercentage)}%</span>
                    </div>
                    <Progress value={capacityPercentage} className="h-2" />
                  </div>
                )}

                <div className="flex space-x-2">
                  <Button
                    onClick={() => toggleBusExpansion(bus.id)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {isExpanded ? 'Hide' : 'View'} Passengers
                  </Button>
                  <Button
                    onClick={() => printPassengerList(bus)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                  <Button
                    onClick={() => downloadPassengerList(bus)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium mb-3 flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      Passengers ({bus.passengerCount})
                    </h4>
                    
                    {bus.passengers.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {bus.passengers.map((passenger, index) => (
                          <div 
                            key={passenger.id} 
                            className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm"
                          >
                            <span className="font-medium">{index + 1}. {passenger.name}</span>
                            <span className="text-gray-500 text-xs">
                              {new Date(passenger.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No passengers on this bus
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {buses.length === 0 && (
        <div className="text-center py-12">
          <Bus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No buses found</p>
        </div>
      )}
    </div>
  )
}
