const { Pool } = require('pg');
const config = require('../config');

class DatabaseManager {
  constructor() {
    // Use PostgreSQL for persistent storage on Render
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.initTables();
  }

  async query(text, params = []) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async initTables() {
    try {
      // Users table
      await this.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Images table
      await this.query(`
        CREATE TABLE IF NOT EXISTS images (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          filename TEXT NOT NULL,
          original_name TEXT,
          position INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Likes table
      await this.query(`
        CREATE TABLE IF NOT EXISTS likes (
          id SERIAL PRIMARY KEY,
          image_id INTEGER NOT NULL,
          user_id TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(image_id, user_id),
          FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Quotes table
      await this.query(`
        CREATE TABLE IF NOT EXISTS quotes (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          quote_text TEXT NOT NULL,
          position INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Create indexes for better performance
      await this.query('CREATE INDEX IF NOT EXISTS idx_images_user_id ON images (user_id)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_images_position ON images (user_id, position)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_likes_image_id ON likes (image_id)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes (user_id)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes (user_id)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_quotes_position ON quotes (user_id, position)');

      console.log('✅ PostgreSQL database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
    }
  }

  // User management methods
  async createUser(userId, username = null) {
    const result = await this.query(
      'INSERT INTO users (id, username) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
      [userId, username]
    );
    return { changes: result.rowCount };
  }

  async getUserById(userId) {
    const result = await this.query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0];
  }

  async getUserByUsername(username) {
    const result = await this.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    return result.rows[0];
  }

  async setUsername(userId, username) {
    const result = await this.query(
      'INSERT INTO users (id, username, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (id) DO UPDATE SET username = $2, updated_at = CURRENT_TIMESTAMP',
      [userId, username]
    );
    return { changes: result.rowCount };
  }

  // Image management methods
  async addImage(userId, imageUrl, originalName, position = null) {
    if (position === null) {
      const maxPosResult = await this.query('SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM images WHERE user_id = $1', [userId]);
      position = maxPosResult.rows[0] ? maxPosResult.rows[0].next_pos : 0;
    }
    
    const result = await this.query(
      'INSERT INTO images (user_id, filename, original_name, position) VALUES ($1, $2, $3, $4)',
      [userId, imageUrl, originalName, position]
    );
    return { changes: result.rowCount, lastID: result.rows[0]?.id };
  }

  async getUserImages(userId) {
    const result = await this.query(`
      SELECT i.*, 
             COUNT(l.id) as like_count
      FROM images i
      LEFT JOIN likes l ON i.id = l.image_id
      WHERE i.user_id = $1
      GROUP BY i.id
      ORDER BY i.position ASC
    `, [userId]);
    return result.rows;
  }

  async getImageById(imageId) {
    const result = await this.query(`
      SELECT i.*, 
             COUNT(l.id) as like_count
      FROM images i
      LEFT JOIN likes l ON i.id = l.image_id
      WHERE i.id = $1
      GROUP BY i.id
    `, [imageId]);
    return result.rows[0];
  }

  async deleteImage(imageId, userId) {
    const result = await this.query('DELETE FROM images WHERE id = $1 AND user_id = $2', [imageId, userId]);
    return { changes: result.rowCount };
  }

  async reorderImages(userId, imageOrders) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const { imageId, position } of imageOrders) {
        await client.query('UPDATE images SET position = $1 WHERE id = $2 AND user_id = $3', [position, imageId, userId]);
      }
      
      await client.query('COMMIT');
      return { changes: imageOrders.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Like management methods
  async likeImage(imageId, userId) {
    const result = await this.query(
      'INSERT INTO likes (image_id, user_id) VALUES ($1, $2) ON CONFLICT (image_id, user_id) DO NOTHING',
      [imageId, userId]
    );
    return { changes: result.rowCount };
  }

  async unlikeImage(imageId, userId) {
    const result = await this.query('DELETE FROM likes WHERE image_id = $1 AND user_id = $2', [imageId, userId]);
    return { changes: result.rowCount };
  }

  async hasUserLikedImage(imageId, userId) {
    const result = await this.query('SELECT id FROM likes WHERE image_id = $1 AND user_id = $2', [imageId, userId]);
    return result.rows.length > 0;
  }

  async getImageLikeCount(imageId) {
    const result = await this.query('SELECT COUNT(*) as count FROM likes WHERE image_id = $1', [imageId]);
    return result.rows[0] ? parseInt(result.rows[0].count) : 0;
  }

  // Quote management methods
  async addQuote(userId, quoteText, position = null) {
    if (position === null) {
      const maxPosResult = await this.query('SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM quotes WHERE user_id = $1', [userId]);
      position = maxPosResult.rows[0] ? maxPosResult.rows[0].next_pos : 0;
    }
    
    const result = await this.query(
      'INSERT INTO quotes (user_id, quote_text, position) VALUES ($1, $2, $3)',
      [userId, quoteText, position]
    );
    return { changes: result.rowCount };
  }

  async getUserQuotes(userId) {
    const result = await this.query(`
      SELECT * FROM quotes 
      WHERE user_id = $1
      ORDER BY position ASC
    `, [userId]);
    return result.rows;
  }

  async getQuoteById(quoteId) {
    const result = await this.query('SELECT * FROM quotes WHERE id = $1', [quoteId]);
    return result.rows[0];
  }

  async deleteQuote(quoteId, userId) {
    const result = await this.query('DELETE FROM quotes WHERE id = $1 AND user_id = $2', [quoteId, userId]);
    return { changes: result.rowCount };
  }

  async reorderQuotes(userId, quoteOrders) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const { quoteId, position } of quoteOrders) {
        await client.query('UPDATE quotes SET position = $1 WHERE id = $2 AND user_id = $3', [position, quoteId, userId]);
      }
      
      await client.query('COMMIT');
      return { changes: quoteOrders.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserQuoteCount(userId) {
    const result = await this.query('SELECT COUNT(*) as count FROM quotes WHERE user_id = $1', [userId]);
    return result.rows[0] ? parseInt(result.rows[0].count) : 0;
  }

  // Utility methods
  async getUserImageCount(userId) {
    const result = await this.query('SELECT COUNT(*) as count FROM images WHERE user_id = $1', [userId]);
    return result.rows[0] ? parseInt(result.rows[0].count) : 0;
  }

  // Backup methods - store usernames and quotes to Discord
  async backupToDiscord(client, userId) {
    try {
      if (!config.databaseChannelId) return;
      
      const databaseChannel = await client.channels.fetch(config.databaseChannelId);
      if (!databaseChannel) return;
      
      const user = await this.getUserById(userId);
      const quotes = await this.getUserQuotes(userId);
      
      if (user || quotes.length > 0) {
        const backupData = {
          userId,
          username: user?.username || null,
          quotes: quotes.map(q => ({ text: q.quote_text, position: q.position })),
          timestamp: new Date().toISOString()
        };
        
        await databaseChannel.send({
          content: `🔒 **Backup Data** for <@${userId}>\n\`\`\`json\n${JSON.stringify(backupData, null, 2)}\n\`\`\``
        });
      }
    } catch (error) {
      console.error('Error backing up to Discord:', error);
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = new DatabaseManager();
