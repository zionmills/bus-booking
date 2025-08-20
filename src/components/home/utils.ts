// QR Code sanitizer function
export const sanitizeQRCode = (qrCode: string | undefined): string => {
  if (!qrCode) return ''
  
  // Only strip control characters (0x00-0x1F and 0x7F)
  // Allow RFC3986 character set plus base64 characters (+, /, =) and common URL query characters
  let sanitized = qrCode
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters only
    .trim()
  
  // Optional: enforce a very large maximum length guard to protect against pathological inputs
  // This is much more permissive than the previous 100 char limit
  const MAX_LENGTH = 10000 // 10KB should be more than enough for any reasonable QR code
  if (sanitized.length > MAX_LENGTH) {
    console.warn(`QR code payload exceeds maximum length (${sanitized.length} > ${MAX_LENGTH}), truncating`)
    sanitized = sanitized.substring(0, MAX_LENGTH)
  }
  
  return sanitized
}

// Display helper function for UI truncation (separate from sanitization)
export const truncateForDisplay = (text: string, maxLength: number = 100): string => {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}
