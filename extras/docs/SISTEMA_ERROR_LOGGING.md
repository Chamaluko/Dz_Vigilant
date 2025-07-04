# 📋 Sistema de Error Logging - Documentación

## 🔥 Descripción General

El sistema de error logging del bot es un componente crítico que captura, procesa y registra automáticamente todos los errores que ocurren durante la ejecución del bot. Está diseñado para funcionar incluso cuando hay problemas de conectividad con MongoDB o Discord.

## 🔧 Arquitectura del Sistema

### Componentes Principales

1. **ErrorLogger** (`extras/tools/errorLogger.js`) - Clase principal del sistema
2. **Event Listeners** - Capturan errores de Discord.js y Node.js
3. **Buffer System** - Almacena errores temporalmente cuando el canal no está disponible
4. **Fallback System** - Múltiples métodos para encontrar el canal de errores
5. **Integración Global** - Disponible en todo el sistema via `global.errorLogger`

### Inicialización Automática

El sistema se inicializa automáticamente cuando el bot se conecta:

```javascript
// En events/ready.js
global.errorLogger = new ErrorLogger(client);
```

## 🎯 Tipos de Errores Capturados

### 1. Errores de Discord.js
- **client.on('error')** - Errores críticos del cliente
- **client.on('warn')** - Advertencias del cliente
- **client.on('shardError')** - Errores específicos de shard

### 2. Errores de Node.js Process
- **process.on('uncaughtException')** - Excepciones no capturadas
- **process.on('unhandledRejection')** - Promesas rechazadas sin handler
- **process.on('warning')** - Advertencias del proceso

### 3. Errores de Interacciones
- **Comandos slash** - Errores durante la ejecución
- **Botones** - Errores al procesar botones
- **Modales** - Errores en formularios

## 🔄 Sistema de Severidad

### Niveles de Severidad

- **🔴 CRITICAL** - Errores críticos (shards, uncaught exceptions)
- **🟠 HIGH** - Errores importantes (unhandled rejections)
- **🟡 NORMAL** - Errores normales (comandos, interacciones)
- **🔵 LOW** - Errores menores (warnings)

### Colores de Embeds

```javascript
const severityColors = {
  'CRITICAL': 0xFF0000,  // Rojo intenso
  'HIGH': 0xFF6B00,      // Naranja
  'NORMAL': 0xFFAA00,    // Amarillo
  'LOW': 0x00AAFF       // Azul
};
```

## 📡 Sistema de Fallback para Canal de Errores

### Método 1: MongoDB (Preferido)
```javascript
const errorChannel = await ChannelBot.findByAlias('errors');
```

### Método 2: Canal Hardcodeado
```javascript
const channel = this.client.channels.cache.get(this.hardcodedChannelId);
```

### Método 3: Búsqueda por Nombre
```javascript
const channelByName = guildChannels.find(ch => 
  ch.name.toLowerCase().includes('error') || 
  ch.name.toLowerCase().includes('bot-error') ||
  ch.name.toLowerCase() === 'bot-errors'
);
```

## 📦 Sistema de Buffer

### Funcionalidad del Buffer
- **Propósito**: Almacenar errores cuando el canal no está disponible
- **Capacidad**: 50 errores máximo
- **Comportamiento**: FIFO (First In, First Out)
- **Procesamiento**: Automático cuando el canal vuelve a estar disponible

### Estructura del Buffer
```javascript
{
  error: Error,
  context: Object,
  isCritical: Boolean,
  timestamp: Date,
  bufferedAt: Number,
  errorNumber: Number
}
```

## 🎛️ Configuración y Uso

### Configuración Automática
```javascript
// Se ejecuta automáticamente 3 segundos después de ready
setTimeout(async () => {
  const errorChannel = guildChannels.find(ch => 
    ch.name.toLowerCase() === 'bot-errors'
  );
  
  if (errorChannel) {
    global.errorLogger.setHardcodedChannel(errorChannel.id);
  }
}, 3000);
```

### Uso Manual
```javascript
// Registrar error personalizado
global.errorLogger.logError(error, {
  type: 'CUSTOM_ERROR',
  severity: 'HIGH',
  source: 'Mi Módulo',
  user: 'Usuario123',
  command: 'mi-comando'
});

// Registrar error de interacción
global.errorLogger.logInteractionError(error, interaction);
```

## 📊 Comando de Monitoreo

### `/bot_status`
Comando administrativo que muestra:

#### Información del Bot
- Nombre, ID, servidores, usuarios
- Estado de conectividad, ping, uptime
- Uso de memoria (heap, total, externa, RSS)

#### Sistema de Errores
- Total de errores capturados
- Errores en buffer
- Uptime del logger
- Estado del canal de errores

#### Salud del Sistema
- Diagnóstico automático
- Sugerencias de mejora
- Alertas de rendimiento

### Ejemplo de Uso
```bash
/bot_status
```

## 🔍 Estructura de Embeds de Error

### Embed Principal
```javascript
const errorEmbed = new EmbedBuilder()
  .setTitle('🚨 Error del Bot (CRÍTICO)')
  .setColor(0xFF0000)
  .setTimestamp()
  .addFields([
    { name: '🔥 Severidad', value: 'CRITICAL 🚨' },
    { name: '📂 Tipo', value: 'SHARD_ERROR' },
    { name: '📍 Fuente', value: 'Discord.js Shard 0' },
    { name: '❌ Error', value: '```Error message...```' },
    { name: '📋 Stack Trace', value: '```Stack trace...```' },
    { name: '📊 Estadísticas', value: 'Uptime: 1h 30m\nError #42' }
  ]);
```

### Información Contextual
- **👤 Usuario**: Quién causó el error
- **🏛️ Servidor**: En qué servidor ocurrió
- **🔧 Comando**: Qué comando falló
- **📡 Canal**: En qué canal ocurrió
- **⏱️ Tiempo**: Cuándo ocurrió

## 📈 Estadísticas y Métricas

### Estadísticas Básicas
```javascript
const stats = global.errorLogger.getStats();
// {
//   errorCount: 42,
//   uptime: 5400,
//   formattedUptime: "1h 30m",
//   bufferedErrors: 3
// }
```

### Estadísticas Detalladas
```javascript
const detailedStats = global.errorLogger.getDetailedStats();
// Incluye información de sistema, memoria, conectividad
```

## 🚨 Alertas y Notificaciones

### Errores Críticos
- **Contenido**: `🚨 **ERROR CRÍTICO DEL BOT** 🚨`
- **Embeds**: Rojos con información completa
- **Stack Trace**: Incluido para debugging

### Errores del Buffer
- **Resumen**: Embed con información del período
- **Recuperación**: Cada error individual con contexto
- **Timing**: Información de cuándo ocurrió originalmente

## 🛠️ Troubleshooting

### Problemas Comunes

#### 1. El canal no recibe errores
**Causa**: MongoDB desconectado o canal no encontrado
**Solución**: Verificar conectividad y configurar canal hardcodeado

#### 2. Errores en buffer creciendo
**Causa**: Problemas persistentes de conectividad
**Solución**: Reiniciar bot o verificar canal de errores

#### 3. Spam de errores
**Causa**: Error recurrente no resuelto
**Solución**: Identificar root cause y corregir

### Logs de Debug
```bash
# Búsqueda de canal
✅ [ERROR-LOGGER] Canal encontrado via MongoDB: bot-errors
⚠️ [ERROR-LOGGER] MongoDB no disponible, usando fallbacks...
✅ [ERROR-LOGGER] Canal encontrado via hardcode: bot-errors

# Envío de errores
✅ [ERROR-LOGGER] Error #42 enviado al canal bot-errors
📦 [ERROR-LOGGER] Error #43 guardado en buffer (3/50)
📤 [ERROR-LOGGER] Procesando 3 errores del buffer...
```

## 🎯 Mejores Prácticas

### Para Desarrolladores
1. **Siempre verificar** `global.errorLogger` antes de usar
2. **Proporcionar contexto** detallado en errores personalizados
3. **Usar severidad apropiada** según el impacto del error
4. **No duplicar logging** - el sistema ya captura automáticamente

### Para Administradores
1. **Monitorear regularmente** con `/bot_status`
2. **Revisar canal de errores** diariamente
3. **Actuar rápidamente** en errores críticos
4. **Mantener canal accesible** para el bot

## 📅 Mantenimiento

### Tareas Regulares
- Verificar estado del sistema con `/bot_status`
- Revisar errores críticos y recurrentes
- Limpiar logs antiguos si es necesario
- Actualizar configuración según cambios

### Actualizaciones
- El sistema se actualiza automáticamente con el bot
- Cambios en la configuración requieren reinicio
- Nuevas funcionalidades se documentan aquí

---

## 🔗 Archivos Relacionados

- `extras/tools/errorLogger.js` - Clase principal
- `events/ready.js` - Inicialización
- `commands_slash/bot_status.js` - Comando de monitoreo
- `config/defaults.json` - Configuración del canal
- `extras/handlers/` - Integración con handlers 