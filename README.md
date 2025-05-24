# 🧟 DZ Vigilant - Bot de Discord para servidores de DayZ

Un bot de Discord temático de DayZ para ayudar a administrar y mejorar la experiencia en tu servidor de Discord dedicado a DayZ.

## 📋 Características

- **Comando de superviviente**: Muestra estadísticas simuladas de un jugador con temática DayZ
- **Botiquín de consejos**: Proporciona consejos aleatorios sobre supervivencia en DayZ
- **Sistema de ayuda**: Comando para mostrar la lista de comandos disponibles
- **Comando de ping**: Verifica la latencia del bot
- **Sistema de anuncios**: Envía anuncios con formato de transmisión de emergencia
- **Configuración de canales por alias**: Permite referenciar canales por un alias en la configuración

## 🛠️ Configuración

### Requisitos previos
- [Node.js](https://nodejs.org/) (v16.9.0 o superior)
- Una [aplicación de Discord](https://discord.com/developers/applications)

### Instalación

1. Clona este repositorio o descarga los archivos
2. Instala las dependencias:
   ```
   npm install
   ```
3. Crea un archivo `.env` en la raíz del proyecto (ver [docs/VARIABLES_ENTORNO.md](docs/VARIABLES_ENTORNO.md) para más detalles):
   ```
   TOKEN=tu_token_de_discord_aqui
   CLIENT_ID=id_de_tu_aplicacion
   CLIENT_SECRET=tu_client_secret_aqui
   GUILD_ID=id_de_tu_servidor_discord
   ```
4. Configura los canales del bot copiando y editando el archivo de ejemplo:
   ```
   cp extras/config/channels.json.example extras/config/channels.json
   ```
   Luego edita el archivo `extras/config/channels.json` con los IDs de tus canales.

### Configuración de la aplicación Discord

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Crea una nueva aplicación o usa una existente
3. Ve a la sección "Bot" y haz clic en "Add Bot"
4. Activa los "Privileged Gateway Intents" (especialmente "SERVER MEMBERS INTENT" y "MESSAGE CONTENT INTENT")
5. Copia el token del bot y guárdalo en tu archivo `.env`
6. Ve a OAuth2 > URL Generator:
   - Selecciona los scopes: `bot` y `applications.commands`
   - Selecciona los permisos: `Send Messages`, `Embed Links`, `Read Message History`, etc.
   - Usa el enlace generado para invitar al bot a tu servidor

## 🚀 Uso

1. Registra los comandos slash:
   ```
   node deploy-commands.js
   ```

2. Inicia el bot:
   ```
   npm start
   ```

## 📝 Comandos disponibles

- `/ping` - Verifica si el bot está funcionando y muestra la latencia
- `/superviviente [usuario]` - Muestra estadísticas simuladas de supervivencia para un usuario
- `/botiquin` - Proporciona un consejo aleatorio sobre supervivencia en DayZ
- `/ayuda` - Muestra la lista de comandos disponibles
- `/anuncio [mensaje] [canal|alias]` - Envía un anuncio con formato de transmisión de emergencia

## 🗂️ Estructura del proyecto

```
DZ_VIGILANT/
├── commands/             # Comandos slash
│   ├── ayuda.js
│   ├── botiquin.js
│   ├── ping.js
│   ├── superviviente.js
│   └── anuncio.js
├── events/               # Eventos del bot
│   ├── interactionCreate.js
│   └── ready.js
├── extras/               # Funcionalidades adicionales
│   ├── config/           # Archivos de configuración
│   │   └── channels.json # Configuración de canales (crear a partir del ejemplo)
│   └── tools/            # Herramientas y utilidades
│       ├── manageTools.js
│       └── messageUtils.js
├── docs/                 # Documentación
│   └── VARIABLES_ENTORNO.md
├── index.js              # Punto de entrada principal
├── deploy-commands.js    # Registra comandos slash
├── .env                  # Variables de entorno (crear manualmente)
├── package.json          # Dependencias
└── README.md             # Este archivo
```

## 🔒 Seguridad

- El bot está configurado para **operar exclusivamente** en el servidor especificado por `GUILD_ID`.
- Si se intenta añadir a otro servidor, abandonará automáticamente.
- Consulta [docs/VARIABLES_ENTORNO.md](docs/VARIABLES_ENTORNO.md) para más información sobre seguridad.

## 🛠️ Personalización

Puedes modificar o añadir comandos en la carpeta `commands/`, y eventos en la carpeta `events/`.

## 📄 Licencia

Este proyecto está bajo la Licencia ISC.

---

¡Sobrevive y mantente alerta! 🧟‍♂️ 