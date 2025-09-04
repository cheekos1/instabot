const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../utils/database');
const imageProcessor = require('../utils/imageProcessor');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your or someone else\'s Instagram-style profile')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User whose profile to view (defaults to yourself)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;

    try {
      await interaction.deferReply();

      // Get user data
      const user = await db.getUserById(userId);
      const userImages = await db.getUserImages(userId);

      if (userImages.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#E1306C')
          .setTitle('📸 Profile Gallery')
          .setDescription(`${targetUser.id === interaction.user.id ? 'You don\'t' : `${targetUser.displayName} doesn't`} have any images uploaded yet!`)
          .setThumbnail(targetUser.displayAvatarURL())
          .addFields(
            { name: '👤 Username', value: user?.username || 'Not set', inline: true },
            { name: '📷 Images', value: '0/3', inline: true }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Create the initial embed for the first image
      await this.showImageCard(interaction, userId, 0, userImages, user, targetUser);

    } catch (error) {
      console.error('Error in profile command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while loading the profile. Please try again.'
      });
    }
  },

  async showImageCard(interaction, userId, imageIndex, userImages, user, targetUser) {
    try {
      const currentImage = userImages[imageIndex];
      const imageUrl = currentImage.filename; // Now stores Discord URL instead of filename

      // Create Instagram-style card using Discord URL
      const cardBuffer = await imageProcessor.createInstagramCard(
        imageUrl,
        targetUser.displayAvatarURL({ size: 128 }),
        user?.username || targetUser.displayName,
        currentImage.like_count,
        imageIndex + 1,
        userImages.length
      );

      const cardAttachment = new AttachmentBuilder(await cardBuffer.getBufferAsync('image/png'), {
        name: 'instagram_card.png'
      });

      // Create embed
      const embed = new EmbedBuilder()
        .setColor('#E1306C')
        .setTitle(`📸 ${user?.username || targetUser.displayName}'s Gallery`)
        .setImage('attachment://instagram_card.png')
        .setFooter({ 
          text: `Image ${imageIndex + 1} of ${userImages.length} • ${currentImage.like_count} likes`,
          iconURL: targetUser.displayAvatarURL({ size: 32 })
        })
        .setTimestamp();

      // Create buttons
      const buttons = [];

      if (userImages.length > 1) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`prev_${userId}_${imageIndex}`)
            .setLabel('Previous')
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(imageIndex === 0),
          new ButtonBuilder()
            .setCustomId(`next_${userId}_${imageIndex}`)
            .setLabel('Next')
            .setEmoji('➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(imageIndex === userImages.length - 1)
        );
      }

      // Like button
      const hasLiked = await db.hasUserLikedImage(currentImage.id, interaction.user.id);
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`like_${currentImage.id}`)
          .setLabel(`${hasLiked ? 'Unlike' : 'Like'}`)
          .setEmoji('❤️')
          .setStyle(hasLiked ? ButtonStyle.Danger : ButtonStyle.Primary)
      );

      const actionRow = new ActionRowBuilder().addComponents(buttons);

      await interaction.editReply({
        embeds: [embed],
        files: [cardAttachment],
        components: [actionRow]
      });

    } catch (error) {
      console.error('Error showing image card:', error);
      await interaction.editReply({
        content: '❌ An error occurred while displaying the image. Please try again.'
      });
    }
  }
};
