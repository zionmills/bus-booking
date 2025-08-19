# Bus Booking App

A modern, mobile-first bus booking application built with Next.js, shadcn/ui, and Supabase. Users can scan QR codes to book seats on buses with real-time updates and queue management.

## Features

- 🚌 **26 Bus Selection**: Choose from 26 different buses
- 📱 **Mobile-First Design**: Optimized for mobile phone usage
- 🔍 **QR Code Scanning**: Scan QR codes for user identification with multi-camera support
- 👥 **Real-time Updates**: Live passenger counts and queue status
- 🎯 **Queue Management**: Maximum 40 concurrent users with position tracking
- 🔄 **Bus Switching**: Change your bus selection at any time
- 📊 **Capacity Monitoring**: Visual indicators for bus availability
- 📷 **Multi-Camera Support**: Switch between available cameras
- 🔄 **Camera Switching**: Seamlessly change cameras during scanning
- 🛡️ **Permission Handling**: Graceful camera permission management
- 📱 **Mobile Optimized**: Works on all devices with camera access

## Tech Stack

- **Frontend**: Next.js 14 with App Router
- **UI Components**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Real-time)
- **QR Scanning**: html5-qrcode with camera selection and switching
- **Deployment**: Vercel (Frontend) + Supabase (Backend)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account and project

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd bus-booking
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

6. **Test Camera Features**
   - Use the main app for bus booking
   - Try switching between different cameras
   - Test permission handling by denying/accepting camera access

## Supabase Setup

### Database Schema

The app requires the following tables in your Supabase database:

```sql
-- Users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  qr_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Buses table
CREATE TABLE buses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  current_passengers INTEGER DEFAULT 0
);

-- Bookings table
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bus_id INTEGER REFERENCES buses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Queue table
CREATE TABLE queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'waiting'
);

-- Insert 26 buses
INSERT INTO buses (id, name, capacity) 
SELECT generate_series(1, 26), 
       'Bus ' || chr(64 + generate_series(1, 26)), 
       50;
```

### Row-Level Security (RLS)

Enable RLS and create policies:

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

-- Allow authenticated users to insert into queue
CREATE POLICY "Allow users to join queue" ON queue
FOR INSERT WITH CHECK (true);

-- Allow users to update their own queue position
CREATE POLICY "Allow users to update own queue position" ON queue
FOR UPDATE USING (true);

-- Allow users to delete their own queue entry
CREATE POLICY "Allow users to leave queue" ON queue
FOR DELETE USING (true);
```

### Real-time Subscriptions

Enable real-time for the following tables:
- `buses` - for live passenger count updates
- `queue` - for live queue position updates
- `bookings` - for live booking updates

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── buses/             # Bus selection page
│   ├── queue/             # Queue management page
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/             # Reusable components
│   ├── ui/                # shadcn/ui components
│   └── QRScanner.tsx      # QR code scanner
└── lib/                    # Utility functions
    └── supabase.ts        # Supabase client
```

## Key Components

### QR Scanner
- Uses `html5-qrcode` library
- Mobile camera integration
- Error handling and user feedback

### Bus Selection
- Grid layout of 26 buses
- Real-time capacity indicators
- Booking and switching functionality

### Queue Management
- FIFO queue system
- Maximum 40 concurrent users
- Real-time position updates

## Deployment

### Frontend (Vercel)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Backend (Supabase)

1. Create a new Supabase project
2. Run the database schema setup
3. Configure RLS policies
4. Enable real-time subscriptions

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key | Yes |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, please open an issue in the GitHub repository or contact the development team.
