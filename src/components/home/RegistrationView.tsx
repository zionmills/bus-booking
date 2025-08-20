'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { User } from 'lucide-react'
import { ConsentForm } from './ConsentForm'
import { UserData } from './types'

interface RegistrationViewProps {
  userData: UserData | null
  isLoading: boolean
  onSubmit: (e: React.FormEvent) => void
  onUserDataChange: (updates: Partial<UserData>) => void
  onBack: () => void
}

export function RegistrationView({
  userData,
  isLoading,
  onSubmit,
  onUserDataChange,
  onBack
}: RegistrationViewProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
      <div className="max-w-md mx-auto pt-20">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <User className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Complete Registration</CardTitle>
            <CardDescription>
              Please enter your name to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={userData?.name || ''}
                  onChange={(e) => onUserDataChange({ name: e.target.value })}
                  className="text-lg"
                  autoFocus
                />
              </div>
              
              <ConsentForm
                consent={userData?.consent || false}
                onConsentChange={(consent) => onUserDataChange({ consent })}
              />
              
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={!userData?.name?.trim() || !userData?.consent || isLoading}
              >
                {isLoading ? 'Creating Registration...' : 'Continue'}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="w-full"
              >
                Back to QR Scan
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
