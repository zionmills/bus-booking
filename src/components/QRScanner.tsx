'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { QrCode, Camera, X, RefreshCw, Settings, AlertCircle } from 'lucide-react'

interface CameraDevice {
  id: string
  label: string
}

interface QRScannerProps {
  onScan: (result: string) => void
  onError?: (error: string) => void
}

export default function QRScanner({ onScan, onError }: QRScannerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [permissionError, setPermissionError] = useState<string>('')
  const [cameraError, setCameraError] = useState<string>('')
  const [hasScanned, setHasScanned] = useState(false)
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const scannerContainerRef = useRef<HTMLDivElement>(null)

  const getAvailableCameras = useCallback(async () => {
    try {
      setIsLoading(true)
      setPermissionError('')
      setCameraError('')
      
      // First, try to get camera permissions with a basic request
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      })
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop())
      
      // Now enumerate available devices
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      
      const cameraList = videoDevices.map(device => ({
        id: device.deviceId,
        label: device.label || `Camera ${device.deviceId.slice(0, 8)}...`
      }))
      
      setCameras(cameraList)
      
      if (cameraList.length > 0) {
        setSelectedCamera(cameraList[0].id)
      } else {
        setCameraError('No cameras found on this device.')
      }
    } catch (error) {
      console.error('Camera access error:', error)
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setPermissionError('Camera access denied. Please allow camera permissions and try again.')
        } else if (error.name === 'NotFoundError') {
          setCameraError('No camera found on this device.')
        } else if (error.name === 'NotReadableError') {
          setCameraError('Camera is already in use by another application.')
        } else {
          setCameraError(`Failed to access camera: ${error.message}`)
        }
        // Call onError callback if provided
        if (onError) {
          onError(error.message)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [onError])

  const stopScanner = useCallback(() => {
    if (html5QrCodeRef.current) {
      try {
        // Check if the scanner is actually running before trying to stop it
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(console.error)
        }
        html5QrCodeRef.current = null
      } catch (error) {
        console.warn('Error stopping scanner:', error)
        html5QrCodeRef.current = null
      }
    }

    setHasScanned(false)
  }, [])

  const startScanner = useCallback(async (cameraId?: string) => {
    if (!scannerContainerRef.current) return

    try {
      // Ensure clean stop of previous scanner
      stopScanner()
      
      const targetCameraId = cameraId || selectedCamera
      if (!targetCameraId) return

      // Initialize HTML5 QR Code scanner
      html5QrCodeRef.current = new Html5Qrcode("qr-reader")
      
      // Start scanning
      await html5QrCodeRef.current.start(
        { deviceId: targetCameraId },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Success callback - prevent multiple scans
          if (hasScanned) return
          
          setHasScanned(true)
          onScan(decodedText)
          
          // Immediately stop scanning and close dialog
          // Use setTimeout to ensure scanner is fully stopped before closing
          setTimeout(() => {
            stopScanner()
            setIsOpen(false)
          }, 100)
        },
        (errorMessage) => {
          // Error callback - ignore common scanning errors
          if (errorMessage.includes('NotFound') || errorMessage.includes('No QR code found')) {
            return
          }
          console.log('QR scanning error:', errorMessage)
          // Call onError callback if provided
          if (onError) {
            onError(errorMessage)
          }
        }
      )

  
      setCameraError('')
    } catch (error) {
      console.error('Failed to start scanner:', error)
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setPermissionError('Camera access denied. Please check permissions and try again.')
        } else if (error.name === 'NotFoundError') {
          setCameraError('Selected camera is not available. Please try a different camera.')
        } else if (error.name === 'NotReadableError') {
          setCameraError('Camera is already in use by another application.')
        } else {
          setCameraError(`Failed to start camera: ${error.message}`)
        }
        // Call onError callback if provided
        if (onError) {
          onError(error.message)
        }
      }
      stopScanner()
    }
  }, [onScan, selectedCamera, onError, stopScanner, hasScanned])

  useEffect(() => {
    if (isOpen) {
      setHasScanned(false)
      getAvailableCameras()
    }

    return () => {
      stopScanner()
    }
  }, [isOpen, getAvailableCameras, stopScanner])

  // Start scanner when cameras are loaded and selected
  useEffect(() => {
    if (cameras.length > 0 && selectedCamera && isOpen) {
      startScanner(selectedCamera)
    }
  }, [cameras, selectedCamera, isOpen, startScanner])

  const handleCameraChange = useCallback((cameraId: string) => {
    if (cameraId === selectedCamera) return // Don't switch if same camera
    
    setSelectedCamera(cameraId)
    setHasScanned(false)
    
    // Stop current scanner and start with new camera
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(console.error)
        }
        html5QrCodeRef.current = null
      } catch (error) {
        console.warn('Error stopping scanner during camera switch:', error)
        html5QrCodeRef.current = null
      }
    }
    
    // Small delay to ensure cleanup, then start new scanner
    setTimeout(() => {
      startScanner(cameraId)
    }, 150)
  }, [selectedCamera, startScanner])

  const handleRefreshCameras = useCallback(async () => {
    // Stop scanner first to clean up properly
    stopScanner()
    
    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Clear any existing errors and reset scan state
    setPermissionError('')
    setCameraError('')
    setHasScanned(false)
    
    // Refresh cameras
    getAvailableCameras()
  }, [stopScanner, getAvailableCameras])

  const handleClose = useCallback(() => {
    stopScanner()
    setIsOpen(false)
    setPermissionError('')
    setCameraError('')
    setHasScanned(false)
  }, [stopScanner])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex-1">
          <Camera className="w-4 h-4 mr-2" />
          Scan QR
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <QrCode className="w-5 h-5 mr-2" />
            Scan QR Code
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 max-h-[calc(90vh-120px)] overflow-y-auto">
          {isLoading && (
            <div className="text-center py-4">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-blue-500" />
              <p className="text-sm text-gray-600 mt-2">Loading cameras...</p>
            </div>
          )}

          {permissionError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-700 font-medium">Permission Required</p>
                  <p className="text-sm text-red-600 mt-1">{permissionError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRefreshCameras}
                    className="mt-2"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-yellow-700 font-medium">Camera Error</p>
                  <p className="text-sm text-yellow-600 mt-1">{cameraError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRefreshCameras}
                    className="mt-2"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Cameras
                  </Button>
                </div>
              </div>
            </div>
          )}

          {cameras.length > 0 && !permissionError && !cameraError && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Select Camera
              </label>
              <select
                value={selectedCamera}
                onChange={(e) => handleCameraChange(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm relative z-10"
                disabled={isLoading}
                style={{ position: 'relative', zIndex: 1000 }}
              >
                {cameras.map((camera) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isLoading && !permissionError && !cameraError && cameras.length > 0 && (
            <div className="text-center text-sm text-gray-600">
              Point your camera at the QR code to scan
            </div>
          )}
          
          <div className="relative w-full">
            <div 
              ref={scannerContainerRef}
              id="qr-reader" 
              className="w-full min-h-[300px] max-h-[60vh] bg-gray-100 rounded-lg overflow-hidden"
              style={{ position: 'relative', zIndex: 1 }}
            />
          </div>
          
          <div className="flex justify-between items-center">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefreshCameras}
              disabled={isLoading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Cameras
            </Button>
            
            <Button variant="outline" onClick={handleClose}>
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
