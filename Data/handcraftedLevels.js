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
          density: 0.3,
        },
        {
          moduleId: "barrel",
          // Para barrels, density solo activa esta regla; la cantidad real la controla clustersPerRoom.
          density: 1,
          roomTypes: ["combat"],
          // Los spots se calculan solos: esquinas, laterales de puertas y puntos cerca de cofres.
          spotStrategy: "semantic",
          // Quita o agrega tipos para probar donde pueden aparecer los grupos.
          spotTypes: ["corner", "door", "chest"],
          // Distancia minima entre grupos. Sube este valor si ves spots demasiado cercanos.
          spotMinDistance: 5,
          // Separacion desde los bordes de walkableAreas para spots de esquina.
          spotInset: 1.4,
          // Distancia hacia dentro y hacia los lados de cada puerta para spots de puerta.
          doorSpotDepth: 2.2,
          doorSpotSideOffset: 2,
          // Distancia desde cada cofre para proponer spots cercanos.
          chestSpotOffset: 1.8,
          // Numero de grupos de barriles por room compatible.
          clustersPerRoom: { min: 3, max: 5 },
          // Cantidad de barriles dentro de cada grupo.
          clusterSize: { min: 2, max: 5 },
          // Distancia maxima desde el punto elegido del grupo.
          clusterRadius: 1,
          // Radio real de dispersion dentro del grupo; baja este valor para barriles mas pegados.
          clusterScatterRadius: 0.4,
          // Huella de separacion entre barriles; menor valor permite grupos mas juntos.
          placementFootprint: { w: 0.6, d: 0.6 },
          // Huella usada para validar navegacion; mantenla pequena si la colision real del barril es pequena.
          collisionFootprint: { w: 0.1, d: 0.1 },
          // Offset extra para decoraciones scatter; los barriles agrupados usan clusterScatterRadius.
          positionJitter: 1,
          // Variacion visual ligera; no cambia el asset original.
          scaleVariation: { min: 0.8, max: 1.6 },
        },
        {
          moduleId: "stones",
          // Probabilidad por tile dentro de las zonas semanticas de stones/rubble.
          density: 0.12,
          roomTypes: ["combat"],
          zoneTypes: ["rubble", "stones"],
          // Variacion visual ligera; no da colision.
          scaleVariation: { min: 0.5, max: 1.2 },
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
