const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = './database/instabot.db';

console.log('📝 Checking database for stored images...\n');

const db = new sqlite3.Database(dbPath);

// Check if database exists and has data
db.serialize(() => {
  // Get user count
  db.get("SELECT COUNT(*) as user_count FROM users", (err, result) => {
    if (err) {
      console.error('❌ Error querying users:', err);
      return;
    }
    console.log(`👥 Total users: ${result.user_count}`);
  });

  // Get image count
  db.get("SELECT COUNT(*) as image_count FROM images", (err, result) => {
    if (err) {
      console.error('❌ Error querying images:', err);
      return;
    }
    console.log(`📷 Total images: ${result.image_count}`);
  });

  // Get all images with details
  db.all("SELECT id, user_id, filename, original_name, created_at FROM images ORDER BY created_at DESC LIMIT 10", (err, rows) => {
    if (err) {
      console.error('❌ Error querying image details:', err);
      return;
    }
    
    if (rows.length === 0) {
      console.log('\n📭 No images found in database');
    } else {
      console.log('\n📸 Recent images:');
      rows.forEach((row, index) => {
        console.log(`${index + 1}. Image ID: ${row.id}`);
        console.log(`   User: ${row.user_id}`);
        console.log(`   Original name: ${row.original_name}`);
        console.log(`   Stored URL/filename: ${row.filename}`);
        console.log(`   Created: ${row.created_at}`);
        
        // Check if this looks like a Discord URL
        if (row.filename && row.filename.includes('discord')) {
          console.log('   ✅ Appears to be Discord URL');
        } else {
          console.log('   ⚠️  Not a Discord URL - this might be the problem!');
        }
        console.log('');
      });
    }
    
    db.close();
  });
});
