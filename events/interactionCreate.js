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
        const errorMessage = {
          content: '❌ There was an error while executing this command!',
          flags: 64
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
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
    await interaction.reply({
      content: '❌ An error occurred while processing your request.',
      flags: 64
    });
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
  const targetUser = await interaction.client.users.fetch(userId);

  if (newIndex < 0 || newIndex >= userImages.length) {
    return; // Invalid index
  }

  // Show the new image card
  const currentImage = userImages[newIndex];
  const imageUrl = currentImage.filename; // Now stores Discord URL instead of filename

  // Create Instagram-style card using Discord URL
  const cardBuffer = await imageProcessor.createInstagramCard(
    imageUrl,
    targetUser.displayAvatarURL({ size: 128 }),
    user?.username || targetUser.displayName,
    currentImage.like_count,
    newIndex + 1,
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
      text: `Image ${newIndex + 1} of ${userImages.length} • ${currentImage.like_count} likes`,
      iconURL: targetUser.displayAvatarURL({ size: 32 })
    })
    .setTimestamp();

  // Create buttons
  const buttons = [];

  if (userImages.length > 1) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`prev_${userId}_${newIndex}`)
        .setLabel('Previous')
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newIndex === 0),
      new ButtonBuilder()
        .setCustomId(`next_${userId}_${newIndex}`)
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
}

async function handleLike(interaction, imageId) {
  const userId = interaction.user.id;
  const imageIdNum = parseInt(imageId);

  await interaction.deferUpdate();

  try {
    // Check if user has already liked this image
    const hasLiked = await db.hasUserLikedImage(imageIdNum, userId);

    if (hasLiked) {
      // Unlike the image
      await db.unlikeImage(imageIdNum, userId);
    } else {
      // Like the image
      await db.likeImage(imageIdNum, userId);
    }

    // Get updated image data
    const image = await db.getImageById(imageIdNum);
    if (!image) {
      await interaction.followUp({
        content: '❌ Image not found.',
        flags: 64
      });
      return;
    }

    // Get all user images to find the current index
    const userImages = await db.getUserImages(image.user_id);
    const currentIndex = userImages.findIndex(img => img.id === imageIdNum);
    
    if (currentIndex === -1) {
      await interaction.followUp({
        content: '❌ Image not found in user gallery.',
        flags: 64
      });
      return;
    }

    // Get user and target user data
    const user = await db.getUserById(image.user_id);
    const targetUser = await interaction.client.users.fetch(image.user_id);

    // Recreate the card with updated like count using Discord URL
    const imageUrl = image.filename; // Now stores Discord URL instead of filename

    const cardBuffer = await imageProcessor.createInstagramCard(
      imageUrl,
      targetUser.displayAvatarURL({ size: 128 }),
      user?.username || targetUser.displayName,
      image.like_count,
      currentIndex + 1,
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
        text: `Image ${currentIndex + 1} of ${userImages.length} • ${image.like_count} likes`,
        iconURL: targetUser.displayAvatarURL({ size: 32 })
      })
      .setTimestamp();

    // Create buttons with updated like status
    const buttons = [];

    if (userImages.length > 1) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`prev_${image.user_id}_${currentIndex}`)
          .setLabel('Previous')
          .setEmoji('⬅️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentIndex === 0),
        new ButtonBuilder()
          .setCustomId(`next_${image.user_id}_${currentIndex}`)
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
        .setCustomId(`like_${imageIdNum}`)
        .setLabel(`${nowLiked ? 'Unlike' : 'Like'}`)
        .setEmoji('❤️')
        .setStyle(nowLiked ? ButtonStyle.Danger : ButtonStyle.Primary)
    );

    const actionRow = new ActionRowBuilder().addComponents(buttons);

    await interaction.editReply({
      embeds: [embed],
      files: [cardAttachment],
      components: [actionRow]
    });

  } catch (error) {
    console.error('Error handling like:', error);
    await interaction.followUp({
      content: '❌ An error occurred while processing your like.',
      flags: 64
    });
  }
}
