// QR Code sanitizer function
export const sanitizeQRCode = (qrCode: string | undefined): string => {
  if (!qrCode) return ''
  
  // Remove HTML tags and decode HTML entities
  let sanitized = qrCode
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Replace HTML entities with spaces
    .trim()
  
  // Enforce max length
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100)
  }
  
  // Only allow alphanumeric, hyphens, underscores, and common URL-safe characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9\-_./:?=&%#]/g, '')
  
  return sanitized
}
