import mongoose from 'mongoose';
import { env } from '$env/dynamic/private';

const connectDB = async () => {
	if (mongoose.connection.readyState >= 1) return;
	return mongoose.connect(env.DB_URL!);
};

export default connectDB;
