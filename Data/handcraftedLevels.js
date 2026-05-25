export const HANDCRAFTED_LEVELS = [
  {
    kind: "assembled",
    tileSetId: "scenarioDefault",
    name: "Test Floor: enter_room_north_south_01 + combat_02 + exit_room_north_south_01",
    connectorStyleId: "openCorridor",
    decorationFill: {
      // Cambia a un numero fijo para repetir la misma distribucion mientras ajustas a mano.
      seed: "random",
      modules: [
        {
          moduleId: "floorDetail",
          // Porcentaje aproximado de tiles caminables que reciben variacion de suelo.
          density: 0,
        },
        {
          moduleId: "barrel",
          // Para barrels, density solo activa esta regla; la cantidad real la controla clustersPerRoom.
          density: 1,
          roomTypes: ["combat"],
          // Debe coincidir con type/tags de decorZones en las room templates.
          zoneTypes: ["storage", "corner", "wall", "barrelStorage"],
          // Numero de grupos de barriles por room compatible.
          clustersPerRoom: { min: 2, max: 3 },
          // Cantidad de barriles dentro de cada grupo.
          clusterSize: { min: 2, max: 4 },
          // Distancia maxima desde el punto elegido del grupo.
          clusterRadius: 1.35,
          // Huella de separacion entre barriles; menor valor permite grupos mas juntos.
          placementFootprint: { w: 0.55, d: 0.55 },
          // Offset maximo dentro de cada tile para romper la cuadricula visual.
          positionJitter: 0.28,
          // Variacion visual ligera; no cambia el asset original.
          scaleVariation: { min: 0.94, max: 1.06 },
        },
        {
          moduleId: "stones",
          // Probabilidad por tile dentro de las zonas semanticas de stones/rubble.
          density: 0,
          roomTypes: ["combat"],
          zoneTypes: ["rubble", "stones"],
          // Variacion visual ligera; no da colision.
          scaleVariation: { min: 0.92, max: 1.08 },
        },
      ],
    },
    playerStart: { x: -8, z: -13 },
    floorSize: 54,
    rooms: [
      {
        id: "EnterRoom",
        templateId: "enter_room_north_south_01",
        position: { x: -8, z: -11 },
        rotationY: 0,
      },
      {
        id: "CombatRoom",
        templateId: "combat_02",
        position: { x: 0, z: 5 },
        rotationY: 0,
      },
      {
        id: "ExitRoom",
        templateId: "exit_room_north_south_01",
        position: { x: 8, z: -10 },
        rotationY: 0,
      },
    ],
  },
];
