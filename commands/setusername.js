const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');

// Admin user ID and allowed role
const ADMIN_USER_ID = '482427857168236544';
const ALLOWED_ROLE_ID = '1415892148997460058';

// Users with special username privileges (granted by admin)
// Note: This should be synchronized with messageCreate.js in a real implementation
const specialUsernameUsers = new Set([ADMIN_USER_ID]); // Admin always has privileges

// Helper function to check if user has required role
function hasRequiredRole(member, roleId) {
  return member.roles.cache.has(roleId);
}

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
        .setMinLength(1)
    ),

  async execute(interaction) {
    const username = interaction.options.getString('username');
    const userId = interaction.user.id;

    try {
      // Check if user has required role or is admin or has special privileges
      const isAdmin = userId === ADMIN_USER_ID;
      const hasSpecialPrivilege = specialUsernameUsers.has(userId);
      const hasRole = interaction.member && hasRequiredRole(interaction.member, ALLOWED_ROLE_ID);
      
      if (!isAdmin && !hasSpecialPrivilege && !hasRole) {
        await interaction.reply({
          content: '❌ You do not have permission to use this command. You must have the required role.',
          flags: 64
        });
        return;
      }
      
      // Validate username format (English letters only) - unless user has special privileges
      if (!isAdmin && !hasSpecialPrivilege) {
        // Regular users must have minimum 2 characters and only letters
        if (username.length < 2) {
          await interaction.reply({
            content: '❌ Username must be at least 2 characters long.',
            flags: 64
          });
          return;
        }
        
        const usernameRegex = /^[a-zA-Z]+$/;
        if (!usernameRegex.test(username)) {
          await interaction.reply({
            content: '❌ Username can only contain English letters (a-z, A-Z).',
            flags: 64
          });
          return;
        }
      } else {
        // For users with special privileges, allow any format but still validate basic safety
        // Remove very dangerous characters but allow letters, numbers, and some special chars
        const dangerousChars = /[<>"'&]/;
        if (dangerousChars.test(username)) {
          await interaction.reply({
            content: '❌ Username contains unsafe characters. Please avoid: < > " \' &',
            flags: 64
          });
          return;
        }
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

      // Backup to Discord channel
      try {
        await db.backupToDiscord(interaction.client, userId);
      } catch (backupError) {
        console.log('Backup failed but username was saved:', backupError);
      }

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


