const { SlashCommandBuilder } = require('discord.js');

const { rolesBot } = require('../config/defaults.json');


const declareModule = {
    name: 'ping',
    description: 'Muestra la latencia del bot',
    isEnabled: true,
    restriction: {
        roles: ['dueño'],
        ids: []
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName(declareModule.name)
        .setDescription(declareModule.description),
    
    declareModule: declareModule,
    async execute(interaction) {

        const latency = Date.now() - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);

        await interaction.editReply(`🏓 Pong!\n📶 Latencia del bot: ${latency}ms\n🌐 Latencia de la API: ${apiLatency}ms`);
    },
}; 