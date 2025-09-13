const config = require('../config');

// Smart database loader - automatically chooses PostgreSQL or SQLite
function loadDatabase() {
  if (config.usePostgres) {
    console.log('🐘 Using PostgreSQL for persistent storage');
    return require('./database-postgres');
  } else {
    console.log('📁 Using SQLite for local storage');
    return require('./database-sqlite');
  }
}

module.exports = loadDatabase();
