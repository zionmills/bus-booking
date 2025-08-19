import type { Bus as BusType } from '@/lib/supabase'

interface BusWithPassengers extends BusType {
  passengerCount: number
}

interface Passenger {
  id: number
  name: string
}

interface PendingPassenger {
  id: number
  name: string
}

export interface BusStatus {
  status: 'loading' | 'full' | 'almost-full' | 'moderate' | 'available' | 'unknown'
  color: 'secondary' | 'destructive' | 'warning' | 'default'
}

export function getBusStatus(
  bus: BusWithPassengers, 
  isLoadingPassengers: boolean, 
  pendingCount: number = 0
): BusStatus {
  if (isLoadingPassengers) {
    return { status: 'loading', color: 'secondary' }
  }
  
  if (bus.capacity === null) {
    return { status: 'unknown', color: 'secondary' }
  }
  
  const totalPassengers = bus.passengerCount + pendingCount
  const percentage = (totalPassengers / bus.capacity) * 100
  
  if (percentage >= 100) return { status: 'full', color: 'destructive' }
  if (percentage >= 80) return { status: 'almost-full', color: 'warning' }
  if (percentage >= 50) return { status: 'moderate', color: 'default' }
  return { status: 'available', color: 'secondary' }
}

export function getStatusText(status: string): string {
  switch (status) {
    case 'full': return 'Full'
    case 'almost-full': return 'Almost Full'
    case 'moderate': return 'Moderate'
    case 'available': return 'Available'
    case 'unknown': return 'Unknown'
    case 'loading': return 'Loading...'
    default: return 'Unknown'
  }
}

export function formatTimeRemaining(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function getTimeoutWarningColor(timeRemaining: number): string {
  if (timeRemaining <= 10000) return 'text-red-600' // 10 seconds or less
  if (timeRemaining <= 30000) return 'text-orange-600' // 30 seconds or less
  return 'text-yellow-600' // More than 30 seconds
}

export function isBusFull(
  bus: BusWithPassengers, 
  pendingCount: number = 0
): boolean {
  return bus.capacity ? (bus.passengerCount + pendingCount) >= bus.capacity : false
}

export function getBusCapacityPercentage(
  bus: BusWithPassengers, 
  pendingCount: number = 0
): number {
  if (!bus.capacity) return 0
  return ((bus.passengerCount + pendingCount) / bus.capacity) * 100
}

export function getTotalPassengers(
  bus: BusWithPassengers, 
  pendingCount: number = 0
): number {
  return bus.passengerCount + pendingCount
}
