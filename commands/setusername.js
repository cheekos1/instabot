const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setusername')
    .setDescription('Set your Instagram-style username')
    .addStringOption(option =>
      option
        .setName('username')
        .setDescription('Your desired username (English letters only)')
        .setRequired(true)
        .setMaxLength(20)
        .setMinLength(2)
    ),

  async execute(interaction) {
    const username = interaction.options.getString('username');
    const userId = interaction.user.id;

    try {
      // Validate username format (English letters only)
      const usernameRegex = /^[a-zA-Z]+$/;
      if (!usernameRegex.test(username)) {
        await interaction.reply({
          content: '❌ Username can only contain English letters (a-z, A-Z).',
          flags: 64
        });
        return;
      }

      // Check if username is already taken
      const existingUser = await db.getUserByUsername(username);
      if (existingUser && existingUser.id !== userId) {
        await interaction.reply({
          content: '❌ Username taken',
          flags: 64
        });
        return;
      }

      // Set the username
      await db.setUsername(userId, username);

      await interaction.reply({
        content: `✅ Username set to **${username}**!`,
        flags: 64
      });

    } catch (error) {
      console.error('Error in setusername command:', error);
      await interaction.reply({
        content: '❌ An error occurred while setting your username. Please try again.',
        flags: 64
      });
    }
  }
};
