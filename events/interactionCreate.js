const db = require('../utils/database');
const imageProcessor = require('../utils/imageProcessor');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error('Error executing command:', error);
        
        // Check if this is a stale interaction (common after bot restarts)
        if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
          console.log('🔄 Ignoring stale interaction from before bot restart');
          return;
        }
        
        // Check if interaction is already acknowledged
        if (error.code === 40060 || error.message?.includes('already been acknowledged')) {
          console.log('⚠️ Interaction already acknowledged, skipping reply');
          return;
        }
        
        const errorMessage = {
          content: '❌ There was an error while executing this command!',
          flags: 64
        };

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
          } else {
            await interaction.reply(errorMessage);
          }
        } catch (replyError) {
          console.log('Could not send error message to user:', replyError.code);
        }
      }
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }
  }
};

async function handleButtonInteraction(interaction) {
  const [action, ...args] = interaction.customId.split('_');

  try {
    // Check if this user is authorized to use the buttons
    // Only the original command sender can use the buttons
    let authorizedUserId;
    
    if (action === 'prev' || action === 'next') {
      // Format: prev_userId_imageIndex_commandSenderId or next_userId_imageIndex_commandSenderId
      authorizedUserId = args[2];
    } else if (action === 'like') {
      // Format: like_imageId_commandSenderId
      authorizedUserId = args[1];
    }
    
    if (authorizedUserId && authorizedUserId !== interaction.user.id) {
      await interaction.reply({
        content: '❌ Only the person who requested this profile can use these buttons.',
        ephemeral: true
      });
      return;
    }

    switch (action) {
      case 'prev':
        await handleNavigation(interaction, 'prev', args);
        break;
      case 'next':
        await handleNavigation(interaction, 'next', args);
        break;
      case 'like':
        await handleLike(interaction, args[0]);
        break;
      default:
        console.error(`Unknown button action: ${action}`);
    }
  } catch (error) {
    console.error('Error handling button interaction:', error);
    
    // Check if this is a stale interaction (common after bot restarts)
    if (error.code === 10062 || error.message?.includes('Unknown interaction')) {
      console.log('🔄 Ignoring stale button interaction from before bot restart');
      return;
    }
    
    // Check if interaction is already acknowledged
    if (error.code === 40060 || error.message?.includes('already been acknowledged')) {
      console.log('⚠️ Button interaction already acknowledged, skipping reply');
      return;
    }
    
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while processing your request.',
          flags: 64
        });
      }
    } catch (replyError) {
      console.log('Could not send error message for button:', replyError.code);
    }
  }
}

async function handleNavigation(interaction, direction, args) {
  const [userId, currentIndex] = args;
  const newIndex = direction === 'next' 
    ? parseInt(currentIndex) + 1 
    : parseInt(currentIndex) - 1;

  await interaction.deferUpdate();

  // Get user data
  const user = await db.getUserById(userId);
  const userImages = await db.getUserImages(userId);
  const userQuotes = await db.getUserQuotes(userId);
  const targetUser = await interaction.client.users.fetch(userId);

  if (newIndex < 0 || newIndex >= userImages.length) {
    return; // Invalid index
  }

  // Show the new image card
  const currentImage = userImages[newIndex];
  const imageUrl = currentImage.filename; // Now stores Discord URL instead of filename

  // Create Instagram-style card using Discord URL (quotes only in description now)
  const cardResult = await imageProcessor.createInstagramCard(
    imageUrl,
    targetUser.displayAvatarURL({ size: 128 }),
    user?.username || targetUser.displayName,
    currentImage.like_count,
    newIndex + 1,
    userImages.length
  );

  // Handle GIF vs regular image
  let cardAttachment;
  if (cardResult.isGif) {
    console.log('🎬 Navigation to GIF - using raw display');
    cardAttachment = null;
  } else {
    cardAttachment = new AttachmentBuilder(await cardResult.getBufferAsync('image/png'), {
      name: 'instagram_card.png'
    });
  }

  // Create embed
  const embed = new EmbedBuilder()
    .setColor('#E1306C')
    .setTitle(`📸 ${user?.username || targetUser.displayName}'s Gallery`)
    .setFooter({ 
      text: `Image ${newIndex + 1} of ${userImages.length} • ${currentImage.like_count} likes`,
      iconURL: targetUser.displayAvatarURL({ size: 32 })
    })
    .setTimestamp();

  // Set image based on type
  if (cardResult.isGif) {
    embed.setImage(imageUrl);
    if (userQuotes && userQuotes.length > 0) {
      const quotesText = userQuotes.map((quote, index) => 
        `${index + 1}. "${quote.quote_text}"`
      ).join('\n');
      embed.setDescription(`🎬 **Animated GIF** 🎬\n\n**Quotes:**\n${quotesText}`);
    } else {
      embed.setDescription('🎬 **Animated GIF** 🎬');
    }
  } else {
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
        .setCustomId(`prev_${userId}_${newIndex}_${interaction.user.id}`)
        .setLabel('Previous')
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newIndex === 0),
      new ButtonBuilder()
        .setCustomId(`next_${userId}_${newIndex}_${interaction.user.id}`)
        .setLabel('Next')
        .setEmoji('➡️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newIndex === userImages.length - 1)
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
}

async function handleLike(interaction, imageId) {
  const userId = interaction.user.id;
  const imageIdNum = parseInt(imageId);

  await interaction.deferUpdate();

  try {
    // Ensure the user exists in database before attempting to like
    // This is crucial for users who haven't used role-restricted commands
    await db.createUser(userId);
    
    // Get image data first (needed for DM notification)
    const image = await db.getImageById(imageIdNum);
    if (!image) {
      await interaction.followUp({
        content: '❌ Image not found.',
        flags: 64
      });
      return;
    }

    // Check if user has already liked this image
    const hasLiked = await db.hasUserLikedImage(imageIdNum, userId);

    if (hasLiked) {
      // Unlike the image
      await db.unlikeImage(imageIdNum, userId);
    } else {
      // Like the image
      await db.likeImage(imageIdNum, userId);
      
      // Send DM notification to image owner (only on like, not unlike)
      try {
        const imageOwner = await interaction.client.users.fetch(image.user_id);
        
        // Don't send DM if user likes their own image
        if (userId !== image.user_id) {
          const liker = interaction.user;
          
          // Create DM embed with the image
          const dmEmbed = new EmbedBuilder()
            .setColor('#E1306C')
            .setTitle('💖 Someone liked your image!')
            .setDescription(`**${liker.displayName}** (@${liker.username}) liked your image!`)
            .setThumbnail(liker.displayAvatarURL())
            .setImage(image.filename) // Use the Discord URL
            .setTimestamp();
          
          await imageOwner.send({ embeds: [dmEmbed] });
          console.log(`📬 Sent like notification to ${imageOwner.username} from ${liker.username}`);
        }
      } catch (dmError) {
        // Don't fail the like if DM fails (user might have DMs disabled)
        console.log('Could not send DM notification:', dmError.message);
      }
    }

    // Get updated image data after like/unlike
    const updatedImage = await db.getImageById(imageIdNum);
    if (!updatedImage) {
      await interaction.followUp({
        content: '❌ Image not found.',
        flags: 64
      });
      return;
    }

    // Get all user images to find the current index
    const userImages = await db.getUserImages(updatedImage.user_id);
    const currentIndex = userImages.findIndex(img => img.id === imageIdNum);
    
    if (currentIndex === -1) {
      await interaction.followUp({
        content: '❌ Image not found in user gallery.',
        flags: 64
      });
      return;
    }

    // Get user and target user data
    const user = await db.getUserById(updatedImage.user_id);
    const userQuotes = await db.getUserQuotes(updatedImage.user_id);
    const targetUser = await interaction.client.users.fetch(updatedImage.user_id);

    // Recreate the card with updated like count using Discord URL and quotes
    const imageUrl = updatedImage.filename; // Now stores Discord URL instead of filename

    const cardResult = await imageProcessor.createInstagramCard(
      imageUrl,
      targetUser.displayAvatarURL({ size: 128 }),
      user?.username || targetUser.displayName,
      updatedImage.like_count,
      currentIndex + 1,
      userImages.length
    );

    // Handle GIF vs regular image
    let cardAttachment;
    if (cardResult.isGif) {
      console.log('🎬 Like action on GIF - using raw display');
      cardAttachment = null;
    } else {
      cardAttachment = new AttachmentBuilder(await cardResult.getBufferAsync('image/png'), {
        name: 'instagram_card.png'
      });
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#E1306C')
      .setTitle(`📸 ${user?.username || targetUser.displayName}'s Gallery`)
      .setFooter({ 
        text: `Image ${currentIndex + 1} of ${userImages.length} • ${updatedImage.like_count} likes`,
        iconURL: targetUser.displayAvatarURL({ size: 32 })
      })
      .setTimestamp();

    // Set image based on type
    if (cardResult.isGif) {
      embed.setImage(imageUrl);
      if (userQuotes && userQuotes.length > 0) {
        const quotesText = userQuotes.map((quote, index) => 
          `${index + 1}. "${quote.quote_text}"`
        ).join('\n');
        embed.setDescription(`🎬 **Animated GIF** 🎬\n\n**Quotes:**\n${quotesText}`);
      } else {
        embed.setDescription('🎬 **Animated GIF** 🎬');
      }
    } else {
      embed.setImage('attachment://instagram_card.png');
      
      // Add quotes to description if available
      if (userQuotes && userQuotes.length > 0) {
        const quotesText = userQuotes.map((quote, index) => 
          `${index + 1}. "${quote.quote_text}"`
        ).join('\n');
        embed.setDescription(`**Quotes:**\n${quotesText}`);
      }
    }

    // Create buttons with updated like status
    const buttons = [];

    if (userImages.length > 1) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`prev_${image.user_id}_${currentIndex}_${interaction.user.id}`)
          .setLabel('Previous')
          .setEmoji('⬅️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentIndex === 0),
        new ButtonBuilder()
          .setCustomId(`next_${image.user_id}_${currentIndex}_${interaction.user.id}`)
          .setLabel('Next')
          .setEmoji('➡️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentIndex === userImages.length - 1)
      );
    }

    // Updated like button
    const nowLiked = !hasLiked; // Inverted since we just toggled it
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`like_${imageIdNum}_${interaction.user.id}`)
        .setLabel(`${nowLiked ? 'Unlike' : 'Like'}`)
        .setEmoji('❤️')
        .setStyle(nowLiked ? ButtonStyle.Danger : ButtonStyle.Primary)
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
    console.error('Error handling like:', error);
    await interaction.followUp({
      content: '❌ An error occurred while processing your like.',
      flags: 64
    });
  }
}
