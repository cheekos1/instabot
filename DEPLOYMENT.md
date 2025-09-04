# Deployment Checklist for Render.com 🚀

## Pre-Deployment Setup

### 1. Discord Bot Application
- [ ] Go to [Discord Developer Portal](https://discord.com/developers/applications)
- [ ] Create new application
- [ ] Create bot in "Bot" section
- [ ] Copy bot token
- [ ] Copy Application ID (Client ID) from "General Information"
- [ ] Enable necessary bot permissions

### 2. Git Repository
- [ ] Initialize git repository: `git init`
- [ ] Add all files: `git add .`
- [ ] Commit: `git commit -m "Initial commit"`
- [ ] Push to GitHub/GitLab

## Render.com Deployment Steps

### 1. Create Web Service
- [ ] Go to [Render.com](https://render.com)
- [ ] Create account or log in
- [ ] Click "New +" → "Web Service"
- [ ] Connect GitHub/GitLab account
- [ ] Select your repository

### 2. Configure Service
**Build & Deploy**
- [ ] Build Command: `npm install`
- [ ] Start Command: `npm start`
- [ ] Root Directory: Leave blank (default)
- [ ] Node.js Version: Will use 20.15.1 (specified in `.node-version` file)

**Environment Variables**
Add these in the Render.com dashboard:
- [ ] `DISCORD_TOKEN` = `your_bot_token_here`
- [ ] `CLIENT_ID` = `your_application_id_here`
- [ ] `NODE_ENV` = `production` (optional)

**Note:** DO NOT set `PORT` - Render.com sets this automatically

### 3. Deploy
- [ ] Click "Create Web Service"
- [ ] Wait for deployment to complete
- [ ] Note the service URL (e.g., `https://your-app-name.onrender.com`)

### 4. Invite Bot to Server
Use this URL format, replacing `YOUR_CLIENT_ID`:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274877913088&scope=bot%20applications.commands
```

Required permissions:
- Send Messages
- Use Slash Commands
- Embed Links
- Attach Files
- Read Message History
- Add Reactions

## Post-Deployment Testing

### 1. Health Check
- [ ] Visit your service URL to see the status page
- [ ] Check `/health` endpoint for API status

### 2. Bot Testing
Test each command in Discord:
- [ ] `/help` - Shows help information
- [ ] `/setusername <name>` - Set username (English letters only)
- [ ] `/upload <image>` - Upload image (max 8MB, JPEG/PNG/GIF/WebP)
- [ ] `/profile [user]` - View profile gallery
- [ ] `/deleteimage <position>` - Delete image
- [ ] `/reorder <from> <to>` - Reorder images

### 3. Interactive Features
- [ ] Previous/Next buttons work
- [ ] Like/Unlike buttons update properly
- [ ] Like count updates in real-time
- [ ] No duplicate likes allowed

## Project Structure Overview

```
instabot/
├── commands/           # Slash commands
│   ├── setusername.js  # Set username (English only)
│   ├── upload.js       # Upload images (max 3)
│   ├── profile.js      # View gallery
│   ├── deleteimage.js  # Delete image
│   ├── reorder.js      # Reorder images
│   └── help.js         # Help command
├── events/             # Discord events
│   ├── ready.js        # Bot startup
│   └── interactionCreate.js # Button/command handling
├── utils/              # Utilities
│   ├── database.js     # SQLite database
│   ├── imageProcessor.js # Jimp image processing
│   └── validation.js   # Input validation
├── database/           # SQLite storage (auto-created)
├── images/            # Image uploads (auto-created)
├── index.js           # Main bot + Express server
├── config.js          # Configuration
├── index.html         # Web status page
└── package.json       # Dependencies
```

## Key Features ✨

### Instagram-Style Design
- Rounded profile pictures and image cards
- Clean, modern embeds
- Instagram color scheme (#E1306C)

### User Management
- Unique usernames (English letters only)
- Username validation and taken check
- User profile system

### Image Gallery
- Upload up to 3 images per user
- Supported formats: JPEG, PNG, GIF, WebP
- Maximum file size: 8MB
- Automatic image processing with rounded corners

### Interactive Navigation
- Previous/Next buttons for multiple images
- Real-time like system
- Spam prevention (one like per user per image)
- Dynamic button states

### Database
- SQLite for data persistence
- User profiles, images, and likes
- Proper relationships and constraints

### Server Integration
- Express.js web server for Render.com
- Health check endpoints
- Graceful shutdown handling

## Troubleshooting 🔍

### Common Issues

**Bot not responding:**
- Check environment variables are set correctly
- Verify bot token and client ID
- Ensure bot has proper permissions in Discord server

**Image upload fails:**
- Check file size (max 8MB)
- Verify file type (JPEG/PNG/GIF/WebP)
- Check Render.com logs for errors

**Username taken error:**
- Ensure using only English letters (a-z, A-Z)
- Try a different username
- Check database for existing usernames

**Deployment fails:**
- Check build logs in Render.com dashboard
- Verify package.json is correct
- Ensure all dependencies are listed

### Getting Help
1. Check Render.com deployment logs
2. Use `/health` endpoint to check bot status
3. Review Discord bot permissions
4. Check environment variables

## Security Notes 🔐

- Bot token is securely stored in Render.com environment variables
- No sensitive data in code repository
- Input validation for all user inputs
- Rate limiting to prevent spam
- Proper file type and size validation

## Performance 📊

- SQLite database for fast local queries
- Image processing with Jimp (Windows-compatible alternative to Canvas)
- Efficient button interaction handling
- Minimal memory footprint

Your Instagram Discord Bot is now ready for deployment! 🎉
