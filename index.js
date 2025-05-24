require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { deployCommands } = require('./deploy-commands');

const keepAlive = require('./server');
const startCron = require('./cron');

// Crear una nueva instancia del cliente con todos los intents necesarios
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions
  ]
});

// Colecciones para comandos
client.commands = new Collection();
client.slashCommands = new Collection();

// Prefijo para los comandos
const prefix = '!';

// Cargar comandos de prefijo
const prefixCommandsPath = path.join(__dirname, 'commands_prefix');
const prefixCommandFiles = fs.readdirSync(prefixCommandsPath).filter(file => file.endsWith('.js'));

for (const file of prefixCommandFiles) {
  const filePath = path.join(prefixCommandsPath, file);
  const command = require(filePath);
  
  if ('name' in command && 'execute' in command) {
    client.commands.set(command.name, command);
  } else {
    console.log(`[ADVERTENCIA] El comando en ${filePath} no tiene las propiedades "name" o "execute" requeridas.`);
  }
}

// Cargar comandos slash
const slashCommandsPath = path.join(__dirname, 'commands_slash');
const slashCommandFiles = fs.readdirSync(slashCommandsPath).filter(file => file.endsWith('.js'));

for (const file of slashCommandFiles) {
  const filePath = path.join(slashCommandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    client.slashCommands.set(command.data.name, command);
  } else {
    console.log(`[ADVERTENCIA] El comando en ${filePath} no tiene las propiedades "data" o "execute" requeridas.`);
  }
}

// Cargar eventos
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Manejar mensajes para comandos de prefijo
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);

  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (error) {
    console.error(error);
    await message.reply('¡Hubo un error al ejecutar el comando!');
  }
});

// Verificar que el bot solo opere en el servidor autorizado
client.on(Events.GuildCreate, guild => {
  if (guild.id !== process.env.GUILD_ID) {
    console.log(`[SEGURIDAD] Bot añadido a un servidor no autorizado: ${guild.name} (${guild.id}). Abandonando...`);
    guild.leave();
  } else {
    console.log(`[INFO] Bot añadido correctamente al servidor autorizado: ${guild.name} (${guild.id})`);
  }
});

// Manejar errores
process.on('unhandledRejection', error => {
  console.error('Error no manejado:', error);
});

// Evento ready para desplegar comandos
client.once(Events.ClientReady, async () => {
  console.log(`[INFO] Bot iniciado como ${client.user.tag}`);
  
  try {
    // Desplegar comandos slash
    await deployCommands(client);
    console.log('[INFO] Comandos slash desplegados correctamente');
  } catch (error) {
    console.error('[ERROR] Error al desplegar comandos:', error);
  }
});

// Iniciar sesión con el bot
client.login(process.env.TOKEN);

// Iniciar servidor y cron
keepAlive(client);
startCron(); 