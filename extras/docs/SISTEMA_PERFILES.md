# 👤 Sistema de Perfiles de Usuario v2.0

## 📋 Descripción General
El sistema de perfiles permite a los usuarios gestionar su información personal, DZ Coins, niveles, logros y configurar preferencias dentro del servidor de Discord. Incluye navegación fluida y sistema completo de monedas virtuales.

## 🚀 Características Principales v2.0
- **Perfil personalizado** con información básica del usuario
- **💰 Sistema de DZ Coins** con niveles y experiencia
- **🔄 Navegación fluida** sin acumular mensajes
- **🏆 Sistema de logros** y badges automáticos
- **🎨 Temas personalizables** para embeds
- **📊 Estadísticas avanzadas** y análisis completo
- **⚙️ Configuración completa** de preferencias
- **🔒 Respuestas privadas** (ephemeral) exclusivas

## 💰 Sistema de DZ Coins

### Mecánicas de Obtención
- **🎁 Bienvenida**: 100 DZ Coins al crear perfil
- **📊 Donaciones aprobadas**: Mínimo 25 DZ Coins (5x la cantidad donada)
- **🎮 Subir de nivel**: Nivel × 10 DZ Coins
- **🏆 Logros**: 50 DZ Coins por logro desbloqueado
- **🔄 Restablecer configuración**: 10 DZ Coins bonus

### Sistema de Niveles
- **Experiencia base**: 100 XP para nivel 2
- **Progresión**: Escalado exponencial (1.5x por nivel)
- **Fuentes de XP**:
  - Actividad diaria: 5 XP
  - Donación aprobada: 50 XP
  - Interacciones del bot: Variable

### Logros Automáticos
- **🎉 Bienvenido**: Crear primer perfil
- **💎 Primer Donador**: Primera donación de cualquier cantidad
- **🌟 Donador Generoso**: Donación ≥ $50
- **👑 Gran Donador**: Donación ≥ $100

## 🔄 Navegación Fluida Implementada

### Mecánica de Navegación
```javascript
// Primer click desde canal estático
const isFromChannel = interaction.message.embeds[0].title === '👤 Sistema de Perfiles';

if (isFromChannel) {
    await interaction.reply({ ephemeral: true }); // Crear mensaje nuevo
} else {
    await interaction.update({ ephemeral: true }); // Reemplazar mensaje anterior
}
```

### Ventajas
- ✅ **Sin acumulación**: Mensajes anteriores se borran automáticamente
- ✅ **Experiencia fluida**: Sensación real de navegación
- ✅ **Menos spam**: Un solo mensaje ephemeral por usuario
- ✅ **Performance mejorada**: Menos mensajes en cache

## 🗄️ Base de Datos UserProfile

### Modelo Completo
```javascript
{
    // Identificación
    member_id: String (único),
    username: String,
    display_name: String,
    
    // Sistema de monedas
    dz_coins: Number (default: 0),
    total_coins_earned: Number (default: 0),
    total_coins_spent: Number (default: 0),
    
    // Sistema de niveles
    level: Number (default: 1),
    experience: Number (default: 0),
    experience_to_next_level: Number (default: 100),
    
    // Actividad
    total_messages: Number (default: 0),
    days_active: Number (default: 0),
    last_active: Date,
    
    // Configuración
    profile_theme: String (enum: [default, dark, light, purple, green, blue, gold]),
    show_stats: Boolean (default: true),
    notifications_enabled: Boolean (default: true),
    weekly_summary: Boolean (default: true),
    dm_notifications: Boolean (default: true),
    
    // Logros y badges
    achievements: [String],
    badges: [String],
    
    // Fechas importantes
    first_profile_creation: Date,
    last_profile_update: Date,
    joined_server_at: Date,
    
    // Estado
    is_active: Boolean (default: true),
    is_premium: Boolean (default: false),
    premium_until: Date
}
```

### Métodos Útiles
```javascript
// Gestión de monedas
userProfile.addCoins(amount, reason)
userProfile.spendCoins(amount, reason)

// Sistema de niveles
userProfile.addExperience(amount, reason)
userProfile.getProgressToNextLevel()
userProfile.getRank()

// Logros
userProfile.addAchievement(achievement)
userProfile.addBadge(badge)

// Configuración
userProfile.resetConfiguration()
userProfile.updateActivity()
```

## 🔘 Botones Implementados v2.0

### 1. 👤 Mi Perfil (`profile_view_button`)
**Información Mostrada:**
- Rango actual y nivel del usuario
- DZ Coins actuales y experiencia
- Progreso al siguiente nivel (%)
- Información básica (usuario, ID, rol)
- Sistema de monedas (actual/ganado/gastado)
- Fechas importantes y días en servidor
- Actividad de donaciones
- Logros recientes (hasta 5)

**Colores Dinámicos:**
Se adapta al tema seleccionado por el usuario:
- `default`: Púrpura (#9B59B6)
- `dark`: Gris oscuro (#2C2F33)
- `green`: Verde gaming (#00FF7F)
- `blue`: Azul profesional (#3498DB)
- `gold`: Oro premium (#FFD700)

### 2. 💰 Mis Donaciones (`profile_donations_button`)
**Funcionalidad Mejorada:**
- Integración completa con UserProfile
- Información de DZ Coins en tiempo real
- Total donado calculado automáticamente
- Recompensas ganadas por donaciones
- Vista sin donaciones con beneficios explicados

**Información Mostrada:**
- Rango, nivel y DZ Coins actuales
- Total donado y estadísticas generales
- Recompensas DZ Coins calculadas
- Últimas 5 donaciones con estados
- Fechas relativas de cada donación

### 3. 📊 Estadísticas (`profile_stats_button`)
**Análisis Completo:**
- Información del UserProfile integrada
- Sistema de niveles y experiencia
- Progreso al siguiente nivel
- Total de monedas ganadas/gastadas
- Tiempo en servidor con días activos
- Estadísticas de donaciones avanzadas
- Información de roles y permisos
- Logros desbloqueados (hasta 8)

### 4. ⚙️ Configurar (`profile_config_button`)
**Panel de Configuración:**
- Configuración actual del UserProfile
- Tema del perfil seleccionado
- Estado de notificaciones
- Opciones de privacidad
- Lista de temas disponibles
- Próximas características

### 5. 🔄 Restablecer (`profile_reset_button`)
**Confirmación Inteligente:**
- Muestra qué se conservará (DZ Coins, logros, nivel)
- Explica qué se restablecerá (configuración)
- Información del perfil actual
- Advertencia de irreversibilidad

### 6. ✅ Confirmar Restablecimiento (`profile_reset_confirm_button`)
**Proceso Completo:**
- Conserva valores importantes automáticamente
- Ejecuta `userProfile.resetConfiguration()`
- Otorga 10 DZ Coins como bonificación
- Muestra antes/después de la operación
- Confirma cambios aplicados

## 🔀 Flujo de Navegación v2.0

```
Canal #perfiles (Mensaje Estático)
├── Botón "Mi Perfil" → reply() → Vista principal
│   ├── "Ver Mis Donaciones" → update() → Historial
│   │   ├── "Volver al Perfil" → update() → Vista principal
│   │   └── "Ver Estadísticas" → update() → Análisis
│   ├── "Ver Estadísticas" → update() → Análisis
│   │   ├── "Volver al Perfil" → update() → Vista principal
│   │   └── "Ver Donaciones" → update() → Historial
│   └── "Configurar" → update() → Configuración
│       ├── "Volver al Perfil" → update() → Vista principal
│       ├── "Crear Ticket" → reply() → Sistema de tickets
│       └── "Restablecer" → update() → Confirmación
│           ├── "Sí, Restablecer" → update() → Ejecutar
│           └── "Cancelar" → update() → Volver a configuración
```

## 💰 Integración con Sistema de Donaciones

### Recompensas Automáticas
Cuando un staff aprueba una donación:

```javascript
// Calcular DZ Coins basado en cantidad donada
const donationAmount = parseFloat(donation.amount.replace(/[^0-9.]/g, '')) || 0;
const dzCoinsReward = Math.max(25, Math.floor(donationAmount * 5));

// Otorgar recompensas
userProfile.addCoins(dzCoinsReward, `Donación aprobada: $${donation.amount}`);
userProfile.addExperience(50, 'Donación aprobada');

// Logros automáticos
if (donationAmount >= 100) {
    userProfile.addAchievement('Gran Donador');
} else if (donationAmount >= 50) {
    userProfile.addAchievement('Donador Generoso');
} else {
    userProfile.addAchievement('Primer Donador');
}
```

### Feedback Mejorado
El mensaje de aprobación ahora incluye:
- DZ Coins otorgados específicos
- Experiencia ganada
- Logros desbloqueados
- Invitación a revisar el perfil

## 🎨 Sistema de Temas

### Temas Disponibles
```javascript
const themeColors = {
    'default': 0x9B59B6,  // Púrpura clásico
    'dark': 0x2C2F33,     // Tema oscuro
    'light': 0xFFFFFF,    // Tema claro
    'purple': 0x9B59B6,   // Púrpura alternativo
    'green': 0x00FF7F,    // Verde gaming
    'blue': 0x3498DB,     // Azul profesional
    'gold': 0xFFD700      // Oro premium
};
```

### Aplicación Automática
- Los embeds se colorean según el tema seleccionado
- Configuración persistente en base de datos
- Cambio inmediato al restablecer configuración

## 🏆 Sistema de Rangos

### Clasificación por Nivel
```javascript
userProfile.getRank() {
    if (this.level >= 50) return '🏆 Leyenda';
    if (this.level >= 40) return '💎 Diamante';
    if (this.level >= 30) return '🥇 Oro';
    if (this.level >= 20) return '🥈 Plata';
    if (this.level >= 10) return '🥉 Bronce';
    return '🆕 Novato';
}
```

### Progresión Visual
- Barra de progreso calculada automáticamente
- Experiencia actual/requerida mostrada
- Porcentaje de progreso al siguiente nivel

## 🔒 Seguridad y Privacidad v2.0

### Respuestas Ephemeral Mejoradas
```javascript
// Primer mensaje desde canal
if (isFromChannel) {
    await interaction.reply({ ephemeral: true });
} else {
    await interaction.update({ ephemeral: true });
}
```

### Protección de Datos
- Solo el usuario ve su información
- Perfiles creados automáticamente al primer uso
- Validación completa de member_id
- Manejo seguro de errores

## 📊 Métricas y Estadísticas

### Estadísticas Calculadas
- **Tiempo**: Días, semanas, meses en servidor
- **Actividad**: Días activos vs. días totales
- **Donaciones**: Total donado, métodos favoritos
- **Progreso**: Nivel, experiencia, logros
- **Monedas**: Ganadas, gastadas, disponibles
- **Eficiencia**: Tasa de éxito en donaciones

### Métodos Estáticos Útiles
```javascript
// Obtener top usuarios por nivel
UserProfile.getTopUsers(10)

// Obtener usuarios más ricos
UserProfile.getRichestUsers(10)

// Estadísticas del servidor
UserProfile.getServerStats()
```

## 🔧 Instalación y Configuración

### 1. Base de Datos
```bash
# El modelo UserProfile se crea automáticamente
# Exportado en extras/database/models/index.js
```

### 2. Configuración en defaults.json
```json
"profiles": {
    "alias": "profiles",
    "channel": "profiles",
    "title": "👤 Sistema de Perfiles",
    "description": "Mensaje explicativo...",
    "color": "0x9B59B6",
    "components": [...]
}
```

### 3. Activación
```bash
# Ejecutar /setup para crear canal y mensaje estático
# Los perfiles se crean automáticamente al primer uso
```

## 🚀 Próximas Características v3.0

### Planeadas
- **🛒 Tienda DZ Coins**: Comprar roles, items especiales
- **🎯 Misiones diarias**: Objetivos para ganar DZ Coins
- **🏅 Leaderboards**: Rankings públicos
- **🎨 Temas premium**: Colores personalizados
- **📱 Widgets**: Información en otros canales
- **⚔️ Competencias**: Eventos con recompensas

### Optimizaciones
- Cache de estadísticas complejas
- Paginación para historiales largos
- Exportación de datos de perfil
- API para consultas externas

---

**Versión:** 2.0  
**Última actualización:** Diciembre 2024  
**Características nuevas:** Navegación fluida, DZ Coins, Niveles, Logros automáticos  
**Autor:** Sistema DZ_VIGILANT Bot 