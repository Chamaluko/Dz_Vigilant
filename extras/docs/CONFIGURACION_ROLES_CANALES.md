# 🔧 Sistema de Roles y Canales - DZ Vigilant

## 📋 Descripción

Sistema mejorado para gestionar roles y canales con separación clara entre alias internos y nombres mostrados.

---

## 🆕 **Nueva Estructura (v2.0):**

### **En `defaults.json`:**

```json
{
  "rolesBot": {
    "dueño": {                    // ← KEY (referencia interna)
      "alias": "dueño",           // ← ALIAS (para BD y código)
      "name": "Jefe",             // ← NAME (nombre mostrado)
      "description": "...",
      "color": "#FFA500",
      "hoist": true
    }
  },
  "channelsBot": {
    "verification": {             // ← KEY (referencia interna)
      "alias": "verification",    // ← ALIAS (para BD y código)
      "name": "Verificación",     // ← NAME (nombre mostrado)
      "description": "...",
      "type": "text"
    }
  }
}
```

### **En la Base de Datos:**
- **`alias`**: Se guarda `"dueño"` (referencia interna)
- **`name`**: Se guarda `"Jefe"` (nombre de Discord)

### **En el Código:**
- **Restricciones**: `roles: ['dueño', 'admin']` (usa alias)
- **Búsquedas**: `RoleBot.findByAlias('dueño')` (usa alias)
- **Setup**: Muestra `"Jefe"` pero guarda `"dueño"` en BD

---

## 🔄 **Migración del Sistema Anterior:**

### **Problema Anterior:**
```json
// ❌ Sistema anterior (confuso)
"dueño": {
  "alias": "Jefe"  // Se usaba como nombre Y como alias
}
```

```javascript
// ❌ En el código anterior
roles: [rolesBot.dueño.alias]  // Daba "Jefe" 
await RoleBot.findByAlias(rolesBot.dueño.alias)  // Buscaba "Jefe"
```

### **Solución Nueva:**
```json
// ✅ Sistema nuevo (claro)
"dueño": {
  "alias": "dueño",  // Para referencias de código/BD
  "name": "Jefe"     // Para mostrar al usuario
}
```

```javascript
// ✅ En el código nuevo
roles: ['dueño']  // Usa alias directo
await RoleBot.findByAlias('dueño')  // Busca por alias correcto
```

---

## 🛠️ **Cambios Realizados:**

### **1. Archivo `defaults.json`:**
- ✅ Agregado campo `name` a todos los roles
- ✅ Agregado campo `name` a todos los canales
- ✅ Cambiado `alias` para que sea referencia interna
- ✅ Roles: `dueño`, `admin`, `mod`, `elite`, `verified`
- ✅ Canales: `verification`, `logs`, `rules`, etc.

### **2. Comando `/setup`:**
- ✅ Muestra `name` en interfaz de usuario
- ✅ Crea roles con `name` como nombre de Discord
- ✅ Guarda `alias` en base de datos
- ✅ Corregida validación de existencia

### **3. Comandos con Restricciones:**
- ✅ `/donaciones`: `roles: ['dueño', 'admin']`
- ✅ `/anuncio`: `roles: ['dueño', 'admin', 'mod']`
- ✅ `/ping`: `roles: ['dueño']`

### **4. Handlers:**
- ✅ `modalHandlers.js`: Busca rol `'dueño'` directamente
- ✅ `buttonHandlers.js`: Usa aliases correctos
- ✅ `validations.js`: Funciona con nuevo sistema

---

## 🔥 **Limpiar Base de Datos:**

### **Si tienes datos del sistema anterior:**

```bash
# Eliminar roles y canales antiguos de la BD
# Para poder ejecutar /setup de nuevo con el sistema corregido
```

### **Pasos Recomendados:**

1. **Hacer backup de la BD** (opcional)
2. **Eliminar documentos antiguos**:
   - Colección `rolesBot`
   - Colección `channelsBot`
3. **Ejecutar `/setup` de nuevo**
4. **Verificar que todo funcione**

---

## 🎯 **Beneficios del Nuevo Sistema:**

### **✅ Separación Clara:**
- **Alias**: Para código y base de datos (`'dueño'`)
- **Name**: Para usuarios y Discord (`'Jefe'`)

### **✅ Consistencia:**
- Todos los comandos usan mismo sistema
- BD guarda referencias internas correctas
- Setup muestra nombres amigables

### **✅ Mantenimiento:**
- Más fácil agregar nuevos roles/canales
- Referencias claras en el código
- Sin confusión entre key/alias/name

---

## 📝 **Ejemplos de Uso:**

### **Agregar Nuevo Rol:**
```json
"staff": {
  "alias": "staff",
  "name": "Personal",
  "description": "Rol para personal del servidor",
  "color": "#0099FF",
  "hoist": true
}
```

### **Usar en Comando:**
```javascript
restriction: {
  roles: ['dueño', 'admin', 'staff'],  // ← Usa alias
  ids: []
}
```

### **Buscar en Código:**
```javascript
const staffRole = await RoleBot.findByAlias('staff');  // ← Usa alias
const roleName = staffRole.name;  // ← Obtiene "Personal"
```

---

## ⚠️ **Notas Importantes:**

1. **Restart requerido**: Después de cambios en `defaults.json`
2. **BD limpia**: Eliminar datos antiguos antes del setup
3. **Verificar logs**: Revisar que no haya errores de búsqueda
4. **Testing**: Probar comandos con restricciones

---

*Documentación del Sistema de Roles y Canales v2.0* 