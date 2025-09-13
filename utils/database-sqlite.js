const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');

class DatabaseManager {
  constructor() {
    // Ensure database directory exists
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new sqlite3.Database(config.dbPath);
    this.initTables();
  }

  // Promisify database methods
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes, lastID: this.lastID });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async initTables() {
    try {
      // Users table
      await this.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Images table
      await this.run(`
        CREATE TABLE IF NOT EXISTS images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          filename TEXT NOT NULL,
          original_name TEXT,
          position INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Likes table
      await this.run(`
        CREATE TABLE IF NOT EXISTS likes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          image_id INTEGER NOT NULL,
          user_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(image_id, user_id),
          FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Quotes table
      await this.run(`
        CREATE TABLE IF NOT EXISTS quotes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          quote_text TEXT NOT NULL,
          position INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Create indexes for better performance
      await this.run('CREATE INDEX IF NOT EXISTS idx_images_user_id ON images (user_id)');
      await this.run('CREATE INDEX IF NOT EXISTS idx_images_position ON images (user_id, position)');
      await this.run('CREATE INDEX IF NOT EXISTS idx_likes_image_id ON likes (image_id)');
      await this.run('CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes (user_id)');
      await this.run('CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes (user_id)');
      await this.run('CREATE INDEX IF NOT EXISTS idx_quotes_position ON quotes (user_id, position)');

      console.log('✅ SQLite database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
    }
  }

  // User management methods
  async createUser(userId, username = null) {
    return await this.run(
      'INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)',
      [userId, username]
    );
  }

  async getUserById(userId) {
    return await this.get('SELECT * FROM users WHERE id = ?', [userId]);
  }

  async getUserByUsername(username) {
    return await this.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [username]);
  }

  async setUsername(userId, username) {
    return await this.run(
      'INSERT OR REPLACE INTO users (id, username, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [userId, username]
    );
  }

  // Image management methods
  async addImage(userId, imageUrl, originalName, position = null) {
    if (position === null) {
      const maxPos = await this.get('SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM images WHERE user_id = ?', [userId]);
      position = maxPos ? maxPos.next_pos : 0;
    }
    
    return await this.run(
      'INSERT INTO images (user_id, filename, original_name, position) VALUES (?, ?, ?, ?)',
      [userId, imageUrl, originalName, position]
    );
  }

  async getUserImages(userId) {
    return await this.all(`
      SELECT i.*, 
             COUNT(l.id) as like_count
      FROM images i
      LEFT JOIN likes l ON i.id = l.image_id
      WHERE i.user_id = ?
      GROUP BY i.id
      ORDER BY i.position ASC
    `, [userId]);
  }

  async getImageById(imageId) {
    return await this.get(`
      SELECT i.*, 
             COUNT(l.id) as like_count
      FROM images i
      LEFT JOIN likes l ON i.id = l.image_id
      WHERE i.id = ?
      GROUP BY i.id
    `, [imageId]);
  }

  async deleteImage(imageId, userId) {
    return await this.run('DELETE FROM images WHERE id = ? AND user_id = ?', [imageId, userId]);
  }

  async reorderImages(userId, imageOrders) {
    const promises = imageOrders.map(({ imageId, position }) =>
      this.run('UPDATE images SET position = ? WHERE id = ? AND user_id = ?', [position, imageId, userId])
    );
    return await Promise.all(promises);
  }

  // Like management methods
  async likeImage(imageId, userId) {
    return await this.run(
      'INSERT OR IGNORE INTO likes (image_id, user_id) VALUES (?, ?)',
      [imageId, userId]
    );
  }

  async unlikeImage(imageId, userId) {
    return await this.run('DELETE FROM likes WHERE image_id = ? AND user_id = ?', [imageId, userId]);
  }

  async hasUserLikedImage(imageId, userId) {
    const result = await this.get('SELECT id FROM likes WHERE image_id = ? AND user_id = ?', [imageId, userId]);
    return !!result;
  }

  async getImageLikeCount(imageId) {
    const result = await this.get('SELECT COUNT(*) as count FROM likes WHERE image_id = ?', [imageId]);
    return result ? result.count : 0;
  }

  // Quote management methods
  async addQuote(userId, quoteText, position = null) {
    if (position === null) {
      const maxPos = await this.get('SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM quotes WHERE user_id = ?', [userId]);
      position = maxPos ? maxPos.next_pos : 0;
    }
    
    return await this.run(
      'INSERT INTO quotes (user_id, quote_text, position) VALUES (?, ?, ?)',
      [userId, quoteText, position]
    );
  }

  async getUserQuotes(userId) {
    return await this.all(`
      SELECT * FROM quotes 
      WHERE user_id = ?
      ORDER BY position ASC
    `, [userId]);
  }

  async getQuoteById(quoteId) {
    return await this.get('SELECT * FROM quotes WHERE id = ?', [quoteId]);
  }

  async deleteQuote(quoteId, userId) {
    return await this.run('DELETE FROM quotes WHERE id = ? AND user_id = ?', [quoteId, userId]);
  }

  async reorderQuotes(userId, quoteOrders) {
    const promises = quoteOrders.map(({ quoteId, position }) =>
      this.run('UPDATE quotes SET position = ? WHERE id = ? AND user_id = ?', [position, quoteId, userId])
    );
    return await Promise.all(promises);
  }

  async getUserQuoteCount(userId) {
    const result = await this.get('SELECT COUNT(*) as count FROM quotes WHERE user_id = ?', [userId]);
    return result ? result.count : 0;
  }

  // Utility methods
  async getUserImageCount(userId) {
    const result = await this.get('SELECT COUNT(*) as count FROM images WHERE user_id = ?', [userId]);
    return result ? result.count : 0;
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

  close() {
    this.db.close();
  }
}

module.exports = new DatabaseManager();
