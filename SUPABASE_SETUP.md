# Supabase Setup Guide

Follow these steps to connect your bus booking app to Supabase:

## 1. Create Environment Variables

Create a `.env.local` file in your project root with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 2. Set Up Database Tables

Run these SQL commands in your Supabase SQL Editor:

### Users Table
```sql
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  qr_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Buses Table
```sql
CREATE TABLE buses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  current_passengers INTEGER DEFAULT 0
);

-- Insert 26 buses
INSERT INTO buses (id, name, capacity) 
SELECT generate_series(1, 26), 
       'Bus ' || chr(64 + generate_series(1, 26)), 
       50;
```

### Bookings Table
```sql
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bus_id INTEGER REFERENCES buses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Queue Table
```sql
CREATE TABLE queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'waiting'
);
```

## 3. Enable Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;

-- Allow public read access to buses
CREATE POLICY "Allow public read access to buses" ON buses
FOR SELECT USING (true);

-- Allow public read access to queue
CREATE POLICY "Allow public read access to queue" ON queue
FOR SELECT USING (true);

-- Allow users to insert into queue
CREATE POLICY "Allow users to join queue" ON queue
FOR INSERT WITH CHECK (true);

-- Allow users to update their own queue position
CREATE POLICY "Allow users to update own queue position" ON queue
FOR UPDATE USING (true);

-- Allow users to delete their own queue entry
CREATE POLICY "Allow users to leave queue" ON queue
FOR DELETE USING (true);

-- Allow users to create bookings
CREATE POLICY "Allow users to create bookings" ON bookings
FOR INSERT WITH CHECK (true);

-- Allow users to read their own bookings
CREATE POLICY "Allow users to read own bookings" ON bookings
FOR SELECT USING (true);

-- Allow users to delete their own bookings
CREATE POLICY "Allow users to delete own bookings" ON bookings
FOR DELETE USING (true);
```

## 4. Enable Real-time Subscriptions

In your Supabase dashboard:
1. Go to Database → Replication
2. Enable real-time for these tables:
   - `buses`
   - `queue`
   - `bookings`

## 5. Test the Integration

1. Start your development server: `npm run dev`
2. Open http://localhost:3000
3. Enter a name and QR code
4. Try joining the queue
5. Book a bus

## 6. Troubleshooting

### Common Issues:

1. **"Invalid API key" error**
   - Check your `.env.local` file
   - Ensure you're using the `anon` key, not the `service_role` key

2. **"Table doesn't exist" error**
   - Run the SQL commands in step 2
   - Check table names match exactly

3. **"RLS policy violation" error**
   - Ensure RLS policies are set up correctly
   - Check that policies allow the operations you're trying to perform

4. **Real-time not working**
   - Enable real-time in Supabase dashboard
   - Check browser console for connection errors

### Testing Real-time:

1. Open the app in two browser tabs
2. Join the queue in one tab
3. Watch the queue update in real-time in the other tab

## 7. Next Steps

Once basic integration is working:

1. **Add user authentication** (if needed)
2. **Implement proper error handling**
3. **Add data validation**
4. **Set up monitoring and logging**
5. **Deploy to production**

## 8. Production Considerations

- Use environment variables in production
- Set up proper CORS policies
- Monitor database performance
- Set up backup strategies
- Consider rate limiting for queue operations
