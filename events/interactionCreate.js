const db = require('../utils/database');
const imageProcessor = require('../utils/imageProcessor');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

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
    } else     if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }

    if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  }
};

async function handleButtonInteraction(interaction) {
  const [action, ...args] = interaction.customId.split('_');

  try {
    // Rate limiting check for button interactions
    const userId = interaction.user.id;
    const now = Date.now();
    
    // Simple rate limiting: max 10 button clicks per minute per user
    if (!interaction.client.buttonRateLimit) {
      interaction.client.buttonRateLimit = new Map();
    }
    
    const userLimits = interaction.client.buttonRateLimit.get(userId) || [];
    const validLimits = userLimits.filter(timestamp => now - timestamp < 60000); // 1 minute
    
    if (validLimits.length >= 10) {
      console.log(`⚠️ Rate limit exceeded for user ${userId} (${validLimits.length} interactions)`);
      await interaction.reply({
        content: '❌ You\'re clicking too fast! Please wait a moment before trying again.',
        flags: 64
      });
      return;
    }
    
    validLimits.push(now);
    interaction.client.buttonRateLimit.set(userId, validLimits);

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
      case 'comment':
        await handleComment(interaction, args[0]);
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
  try {
    const [userId, currentIndex] = args;
    const newIndex = direction === 'next' 
      ? parseInt(currentIndex) + 1 
      : parseInt(currentIndex) - 1;

    console.log(`🔄 Navigation: ${direction} from ${currentIndex} to ${newIndex} for user ${userId}`);

    await interaction.deferUpdate();

    // Get user data with error handling
    const user = await db.getUserById(userId);
    const userImages = await db.getUserImages(userId);
    const userQuotes = await db.getUserQuotes(userId);
    const targetUser = await interaction.client.users.fetch(userId);

    console.log(`📊 Found ${userImages.length} images for user ${userId}`);

    if (newIndex < 0 || newIndex >= userImages.length) {
      console.error(`❌ Invalid navigation index: ${newIndex} (images: ${userImages.length})`);
      await interaction.followUp({
        content: '❌ Invalid navigation request. Please try again.',
        flags: 64
      });
      return;
    }

    // Show the new image card
    const currentImage = userImages[newIndex];
    const imageUrl = currentImage.filename; // Now stores Discord URL instead of filename

    console.log(`🖼️ Processing image ${newIndex + 1}: ${imageUrl.substring(0, 50)}...`);

    // Skip Instagram card processing for navigation - use raw Discord URLs for reliability
    // This prevents Discord API timeouts while maintaining good UX
    let cardResult;
    let useProcessedCard = false; // Always use raw images for navigation
    
    console.log(`🔄 Using raw Discord URL for navigation (bypassing card processing)`);
    cardResult = { isGif: imageUrl.toLowerCase().includes('.gif'), originalUrl: imageUrl };

  // Handle GIF vs regular image - always use raw Discord URLs for navigation
  let cardAttachment;
  if (cardResult.isGif) {
    console.log('🎬 Navigation to GIF - using raw display');
  } else {
    console.log('🔄 Using raw Discord URL for navigation (no attachment needed)');
  }
  cardAttachment = null; // Always null for navigation - no attachments to prevent timeouts

  // Create embed
  const embed = new EmbedBuilder()
    .setColor('#E1306C')
    .setTitle(`📸 ${user?.username || targetUser.displayName}'s Gallery`)
    .setFooter({ 
      text: `Image ${newIndex + 1} of ${userImages.length} • ${currentImage.like_count} likes`,
      iconURL: targetUser.displayAvatarURL({ size: 32 })
    })
    .setTimestamp();

  // Always use raw Discord URL for navigation (no attachments)
  embed.setImage(imageUrl);
  
  if (cardResult.isGif) {
    if (userQuotes && userQuotes.length > 0) {
      const quotesText = userQuotes.map((quote, index) => 
        `${index + 1}. "${quote.quote_text}"`
      ).join('\n');
      embed.setDescription(`🎬 **Animated GIF** 🎬\n\n**Quotes:**\n${quotesText}`);
    } else {
      embed.setDescription('🎬 **Animated GIF** 🎬');
    }
  } else {
    // Regular image with quotes
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

  // Comment button
  buttons.push(
    new ButtonBuilder()
      .setCustomId(`comment_${currentImage.id}_${interaction.user.id}`)
      .setLabel('Comment')
      .setEmoji('💬')
      .setStyle(ButtonStyle.Secondary)
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

    console.log(`📤 Sending navigation update (no attachment for speed)`);
    console.log(`📤 Interaction status:`, {
      interactionId: interaction.id,
      interactionType: interaction.type,
      deferred: interaction.deferred,
      replied: interaction.replied,
      isCommand: interaction.isCommand(),
      isButton: interaction.isButton(),
      messageId: interaction.message?.id
    });
    
    console.log(`📤 Reply data structure:`, {
      embeds: replyData.embeds?.length || 0,
      components: replyData.components?.length || 0,
      files: 0 // Always 0 for navigation
    });
    
    // Delete and recreate approach - most reliable method
    // Delete the old message and send a new one instead of editing
    console.log(`🔄 Using delete-and-recreate approach for navigation`);
    
    try {
      // Delete the original message
      console.log(`🗑️ Deleting original message: ${interaction.message?.id}`);
      await interaction.message.delete().catch(deleteError => {
        console.log(`⚠️ Could not delete original message:`, deleteError.message);
        // Continue anyway - not critical if deletion fails
      });
      
      // Send new message with updated content
      console.log(`📤 Sending new navigation message`);
      await interaction.channel.send({
        embeds: [embed],
        components: [actionRow]
      });
      
      console.log(`✅ Navigation completed successfully with delete-and-recreate for user ${userId}`);
      return; // Success with delete-and-recreate
    } catch (deleteRecreateError) {
      console.error(`❌ Delete-and-recreate failed:`, {
        error: deleteRecreateError.message,
        code: deleteRecreateError.code,
        status: deleteRecreateError.status,
        interactionId: interaction.id,
        userId: userId
      });
      
      // Fallback: try followUp if delete-and-recreate fails
      try {
        console.log(`🔄 Fallback: attempting followUp`);
        await interaction.followUp({
          content: `📸 **${user?.username || targetUser.displayName}'s Gallery**\n**Image ${newIndex + 1} of ${userImages.length}** • ${currentImage.like_count} likes\n\n${imageUrl}`,
          components: [actionRow]
        });
        console.log(`✅ Fallback followUp successful for user ${userId}`);
        return; // Success with fallback
      } catch (fallbackError) {
        console.error(`❌ All navigation methods failed:`, {
          error: fallbackError.message,
          code: fallbackError.code,
          status: fallbackError.status
        });
      }
    }

  } catch (error) {
    console.error('❌ Error in handleNavigation:', error);
    
    // Try to send error message to user
    try {
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({
          content: '❌ An error occurred while navigating. Please try again.',
          components: [] // Remove buttons to prevent further issues
        });
      } else if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while navigating. Please try again.',
          flags: 64
        });
      }
    } catch (replyError) {
      console.error('❌ Could not send error message:', replyError);
    }
  }
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

  // Comment button
  buttons.push(
    new ButtonBuilder()
      .setCustomId(`comment_${imageIdNum}_${interaction.user.id}`)
      .setLabel('Comment')
      .setEmoji('💬')
      .setStyle(ButtonStyle.Secondary)
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

    // Delete and recreate approach for like updates
    console.log(`🔄 Using delete-and-recreate approach for like update`);
    
    try {
      // Delete the original message
      console.log(`🗑️ Deleting original message for like update: ${interaction.message?.id}`);
      await interaction.message.delete().catch(deleteError => {
        console.log(`⚠️ Could not delete original message for like:`, deleteError.message);
        // Continue anyway - not critical if deletion fails
      });
      
      // Send new message with updated like count
      console.log(`📤 Sending new like update message`);
      await interaction.channel.send({
        embeds: [embed],
        components: [actionRow],
        files: cardAttachment ? [cardAttachment] : []
      });
      
      console.log(`✅ Like update completed successfully with delete-and-recreate`);
    } catch (deleteRecreateError) {
      console.error(`❌ Delete-and-recreate for like failed:`, {
        error: deleteRecreateError.message,
        code: deleteRecreateError.code,
        status: deleteRecreateError.status
      });
      
      // Fallback: try editReply if delete-and-recreate fails
      try {
        console.log(`🔄 Fallback: attempting editReply for like`);
        const replyData = {
          embeds: [embed],
          components: [actionRow],
          files: cardAttachment ? [cardAttachment] : []
        };
        await interaction.editReply(replyData);
        console.log(`✅ Fallback editReply successful for like`);
      } catch (fallbackError) {
        console.error(`❌ All like update methods failed:`, {
          error: fallbackError.message,
          code: fallbackError.code,
          status: fallbackError.status
        });
        
        // Final fallback: send follow-up
        await interaction.followUp({
          content: `❤️ ${hasLiked ? 'Liked' : 'Unliked'}! (${updatedImage.like_count} likes)`,
          flags: 64
        });
      }
    }

  } catch (error) {
    console.error('Error handling like:', error);
    await interaction.followUp({
      content: '❌ An error occurred while processing your like.',
      flags: 64
    });
  }
}

async function handleComment(interaction, imageId) {
  const userId = interaction.user.id;
  const imageIdNum = parseInt(imageId);

  try {
    // Get image data first
    const image = await db.getImageById(imageIdNum);
    if (!image) {
      await interaction.reply({
        content: '❌ Image not found.',
        flags: 64
      });
      return;
    }

    // Don't allow users to comment on their own images
    if (userId === image.user_id) {
      await interaction.reply({
        content: '❌ You cannot comment on your own images.',
        flags: 64
      });
      return;
    }

    // Create modal for comment input
    const commentModal = new ModalBuilder()
      .setCustomId(`comment_modal_${imageIdNum}_${userId}`)
      .setTitle(`Comment on ${image.user_id === interaction.user.id ? 'your' : 'this'} image`);

    const commentInput = new TextInputBuilder()
      .setCustomId('comment_text')
      .setLabel('Your comment')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Write your comment here...')
      .setRequired(true)
      .setMaxLength(1000); // Discord's max length for text inputs

    const commentActionRow = new ActionRowBuilder().addComponents(commentInput);
    commentModal.addComponents(commentActionRow);

    await interaction.showModal(commentModal);

  } catch (error) {
    console.error('Error showing comment modal:', error);
    await interaction.reply({
      content: '❌ An error occurred while opening the comment form.',
      flags: 64
    });
  }
}

async function handleModalSubmit(interaction) {
  try {
    // Check if this is a comment modal
    if (interaction.customId.startsWith('comment_modal_')) {
      const [, , imageId, userId] = interaction.customId.split('_');
      const imageIdNum = parseInt(imageId);
      const commentText = interaction.fields.getTextInputValue('comment_text');

      // Validate comment
      if (!commentText || commentText.trim().length === 0) {
        await interaction.reply({
          content: '❌ Please enter a valid comment.',
          flags: 64
        });
        return;
      }

      // Get image data
      const image = await db.getImageById(imageIdNum);
      if (!image) {
        await interaction.reply({
          content: '❌ Image not found.',
          flags: 64
        });
        return;
      }

      // Don't allow users to comment on their own images
      if (userId === image.user_id) {
        await interaction.reply({
          content: '❌ You cannot comment on your own images.',
          flags: 64
        });
        return;
      }

      // Send DM notification to image owner
      try {
        const imageOwner = await interaction.client.users.fetch(image.user_id);
        const commenter = interaction.user;
        
        // Create DM embed with the image and comment
        const dmEmbed = new EmbedBuilder()
          .setColor('#E1306C')
          .setTitle('💬 Someone commented on your image!')
          .setDescription(`**${commenter.displayName}** (@${commenter.username}) commented on your image!`)
          .setThumbnail(commenter.displayAvatarURL())
          .setImage(image.filename) // Use the Discord URL
          .addFields({
            name: '💬 Comment',
            value: `"${commentText}"`,
            inline: false
          })
          .setTimestamp();
        
        await imageOwner.send({ embeds: [dmEmbed] });
        console.log(`📬 Sent comment notification to ${imageOwner.username} from ${commenter.username}: "${commentText}"`);
        
        // Confirm to the commenter
        await interaction.reply({
          content: '✅ Your comment has been sent to the image owner!',
          flags: 64
        });
        
      } catch (dmError) {
        console.error('Could not send comment DM notification:', dmError.message);
        await interaction.reply({
          content: '❌ Could not send the comment. The user might have DMs disabled.',
          flags: 64
        });
      }
    }
  } catch (error) {
    console.error('Error handling modal submit:', error);
    await interaction.reply({
      content: '❌ An error occurred while processing your comment.',
      flags: 64
    });
  }
}
