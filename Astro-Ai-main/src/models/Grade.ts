import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGrade extends Document {
  id: string;
  userId: string;
  studentName: string;
  studentId?: string;
  subject: string;
  grade: number;
  className: string;
  date: Date;
  legacyId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GradeSchema = new Schema<IGrade>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
      trim: true,
    },
    studentName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
      minlength: [1, 'Student name cannot be empty'],
      maxlength: [100, 'Student name cannot exceed 100 characters'],
    },
    studentId: {
      type: String,
      index: true,
      trim: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      minlength: [1, 'Subject cannot be empty'],
      maxlength: [100, 'Subject cannot exceed 100 characters'],
    },
    grade: {
      type: Number,
      required: [true, 'Grade score is required'],
      min: [0, 'Grade cannot be negative'],
      max: [100, 'Grade cannot exceed 100'],
    },
    className: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
      minlength: [1, 'Class name cannot be empty'],
      maxlength: [50, 'Class name cannot exceed 50 characters'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
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

// Compound indexes for optimal querying, sorting, and reporting
GradeSchema.index({ userId: 1, className: 1, subject: 1 });
GradeSchema.index({ userId: 1, studentName: 1 });
GradeSchema.index({ userId: 1, date: -1 });

const Grade: Model<IGrade> =
  mongoose.models.Grade || mongoose.model<IGrade>('Grade', GradeSchema);

export default Grade;
