const db = require('../utils/database');
const imageProcessor = require('../utils/imageProcessor');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder } = require('discord.js');

// Admin user ID and allowed role
const ADMIN_USER_ID = '482427857168236544';
const ALLOWED_ROLE_ID = '1415892148997460058';

// Users with special username privileges (granted by admin)
const specialUsernameUsers = new Set([ADMIN_USER_ID]); // Admin always has privileges

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    // Ignore bot messages
    if (message.author.bot) return;

    // Check for Arabic commands
    const content = message.content.trim();
    
    // Arabic command mappings
    const arabicCommands = {
      '!بروفايل': 'profile',
      '!حذف_صورة': 'deleteimage', 
      '!ترتيب': 'reorder',
      '!نبذة': 'addquote',
      '!حذف_نبذة': 'deletequote',
      '!اسم': 'setusername', // Arabic username command
      // Admin commands
      '!مسح_مستخدم': 'resetuser', // Reset user command for admin
      '!منح_صلاحية': 'grantprivilege' // Grant username privilege to user
    };

    // Parse command and arguments
    const args = content.split(' ');
    const command = args[0];
    
    if (!arabicCommands[command]) return;

    const commandType = arabicCommands[command];
    const userId = message.author.id;

    try {
      switch (commandType) {
        case 'profile':
          await handleArabicProfile(message, args);
          break;
        case 'deleteimage':
          await handleArabicDeleteImage(message, args);
          break;
        case 'reorder':
          await handleArabicReorder(message, args);
          break;
        case 'addquote':
          await handleArabicAddQuote(message, args);
          break;
        case 'deletequote':
          await handleArabicDeleteQuote(message, args);
          break;
        case 'setusername':
          await handleArabicSetUsername(message, args);
          break;
        case 'resetuser':
          await handleAdminResetUser(message, args);
          break;
        case 'grantprivilege':
          await handleAdminGrantPrivilege(message, args);
          break;
      }
    } catch (error) {
      console.error('Error handling Arabic command:', error);
      await message.reply('❌ حدث خطأ أثناء تنفيذ الأمر.');
    }
  }
};

// Arabic Profile Command (!بروفايل)
async function handleArabicProfile(message, args) {
  let targetUser = message.author;
  
  // Check for mentioned user
  if (message.mentions.users.size > 0) {
    targetUser = message.mentions.users.first();
  }

  const userId = targetUser.id;

  try {
    // Get user data
    const user = await db.getUserById(userId);
    const userImages = await db.getUserImages(userId);
    const userQuotes = await db.getUserQuotes(userId);
    
    if (userImages.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#E1306C')
        .setTitle('📸 معرض الصور')
        .setDescription(`${targetUser.id === message.author.id ? 'لا توجد' : `${targetUser.displayName} ليس لديه`} صور محملة بعد!`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: '👤 اسم المستخدم', value: user?.username || 'غير محدد', inline: true },
          { name: '📷 الصور', value: '0/3', inline: true }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    // Create the initial embed for the first image (reuse existing logic but with Arabic text)
    await showArabicImageCard(message, userId, 0, userImages, user, targetUser, userQuotes);

  } catch (error) {
    console.error('Error in Arabic profile command:', error);
    await message.reply('❌ حدث خطأ أثناء تحميل الملف الشخصي.');
  }
}

// Arabic Delete Image Command (!حذف_صورة)
async function handleArabicDeleteImage(message, args) {
  if (args.length < 2) {
    await message.reply('❌ الاستخدام: `!حذف_صورة [الموضع]`\nمثال: `!حذف_صورة 1`');
    return;
  }

  const position = parseInt(args[1]);
  const userId = message.author.id;

  if (isNaN(position) || position < 1 || position > 3) {
    await message.reply('❌ يجب أن يكون الموضع رقم بين 1 و 3.');
    return;
  }

  try {
    // Get user's images
    const userImages = await db.getUserImages(userId);
    
    if (userImages.length === 0) {
      await message.reply('❌ ليس لديك أي صور لحذفها.');
      return;
    }

    // Check if position is valid
    if (position > userImages.length) {
      await message.reply(`❌ لديك فقط ${userImages.length} صورة. اختر موضع بين 1 و ${userImages.length}.`);
      return;
    }

    // Get the image to delete (position is 1-indexed, array is 0-indexed)
    const imageToDelete = userImages[position - 1];
    
    // Delete from database
    const result = await db.deleteImage(imageToDelete.id, userId);
    
    if (result.changes > 0) {
      await message.reply(`✅ تم حذف الصورة في الموضع ${position} بنجاح!`);
    } else {
      await message.reply('❌ فشل في حذف الصورة. حاول مرة أخرى.');
    }

  } catch (error) {
    console.error('Error in Arabic deleteimage command:', error);
    await message.reply('❌ حدث خطأ أثناء حذف صورتك.');
  }
}

// Arabic Reorder Command (!ترتيب)
async function handleArabicReorder(message, args) {
  if (args.length < 3) {
    await message.reply('❌ الاستخدام: `!ترتيب [من] [إلى]`\nمثال: `!ترتيب 1 3`');
    return;
  }

  const fromPosition = parseInt(args[1]);
  const toPosition = parseInt(args[2]);
  const userId = message.author.id;

  if (isNaN(fromPosition) || isNaN(toPosition) || 
      fromPosition < 1 || fromPosition > 3 || 
      toPosition < 1 || toPosition > 3) {
    await message.reply('❌ يجب أن تكون المواضع أرقام بين 1 و 3.');
    return;
  }

  if (fromPosition === toPosition) {
    await message.reply('❌ لا يمكن أن تكون مواضع المصدر والوجهة متطابقة.');
    return;
  }

  try {
    // Get user's images
    const userImages = await db.getUserImages(userId);
    
    if (userImages.length === 0) {
      await message.reply('❌ ليس لديك أي صور لإعادة ترتيبها.');
      return;
    }

    // Validate positions
    if (fromPosition > userImages.length || toPosition > userImages.length) {
      await message.reply(`❌ موضع غير صالح. لديك فقط ${userImages.length} صورة.`);
      return;
    }

    // Create new order array
    const newOrder = [...userImages];
    const [movedImage] = newOrder.splice(fromPosition - 1, 1);
    newOrder.splice(toPosition - 1, 0, movedImage);

    // Create update array for database
    const imageOrders = newOrder.map((image, index) => ({
      imageId: image.id,
      position: index
    }));

    // Update database
    await db.reorderImages(userId, imageOrders);

    await message.reply(`✅ تم نقل الصورة من الموضع ${fromPosition} إلى الموضع ${toPosition}!`);

  } catch (error) {
    console.error('Error in Arabic reorder command:', error);
    await message.reply('❌ حدث خطأ أثناء إعادة ترتيب صورك.');
  }
}

// Arabic Add Quote Command (!نبذة)
async function handleArabicAddQuote(message, args) {
  if (args.length < 2) {
    await message.reply('❤️ الاستخدام: `!نبذة [النص]`\nمثال: `!نبذة أحب البرمجة والتصميم`');
    return;
  }

  const quoteText = args.slice(1).join(' ');
  const userId = message.author.id;

  // Check if user has required role or is admin
  const isAdmin = userId === ADMIN_USER_ID;
  const hasRole = message.member && hasRequiredRole(message.member, ALLOWED_ROLE_ID);

  if (!isAdmin && !hasRole) {
    await message.reply('❤️ ليس لديك صلاحية لاستخدام هذا الأمر. يجب أن يكون لديك الدور المطلوب.');
    return;
  }

  if (quoteText.length > 200) {
    await message.reply('❌ النبذة طويلة جداً. الحد الأقصى 200 حرف.');
    return;
  }

  try {
    // Ensure user exists in database
    await db.createUser(userId);

    // Check if user already has maximum quotes
    const currentQuoteCount = await db.getUserQuoteCount(userId);
    if (currentQuoteCount >= 3) {
      await message.reply('❌ يمكنك أن تحصل على 3 نبذات فقط. احذف نبذة موجودة أولاً باستخدام `!حذف_نبذة`.');
      return;
    }

    // Add quote to database
    const result = await db.addQuote(userId, quoteText);
    
    if (result.changes > 0) {
      await message.reply(`✅ تم إضافة النبذة بنجاح! لديك الآن ${currentQuoteCount + 1}/3 نبذة.`);
    } else {
      throw new Error('Failed to save quote to database');
    }

  } catch (error) {
    console.error('Error in Arabic addquote command:', error);
    await message.reply('❌ حدث خطأ أثناء إضافة نبذتك.');
  }
}

// Arabic Delete Quote Command (!حذف_نبذة)
async function handleArabicDeleteQuote(message, args) {
  if (args.length < 2) {
    await message.reply('❌ الاستخدام: `!حذف_نبذة [الموضع]`\nمثال: `!حذف_نبذة 1`');
    return;
  }

  const position = parseInt(args[1]);
  const userId = message.author.id;

  if (isNaN(position) || position < 1 || position > 3) {
    await message.reply('❌ يجب أن يكون الموضع رقم بين 1 و 3.');
    return;
  }

  try {
    // Get user's quotes
    const userQuotes = await db.getUserQuotes(userId);
    
    if (userQuotes.length === 0) {
      await message.reply('❌ ليس لديك أي نبذات لحذفها.');
      return;
    }

    // Check if position is valid
    if (position > userQuotes.length) {
      await message.reply(`❌ لديك فقط ${userQuotes.length} نبذة. اختر موضع بين 1 و ${userQuotes.length}.`);
      return;
    }

    // Get the quote to delete (position is 1-indexed, array is 0-indexed)
    const quoteToDelete = userQuotes[position - 1];
    
    // Delete from database
    const result = await db.deleteQuote(quoteToDelete.id, userId);
    
    if (result.changes > 0) {
      await message.reply(`✅ تم حذف النبذة في الموضع ${position} بنجاح!`);
    } else {
      await message.reply('❌ فشل في حذف النبذة. حاول مرة أخرى.');
    }

  } catch (error) {
    console.error('Error in Arabic deletequote command:', error);
    await message.reply('❌ حدث خطأ أثناء حذف نبذتك.');
  }
}

// Admin Reset User Command (!مسح_مستخدم)
async function handleAdminResetUser(message, args) {
  // Check if user is admin
  if (message.author.id !== ADMIN_USER_ID) {
    await message.reply('❌ ليس لديك صلاحية لاستخدام هذا الأمر.');
    return;
  }

  if (args.length < 2 && message.mentions.users.size === 0) {
    await message.reply('❌ الاستخدام: `!مسح_مستخدم [@مستخدم]` أو `!مسح_مستخدم [معرف_المستخدم]`');
    return;
  }

  let targetUserId;
  let targetUser;

  // Check for mentioned user
  if (message.mentions.users.size > 0) {
    targetUser = message.mentions.users.first();
    targetUserId = targetUser.id;
  } else {
    // Try to parse user ID
    targetUserId = args[1];
    try {
      targetUser = await message.client.users.fetch(targetUserId);
    } catch {
      await message.reply('❌ لم يتم العثور على المستخدم.');
      return;
    }
  }

  try {
    // Get user data before deletion
    const userData = await db.getUserById(targetUserId);
    const userImages = await db.getUserImages(targetUserId);
    const userQuotes = await db.getUserQuotes(targetUserId);

    if (!userData && userImages.length === 0 && userQuotes.length === 0) {
      await message.reply(`❌ المستخدم ${targetUser.displayName} ليس لديه أي بيانات لحذفها.`);
      return;
    }

    // Delete all user data
    // Delete images (this will also delete likes due to foreign key cascade)
    for (const image of userImages) {
      await db.deleteImage(image.id, targetUserId);
    }

    // Delete quotes
    for (const quote of userQuotes) {
      await db.deleteQuote(quote.id, targetUserId);
    }

    // Reset username
    if (userData) {
      await db.setUsername(targetUserId, null);
    }

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🗑️ تم مسح بيانات المستخدم')
      .setDescription(`تم مسح جميع بيانات المستخدم ${targetUser.displayName}`)
      .addFields(
        { name: '📷 الصور المحذوفة', value: userImages.length.toString(), inline: true },
        { name: '💬 النبذات المحذوفة', value: userQuotes.length.toString(), inline: true },
        { name: '👤 اسم المستخدم', value: userData?.username ? 'تم إزالته' : 'لم يكن محدد', inline: true }
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: `تم بواسطة ${message.author.displayName}`, iconURL: message.author.displayAvatarURL() });

    await message.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in admin reset user command:', error);
    await message.reply('❌ حدث خطأ أثناء مسح بيانات المستخدم.');
  }
}

// Show Arabic Image Card (similar to profile.js but with Arabic text)
async function showArabicImageCard(message, userId, imageIndex, userImages, user, targetUser, userQuotes = []) {
  try {
    const currentImage = userImages[imageIndex];
    const imageUrl = currentImage.filename;

    // Create Instagram-style card using Discord URL
    const cardResult = await imageProcessor.createInstagramCard(
      imageUrl,
      targetUser.displayAvatarURL({ size: 128 }),
      user?.username || targetUser.displayName,
      currentImage.like_count,
      imageIndex + 1,
      userImages.length
    );

    // Check if this is a GIF
    let cardAttachment;
    if (cardResult.isGif) {
      cardAttachment = null;
    } else {
      cardAttachment = new AttachmentBuilder(await cardResult.getBufferAsync('image/png'), {
        name: 'instagram_card.png'
      });
    }

    // Create embed with Arabic text
    const embed = new EmbedBuilder()
      .setColor('#E1306C')
      .setTitle(`📸 معرض ${user?.username || targetUser.displayName}`)
      .setFooter({ 
        text: `الصورة ${imageIndex + 1} من ${userImages.length} • ${currentImage.like_count} إعجاب`,
        iconURL: targetUser.displayAvatarURL({ size: 32 })
      })
      .setTimestamp();

    // Set image source based on type
    if (cardResult.isGif) {
      embed.setImage(imageUrl);
      if (userQuotes && userQuotes.length > 0) {
        const quotesText = userQuotes.map((quote, index) => 
          `${index + 1}. "${quote.quote_text}"`
        ).join('\n');
        embed.setDescription(`🎬 **صورة متحركة** 🎬\n\n**النبذات:**\n${quotesText}`);
      } else {
        embed.setDescription('🎬 **صورة متحركة** 🎬');
      }
    } else {
      embed.setImage('attachment://instagram_card.png');
      
      if (userQuotes && userQuotes.length > 0) {
        const quotesText = userQuotes.map((quote, index) => 
          `${index + 1}. "${quote.quote_text}"`
        ).join('\n');
        embed.setDescription(`**النبذات:**\n${quotesText}`);
      }
    }

    // Create buttons with Arabic labels
    const buttons = [];

    if (userImages.length > 1) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`prev_${userId}_${imageIndex}_${message.author.id}`)
          .setLabel('السابق')
          .setEmoji('⬅️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(imageIndex === 0),
        new ButtonBuilder()
          .setCustomId(`next_${userId}_${imageIndex}_${message.author.id}`)
          .setLabel('التالي')
          .setEmoji('➡️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(imageIndex === userImages.length - 1)
      );
    }

    // Like button
    const hasLiked = await db.hasUserLikedImage(currentImage.id, message.author.id);
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`like_${currentImage.id}_${message.author.id}`)
        .setLabel(hasLiked ? 'إلغاء الإعجاب' : 'إعجاب')
        .setEmoji('❤️')
        .setStyle(hasLiked ? ButtonStyle.Danger : ButtonStyle.Primary)
    );

    // Support button
    buttons.push(
      new ButtonBuilder()
        .setLabel('دعم')
        .setStyle(ButtonStyle.Link)
        .setURL('https://guns.lol/i_q')
        .setEmoji('💖')
    );

    const actionRow = new ActionRowBuilder().addComponents(buttons);

    const replyData = {
      embeds: [embed],
      components: [actionRow],
      files: cardAttachment ? [cardAttachment] : []
    };

    await message.reply(replyData);

  } catch (error) {
    console.error('Error showing Arabic image card:', error);
    await message.reply('❤️ حدث خطأ أثناء عرض الصورة.');
  }
}

// Helper function to check if user has required role
function hasRequiredRole(member, roleId) {
  return member.roles.cache.has(roleId);
}

// Arabic Set Username Command (!اسم)
async function handleArabicSetUsername(message, args) {
  if (args.length < 2) {
    await message.reply('❤️ الاستخدام: `!اسم [الاسم_الجديد]`\nمثال: `!اسم محمد`');
    return;
  }

  const username = args.slice(1).join(' ');
  const userId = message.author.id;

  // Check if user has required role or is admin or has special privileges
  const isAdmin = userId === ADMIN_USER_ID;
  const hasSpecialPrivilege = specialUsernameUsers.has(userId);
  const hasRole = message.member && hasRequiredRole(message.member, ALLOWED_ROLE_ID);

  if (!isAdmin && !hasSpecialPrivilege && !hasRole) {
    await message.reply('❤️ ليس لديك صلاحية لاستخدام هذا الأمر. يجب أن يكون لديك الدور المطلوب.');
    return;
  }

  try {
    // Validate username format (English letters only) - unless admin or special user
    if (!isAdmin && !hasSpecialPrivilege) {
      // Regular users with role must have minimum 2 characters and only letters
      if (username.length < 2) {
        await message.reply('❤️ اسم المستخدم يجب أن يكون على الأقل حرفان.');
        return;
      }
      
      const usernameRegex = /^[a-zA-Z]+$/;
      if (!usernameRegex.test(username)) {
        await message.reply('❤️ اسم المستخدم يجب أن يحتوي على أحرف إنجليزية فقط (a-z, A-Z).');
        return;
      }
    } else {
      // Admin and special users can use any format but avoid dangerous characters
      const dangerousChars = /[<>"'&]/;
      if (dangerousChars.test(username)) {
        await message.reply('❤️ اسم المستخدم يحتوي على أحرف غير آمنة. تجنب: < > " \' &');
        return;
      }
    }

    // Check if username is already taken
    const existingUser = await db.getUserByUsername(username);
    if (existingUser && existingUser.id !== userId) {
      await message.reply('❤️ اسم المستخدم محجوز');
      return;
    }

    // Set the username
    await db.setUsername(userId, username);

    // Backup to Discord channel
    try {
      await db.backupToDiscord(message.client, userId);
    } catch (backupError) {
      console.log('Backup failed but username was saved:', backupError);
    }

    await message.reply(`✅ تم تعيين اسم المستخدم إلى **${username}**!`);

  } catch (error) {
    console.error('Error in Arabic setusername command:', error);
    await message.reply('❤️ حدث خطأ أثناء تعيين اسم المستخدم. حاول مرة أخرى.');
  }
}

// Admin Grant Privilege Command (!منح_صلاحية)
async function handleAdminGrantPrivilege(message, args) {
  // Check if user is admin
  if (message.author.id !== ADMIN_USER_ID) {
    await message.reply('❤️ ليس لديك صلاحية لاستخدام هذا الأمر.');
    return;
  }

  if (args.length < 2 && message.mentions.users.size === 0) {
    await message.reply('❤️ الاستخدام: `!منح_صلاحية [@مستخدم]` أو `!منح_صلاحية [معرف_المستخدم]` أو `!منح_صلاحية قائمة` لعرض القائمة');
    return;
  }

  // Check if user wants to see the list
  if (args[1] === 'قائمة') {
    const privilegedUsers = Array.from(specialUsernameUsers);
    const userList = await Promise.all(
      privilegedUsers.map(async (id) => {
        try {
          const user = await message.client.users.fetch(id);
          return `• ${user.displayName} (${id})`;
        } catch {
          return `• Unknown User (${id})`;
        }
      })
    );

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🔑 قائمة المستخدمين ذوي صلاحية اسم المستخدم الخاصة')
      .setDescription(userList.length > 0 ? userList.join('\n') : 'لا يوجد مستخدمون بصلاحيات خاصة')
      .setTimestamp()
      .setFooter({ text: `مجموع المستخدمين: ${privilegedUsers.length}`, iconURL: message.author.displayAvatarURL() });

    await message.reply({ embeds: [embed] });
    return;
  }

  let targetUserId;
  let targetUser;

  // Check for mentioned user
  if (message.mentions.users.size > 0) {
    targetUser = message.mentions.users.first();
    targetUserId = targetUser.id;
  } else {
    // Try to parse user ID
    targetUserId = args[1];
    try {
      targetUser = await message.client.users.fetch(targetUserId);
    } catch {
      await message.reply('❤️ لم يتم العثور على المستخدم.');
      return;
    }
  }

  try {
    // Check if user already has privileges
    if (specialUsernameUsers.has(targetUserId)) {
      // Remove privileges
      specialUsernameUsers.delete(targetUserId);
      
      const embed = new EmbedBuilder()
        .setColor('#FF4444')
        .setTitle('❌ تم إزالة الصلاحية')
        .setDescription(`تم إزالة صلاحية اسم المستخدم الخاصة من ${targetUser.displayName}`)
        .addFields(
          { name: '👤 المستخدم', value: targetUser.displayName, inline: true },
          { name: '🆔 معرف المستخدم', value: targetUserId, inline: true },
          { name: '📅 الحالة', value: 'تم إزالة الصلاحية', inline: true }
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `تم بواسطة ${message.author.displayName}`, iconURL: message.author.displayAvatarURL() });

      await message.reply({ embeds: [embed] });
    } else {
      // Grant privileges
      specialUsernameUsers.add(targetUserId);
      
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ تم منح الصلاحية')
        .setDescription(`تم منح صلاحية اسم المستخدم الخاصة لـ ${targetUser.displayName}`)
        .addFields(
          { name: '👤 المستخدم', value: targetUser.displayName, inline: true },
          { name: '🆔 معرف المستخدم', value: targetUserId, inline: true },
          { name: '📅 الحالة', value: 'تم منح الصلاحية', inline: true }
        )
        .addFields(
          { name: '✨ الميزات الجديدة', value: '• اختيار أي اسم مستخدم (أرقام ورموز)\n• عدم وجود قيود على الأحرف', inline: false }
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `تم بواسطة ${message.author.displayName}`, iconURL: message.author.displayAvatarURL() });

      await message.reply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Error in admin grant privilege command:', error);
    await message.reply('❤️ حدث خطأ أثناء معالجة صلاحية المستخدم.');
  }
}


