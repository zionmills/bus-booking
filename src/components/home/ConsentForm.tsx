'use client'

import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface ConsentFormProps {
  consent: boolean
  onConsentChange: (consent: boolean) => void
}

export function ConsentForm({ consent, onConsentChange }: ConsentFormProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Consent Form</Label>
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="consent"
            checked={consent}
            onCheckedChange={(checked) => onConsentChange(checked as boolean)}
            className="mt-1"
          />
          <div className="text-sm text-gray-700 leading-relaxed">
            <p className="font-medium mb-2">By entering your name and selecting a bus, you acknowledge and agree that:</p>
            <ul className="space-y-1 text-gray-600">
              <li>• Your name will be displayed on the bus roster visible to other riders for the purpose of seat assignment and coordination.</li>
              <li>• Your information will only be used for this event and will not be shared outside the group.</li>
              <li>• The roster will be deleted/disabled after the event.</li>
              <li>• You may request correction or removal of your data at any time by contacting the organizers.</li>
            </ul>
            <p className="font-medium text-gray-800 mt-2">
              ✅ I consent to my name being displayed on the bus roster for this event.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
