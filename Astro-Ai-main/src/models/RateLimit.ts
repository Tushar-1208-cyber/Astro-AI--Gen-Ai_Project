import mongoose from 'mongoose';

const RateLimitSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
  },
  count: {
    type: Number,
    required: true,
    default: 0,
  },
  windowStart: {
    type: Date,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

// Unique index to guarantee atomic serialization and prevent duplicate buckets
RateLimitSchema.index({ key: 1 }, { unique: true });

// Auto-expire documents using MongoDB TTL index
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.RateLimit || mongoose.model('RateLimit', RateLimitSchema);
