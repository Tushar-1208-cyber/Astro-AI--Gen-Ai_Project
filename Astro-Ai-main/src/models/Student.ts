import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStudent extends Document {
  id: string;
  userId: string;
  name: string;
  photoUrl: string;
  photoDataUri?: string;
  legacyId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
      minlength: [1, 'Name cannot be empty'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    photoUrl: {
      type: String,
      default: '',
      trim: true,
    },
    photoDataUri: {
      type: String,
      default: '',
      trim: true,
    },
    legacyId: {
      type: String,
      index: true,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret: any) {
        ret.id = ret.legacyId || ret._id.toString();
        // Fallback photoDataUri to photoUrl if photoDataUri is empty
        if (!ret.photoDataUri && ret.photoUrl) {
          ret.photoDataUri = ret.photoUrl;
        }
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (_doc, ret: any) {
        ret.id = ret.legacyId || ret._id.toString();
        if (!ret.photoDataUri && ret.photoUrl) {
          ret.photoDataUri = ret.photoUrl;
        }
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for optimal query performance
StudentSchema.index({ userId: 1, name: 1 });
StudentSchema.index({ userId: 1, createdAt: -1 });

const Student: Model<IStudent> =
  mongoose.models.Student || mongoose.model<IStudent>('Student', StudentSchema);

export default Student;
