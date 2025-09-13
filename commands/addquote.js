const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addquote')
    .setDescription('Add a status quote to your profile')
    .addStringOption(option =>
      option
        .setName('quote')
        .setDescription(`Your status quote (max ${config.maxQuoteLength} characters)`)
        .setRequired(true)
        .setMaxLength(config.maxQuoteLength)
        .setMinLength(1)
    ),

  async execute(interaction) {
    const quoteText = interaction.options.getString('quote');
    const userId = interaction.user.id;

    try {
      await interaction.deferReply({ flags: 64 }); // 64 = MessageFlags.Ephemeral

      // Ensure user exists in database
      await db.createUser(userId);

      // Check if user already has maximum quotes
      const currentQuoteCount = await db.getUserQuoteCount(userId);
      if (currentQuoteCount >= config.maxQuotes) {
        await interaction.editReply({
          content: `❌ You can only have up to ${config.maxQuotes} quotes. Delete an existing quote first using \`/deletequote\`.`
        });
        return;
      }

      // Add quote to database
      const result = await db.addQuote(userId, quoteText);
      
      if (result.changes > 0) {
        // Backup to Discord channel
        try {
          await db.backupToDiscord(interaction.client, userId);
        } catch (backupError) {
          console.log('Backup failed but quote was saved:', backupError);
        }

        await interaction.editReply({
          content: `✅ Quote added successfully! You now have ${currentQuoteCount + 1}/${config.maxQuotes} quotes.`
        });
      } else {
        throw new Error('Failed to save quote to database');
      }

    } catch (error) {
      console.error('Error in addquote command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while adding your quote. Please try again.'
      });
    }
  }
};
