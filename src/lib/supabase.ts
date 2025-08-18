import { createClient } from '@supabase/supabase-js'
import type { Database } from './supabase-types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Export types from the generated schema for convenience
export type { Database } from './supabase-types'
export type Delegate = Database['public']['Tables']['delegates']['Row']
export type Bus = Database['public']['Tables']['buses']['Row']
export type Booking = Database['public']['Tables']['bookings']['Row']
export type QueueEntry = Database['public']['Tables']['queue']['Row']

// Insert types for creating new records
export type DelegateInsert = Database['public']['Tables']['delegates']['Insert']
export type BusInsert = Database['public']['Tables']['buses']['Insert']
export type BookingInsert = Database['public']['Tables']['bookings']['Insert']
export type QueueEntryInsert = Database['public']['Tables']['queue']['Insert']

// Update types for modifying existing records
export type DelegateUpdate = Database['public']['Tables']['delegates']['Update']
export type BusUpdate = Database['public']['Tables']['buses']['Update']
export type BookingUpdate = Database['public']['Tables']['bookings']['Update']
export type QueueEntryUpdate = Database['public']['Tables']['queue']['Update']
