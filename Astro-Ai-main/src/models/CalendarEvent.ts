import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICalendarEvent extends Document {
  id: string;
  userId: string;
  title: string;
  date: Date;
  type: 'Lesson' | 'Deadline' | 'Event' | 'Holiday';
  description?: string;
  legacyId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CalendarEventSchema = new Schema<ICalendarEvent>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
      default: Date.now,
    },
    type: {
      type: String,
      required: [true, 'Event type is required'],
      enum: {
        values: ['Lesson', 'Deadline', 'Event', 'Holiday'],
        message: '{VALUE} is not a valid event type',
      },
      default: 'Event',
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
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

CalendarEventSchema.index({ userId: 1, date: 1 });
CalendarEventSchema.index({ userId: 1, type: 1 });

const CalendarEvent: Model<ICalendarEvent> =
  mongoose.models.CalendarEvent || mongoose.model<ICalendarEvent>('CalendarEvent', CalendarEventSchema);

export default CalendarEvent;
