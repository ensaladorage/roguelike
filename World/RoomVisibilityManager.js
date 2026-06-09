const CONNECTOR_REVEAL_TRIGGER_RADIUS = 1.15;
const PROGRESSIVE_REVEAL_STEP_DELAY = 0.025;
const PROGRESSIVE_REVEAL_OBJECTS_PER_STEP = 10;

export class RoomVisibilityManager {
  constructor(scene) {
    this.scene = scene;
    this.rooms = new Map();
    this.connections = new Map();
    this.visitedRoomIds = new Set();
    this.progressiveReveals = [];
    this.currentRoomId = null;
    this.enabled = false;
  }

  load(level, build = {}) {
    this.clear();

    const visibility = level?.roomVisibility;
    if (!visibility?.rooms?.length) {
      this.enabled = false;
      this.refreshVisibleWallMeshes();
      return;
    }

    this.enabled = true;

    for (const connection of visibility.connections ?? []) {
      this.connections.set(connection.id, {
        ...connection,
        objects: [...(build.connectionObjectsById?.get(connection.id) ?? [])],
        revealed: false,
      });
    }

    for (const room of visibility.rooms) {
      this.rooms.set(room.id, {
        ...room,
        objects: [...(build.roomObjectsById?.get(room.id) ?? [])],
        enemies: this.getEntitiesForRoom(build.enemies, room.id),
        chests: this.getEntitiesForRoom(build.chests, room.id),
        shopStands: this.getEntitiesForRoom(build.shopStands, room.id),
        shopFountains: this.getEntitiesForRoom(build.shopFountains, room.id),
        revealed: false,
      });
    }

    this.setAllHidden();
    this.revealAtPosition(this.scene?.player?.model?.position ?? level.playerStart);
    console.log("roomVisibilityLoaded", {
      rooms: this.rooms.size,
      connections: this.connections.size,
      visitedRooms: this.visitedRoomIds.size,
    });
  }

  clear() {
    this.rooms.clear();
    this.connections.clear();
    this.visitedRoomIds.clear();
    this.progressiveReveals = [];
    this.currentRoomId = null;
    this.enabled = false;
  }

  update(playerPosition, delta = 0) {
    if (!this.enabled || !playerPosition) return;

    this.updateCurrentRoom(playerPosition);
    this.checkConnectorRevealTriggers(playerPosition);
    this.updateProgressiveReveals(delta);
  }

  revealAtPosition(position) {
    if (!this.enabled || !position) return;

    const room = this.getRoomAtPosition(position);
    if (!room) return;

    this.currentRoomId = room.id;
    this.revealRoom(room.id, { immediate: true });
  }

  revealRoom(roomId, options = {}) {
    const room = this.rooms.get(roomId);
    if (!room || room.revealed) return;

    const immediate = options.immediate ?? true;
    room.revealed = true;
    this.visitedRoomIds.add(roomId);

    for (const connectionId of room.connectionIds ?? []) {
      this.revealConnection(connectionId);
    }

    if (immediate) {
      this.setObjectsVisible(room.objects, true);
      this.setRoomEntitiesVisible(room, true);
    } else {
      this.queueProgressiveRoomReveal(room, options.origin);
    }

    this.refreshVisibleWallMeshes();
    console.log("roomRevealed", {
      roomId,
      visitedRooms: this.visitedRoomIds.size,
      revealedConnections: Array.from(this.connections.values()).filter(
        (connection) => connection.revealed
      ).length,
    });
  }

  revealConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.revealed = true;
    this.updateConnectionVisibility(connection);
  }

  setAllHidden() {
    for (const room of this.rooms.values()) {
      room.revealed = false;
      this.setObjectsVisible(room.objects, false);
      this.setRoomEntitiesVisible(room, false);
    }

    for (const connection of this.connections.values()) {
      connection.revealed = false;
      this.setObjectsVisible(connection.objects, false);
    }

    this.refreshVisibleWallMeshes();
  }

  setRoomEntitiesVisible(room, visible) {
    for (const enemy of room.enemies ?? []) {
      if (!enemy?.model) continue;
      enemy.model.visible = visible && enemy.alive !== false;
    }

    for (const chest of room.chests ?? []) {
      if (!chest?.model) continue;
      chest.model.visible = visible;
    }

    for (const stand of room.shopStands ?? []) {
      if (!stand?.model) continue;
      stand.model.visible = visible;
    }

    for (const fountain of room.shopFountains ?? []) {
      if (!fountain?.model) continue;
      fountain.model.visible = visible;
    }
  }

  updateCurrentRoom(position) {
    const room = this.getRoomAtPosition(position);
    if (!room?.revealed) return;

    this.currentRoomId = room.id;
  }

  checkConnectorRevealTriggers(playerPosition) {
    const currentRoomId = this.currentRoomId;
    if (!currentRoomId || !this.visitedRoomIds.has(currentRoomId)) return;

    for (const connection of this.connections.values()) {
      if (!connection.revealed) continue;
      if (!(connection.roomIds ?? []).includes(currentRoomId)) continue;

      const targetRoomId = (connection.roomIds ?? []).find(
        (roomId) => roomId !== currentRoomId && !this.visitedRoomIds.has(roomId)
      );
      if (!targetRoomId) continue;

      const trigger = this.getConnectionTriggerForRoom(connection, currentRoomId);
      if (!trigger || trigger.visible === false) continue;
      if (this.flatDistance(playerPosition, trigger.position) > CONNECTOR_REVEAL_TRIGGER_RADIUS) {
        continue;
      }

      this.revealRoom(targetRoomId, {
        immediate: false,
        origin: trigger.position,
      });
    }
  }

  getConnectionTriggerForRoom(connection, roomId) {
    const triggers = (connection.objects ?? []).filter(
      (object) =>
        object?.userData?.moduleId === "woodSupport" &&
        object.userData.connectorVisibleRoomId === roomId
    );
    if (triggers.length === 0) return null;

    triggers.sort((a, b) =>
      this.distanceToConnectedRoom(a, connection, roomId) -
      this.distanceToConnectedRoom(b, connection, roomId)
    );

    return triggers[0];
  }

  distanceToConnectedRoom(object, connection, roomId) {
    const otherEndpoint = connection.a.roomId === roomId
      ? connection.b.opening
      : connection.a.opening;

    if (!otherEndpoint) return 0;

    const dx = object.position.x - otherEndpoint.x;
    const dz = object.position.z - otherEndpoint.z;

    return dx * dx + dz * dz;
  }

  queueProgressiveRoomReveal(room, origin = null) {
    this.setObjectsVisible(room.objects, false);
    this.setRoomEntitiesVisible(room, false);

    const queue = [...(room.objects ?? [])].sort((a, b) =>
      this.distanceFromOrigin(a, origin) - this.distanceFromOrigin(b, origin)
    );

    this.progressiveReveals.push({
      room,
      queue,
      cursor: 0,
      elapsed: 0,
    });
  }

  updateProgressiveReveals(delta = 0) {
    if (this.progressiveReveals.length === 0) return;

    for (const reveal of this.progressiveReveals) {
      reveal.elapsed += delta;

      while (
        reveal.elapsed >= PROGRESSIVE_REVEAL_STEP_DELAY &&
        reveal.cursor < reveal.queue.length
      ) {
        reveal.elapsed -= PROGRESSIVE_REVEAL_STEP_DELAY;

        const end = Math.min(
          reveal.cursor + PROGRESSIVE_REVEAL_OBJECTS_PER_STEP,
          reveal.queue.length
        );

        for (let index = reveal.cursor; index < end; index += 1) {
          reveal.queue[index].visible = true;
        }

        reveal.cursor = end;
      }

      if (reveal.cursor >= reveal.queue.length) {
        this.setRoomEntitiesVisible(reveal.room, true);
      }
    }

    this.progressiveReveals = this.progressiveReveals.filter(
      (reveal) => reveal.cursor < reveal.queue.length
    );
    this.refreshVisibleWallMeshes();
  }

  distanceFromOrigin(object, origin) {
    if (!origin) return 0;

    const dx = object.position.x - origin.x;
    const dz = object.position.z - origin.z;

    return dx * dx + dz * dz;
  }

  flatDistance(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  setObjectsVisible(objects, visible) {
    for (const object of objects ?? []) {
      if (!object) continue;
      object.visible = visible;
    }
  }

  updateConnectionVisibility(connection) {
    const allRoomsVisited = (connection.roomIds ?? []).every((roomId) =>
      this.visitedRoomIds.has(roomId)
    );

    for (const object of connection.objects ?? []) {
      if (!object) continue;

      const needsBothRooms =
        object.userData?.connectorVisibility === "bothRoomsVisited";
      const visibleRoomId = object.userData?.connectorVisibleRoomId;
      const roomEndpointVisible =
        !visibleRoomId || this.visitedRoomIds.has(visibleRoomId);

      object.visible =
        connection.revealed &&
        (!needsBothRooms || allRoomsVisited) &&
        roomEndpointVisible;
    }
  }

  getEntitiesForRoom(entities = [], roomId) {
    return (entities ?? []).filter((entity) => entity?.roomId === roomId);
  }

  getRoomAtPosition(position) {
    for (const room of this.rooms.values()) {
      if (this.isInsideAnyArea(position, room.walkableAreas ?? [])) {
        return room;
      }
    }

    return null;
  }

  isInsideAnyArea(position, areas = []) {
    return areas.some(
      (area) =>
        position.x >= area.x - area.w / 2 &&
        position.x <= area.x + area.w / 2 &&
        position.z >= area.z - area.d / 2 &&
        position.z <= area.z + area.d / 2
    );
  }

  refreshVisibleWallMeshes() {
    if (!this.scene) return;

    const allWallMeshes = this.scene.allWallMeshes ?? this.scene.wallMeshes ?? [];
    this.scene.wallMeshes = allWallMeshes.filter((mesh) => mesh.visible);
  }
}
