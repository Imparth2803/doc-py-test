// googleId
// email
// name
// picture
// createdAt
// updatedAt

import mongoose, {
  Schema,
  Document as MongooseDocument,
} from "mongoose";

export interface IUser
  extends MongooseDocument {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  role?: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  usage?: {
    totalAiUnits: number;
    totalProcessingRuns: number;
  };
}

const UserSchema = new Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
    },

    picture: {
      type: String,
    },

    role: {
      type: String,
      default: "user",
    },

    googleAccessToken: {
      type: String,
    },

    googleRefreshToken: {
      type: String,
    },
    usage: {
      totalAiUnits: {
        type: Number,
        default: 0,
      },
      totalProcessingRuns: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IUser>(
  "User",
  UserSchema
);