const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

class ImageProcessor {
  constructor() {
    // No longer need local image directory - using Discord URLs!
  }


  async createRoundedRectangleImage(imageUrl, width, height, borderRadius = 20) {
    try {
      // Download image from URL and process it
      const imageBuffer = await this.downloadImage(imageUrl);
      const image = await Jimp.read(imageBuffer);
      
      // Create rounded rectangle mask
      const mask = new Jimp(width, height, 0x00000000);
      
      // Draw rounded rectangle mask
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          let inBounds = true;
          
          // Check corners for rounded effect
          if (x < borderRadius && y < borderRadius) {
            const distance = Math.sqrt(Math.pow(x - borderRadius, 2) + Math.pow(y - borderRadius, 2));
            inBounds = distance <= borderRadius;
          } else if (x > width - borderRadius && y < borderRadius) {
            const distance = Math.sqrt(Math.pow(x - (width - borderRadius), 2) + Math.pow(y - borderRadius, 2));
            inBounds = distance <= borderRadius;
          } else if (x < borderRadius && y > height - borderRadius) {
            const distance = Math.sqrt(Math.pow(x - borderRadius, 2) + Math.pow(y - (height - borderRadius), 2));
            inBounds = distance <= borderRadius;
          } else if (x > width - borderRadius && y > height - borderRadius) {
            const distance = Math.sqrt(Math.pow(x - (width - borderRadius), 2) + Math.pow(y - (height - borderRadius), 2));
            inBounds = distance <= borderRadius;
          }
          
          if (inBounds) {
            mask.setPixelColor(0xFFFFFFFF, x, y);
          }
        }
      }
      
      // Resize and crop the image, then apply rounded rectangle mask
      const processedImage = image
        .cover(width, height, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE)
        .mask(mask, 0, 0);
      
      return processedImage;
    } catch (error) {
      console.error('Error creating rounded rectangle image:', error);
      throw error;
    }
  }

  async downloadImage(url) {
    try {
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer;
    } catch (error) {
      console.error('Error downloading image:', error);
      throw error;
    }
  }

  // Now accepts imageUrl instead of imagePath
  async createInstagramCard(imageUrl, avatarUrl, username, likeCount, imageIndex = 1, totalImages = 1) {
    try {
      // Card dimensions - Instagram style with bigger image
      const cardWidth = 500;
      const cardHeight = 700;
      const headerHeight = 70;
      const footerHeight = 50;
      const imageHeight = cardHeight - headerHeight - footerHeight; // 580px tall image!
      const imageWidth = cardWidth - 20; // 480px wide image
      const avatarSize = 45;
      const padding = 10;
      
      // Create card background with soft red/pink color
      const card = new Jimp(cardWidth, cardHeight, 0xFFE8E8FF); // Light pink background
      
      // Load and create circular Discord avatar
      let avatar;
      try {
        // Try to get PNG version of Discord avatar (better compatibility)
        let actualAvatarUrl = avatarUrl;
        if (avatarUrl.includes('.webp')) {
          actualAvatarUrl = avatarUrl.replace('.webp', '.png');
        }
        
        console.log('Loading Discord avatar from:', actualAvatarUrl);
        const avatarBuffer = await this.downloadImage(actualAvatarUrl);
        const avatarImg = await Jimp.read(avatarBuffer);
        
        // Create circular avatar
        avatar = avatarImg.cover(avatarSize, avatarSize, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);
        
        // Apply circle mask
        avatar = avatar.circle();
        
      } catch (error) {
        console.log('Creating fallback avatar for user:', username);
        // Create a nice looking default circular avatar
        avatar = new Jimp(avatarSize, avatarSize, 0x667EEAFF); // Nice blue color
        
        // Make it circular
        avatar = avatar.circle();
        
        // Add user initial
        try {
          const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
          const initial = username?.charAt(0)?.toUpperCase() || '?';
          const textWidth = Jimp.measureText(font, initial);
          const textHeight = Jimp.measureTextHeight(font, initial);
          const x = (avatarSize - textWidth) / 2;
          const y = (avatarSize - textHeight) / 2;
          avatar.print(font, x, y, initial);
        } catch (fontError) {
          console.log('Font loading failed, using simple avatar');
        }
      }
      
      // Load main image directly from Discord URL (no local storage!)
      const processedMainImage = await this.createRoundedRectangleImage(imageUrl, imageWidth, imageHeight, 12);
      
      // Position elements
      const avatarX = padding;
      const avatarY = padding + 5;
      const usernameX = avatarX + avatarSize + 12;
      const usernameY = avatarY + 12;
      const imageX = padding;
      const imageY = headerHeight;
      const likesY = imageY + imageHeight + 8;
      const navigationY = likesY + 20;
      
      // Composite elements onto card
      card.composite(avatar, avatarX, avatarY);
      card.composite(processedMainImage, imageX, imageY);
      
      // Load fonts for text
      const usernameFont = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
      const likesFont = await Jimp.loadFont(Jimp.FONT_SANS_12_BLACK);
      const navigationFont = await Jimp.loadFont(Jimp.FONT_SANS_10_BLACK);
      
      // Add username
      card.print(usernameFont, usernameX, usernameY, username || 'Anonymous');
      
      // Draw heart using simple method and add likes text
      const heartX = padding;
      const likesTextX = heartX + 15;
      
      // Draw a simple filled rectangle as heart substitute (red square)
      for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
          card.setPixelColor(0xFF3366FF, heartX + x, likesY + y + 2);
        }
      }
      
      card.print(likesFont, likesTextX, likesY, `${likeCount} likes`);
      
      if (totalImages > 1) {
        card.print(navigationFont, padding, navigationY, `${imageIndex} of ${totalImages}`);
      }
      
      return card;
      
    } catch (error) {
      console.error('Error creating Instagram card:', error);
      throw error;
    }
  }

  // New method: Upload image to Discord database channel and return permanent URL
  async uploadToDiscordStorage(client, attachment, userId) {
    try {
      const config = require('../config');
      
      if (!config.databaseChannelId) {
        throw new Error('DATABASE_CHANNEL_ID not configured');
      }
      
      // Get the database channel
      const databaseChannel = await client.channels.fetch(config.databaseChannelId);
      
      if (!databaseChannel) {
        throw new Error('Database channel not found');
      }
      
      // Send image to database channel to get permanent Discord URL
      const message = await databaseChannel.send({
        content: `📷 Image uploaded by <@${userId}> - ${attachment.name}`,
        files: [attachment]
      });
      
      // Get the permanent Discord URL from the message
      const permanentUrl = message.attachments.first().url;
      
      return {
        imageUrl: permanentUrl,
        originalName: attachment.name,
        size: attachment.size,
        messageId: message.id
      };
      
    } catch (error) {
      console.error('Error uploading to Discord storage:', error);
      throw error;
    }
  }

  // Validate image without downloading
  validateImageAttachment(attachment) {
    const config = require('../config');
    
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

    return { isValid: true, error: null };
  }
}

module.exports = new ImageProcessor();
