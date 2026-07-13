const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages]
});

client.on('ready', () => {
    console.log(`✅ Greedy Hudzell Bot is online as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.content === '!verify') {
        const key = `GH-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
        try {
            await message.author.send(`Ваш ключ: **${key}**\nДействует: 24 часа\nИспользуй его на сайте!`);
            message.reply("✅ Ключ отправлен в ЛС!");
        } catch (e) {
            message.reply("Не удалось отправить ЛС. Откройте личные сообщения.");
        }
    }
    
    if (message.content === '!status') {
        message.reply("🟢 Greedy Hudzell: Работает | Версия 2.4.1");
    }
});

client.login(process.env.DISCORD_TOKEN);