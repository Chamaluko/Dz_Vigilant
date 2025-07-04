const mongoose = require('mongoose');

// Configuración simple de eventos
mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB conectado correctamente');
});

mongoose.connection.on('error', (error) => {
    console.error('❌ Error MongoDB:', error);
});

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB desconectado');
});

// Función simple para conectar
async function connectDB() {
    try {
        const connectionString = process.env.DB_CONNECTION;
        
        if (!connectionString) {
            throw new Error('❌ DB_CONNECTION no definida en .env');
        }

        // Opciones básicas y limpias
        const options = {
            // Solo las opciones esenciales y compatibles
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };

        await mongoose.connect(connectionString, options);
        console.log('🚀 Conexión MongoDB establecida');
        
        return mongoose.connection;
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error);
        throw error;
    }
}

// Cerrar conexión limpiamente
async function disconnectDB() {
    try {
        await mongoose.connection.close();
        console.log('📊 MongoDB desconectado correctamente');
    } catch (error) {
        console.error('❌ Error cerrando MongoDB:', error);
    }
}

// Manejadores para cierre limpio del proceso
process.on('SIGINT', async () => {
    console.log('🔄 Cerrando aplicación...');
    await disconnectDB();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🔄 Terminando aplicación...');
    await disconnectDB();
    process.exit(0);
});

module.exports = { connectDB, disconnectDB }; 