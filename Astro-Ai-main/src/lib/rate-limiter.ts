import dbConnect from './db';
import RateLimit from '@/models/RateLimit';

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number; // timestamp in ms when window resets
  limit: number;
}

/**
 * MongoDB-backed atomic sliding window rate limiter suitable for clustered/multi-instance deployments.
 * Uses atomic findOneAndUpdate with $inc on unique bucket keys.
 * Safely recovers from first-time bucket creation race conditions (E11000).
 * Automatically purges expired buckets via MongoDB TTL indexes.
 */
export async function checkRateLimit(
  key: string,
  limit: number = 5,
  windowSeconds: number = 900 // default 15 minutes
): Promise<RateLimitResult> {
  const now = new Date();
  const windowMs = windowSeconds * 1000;
  // Deterministic window partitioning into atomic buckets
  const windowIndex = Math.floor(now.getTime() / windowMs);
  const windowStartMs = windowIndex * windowMs;
  const resetTime = windowStartMs + windowMs;
  const expiresAt = new Date(resetTime + windowMs);

  const bucketKey = `${key}:${windowIndex}`;

  try {
    await dbConnect();
    // Ensure schema indexes (including unique index on key) are initialized
    await RateLimit.init();

    let record: any;
    try {
      record = await RateLimit.findOneAndUpdate(
        { key: bucketKey },
        {
          $inc: { count: 1 },
          $setOnInsert: {
            key: bucketKey,
            windowStart: new Date(windowStartMs),
            expiresAt,
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
        }
      );
    } catch (upsertError: any) {
      // Handle race condition during first-time bucket creation across concurrent workers (E11000)
      if (upsertError.code === 11000 || upsertError.message?.includes('E11000')) {
        record = await RateLimit.findOneAndUpdate(
          { key: bucketKey },
          { $inc: { count: 1 } },
          { returnDocument: 'after' }
        );
      } else {
        throw upsertError;
      }
    }

    const currentCount = record ? record.count : limit + 1;
    if (currentCount > limit) {
      return {
        success: false,
        remaining: 0,
        resetTime,
        limit,
      };
    }

    return {
      success: true,
      remaining: Math.max(0, limit - currentCount),
      resetTime,
      limit,
    };
  } catch (error) {
    console.error('[RateLimiter] Database error during rate limiting:', error);
    // Secure failure mode: Fail closed to prevent bypass during database outages
    return {
      success: false,
      remaining: 0,
      resetTime: Date.now() + windowMs,
      limit,
    };
  }
}
