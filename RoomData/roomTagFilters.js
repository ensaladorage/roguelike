export function normalizeTagList(tags) {
  if (!tags) return [];
  if (typeof tags === "string") return [tags];
  if (!Array.isArray(tags)) return [];

  return tags.filter((tag) => typeof tag === "string" && tag.length > 0);
}

export function uniqueTags(tags) {
  return [...new Set(normalizeTagList(tags))];
}

export function getRoomTagFilterForType(type, options = {}) {
  const rawFilters = options.roomTagFilters ?? options.roomTags ?? {};
  const filters = Array.isArray(rawFilters) || typeof rawFilters === "string"
    ? { include: rawFilters }
    : rawFilters;
  const byType = filters.byType ?? {};
  const typeFilter = filters[type] ?? byType[type] ?? {};

  return {
    include: uniqueTags([
      ...normalizeTagList(filters.include),
      ...normalizeTagList(typeFilter.include),
    ]),
    includeAny: uniqueTags([
      ...normalizeTagList(filters.includeAny ?? filters.any),
      ...normalizeTagList(typeFilter.includeAny ?? typeFilter.any),
    ]),
    exclude: uniqueTags([
      ...normalizeTagList(filters.exclude),
      ...normalizeTagList(typeFilter.exclude),
    ]),
  };
}

export function hasRoomTagFilter(filter) {
  return (
    (filter.include?.length ?? 0) > 0 ||
    (filter.includeAny?.length ?? 0) > 0 ||
    (filter.exclude?.length ?? 0) > 0
  );
}

export function roomMatchesTagFilter(room, filter) {
  if (!hasRoomTagFilter(filter)) return true;

  const tags = new Set(room.tags ?? []);

  return (
    filter.include.every((tag) => tags.has(tag)) &&
    (filter.includeAny.length === 0 ||
      filter.includeAny.some((tag) => tags.has(tag))) &&
    filter.exclude.every((tag) => !tags.has(tag))
  );
}

export function filterRoomsByTags(rooms, type, options = {}) {
  const filter = getRoomTagFilterForType(type, options);

  if (!hasRoomTagFilter(filter)) return [...rooms];

  return rooms.filter((room) => roomMatchesTagFilter(room, filter));
}
