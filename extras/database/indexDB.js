const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const TABLES = require('./schema');

class Database {
    constructor() {
        this.db = null;
    }

    // Inicializar la base de datos
    async init() {
        // Asegurar que el directorio data existe
        const dataDir = path.join(__dirname, '../../../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Crear conexión
        this.db = new sqlite3.Database(path.join(dataDir, 'bot.db'));
        return this;
    }

    // Crear todas las tablas si no existen
    async ensureTables() {
        if (!this.db) {
            throw new Error('La base de datos no está inicializada. Llama a init() primero.');
        }

        console.log('📊 Verificando tablas de la base de datos...');
        for (const [tableName, query] of Object.entries(TABLES)) {
            await this.run(query);
            console.log(`✅ Tabla ${tableName} verificada`);
        }
        console.log('✨ Base de datos lista');
    }

    // Método para ejecutar queries
    async run(query, params = []) {
        if (!this.db) {
            throw new Error('La base de datos no está inicializada. Llama a init() primero.');
        }
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
                if (err) reject(err);
                resolve(this);
            });
        });
    }

    // Método para obtener una fila
    async get(query, params = []) {
        if (!this.db) {
            throw new Error('La base de datos no está inicializada. Llama a init() primero.');
        }
        return new Promise((resolve, reject) => {
            this.db.get(query, params, (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
    }

    // Método para obtener múltiples filas
    async all(query, params = []) {
        if (!this.db) {
            throw new Error('La base de datos no está inicializada. Llama a init() primero.');
        }
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });
    }

    // Cerrar la conexión
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

// Crear y exportar una instancia única
const db = new Database();
db.init().catch(console.error);
module.exports = db; 