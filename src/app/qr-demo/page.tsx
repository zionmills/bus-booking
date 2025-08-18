'use client'

import { useState } from 'react'
import QRScanner from '@/components/QRScanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QrCode, Camera, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function QRDemoPage() {
  const [scannedResult, setScannedResult] = useState<string>('')
  const [scanHistory, setScanHistory] = useState<string[]>([])

  const handleScan = (result: string) => {
    setScannedResult(result)
    setScanHistory(prev => [result, ...prev.slice(0, 9)]) // Keep last 10 scans
  }

  const handleError = (error: string) => {
    console.error('Scan error:', error)
  }

  const clearHistory = () => {
    setScanHistory([])
    setScannedResult('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Main App
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">QR Scanner Demo</h1>
          <p className="text-gray-600">
            Test the enhanced QR scanner with camera selection and switching capabilities
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Scanner Section */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Camera className="w-5 h-5 mr-2" />
                Camera Scanner
              </CardTitle>
              <CardDescription>
                Select your camera and scan QR codes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <QRScanner 
                onScan={handleScan}
                onError={handleError}
              />
              
              {scannedResult && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800">Last Scan:</p>
                  <p className="text-sm text-green-700 font-mono break-all">{scannedResult}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Features & History */}
          <div className="space-y-6">
            {/* Features */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <QrCode className="w-5 h-5 mr-2" />
                  Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    Multi-camera support
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    Camera switching
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    Permission handling
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    Error recovery
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    Real-time scanning
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Scan History */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Scan History</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearHistory}
                    disabled={scanHistory.length === 0}
                  >
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {scanHistory.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No scans yet. Try scanning a QR code!
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {scanHistory.map((result, index) => (
                      <div 
                        key={index} 
                        className="p-2 bg-gray-50 rounded text-xs font-mono break-all"
                      >
                        {result}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Instructions */}
        <Card className="mt-8 shadow-lg">
          <CardHeader>
            <CardTitle>How to Use</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
              <li>Click the "Scan QR" button to open the camera scanner</li>
              <li>Allow camera permissions when prompted</li>
              <li>Select your preferred camera from the dropdown (if multiple cameras available)</li>
              <li>Point your camera at a QR code</li>
              <li>The scanner will automatically detect and decode QR codes</li>
              <li>Use the "Refresh Cameras" button if you encounter issues</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
