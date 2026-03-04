module.exports = {
    PORT: process.env.PORT,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    ML_SERVICE_URL: process.env.ML_SERVICE_URL,
    DATA_DIR: process.env.DATA_DIR,
    SEED_USERS: process.env.SEED_USERS,
};
