const path = require('path');

module.exports = {
    PORT: process.env.PORT || process.env.BACKEND_PORT,
    MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
    ML_SERVICE_URL: process.env.ML_SERVICE_URL,
    PYTHON_BIN: process.env.PYTHON_BIN,
    ARTIFACTS_DIR:
        process.env.ARTIFACTS_DIR ||
        path.resolve(__dirname, '../artifacts'),
    AUTO_TRAIN_ON_INGEST:
        String(process.env.AUTO_TRAIN_ON_INGEST || 'true').toLowerCase() !== 'false',
    DATA_DIR:
        process.env.DATA_DIR ||
        path.resolve(__dirname, '../data/fedex_dca_synthetic_dataset'),
    SEED_USERS: process.env.SEED_USERS,
};
