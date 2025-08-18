# Troubleshooting Bus Booking Issues

## Current Problem
You're experiencing errors when trying to book a bus. The app successfully shows all buses but fails during the booking process.

## Root Causes Identified

### 1. Missing Environment Variables
The app cannot connect to Supabase because the environment variables are not set up.

**Solution:**
1. Create a `.env.local` file in your project root
2. Add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
3. Restart your development server

### 2. Database Schema Mismatch
There's a mismatch between your database schema and the TypeScript types:

**Current Types File Shows:**
- `delegates` table with integer IDs
- `buses` table without name field
- `bookings` table with integer IDs

**Setup Guide Shows:**
- `users` table with UUID IDs
- `buses` table with name field
- `bookings` table with UUID IDs

## How to Fix

### Option 1: Update Database Schema (Recommended)
Run this SQL in your Supabase SQL Editor to match the types file:

```sql
-- Drop existing tables if they exist
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS queue CASCADE;
DROP TABLE IF EXISTS buses CASCADE;
DROP TABLE IF EXISTS delegates CASCADE;

-- Create delegates table
CREATE TABLE delegates (
  id SERIAL PRIMARY KEY,
  name TEXT,
  qr_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create buses table
CREATE TABLE buses (
  id SERIAL PRIMARY KEY,
  capacity INTEGER,
  current_passengers INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bookings table
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES delegates(id),
  bus_id INTEGER REFERENCES buses(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create queue table
CREATE TABLE queue (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES delegates(id),
  position INTEGER,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample buses
INSERT INTO buses (id, capacity, current_passengers) 
SELECT generate_series(1, 26), 50, 0;

-- Enable RLS
ALTER TABLE delegates ENABLE ROW LEVEL SECURITY;
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to buses" ON buses FOR SELECT USING (true);
CREATE POLICY "Allow public read access to queue" ON queue FOR SELECT USING (true);
CREATE POLICY "Allow users to create bookings" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to read own bookings" ON bookings FOR SELECT USING (true);
CREATE POLICY "Allow users to delete own bookings" ON bookings FOR DELETE USING (true);
CREATE POLICY "Allow users to update buses" ON buses FOR UPDATE USING (true);
```

### Option 2: Update TypeScript Types
If you prefer to keep your current database schema, update the `supabase-types.ts` file to match.

## Testing the Fix

1. **Set up environment variables** (see above)
2. **Update database schema** (see above)
3. **Restart your development server**
4. **Test the flow:**
   - Go to `/`
   - Enter your name
   - Enter a QR code (or scan one)
   - Try to book a bus

## Debug Information

The app now includes console logging to help debug issues:

1. Open browser developer tools (F12)
2. Go to Console tab
3. Try to book a bus
4. Look for error messages and logs

## Common Error Messages

- **"Invalid API key"** → Environment variables not set
- **"Table doesn't exist"** → Database schema not created
- **"RLS policy violation"** → Row Level Security policies not set up
- **"Foreign key constraint"** → Database relationships not properly configured

## Still Having Issues?

1. Check the browser console for specific error messages
2. Verify your Supabase project is active and accessible
3. Ensure your database tables exist and have the correct structure
4. Check that RLS policies allow the operations you're trying to perform

## Next Steps

Once booking works:
1. Test the QR scanner functionality
2. Verify queue management works
3. Test bus changing functionality
4. Add any missing features
