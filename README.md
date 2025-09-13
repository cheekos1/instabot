# Instagram Discord Bot 📸

A Discord bot that creates Instagram-style profile galleries with image uploads, likes, and smooth navigation.

## Features ✨

- **Instagram-style profiles** with rounded images and modern design
- **Username system** with English letter validation and uniqueness checks
- **Image gallery** - Upload up to 3 images per user
- **Like system** with spam prevention (one like per user per image)
- **Navigation** - Browse images with Previous/Next buttons
- **Image management** - Delete and reorder your uploaded images
- **Responsive design** - Clean embeds that look great on mobile and desktop

## Commands 🎮

| Command | Description |
|---------|-------------|
| `/setusername <name>` | Set your username (English letters only) |
| `/upload <image>` | Upload an image to your gallery (max 3) |
| `/profile [user]` | View your profile or someone else's gallery |
| `/deleteimage <position>` | Delete image at specific position (1-3) |
| `/reorder <from> <to>` | Move image from one position to another |
| `/help` | Show help and commands |

## Setup for Local Development 🛠️

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo>
   cd instabot
   npm install
   ```

2. **Create a Discord application:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to "Bot" section and create a bot
   - Copy the bot token
   - Go to "General Information" and copy the Application ID (Client ID)

3. **Set up environment variables:**
   Create a `.env` file with:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_application_id_here
   PORT=8888
   ```

4. **Run the bot:**
   ```bash
   npm start
   ```

## Deployment on Render.com 🌐

1. **Push your code to GitHub/GitLab**

2. **Create a new Web Service on Render.com:**
   - Connect your repository
   - Set build command: `npm install`
   - Set start command: `npm start`

3. **Add environment variables in Render.com dashboard:**
   ```
   DISCORD_TOKEN = your_bot_token_here
   CLIENT_ID = your_application_id_here
   PORT = (leave empty, Render will set this automatically)
   ```

4. **Deploy and get your service URL**

5. **Invite the bot to your server:**
   - Use this URL format:
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274877913088&scope=bot%20applications.commands
   ```
   - Replace `YOUR_CLIENT_ID` with your actual Client ID

## File Structure 📁

```
instabot/
├── commands/           # Slash commands
│   ├── setusername.js
│   ├── upload.js
│   ├── profile.js
│   ├── deleteimage.js
│   ├── reorder.js
│   └── help.js
├── events/             # Discord event handlers
│   ├── ready.js
│   └── interactionCreate.js
├── utils/              # Utility functions
│   ├── database.js
│   ├── imageProcessor.js
│   └── validation.js
├── database/           # SQLite database storage
├── images/             # Uploaded image storage
├── index.js            # Main bot file with Express server
├── config.js           # Configuration management
├── index.html          # Web interface for health checks
└── package.json
```

## Technical Details 🔧

- **Discord.js v14** with slash commands and button interactions
- **SQLite database** for user data, images, and likes
- **Jimp** for image processing and rounded corners
- **Express.js** web server for Render.com deployment
- **Rate limiting** to prevent spam
- **Error handling** and input validation

## Database Schema 🗃️

### Users Table
- `id` (TEXT) - Discord user ID
- `username` (TEXT) - Custom username
- `created_at` - Timestamp
- `updated_at` - Timestamp

### Images Table  
- `id` (INTEGER) - Auto-increment primary key
- `user_id` (TEXT) - Foreign key to users
- `filename` (TEXT) - Stored filename
- `original_name` (TEXT) - Original filename
- `position` (INTEGER) - Display order
- `created_at` - Timestamp

### Likes Table
- `id` (INTEGER) - Auto-increment primary key  
- `image_id` (INTEGER) - Foreign key to images
- `user_id` (TEXT) - Foreign key to users
- `created_at` - Timestamp
- Unique constraint on (image_id, user_id) to prevent duplicate likes

## Permissions Required 🔐

The bot needs these Discord permissions:
- Send Messages
- Use Slash Commands  
- Embed Links
- Attach Files
- Read Message History
- Add Reactions

## Troubleshooting 🔍

1. **"Username taken" error:** Try a different username with only English letters
2. **Image upload fails:** Check file size (max 8MB) and type (JPEG/PNG/GIF/WebP)
3. **Bot not responding:** Verify token and client ID in environment variables
4. **Database errors:** Check file permissions and disk space

## Support 💬

If you encounter issues:
1. Check the console logs for error details
2. Verify all environment variables are set correctly
3. Ensure the bot has proper permissions in your Discord server
4. For Render.com issues, check the deployment logs in your dashboard
