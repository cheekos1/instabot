require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  databaseChannelId: process.env.DATABASE_CHANNEL_ID,
  port: process.env.PORT || 8888,
  maxImages: 3,
  maxQuotes: 3,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  maxFileSize: 8 * 1024 * 1024, // 8MB
  maxQuoteLength: 200, // Maximum characters per quote
  dbPath: './database/instabot.db',
  // PostgreSQL connection (for persistent storage on Render)
  databaseUrl: process.env.DATABASE_URL,
  usePostgres: !!process.env.DATABASE_URL // Automatically use PostgreSQL if DATABASE_URL is set
};
