const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deletequote')
    .setDescription('Delete one of your status quotes')
    .addIntegerOption(option =>
      option
        .setName('position')
        .setDescription('Position of the quote to delete (1, 2, or 3)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(3)
    ),

  async execute(interaction) {
    const position = interaction.options.getInteger('position');
    const userId = interaction.user.id;

    try {
      await interaction.deferReply({ flags: 64 }); // 64 = MessageFlags.Ephemeral

      // Get user's quotes
      const userQuotes = await db.getUserQuotes(userId);
      
      if (userQuotes.length === 0) {
        await interaction.editReply({
          content: '❌ You don\'t have any quotes to delete.'
        });
        return;
      }

      // Check if position is valid
      if (position > userQuotes.length) {
        await interaction.editReply({
          content: `❌ You only have ${userQuotes.length} quote(s). Please choose a position between 1 and ${userQuotes.length}.`
        });
        return;
      }

      // Get the quote to delete (position is 1-indexed, array is 0-indexed)
      const quoteToDelete = userQuotes[position - 1];
      
      // Delete from database
      const result = await db.deleteQuote(quoteToDelete.id, userId);
      
      if (result.changes > 0) {
        // Backup updated data to Discord channel
        try {
          await db.backupToDiscord(interaction.client, userId);
        } catch (backupError) {
          console.log('Backup failed but quote was deleted:', backupError);
        }

        await interaction.editReply({
          content: `✅ Quote at position ${position} deleted successfully!`
        });
      } else {
        await interaction.editReply({
          content: '❌ Failed to delete quote. Please try again.'
        });
      }

    } catch (error) {
      console.error('Error in deletequote command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while deleting your quote. Please try again.'
      });
    }
  }
};
