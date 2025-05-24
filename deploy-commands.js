require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Verificar variables de entorno necesarias
const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
    console.error('❌ Faltan variables de entorno necesarias. Verifica tu archivo .env');
    process.exit(1);
}

/**
 * Función para desplegar los comandos slash
 * @param {Client} client - Cliente de Discord
 * @returns {Promise<void>}
 * @description Esta función solo actualiza el registro de comandos slash en Discord.
 * No afecta a datos sensibles, configuraciones guardadas o funcionalidades en memoria.
 */
async function deployCommands(client) {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands_slash');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    // Cargar comandos
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        // Verificar si el comando tiene la estructura correcta
        if (!command.data || !command.execute) {
            console.warn(`⚠️ El comando en ${file} no tiene la estructura correcta.`);
            continue;
        }

        // Verificar si el comando tiene declareModule
        if (!command.declareModule) {
            console.warn(`⚠️ El comando en ${file} no tiene declareModule. Omitiendo...`);
            continue;
        }
        
        // Verificar si el comando está habilitado
        if (command.declareModule && command.declareModule.isEnabled === false) {
            console.log(`⏭️ Comando ${file} deshabilitado. Omitiendo...`);
            continue;
        }


        commands.push(command.data.toJSON());
    }

    // Crear instancia REST
    const rest = new REST().setToken(TOKEN);

    try {
        console.log(`🔄 Iniciando registro de ${commands.length} comandos...`);

        // Registrar comandos específicamente para el servidor
        const data = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );

        console.log(`✅ Se han registrado ${data.length} comandos exitosamente.`);
        
        // Actualizar el mapa de comandos en el cliente
        if (!client.slashCommands) {
            client.slashCommands = new Map();
        }
        
        // Limpiar solo el mapa de comandos slash
        client.slashCommands.clear();
        
        // Cargar los nuevos comandos
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            
            // Verificar si el comando tiene declareModule y está habilitado
            if (command.declareModule && command.declareModule.isEnabled !== false) {
                client.slashCommands.set(command.data.name, command);
            }
        }
        
        // Preservar datos importantes en memoria
        if (client.verificationMessages) {
            console.log(`[INFO] Preservando ${client.verificationMessages.size} mensajes de verificación activos`);
        }
        
    } catch (error) {
        console.error('❌ Error al registrar los comandos:', error);
        throw error;
    }
}

module.exports = { deployCommands }; 