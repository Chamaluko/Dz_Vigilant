// Archivo índice para exportar todos los modelos
// Esto permite hacer: const { RoleBot, ChannelBot, StaticMessage, DonationRequest } = require('./models');

const RoleBot = require('./RoleBot');
const ChannelBot = require('./ChannelBot');
const StaticMessage = require('./StaticMessage');
const DonationRequest = require('./DonationRequest');
const UserProfile = require('./UserProfile');
const CompletedDonation = require('./CompletedDonation');
const Ticket = require('./Ticket');
const Giveaway = require('./Giveaway');
const Prize = require('./Prize');

module.exports = {
    RoleBot,
    ChannelBot,
    StaticMessage,
    DonationRequest,
    UserProfile,
    CompletedDonation,
    Ticket,
    Giveaway,
    Prize
}; 