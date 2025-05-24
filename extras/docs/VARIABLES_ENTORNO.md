# Variables de Entorno para DZ Vigilant Bot

Este documento explica las variables de entorno necesarias para el funcionamiento del bot y cómo configurarlas.

## Archivo .env

Debes crear un archivo llamado `.env` en la raíz del proyecto con las siguientes variables:

```
TOKEN=tu_token_aqui
CLIENT_ID=tu_client_id_aqui
CLIENT_SECRET=tu_client_secret_aqui
GUILD_ID=tu_guild_id_aqui
```

## Variables Obligatorias

### TOKEN
- **Descripción**: El token de autenticación de tu bot de Discord.
- **Cómo obtenerlo**: 
  1. Ve al [Portal de Desarrolladores de Discord](https://discord.com/developers/applications)
  2. Selecciona tu aplicación > Bot > Token
  3. Haz clic en "Copy" o "Reset Token" si necesitas uno nuevo

### CLIENT_ID
- **Descripción**: El identificador único de tu aplicación de Discord.
- **Cómo obtenerlo**:
  1. Ve al [Portal de Desarrolladores de Discord](https://discord.com/developers/applications)
  2. Selecciona tu aplicación > General Information
  3. Copia el "Application ID"

### GUILD_ID
- **Descripción**: El ID del servidor de Discord donde operará el bot.
- **Uso**: El bot está configurado para operar exclusivamente en este servidor.
- **Cómo obtenerlo**:
  1. Activa el "Modo desarrollador" en Discord (Configuración > Avanzado)
  2. Haz clic derecho en tu servidor > "Copiar ID"

## Variable Opcional

### CLIENT_SECRET
- **Descripción**: El secreto de cliente de tu aplicación.
- **Uso**: Necesario solo si implementas funcionalidades OAuth2 (como login con Discord).
- **Cómo obtenerlo**:
  1. Ve al [Portal de Desarrolladores de Discord](https://discord.com/developers/applications)
  2. Selecciona tu aplicación > General Information
  3. Copia el "Client Secret" o haz clic en "Reset Secret" si necesitas uno nuevo

## Seguridad

- **IMPORTANTE**: Nunca compartas tu TOKEN o CLIENT_SECRET.
- **NUNCA** subas el archivo `.env` a repositorios públicos (está incluido en `.gitignore`).
- Si sospechas que tu token ha sido comprometido, restablécelo inmediatamente en el Portal de Desarrolladores.

## Limitaciones del Bot

Este bot está configurado para operar **exclusivamente** en el servidor especificado por `GUILD_ID`. Si se intenta añadir a otro servidor, abandonará automáticamente. 