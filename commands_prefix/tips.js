const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'tips',
  description: 'Recibe un consejo aleatorio de supervivencia para DayZ',

  async execute(message, args) {
    // Lista de consejos de supervivencia para DayZ
    const consejos = [
      "Siempre verifica los edificios antes de entrar. Nunca sabes quién o qué podría estar dentro.",
      "Mantén tu arma limpia y en buen estado. Un arma que se atasca podría significar tu muerte.",
      "El sigilo es clave. Si haces mucho ruido, atraerás zombies y otros jugadores.",
      "Lleva siempre vendas y desinfectante. Las infecciones pueden ser mortales.",
      "Aprende a cazar y pescar. La comida enlatada no durará para siempre.",
      "Nunca confíes en extraños. La mayoría te matará por tus recursos.",
      "Las ciudades grandes tienen mejor botín, pero también más peligros.",
      "El agua de arroyos y lagos debe ser purificada antes de beberla.",
      "La hipotermia es una amenaza real. Mantente seco y abrigado.",
      "Viaja ligero. Llevar demasiado peso te hará lento y vulnerable.",
      "Si escuchas disparos, mantente alerta. Podrías encontrar la muerte o un buen botín.",
      "Aprende a orientarte con el sol y las estrellas para cuando no tengas brújula.",
      "Los helicópteros y aviones suelen estrellarse en lugares con buen botín.",
      "Conserva munición. Cada disparo atrae más problemas.",
      "Siempre ten un plan de escape cuando entres en zonas de alto riesgo.",
      "Puedes usar la tecla 'V' mientras conduces para cambiar la vista.",
      "Mientras conduces usa la tecla 'shift' para acelerar a fondo. Pero cuidado con la bencina...",
      "La Cacería es una buena forma de obtener recursos y dinero.",
      "Cuando vendas un auto recuerda venderlo por partes, así obtendrás mejor beneficio.",
      "Recuerda guardar tu dinero en los cajeros de las Zonas Seguras.",
      "Puedes sacar copia de las llaves de tus vehículos. Consulta dónde.",
      "Mantén el hambre y la sed en buen estado para evitar penalizaciones en movimiento y visión.",
      "No comas la carne de depredadores, **está infectada**.",
      "Usa bolsas de loot (molle pouches, rucksacks) para organizar comida, munición, medicina y herramientas.",
      "Repara tu ropa dañada; la ropa en buen estado aumenta tu protección y la de los objetos que llevas.",
      "Construye refugios temporales con tiendas de campaña o cobertizos de madera para guardar recursos y descansar seguros.",
      "Aprovecha granjas y campos agrícolas: suelen tener semillas, herramientas de jardinería y alimentos frescos.",
      "Fabrica vendajes improvisados con camisetas viejas; lleva siempre al menos tres para emergencias.",
      "Puedes fabricar guantes, zapatos, entre otros con telas de ropa.",
      "Mantén un kit de supervivencia en tu vehículo o mochila secundaria: mechero, cerillas, pedernal, cuchillo y barrita energética.",
      "Siempre ten en tu vehículo una batería, bujías y demaces para casos de emergencia.",
      "Recuerda quitarle las balas a las armas y cargadores antes de venderlos o desecharlos.",
      "Vigila tu estamina y reserva el sprint para emergencias; Quedarte sin ella te podría dejar vulnerable.",
      "Llevar mucha carga puede reducir tu estamina.",
      "Explora zonas industriales (fábricas, almacenes) para encontrar herramientas, combustible y clavos.",
      "Purifica siempre el agua con tabletas o hirviéndola; beber agua sucia causa infecciones.",
      "Instala trampas caseras alrededor de tu campamento para proptejerte de intrusos.",
      "Revisa los cuerpos caídos; a menudo llevan linternas, baterías o loot útil.",
      "Al encontrar un vehículo, comprueba que tenga agua suficiente en el raidador. Sino romperás el motor.",
      "Usa prismáticos u optris para escanear el terreno desde lejos antes de ir a lootear. Nunca se sabe donde podría estar un jugador.",
      "Siempre ten un plan de escape definido al entrar en zonas de alto riesgo.",
      "Conserva munición y dispara solo cuando sea imprescindible; cada disparo atrae zombies y jugadores.",
      "Si matas a otro jugador procede con cautela. Nunca se sabe si esta acompañado o no.",
      "Mantén tu fusil limpio. Nunca se sabe cuando podrías necesitarlo.",
    ];

    // Seleccionar un consejo aleatorio
    const consejoAleatorio = consejos[Math.floor(Math.random() * consejos.length)];

    const embed = new EmbedBuilder()
      .setTitle('🧰 Botiquín de Supervivencia')
      .setDescription(consejoAleatorio)
      .setColor(0xE74C3C)
      .setFooter({ text: 'Consejo patrocinado por DZ Vigilant' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  },
}; 