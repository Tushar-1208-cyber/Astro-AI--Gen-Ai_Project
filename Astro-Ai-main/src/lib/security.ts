import { NextRequest, NextResponse } from 'next/server';

/**
 * Extracts client IP from request headers across various reverse proxies / CDNs
 */
export function getClientIp(req: Request | NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/**
 * Validates request Origin and Referer headers against the host header for state-changing requests (CSRF protection)
 */
export function validateSameOrigin(req: Request | NextRequest): boolean {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');

  if (!host) return true;

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      return refererHost === host;
    } catch {
      return false;
    }
  }

  // Same-origin navigation or server action internal call
  return true;
}

/**
 * Standard secure JSON error response
 */
export function securityErrorResponse(message: string, status: number = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Sanitizes error messages before returning them to client/frontend
 * Strips internal IP addresses, ports, URLs, API keys, tokens, and server paths
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return "An unknown error occurred.";
  let message = error instanceof Error ? error.message : String(error);

  // 1. Scrub Google API keys (AIza...)
  message = message.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');

  // 2. Scrub JWT tokens (eyJ...)
  message = message.replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_TOKEN]');

  // 3. Scrub MongoDB URIs with credentials
  message = message.replace(/mongodb(\+srv)?:\/\/[^\s@]+@[^\s/]+/g, 'mongodb://[REDACTED]');

  // 4. Scrub internal localhost / loopback endpoints
  message = message.replace(/https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/[^\s]*)?/gi, '[INTERNAL_ENDPOINT]');

  // 5. Scrub raw external cloud API URLs
  message = message.replace(/https:\/\/generativelanguage\.googleapis\.com[^\s]*/gi, '[CLOUD_API_ENDPOINT]');

  // 6. Scrub local file system paths (Windows C:\ or Unix /...)
  message = message.replace(/([A-Za-z]:\\[^:\n\r]+|\/(?:home|usr|etc|var|app)\/[^\s]+)/g, '[INTERNAL_PATH]');

  // 7. Strip stack traces (take only the first line of message)
  const firstNewline = message.indexOf('\n');
  if (firstNewline !== -1) {
    message = message.substring(0, firstNewline).trim();
  }

  return message.trim() || "An unexpected error occurred.";
}

