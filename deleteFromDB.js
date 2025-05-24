const db = require('./extras/database/indexDB');

// Cambia estos valores según lo que quieras borrar
const TABLE = 'rolesBot'; // Ejemplo: 'rolesBot', 'channelsBot', 'staticMessages'
const FIELD = 'alias';    // Ejemplo: 'alias', 'id', etc.
const VALUE = 'survivor'; // El valor que quieres borrar

async function deleteFromDB() {
  try {
    const result = await db.run(
      `DELETE FROM ${TABLE} WHERE ${FIELD} = ?`,
      [VALUE]
    );
    console.log(`✅ Registro eliminado de ${TABLE} donde ${FIELD} = '${VALUE}'`);
  } catch (error) {
    console.error('❌ Error al eliminar el registro:', error);
  } finally {
    db.close();
  }
}

deleteFromDB();