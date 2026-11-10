import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClassRecording extends Document {
  id: string;
  userId: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
  legacyId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClassRecordingSchema = new Schema<IClassRecording>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Recording title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    videoUrl: {
      type: String,
      required: [true, 'Video URL is required'],
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      default: '',
      trim: true,
    },
    duration: {
      type: String,
      default: '0:00',
      trim: true,
    },
    legacyId: {
      type: String,
      index: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret: any) {
        ret.id = ret.legacyId || ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (_doc, ret: any) {
        ret.id = ret.legacyId || ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

ClassRecordingSchema.index({ userId: 1, createdAt: -1 });

const ClassRecording: Model<IClassRecording> =
  mongoose.models.ClassRecording || mongoose.model<IClassRecording>('ClassRecording', ClassRecordingSchema);

export default ClassRecording;
