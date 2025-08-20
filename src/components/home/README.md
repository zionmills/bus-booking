# Home Page Components

This directory contains the refactored components for the home page, breaking down the original monolithic `page.tsx` into smaller, more manageable pieces.

## Component Structure

### Core Components

- **`QRScannerContainer`** - Main container managing the scanning state and orchestrating other components
- **`ScanningView`** - Handles the QR scanning interface and user dashboard
- **`RegistrationView`** - Manages new user registration flow
- **`ErrorView`** - Displays error messages and recovery options
- **`ReadyView`** - Shows success state after registration

### UI Components

- **`QueueStatusBanner`** - Displays queue status information
- **`UserBookingCard`** - Shows existing user booking information and actions
- **`ConsentForm`** - Handles terms and consent checkbox

### Custom Hooks

- **`useStatePersistence`** - Manages localStorage state persistence
- **`useMobileDetection`** - Detects mobile devices for responsive behavior

### Utilities

- **`types.ts`** - TypeScript interfaces and types
- **`utils.ts`** - Utility functions like QR code sanitization

## Benefits of Refactoring

1. **Separation of Concerns** - Each component has a single responsibility
2. **Reusability** - Components can be easily reused in other parts of the app
3. **Maintainability** - Easier to debug and modify individual components
4. **Testability** - Components can be tested in isolation
5. **Code Organization** - Clear structure makes the codebase easier to navigate

## Usage

```tsx
import { QRScannerContainer } from '@/components/home'

export default function HomePage() {
  return <QRScannerContainer />
}
```

## State Management

The refactored components use a reducer pattern for predictable state updates, with the main state managed in `QRScannerContainer` and passed down to child components as props.

## File Structure

```
src/components/home/
├── index.ts                 # Export all components
├── types.ts                 # TypeScript types and interfaces
├── utils.ts                 # Utility functions
├── QRScannerContainer.tsx   # Main container component
├── ScanningView.tsx         # QR scanning interface
├── RegistrationView.tsx     # User registration form
├── ErrorView.tsx            # Error display
├── ReadyView.tsx            # Success state
├── QueueStatusBanner.tsx    # Queue status display
├── UserBookingCard.tsx      # User booking information
├── ConsentForm.tsx          # Consent form
├── useStatePersistence.ts   # State persistence hook
├── useMobileDetection.ts    # Mobile detection hook
└── README.md                # This file
```
