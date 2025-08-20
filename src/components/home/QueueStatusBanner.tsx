'use client'

import { Users } from 'lucide-react'
import Link from 'next/link'

export function QueueStatusBanner() {
  return (
    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-blue-600" />
          <div>
            <span className="text-sm text-blue-800 font-medium">Queue Status</span>
            <p className="text-xs text-blue-600">Only top 20 can book buses</p>
          </div>
        </div>
        <Link href="/queue" className="text-sm text-blue-600 hover:underline">
          View Queue →
        </Link>
      </div>
    </div>
  )
}
