const config = require('../config');

/**
 * Validates username format (English letters only)
 * @param {string} username 
 * @returns {boolean}
 */
function isValidUsername(username) {
  const usernameRegex = /^[a-zA-Z]+$/;
  return usernameRegex.test(username);
}

/**
 * Validates image file
 * @param {Object} attachment - Discord attachment object
 * @returns {Object} - { isValid: boolean, error: string|null }
 */
function validateImageFile(attachment) {
  // Check file size
  if (attachment.size > config.maxFileSize) {
    return {
      isValid: false,
      error: `File too large! Maximum size is ${config.maxFileSize / (1024 * 1024)}MB.`
    };
  }

  // Check file type
  if (!config.allowedImageTypes.includes(attachment.contentType)) {
    return {
      isValid: false,
      error: 'Invalid file type! Please upload a JPEG, PNG, GIF, or WebP image.'
    };
  }

  // Check for null/undefined
  if (!attachment.url || !attachment.name) {
    return {
      isValid: false,
      error: 'Invalid attachment. Please try uploading again.'
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validates position parameter for image operations
 * @param {number} position 
 * @param {number} maxPosition 
 * @returns {Object}
 */
function validateImagePosition(position, maxPosition) {
  if (position < 1 || position > maxPosition) {
    return {
      isValid: false,
      error: `Invalid position. Please choose a number between 1 and ${maxPosition}.`
    };
  }

  return { isValid: true, error: null };
}

/**
 * Sanitizes filename for storage
 * @param {string} filename 
 * @returns {string}
 */
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

/**
 * Formats file size for display
 * @param {number} bytes 
 * @returns {string}
 */
function formatFileSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Byte';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Generates a safe error message for users
 * @param {Error} error 
 * @returns {string}
 */
function getPublicErrorMessage(error) {
  // Log the full error for debugging
  console.error('Full error:', error);
  
  // Return generic message to users for security
  return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
}

/**
 * Validates user permissions for image operations
 * @param {string} userId 
 * @param {Object} imageData 
 * @returns {boolean}
 */
function canUserModifyImage(userId, imageData) {
  return imageData && imageData.user_id === userId;
}

/**
 * Rate limiting utility (simple in-memory implementation)
 */
class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) { // 10 requests per minute by default
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(userId) {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(timestamp => now - timestamp < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(userId, validRequests);
    
    return true;
  }

  getRemainingRequests(userId) {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    const validRequests = userRequests.filter(timestamp => now - timestamp < this.windowMs);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

// Create rate limiter instances for different operations
const uploadRateLimit = new RateLimiter(3, 300000); // 3 uploads per 5 minutes
const generalRateLimit = new RateLimiter(20, 60000); // 20 general commands per minute

module.exports = {
  isValidUsername,
  validateImageFile,
  validateImagePosition,
  sanitizeFilename,
  formatFileSize,
  getPublicErrorMessage,
  canUserModifyImage,
  uploadRateLimit,
  generalRateLimit
};
