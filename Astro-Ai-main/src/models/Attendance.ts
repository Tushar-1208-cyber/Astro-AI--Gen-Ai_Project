import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAttendance extends Document {
  id: string;
  userId: string;
  date: Date;
  presentStudents: string[];
  photoUrl?: string;
  photoDataUri?: string;
  legacyId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Attendance date is required'],
      default: Date.now,
    },
    presentStudents: {
      type: [String],
      default: [],
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
  },
  {
    timestamps: true,
    toJSON: {
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

AttendanceSchema.index({ userId: 1, date: -1 });

const Attendance: Model<IAttendance> =
  mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);

export default Attendance;
