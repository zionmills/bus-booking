import { useState, useEffect } from 'react'

export function useMobileDetection() {
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === 'undefined') return false
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    }
    
    setIsMobile(checkMobile())
  }, [])
  
  return isMobile
}
