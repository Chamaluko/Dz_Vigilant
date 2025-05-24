// Definición de las tablas de la base de datos
const TABLES = { 
    rolesBot: //roles que usara el bot
    `
        CREATE TABLE IF NOT EXISTS rolesBot (
            alias TEXT NOT NULL,
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            permissions TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,
    channelsBot: //canales que usara el bot
    `
        CREATE TABLE IF NOT EXISTS channelsBot (
            alias TEXT NOT NULL,
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            category TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,
    staticMessages: //mensajes estáticos del bot
    `
        CREATE TABLE IF NOT EXISTS staticMessages (
            id TEXT PRIMARY KEY,
            channel_id TEXT,
            alias TEXT UNIQUE,
            message_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (channel_id) REFERENCES channelsBot(id)
        )
    `
};

module.exports = TABLES; 