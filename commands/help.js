const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help and learn how to use the Instagram bot'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor('#E1306C')
      .setTitle('📸 Instagram Discord Bot - Help')
      .setDescription('Welcome to the Instagram-style profile gallery bot! Here\'s how to get started:')
      .addFields(
        {
          name: '👤 **Username Commands**',
          value: '`/setusername <name>` - Set your display username (English letters only)\n**Note:** If username is taken, you\'ll see "❌ Username taken"',
          inline: false
        },
        {
          name: '📷 **Image Commands**',
          value: '`/upload <image>` - Upload an image to your gallery (max 3 images)\n`/deleteimage <position>` - Delete image at specific position (1, 2, or 3)\n`/reorder <from> <to>` - Move image from one position to another',
          inline: false
        },
        {
          name: '💬 **Quote Commands**',
          value: '`/addquote <quote>` - Add a status quote to your profile (max 3 quotes)\n`/deletequote <position>` - Delete quote at specific position (1, 2, or 3)\n\n**Note:** Quotes appear below your images on your profile!',
          inline: false
        },
        {
          name: '🖼️ **Gallery Commands**',
          value: '`/profile [user]` - View your profile or someone else\'s gallery\n\n**Navigation:**\n⬅️ Previous - Go to previous image\n➡️ Next - Go to next image\n❤️ Like/Unlike - Like or unlike the current image',
          inline: false
        },
        {
          name: '✨ **Features**',
          value: '• **Rounded corners** on all images for that Instagram look\n• **Like system** with spam prevention (can\'t like the same image twice)\n• **Real-time updates** when you like/unlike images\n• **Clean embeds** showing profile picture, username, and like count',
          inline: false
        },
        {
          name: '📋 **Limits & Rules**',
          value: '• Maximum 3 images per user\n• Maximum 3 quotes per user (max 200 characters each)\n• Images: JPEG, PNG, GIF, WebP (max 8MB)\n• Usernames: English letters only (a-z, A-Z)\n• Each user can like each image only once',
          inline: false
        }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: 'Need more help? Contact the server administrators!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
