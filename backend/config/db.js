const mongoose = require('mongoose');

const connectDB = async () => {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGO_URI (or MONGODB_URI) environment variable is not set');
    }
    await mongoose.connect(uri);
    console.log('MongoDB connected');
};

module.exports = connectDB;
