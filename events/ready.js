module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`🚀 ${client.user.tag} is online and ready!`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers with ${client.users.cache.size} users`);
  }
};
