const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const imageProcessor = require('../utils/imageProcessor');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deleteimage')
    .setDescription('Delete one of your uploaded images')
    .addIntegerOption(option =>
      option
        .setName('position')
        .setDescription('Position of the image to delete (1, 2, or 3)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(3)
    ),

  async execute(interaction) {
    const position = interaction.options.getInteger('position');
    const userId = interaction.user.id;

    try {
      await interaction.deferReply({ flags: 64 }); // 64 = MessageFlags.Ephemeral

      // Get user's images
      const userImages = await db.getUserImages(userId);
      
      if (userImages.length === 0) {
        await interaction.editReply({
          content: '❌ You don\'t have any images to delete.'
        });
        return;
      }

      // Check if position is valid
      if (position > userImages.length) {
        await interaction.editReply({
          content: `❌ You only have ${userImages.length} image(s). Please choose a position between 1 and ${userImages.length}.`
        });
        return;
      }

      // Get the image to delete (position is 1-indexed, array is 0-indexed)
      const imageToDelete = userImages[position - 1];
      
      // Delete from database
      const result = await db.deleteImage(imageToDelete.id, userId);
      
      if (result.changes > 0) {
        // No need to delete physical files - Discord CDN handles storage
        await interaction.editReply({
          content: `✅ Image at position ${position} deleted successfully!`
        });
      } else {
        await interaction.editReply({
          content: '❌ Failed to delete image. Please try again.'
        });
      }

    } catch (error) {
      console.error('Error in deleteimage command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while deleting your image. Please try again.'
      });
    }
  }
};
