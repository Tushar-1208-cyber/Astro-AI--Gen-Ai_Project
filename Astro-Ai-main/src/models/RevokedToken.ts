import mongoose from 'mongoose';

const RevokedTokenSchema = new mongoose.Schema({
  jti: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  revokedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

// Auto-expire revocation records via MongoDB TTL index when the token's original expiration is reached
RevokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.RevokedToken || mongoose.model('RevokedToken', RevokedTokenSchema);
