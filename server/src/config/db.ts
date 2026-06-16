import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error('MONGO_URI is not defined');
    }

    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

  } catch (error: any) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    console.warn('SERVER CONTINUING WITHOUT DATABASE CONNECTION (Features will be limited)');
    // process.exit(1);
  }
};

export default connectDB;