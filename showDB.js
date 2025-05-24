const db = require('./extras/database/indexDB');

async function showDatabase() {
    try {
        console.log('📊 Mostrando contenido de la base de datos...\n');

        // Mostrar roles
        console.log('👑 ROLES CONFIGURADOS:');
        console.log('=====================');
        const roles = await db.all('SELECT * FROM rolesBot');
        if (roles.length === 0) {
            console.log('No hay roles configurados');
        } else {
            // Agrupar por alias para detectar duplicados
            const roleGroups = roles.reduce((acc, role) => {
                if (!acc[role.alias]) acc[role.alias] = [];
                acc[role.alias].push(role);
                return acc;
            }, {});

            Object.entries(roleGroups).forEach(([alias, roleList]) => {
                console.log(`\n🔍 Alias: ${alias}`);
                console.log(`📊 Cantidad de entradas: ${roleList.length}`);
                if (roleList.length > 1) {
                    console.log('⚠️  ¡ADVERTENCIA! Este rol está duplicado');
                }
                roleList.forEach(role => {
                    console.log(`\n  ID: ${role.id}`);
                    console.log(`  Nombre: ${role.name}`);
                    console.log(`  Tipo: ${role.type}`);
                    console.log(`  Permisos: ${role.permissions}`);
                });
                console.log('---------------------');
            });
        }

        console.log('\n📝 CANALES CONFIGURADOS:');
        console.log('=====================');
        const channels = await db.all('SELECT * FROM channelsBot');
        if (channels.length === 0) {
            console.log('No hay canales configurados');
        } else {
            // Agrupar por alias para detectar duplicados
            const channelGroups = channels.reduce((acc, channel) => {
                if (!acc[channel.alias]) acc[channel.alias] = [];
                acc[channel.alias].push(channel);
                return acc;
            }, {});

            Object.entries(channelGroups).forEach(([alias, channelList]) => {
                console.log(`\n🔍 Alias: ${alias}`);
                console.log(`📊 Cantidad de entradas: ${channelList.length}`);
                if (channelList.length > 1) {
                    console.log('⚠️  ¡ADVERTENCIA! Este canal está duplicado');
                }
                channelList.forEach(channel => {
                    console.log(`\n  ID: ${channel.id}`);
                    console.log(`  Nombre: ${channel.name}`);
                    console.log(`  Tipo: ${channel.type}`);
                    console.log(`  Categoría: ${channel.category || 'Ninguna'}`);
                });
                console.log('---------------------');
            });
        }

    } catch (error) {
        console.error('❌ Error al mostrar la base de datos:', error);
    } finally {
        // Cerrar la conexión
        await db.close();
    }
}

// Ejecutar la visualización
showDatabase(); 