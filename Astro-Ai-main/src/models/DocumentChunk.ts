import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDocumentChunk extends Document {
  id: string;
  userId: string;
  documentId: string;
  title: string;
  chunkIndex: number;
  totalChunks: number;
  content: string;
  tokenCount: number;
  embedding: number[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const DocumentChunkSchema = new Schema<IDocumentChunk>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required for multi-tenant isolation'],
      index: true,
      trim: true,
    },
    documentId: {
      type: String,
      required: [true, 'Document ID is required'],
      index: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    chunkIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    totalChunks: {
      type: Number,
      required: true,
      min: 1,
    },
    content: {
      type: String,
      required: [true, 'Chunk content is required'],
      trim: true,
    },
    tokenCount: {
      type: Number,
      default: 0,
    },
    embedding: {
      type: [Number],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for tenant-scoped document retrieval and efficient deletion
DocumentChunkSchema.index({ userId: 1, documentId: 1, chunkIndex: 1 });

const DocumentChunk: Model<IDocumentChunk> =
  mongoose.models.DocumentChunk || mongoose.model<IDocumentChunk>('DocumentChunk', DocumentChunkSchema);

export default DocumentChunk;
