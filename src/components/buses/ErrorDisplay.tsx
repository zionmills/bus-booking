import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'

interface ErrorDisplayProps {
  error: string | null
  onRetry: () => void
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  if (!error) return null

  return (
    <Card className="mb-8 border-red-200 bg-red-50">
      <CardContent className="pt-6">
        <div className="flex items-center space-x-3">
          <XCircle className="w-6 h-6 text-red-600" />
          <div>
            <p className="font-semibold text-red-800">Error Loading Buses</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
          >
            Retry
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
