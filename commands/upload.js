const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../utils/database');
const imageProcessor = require('../utils/imageProcessor');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('upload')
    .setDescription('Upload an image to your profile gallery')
    .addAttachmentOption(option =>
      option
        .setName('image')
        .setDescription('Image to upload (JPEG, PNG, GIF, WebP)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const attachment = interaction.options.getAttachment('image');
    const userId = interaction.user.id;

    try {
      await interaction.deferReply({ flags: 64 }); // 64 = MessageFlags.Ephemeral

      // Ensure user exists in database
      await db.createUser(userId);

      // Check if user already has maximum images
      const currentImageCount = await db.getUserImageCount(userId);
      if (currentImageCount >= config.maxImages) {
        await interaction.editReply({
          content: `❌ You can only upload up to ${config.maxImages} images. Delete an existing image first.`
        });
        return;
      }

      // Validate attachment
      const validation = imageProcessor.validateImageAttachment(attachment);
      if (!validation.isValid) {
        await interaction.editReply({
          content: `❌ ${validation.error}`
        });
        return;
      }

      // Upload to Discord storage and get permanent URL
      const uploadResult = await imageProcessor.uploadToDiscordStorage(interaction.client, attachment, userId);
      
      // Debug logging
      console.log(`📤 Upload result:`, {
        imageUrl: uploadResult.imageUrl,
        originalName: uploadResult.originalName,
        userId: userId
      });
      
      // Add to database with Discord URL
      const result = await db.addImage(userId, uploadResult.imageUrl, uploadResult.originalName);
      
      console.log(`📋 Database write result:`, result);

      if (result.changes > 0) {
        await interaction.editReply({
          content: `✅ Image uploaded successfully! You now have ${currentImageCount + 1}/${config.maxImages} images.`
        });
      } else {
        throw new Error('Failed to save image to database');
      }

    } catch (error) {
      console.error('Error in upload command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while uploading your image. Please make sure it\'s a valid image file and try again.'
      });
    }
  }
};
