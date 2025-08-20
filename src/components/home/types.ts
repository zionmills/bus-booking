// Types for better type safety
export interface UserData {
  qrCode: string
  name: string
  consent: boolean
}

export interface UserBooking {
  id: number
  bus_id: number | null
  user_id: number | null
  created_at: string
}

export interface AppState {
  status: 'scanning' | 'registering' | 'ready' | 'error'
  userData: UserData | null
  error: string | null
  isLoading: boolean
  isProcessingQR: boolean
  lastScanTime: number
  processedQRs: Set<string>
  manualQr: string
}

// Action types for the reducer
export type AppAction =
  | { type: 'START_SCANNING' }
  | { type: 'QR_SCANNED'; payload: string }
  | { type: 'START_REGISTRATION'; payload: string }
  | { type: 'UPDATE_USER_DATA'; payload: Partial<UserData> }
  | { type: 'REGISTRATION_COMPLETE'; payload: { user: { id: number; name: string | null; qr_code: string | null; created_at: string }; queuePosition: number } }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_PROCESSING_QR'; payload: boolean }
  | { type: 'RESET' }
  | { type: 'ADD_PROCESSED_QR'; payload: string }
  | { type: 'UPDATE_MANUAL_QR'; payload: string }

// Initial state
export const initialState: AppState = {
  status: 'scanning',
  userData: null,
  error: null,
  isLoading: false,
  isProcessingQR: false,
  lastScanTime: 0,
  processedQRs: new Set(),
  manualQr: ''
}

// Reducer function for predictable state updates
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'START_SCANNING':
      return {
        ...state,
        status: 'scanning',
        error: null,
        userData: null,
        processedQRs: new Set(),
        manualQr: ''
      }
    
    case 'QR_SCANNED':
      return {
        ...state,
        lastScanTime: Date.now()
      }
    
    case 'START_REGISTRATION':
      return {
        ...state,
        status: 'registering',
        userData: {
          qrCode: action.payload,
          name: '',
          consent: false
        },
        error: null
      }
    
    case 'UPDATE_USER_DATA':
      return {
        ...state,
        userData: state.userData ? { ...state.userData, ...action.payload } : null
      }
    
    case 'REGISTRATION_COMPLETE':
      return {
        ...state,
        status: 'ready',
        isLoading: false,
        error: null
      }
    
    case 'SET_ERROR':
      return {
        ...state,
        status: 'error',
        error: action.payload,
        isLoading: false,
        isProcessingQR: false
      }
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      }
    
    case 'SET_PROCESSING_QR':
      return {
        ...state,
        isProcessingQR: action.payload
      }
    
    case 'RESET':
      return initialState
    
    case 'ADD_PROCESSED_QR':
      return {
        ...state,
        processedQRs: new Set([...state.processedQRs, action.payload])
      }
    
    case 'UPDATE_MANUAL_QR':
      return {
        ...state,
        manualQr: action.payload
      }
    
    default:
      return state
  }
}
