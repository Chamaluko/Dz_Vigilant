# Comandos Slash

## Estructura de Comandos

Cada comando slash debe seguir una estructura específica y estar ubicado en la carpeta `commands_slash/`. La estructura básica incluye:

### Declaración del Módulo

```javascript
const declareModule = {
    name: 'nombre_del_comando',
    description: 'Descripción del comando',
    isEnabled: true,
    restriction: {
        roles: [], // IDs de roles permitidos
        ids: []    // IDs de usuarios permitidos
    }
};
```

#### Propiedades de la Declaración

- `name`: Nombre del comando (debe coincidir con el nombre del archivo)
- `description`: Descripción que aparecerá en Discord
- `isEnabled`: Booleano que determina si el comando se carga y registra
- `restriction`: Objeto que define las restricciones de uso
  - `roles`: Array de IDs de roles permitidos
  - `ids`: Array de IDs de usuarios permitidos

### Estructura del Comando

```javascript
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(declareModule.name)
        .setDescription(declareModule.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Verificación de restricciones
        if (declareModule.restriction.roles.length > 0 || declareModule.restriction.ids.length > 0) {
            const hasRole = interaction.member.roles.cache.some(role => 
                declareModule.restriction.roles.includes(role.id)
            );
            const hasId = declareModule.restriction.ids.includes(interaction.user.id);

            if (!hasRole && !hasId) {
                return interaction.reply({
                    content: '❌ No tienes permiso para usar este comando.',
                    ephemeral: true
                });
            }
        }

        // Lógica del comando
    }
};
```

## Sistema de Restricciones

El sistema de restricciones permite controlar quién puede usar cada comando:

1. Si `restriction.roles` está vacío y `restriction.ids` está vacío, el comando está disponible para todos los usuarios con los permisos básicos.
2. Si `restriction.roles` tiene IDs, solo los usuarios con esos roles pueden usar el comando.
3. Si `restriction.ids` tiene IDs, esos usuarios específicos pueden usar el comando.
4. Si ambos tienen valores, un usuario puede usar el comando si tiene alguno de los roles O es uno de los usuarios listados.

## Ejemplo de Uso

```javascript
const declareModule = {
    name: 'admin',
    description: 'Comando de administración',
    isEnabled: true,
    restriction: {
        roles: ['123456789'], // ID del rol de administrador
        ids: ['987654321']    // ID de un usuario específico
    }
};
```

## Comandos Especiales

### Comando /catalogo

Este comando genera catálogos de Discord basándose en datos de Google Sheets. Es un comando exclusivo para el dueño del servidor.

#### Configuración Requerida

Para usar este comando, necesitas configurar las siguientes variables de entorno:

- `OWNER_ID`: Tu ID de usuario de Discord
- `GOOGLE_SHEET_ID`: ID del Google Sheet con los datos
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Email de la cuenta de servicio de Google
- `GOOGLE_PRIVATE_KEY`: Clave privada de la cuenta de servicio

#### Parámetros del Comando

- `sheet_id` (opcional): ID específico del Google Sheet a usar. Si no se proporciona, usa `GOOGLE_SHEET_ID` del .env
- `hoja` (opcional): Nombre de la hoja específica dentro del documento. Por defecto: "Hoja1"
- `titulo` (opcional): Título personalizado para el catálogo. Por defecto: "Catálogo"

#### Ejemplo de Uso

```
/catalogo 
/catalogo titulo:Productos disponibles hoja:Inventario
/catalogo sheet_id:1A2B3C4D5E6F titulo:Catálogo especial
```

#### Características

- **Seguridad**: Solo el usuario especificado en `OWNER_ID` puede ejecutarlo
- **Paginación**: Si hay muchos elementos, se dividirán en múltiples embeds
- **Formato**: Muestra las primeras 3 columnas de cada fila en formato organizado
- **Información**: Incluye metadatos como nombre del documento y total de elementos

#### Requisitos de Google Sheets

1. El Google Sheet debe estar compartido con la cuenta de servicio
2. La cuenta de servicio debe tener permisos de lectura mínimo
3. El formato recomendado es tener headers en la primera fila

## Notas Importantes

1. El nombre del archivo debe coincidir con el nombre del comando.
2. Siempre incluir la declaración del módulo al inicio del archivo.
3. Implementar la verificación de restricciones en el método `execute`.
4. Usar `ephemeral: true` para respuestas que solo debe ver el usuario que ejecutó el comando.
5. Manejar errores apropiadamente y proporcionar mensajes claros al usuario. 