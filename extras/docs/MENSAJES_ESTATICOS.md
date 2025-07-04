# 📝 Sistema de Mensajes Estáticos

## ¿Qué Son?
Los mensajes estáticos son mensajes que el bot envía **una sola vez** cuando se ejecuta `/setup`. Son mensajes persistentes que contienen embeds con botones interactivos.

## 🔄 **Flujo Completo:**

### 1. **Definición Centralizada** (`config/defaults.json`)
```json
"staticMessages": {
    "verify": {
        "alias": "verify",
        "channel": "verification",  // ← CANAL DONDE SE ENVÍA
        "title": "✅ Verificación",
        "description": "Mensaje de bienvenida...",
        "color": "0x00FF00",
        "components": [
            {
                "type": "button",
                "style": "Success",
                "label": "Verificar",
                "emoji": "✅",
                "customId": "verify_button"
            }
        ]
    }
}
```

### 2. **Sistema Automático** (`staticMessages.js`)
```javascript
// ✅ AHORA ES COMPLETAMENTE AUTOMÁTICO
const channelAlias = messageConfig.channel;
if (channelAlias) {
    channelConfig = await ChannelBot.findByAlias(channelAlias);
}
```

### 3. **Ejecución** (Comando `/setup`)
- `StaticMessageManager.checkAndSendMessages()` se ejecuta al final de setup
- Lee todos los mensajes de `defaults.json`
- Para cada mensaje:
  - ✅ Verifica si ya existe en la base de datos
  - ✅ Si existe, verifica que el mensaje aún esté en Discord
  - ✅ Si no existe o fue borrado, lo vuelve a crear
  - ✅ Envía el mensaje al canal correspondiente
  - ✅ Guarda en la DB: `{id, channel_id, alias, message_data}`

### 4. **Manejo de Interacciones** (`interactionCreate.js`)
```javascript
// Los botones se manejan aquí por customId
if (interaction.customId === 'verify_button') { ... }
if (interaction.customId === 'create_ticket_button') { ... }
if (interaction.customId === 'close_ticket_button') { ... }
```

## 🎫 **Mensajes Actuales:**

| Mensaje | Canal | Botón | Función |
|---------|-------|-------|---------|
| `verify` | `verification` | ✅ Verificar | Asigna rol "Superviviente" |
| `tickets` | `tickets` | 🎫 Crear Ticket | Crea canal privado de soporte |

## ➕ **Cómo Agregar Nuevos Mensajes (CENTRALIZADO):**

### Paso 1: Agregar Canal (si es necesario)
```json
"channelsBot": {
    "nuevo_canal": {
        "alias": "Nuevo Canal",
        "description": "Descripción del canal",
        "type": "text"
    }
}
```

### Paso 2: Definir Mensaje (TODO EN UN LUGAR)
```json
"staticMessages": {
    "nuevo_mensaje": {
        "alias": "nuevo_mensaje",
        "channel": "nuevo_canal",        // ← AQUÍ DEFINES EL CANAL
        "title": "🆕 Título",
        "description": "Descripción...",
        "color": "0xFF0000",
        "components": [
            {
                "type": "button",
                "style": "Primary",
                "label": "Acción",
                "emoji": "🆕",
                "customId": "nuevo_button"
            }
        ]
    }
}
```

### Paso 3: Manejar Interacción (SOLO SI TIENE BOTONES)
```javascript
else if (interaction.customId === 'nuevo_button') {
    // Lógica del botón
}
```

### ✅ **¡Ya NO necesitas tocar staticMessages.js!** 
El sistema lee automáticamente el campo `channel` de cada mensaje.

## 🔧 **Sistema de Tickets Implementado:**

### Funcionalidades:
- ✅ **Crear Ticket**: Canal privado con permisos solo para el usuario y staff
- ✅ **Permisos Automáticos**: Solo el creador + dueño/admin/mod pueden ver
- ✅ **Cerrar Ticket**: Botón para eliminar el canal (5 segundos de espera)
- ✅ **Validación de Permisos**: Solo creador o staff pueden cerrar

### Estructura del Ticket:
```
ticket-{username}
├── Permisos: Privado
├── Usuarios: Creador + Staff roles
└── Funciones: Ver, enviar, leer historial
```

## 🚀 **Para Ejecutar:**
1. Ejecuta `/setup` como administrador
2. Configura todos los roles y canales
3. Los mensajes estáticos se enviarán automáticamente
4. ¡Los usuarios pueden interactuar con los botones!

## 🎯 **Ventajas del Sistema Centralizado:**

### ✅ **Antes (Sistema Descentralizado):**
- Definir mensaje en `defaults.json`
- Mapear canal en `staticMessages.js` (hardcoded)
- Manejar botón en `interactionCreate.js`
- **3 archivos diferentes** para cada mensaje

### 🚀 **Ahora (Sistema Centralizado):**
- Definir mensaje + canal en `defaults.json` (TODO EN UNO)
- Sistema automático lee el campo `channel`
- Solo manejar botón si es necesario
- **1-2 archivos** para cada mensaje

### 💡 **Beneficios:**
- ✅ **Más fácil agregar mensajes** (solo editar defaults.json)
- ✅ **Menos código duplicado**
- ✅ **Menos errores** (no hay que sincronizar múltiples archivos)
- ✅ **Más mantenible** (un solo lugar para cada mensaje)
- ✅ **Escalable** (agregar 100 mensajes sin tocar staticMessages.js)

## 📋 **Notas Importantes:**
- Los mensajes se envían **solo una vez** por servidor
- Si borras un mensaje, se volverá a crear en el próximo `/setup`
- Los mensajes se guardan en MongoDB para control
- Los componentes (botones) son completamente funcionales
- **Campo `channel` es obligatorio** para cada mensaje estático

## 🧪 **Ejemplo Completo: Agregar Mensaje de Reglas**

### Paso 1: Agregar en `defaults.json`
```json
"staticMessages": {  
    "reglas": {
        "alias": "reglas",
        "channel": "rules",                    // ← SE ENVIARÁ AL CANAL 'rules'
        "title": "📋 Reglas del Servidor",
        "description": "Aquí están las reglas principales:\n\n1. Respeta a todos\n2. No spam\n3. Sé amable",
        "color": "0xFF9900",
        "components": [
            {
                "type": "button",
                "style": "Secondary", 
                "label": "He leído las reglas",
                "emoji": "✅",
                "customId": "accept_rules_button"
            }
        ]
    }
}
```

### Paso 2: Manejar botón (en `interactionCreate.js`)
```javascript
else if (interaction.customId === 'accept_rules_button') {
    await interaction.reply({ 
        content: '✅ ¡Gracias por leer las reglas!', 
        ephemeral: true 
    });
}
```

### Resultado:
- ✅ Al ejecutar `/setup`, el mensaje se enviará automáticamente al canal `rules`
- ✅ El botón funcionará según tu lógica
- ✅ **NO** necesitas tocar `staticMessages.js`
- ✅ Todo está centralizado en `defaults.json`

### 🎉 **¡Sistema Completamente Centralizado!** 