# 🎁 Sistema de Donaciones/Reclamos - DZ Vigilant

## 📋 Descripción

Sistema completo para gestionar reclamos de premios de donaciones ya realizadas por jugadores. Incluye tickets privados, formularios, base de datos y panel administrativo.

---

## 🚀 Características Principales

### ✨ Para Usuarios
- **Formulario simplificado** con 3 campos (cantidad, método de pago, comentarios)
- **Tickets privados** con formato `donation-{member.id}`
- **Sistema de comprobantes** - subir archivos en el ticket
- **Tiempo ampliado** - 1 hora para cerrar tickets
- **Reapertura de tickets** disponible

### 🛠️ Para Staff
- **Panel administrativo** completo via `/donaciones`
- **Base de datos** completa para seguimiento
- **Estadísticas en tiempo real**
- **Búsqueda por usuario**
- **Estados de seguimiento**: pending, approved, rejected, closed, reopened

---

## 🗄️ Base de Datos

### Modelo: DonationRequest

```javascript
{
  id: String,                    // ID único generado
  member_id: String,             // Discord member ID
  member_username: String,       // Username de Discord
  channel_id: String,            // ID del canal del ticket
  status: String,                // Estado: pending, approved, rejected, closed, reopened
  amount: String,                // Cantidad donada
  payment_method: String,        // Método de pago usado
  comments: String,              // Comentarios del usuario
  staff_notes: String,           // Notas del staff
  approved_by: String,           // ID del staff que procesó
  approved_by_username: String,  // Username del staff
  approved_at: Date,             // Fecha de procesamiento
  closed_at: Date,               // Fecha de cierre
  reopened_at: Date,             // Fecha de reapertura
  reopened_by: String,           // ID de quien reabrió
  created_at: Date,              // Fecha de creación
  updated_at: Date               // Fecha de actualización
}
```

---

## 🎮 Flujo de Usuario

### 1. Crear Reclamo
1. Usuario hace clic en "Reclamar Premios" en canal donaciones
2. Completa formulario con 3 campos
3. Se crea ticket privado `donation-{member.id}`
4. **Se guarda automáticamente en base de datos** con estado `pending`

### 2. Verificación de Comprobante
1. Usuario sube comprobante como archivo en ticket
2. Staff revisa y decide aprobar/rechazar
3. **Estado se actualiza automáticamente en BD**

### 3. Cierre y Reapertura
1. Al cerrar: ticket se programa para eliminar en **1 hora**
2. Aparece botón "Reabrir Ticket" durante la espera
3. **Estados se actualizan en BD**: `closed` → `reopened`

---

## 🔧 Panel Administrativo

### Comando: `/donaciones`

#### Subcomandos Disponibles:

**📊 `/donaciones pendientes`**
- Lista todas las solicitudes pendientes y reabiertas
- Información: usuario, cantidad, método de pago, tiempo transcurrido
- Estados: 🟡 Pending, 🔄 Reopened

**📈 `/donaciones estadisticas`**
- Estadísticas completas del sistema
- Contadores por estado (pending, approved, rejected, etc.)
- Tasas de aprobación y rechazo
- Actividad diaria y totales

**🔍 `/donaciones buscar <usuario>`**
- Historial completo de un usuario específico
- Resumen por estados
- Total reclamado
- Solicitudes más recientes
- Link al canal activo si existe

**📦 `/donaciones paquetes`**
- Información de paquetes disponibles
- Estados de configuración

---

## ⚙️ Configuración

### Canal y Mensaje

En `config/defaults.json`:

```json
{
  "channels": {
    "donaciones": {
      "alias": "donaciones",
      "name": "💰┃donaciones",
      "description": "Canal para reclamar premios de donaciones"
    }
  },
  "staticMessages": {
    "donaciones": {
      "channel": "donaciones",
      "title": "🎁 Reclama tus Premios de Donación",
      "description": "**¿Ya donaste al servidor?** ¡Reclama tus premios aquí!\n\n**IMPORTANTE:** Solo usa este sistema si ya realizaste una donación fuera de Discord.",
      "color": "0xFFD700",
      "buttons": [
        {
          "label": "Reclamar Premios",
          "customId": "create_donation_claim_button",
          "style": "Primary",
          "emoji": "🎁"
        }
      ]
    }
  }
}
```

---

## 🔒 Permisos y Restricciones

### Sistema de Tickets
- **Creador del ticket**: Ver, escribir, leer historial
- **Staff (dueño)**: Ver, escribir, leer, gestionar mensajes
- **@everyone**: Sin acceso

### Comandos Administrativos
- **Restricción**: Solo roles `dueño` y `admin`
- **Permisos Discord**: `Administrator`

---

## 📊 Estados del Sistema

| Estado | Emoji | Descripción |
|--------|--------|-------------|
| `pending` | 🟡 | Solicitud creada, esperando revisión |
| `approved` | ✅ | Aprobada por staff, premios entregados |
| `rejected` | ❌ | Rechazada por staff con razón |
| `closed` | 🗑️ | Cerrada manualmente |
| `reopened` | 🔄 | Reabierta después de cierre |

---

## 🔄 Actualizaciones Recientes

### v2.0 - Base de Datos y Seguimiento
- ✅ **Integración completa con MongoDB**
- ✅ **Tiempo de cierre ampliado a 1 hora**
- ✅ **Sistema de reapertura de tickets**
- ✅ **Panel administrativo con estadísticas reales**
- ✅ **Seguimiento completo de estados**
- ✅ **Búsqueda avanzada por usuario**

### Mejoras Técnicas
- **Base de datos persistente** para todas las solicitudes
- **Logs detallados** con prefijos específicos
- **Validaciones robustas** en todos los procesos
- **Error handling** completo
- **Código modular** y mantenible

---

## 🆘 Solución de Problemas

### Errores Comunes

**❌ "Error al consultar la base de datos"**
- Verificar conexión a MongoDB
- Revisar logs del servidor
- Reiniciar bot si es necesario

**❌ "No se encontró solicitud de donación"**
- Canal no asociado a solicitud en BD
- Posible error en creación inicial
- Verificar logs de creación

**❌ "Solo el staff puede aprobar/rechazar"**
- Usuario sin rol `dueño`, `admin` o `mod`
- Verificar configuración de roles

### Logs Importantes
```
💾 [DATABASE] Solicitud de donación guardada en BD: donation_xxx
🟡 [BUTTON] Ticket será cerrado en 1 hora
🔄 [BUTTON] Ticket reabierto por usuario
✅ [DATABASE] Estado actualizado a 'approved'
```

---

## 📝 Notas para Desarrolladores

### Archivos Principales
- **Modelo**: `extras/database/models/DonationRequest.js`
- **Handlers**: `extras/handlers/modalHandlers.js`, `buttonHandlers.js`
- **Comando Admin**: `commands_slash/donaciones.js`
- **Configuración**: `config/defaults.json`

### Extensiones Futuras
- Sistema de notificaciones automáticas
- Integración con APIs de pago
- Dashboard web para estadísticas
- Sistema de reportes automáticos

---

*Documentación actualizada - Sistema de Donaciones DZ Vigilant v2.0*