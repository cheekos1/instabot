const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const path = require('path');
const fs = require('fs');
const express = require('express');
const config = require('./config');

// Initialize Express app for Render.com
const app = express();

// Serve the HTML file
app.get('/', (req, res) => {
  const imagePath = path.join(__dirname, 'index.html');
  res.sendFile(imagePath);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    bot: client?.user?.tag || 'Not ready',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Start the Express server
app.listen(config.port, () => {
  console.log(`🔗 Web server listening on port ${config.port}`);
});

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Create collections for commands
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`📝 Loaded command: ${command.data.name}`);
    } else {
      console.log(`⚠️ Command at ${filePath} is missing required "data" or "execute" property.`);
    }
  }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
    console.log(`🎯 Loaded event: ${event.name}`);
  }
}

// Register slash commands
async function registerCommands() {
  const commands = [];
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.data) {
      commands.push(command.data.toJSON());
    }
  }
  
  const rest = new REST({ version: '10' }).setToken(config.token);
  
  try {
    console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);
    
    // Register commands globally
    const data = await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    );
    
    console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

// Error handling
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT. Gracefully shutting down...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM. Gracefully shutting down...');
  client.destroy();
  process.exit(0);
});

// Start the bot
async function startBot() {
  try {
    if (!config.token) {
      throw new Error('DISCORD_TOKEN environment variable is required');
    }
    
    if (!config.clientId) {
      throw new Error('CLIENT_ID environment variable is required');
    }
    
    // Register commands before logging in
    if (fs.existsSync(commandsPath) && fs.readdirSync(commandsPath).length > 0) {
      await registerCommands();
    }
    
    // Login to Discord
    await client.login(config.token);
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Initialize database and start bot
console.log('🔧 Initializing database...');
require('./utils/database'); // This will create tables

console.log('🚀 Starting Discord bot...');
startBot();
