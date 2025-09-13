const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reorder')
    .setDescription('Reorder your uploaded images')
    .addIntegerOption(option =>
      option
        .setName('from')
        .setDescription('Current position of the image (1, 2, or 3)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(3)
    )
    .addIntegerOption(option =>
      option
        .setName('to')
        .setDescription('New position for the image (1, 2, or 3)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(3)
    ),

  async execute(interaction) {
    const fromPosition = interaction.options.getInteger('from');
    const toPosition = interaction.options.getInteger('to');
    const userId = interaction.user.id;

    try {
      await interaction.deferReply({ ephemeral: true });

      // Get user's images
      const userImages = await db.getUserImages(userId);
      
      if (userImages.length === 0) {
        await interaction.editReply({
          content: '❌ You don\'t have any images to reorder.'
        });
        return;
      }

      // Validate positions
      if (fromPosition > userImages.length || toPosition > userImages.length) {
        await interaction.editReply({
          content: `❌ Invalid position. You only have ${userImages.length} image(s).`
        });
        return;
      }

      if (fromPosition === toPosition) {
        await interaction.editReply({
          content: '❌ Source and destination positions cannot be the same.'
        });
        return;
      }

      // Create new order array
      const newOrder = [...userImages];
      const [movedImage] = newOrder.splice(fromPosition - 1, 1); // Remove from original position
      newOrder.splice(toPosition - 1, 0, movedImage); // Insert at new position

      // Create update array for database
      const imageOrders = newOrder.map((image, index) => ({
        imageId: image.id,
        position: index
      }));

      // Update database
      await db.reorderImages(userId, imageOrders);

      await interaction.editReply({
        content: `✅ Image moved from position ${fromPosition} to position ${toPosition}!`
      });

    } catch (error) {
      console.error('Error in reorder command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while reordering your images. Please try again.'
      });
    }
  }
};
