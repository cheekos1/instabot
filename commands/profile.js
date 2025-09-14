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
      const userQuotes = await db.getUserQuotes(userId);
      
      // Debug logging for production
      console.log(`🔍 Profile request for user ${userId}`);
      console.log(`🔍 User data:`, user);
      console.log(`🔍 Found ${userImages.length} images`);
      if (userImages.length > 0) {
        console.log(`🔍 First image URL:`, userImages[0].filename);
      }

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
      await this.showImageCard(interaction, userId, 0, userImages, user, targetUser, userQuotes);

    } catch (error) {
      console.error('Error in profile command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while loading the profile. Please try again.'
      });
    }
  },

  async showImageCard(interaction, userId, imageIndex, userImages, user, targetUser, userQuotes = []) {
    try {
      const currentImage = userImages[imageIndex];
      const imageUrl = currentImage.filename; // Now stores Discord URL instead of filename

      // Create Instagram-style card using Discord URL (quotes only in description now)
      const cardResult = await imageProcessor.createInstagramCard(
        imageUrl,
        targetUser.displayAvatarURL({ size: 128 }),
        user?.username || targetUser.displayName,
        currentImage.like_count,
        imageIndex + 1,
        userImages.length
      );

      // Check if this is a GIF or fallback - handle differently
      let cardAttachment;
      if (cardResult.isGif || cardResult.fallback) {
        const reason = cardResult.isGif ? 'GIF' : 'fallback';
        console.log(`🎬 Using raw ${reason} for display`);
        // For GIFs and fallbacks, we don't create a card attachment - we'll use the embed image instead
        cardAttachment = null;
      } else {
        cardAttachment = new AttachmentBuilder(await cardResult.getBufferAsync('image/png'), {
          name: 'instagram_card.png'
        });
      }

      // Create embed - handle GIF vs regular image differently
      const embed = new EmbedBuilder()
        .setColor('#E1306C')
        .setTitle(`📸 ${user?.username || targetUser.displayName}'s Gallery`)
        .setFooter({ 
          text: `Image ${imageIndex + 1} of ${userImages.length} • ${currentImage.like_count} likes`,
          iconURL: targetUser.displayAvatarURL({ size: 32 })
        })
        .setTimestamp();

      // Set image source based on type
      if (cardResult.isGif || cardResult.fallback) {
        // For GIFs and fallbacks, show the raw image directly
        embed.setImage(imageUrl);
        
        // Add appropriate description
        if (cardResult.isGif) {
          // Add quotes to description since we can't overlay them on GIF
          if (userQuotes && userQuotes.length > 0) {
            const quotesText = userQuotes.map((quote, index) => 
              `${index + 1}. "${quote.quote_text}"`
            ).join('\n');
            embed.setDescription(`🎬 **Animated GIF** 🎬\n\n**Quotes:**\n${quotesText}`);
          } else {
            embed.setDescription('🎬 **Animated GIF** 🎬');
          }
        } else if (cardResult.fallback) {
          // For fallbacks, show a message about processing issues
          if (userQuotes && userQuotes.length > 0) {
            const quotesText = userQuotes.map((quote, index) => 
              `${index + 1}. "${quote.quote_text}"`
            ).join('\n');
            embed.setDescription(`⚠️ **Image Processing Issue** - Showing original image\n\n**Quotes:**\n${quotesText}`);
          } else {
            embed.setDescription('⚠️ **Image Processing Issue** - Showing original image');
          }
        }
      } else {
        // For regular images, use the processed Instagram card
        embed.setImage('attachment://instagram_card.png');
        
        // Add quotes to description if available
        if (userQuotes && userQuotes.length > 0) {
          const quotesText = userQuotes.map((quote, index) => 
            `${index + 1}. "${quote.quote_text}"`
          ).join('\n');
          embed.setDescription(`**Quotes:**\n${quotesText}`);
        }
      }

      // Create buttons
      const buttons = [];

      if (userImages.length > 1) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`prev_${userId}_${imageIndex}_${interaction.user.id}`)
            .setLabel('Previous')
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(imageIndex === 0),
          new ButtonBuilder()
            .setCustomId(`next_${userId}_${imageIndex}_${interaction.user.id}`)
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
          .setCustomId(`like_${currentImage.id}_${interaction.user.id}`)
          .setLabel(`${hasLiked ? 'Unlike' : 'Like'}`)
          .setEmoji('❤️')
          .setStyle(hasLiked ? ButtonStyle.Danger : ButtonStyle.Primary)
      );

      // Support button (link button)
      buttons.push(
        new ButtonBuilder()
          .setLabel('Support')
          .setStyle(ButtonStyle.Link)
          .setURL('https://guns.lol/i_q')
          .setEmoji('💖')
      );

      const actionRow = new ActionRowBuilder().addComponents(buttons);

      // Build reply object - ensure consistent structure for proper editing
      const replyData = {
        embeds: [embed],
        components: [actionRow],
        files: cardAttachment ? [cardAttachment] : [] // Always include files array, even if empty
      };

      await interaction.editReply(replyData);

    } catch (error) {
      console.error('Error showing image card:', error);
      await interaction.editReply({
        content: '❌ An error occurred while displaying the image. Please try again.'
      });
    }
  }
};
