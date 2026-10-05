export const BREAD_DRAG_TYPE = 'application/x-bangtray-bread';

export function prepareTrayDrop(event, isLocal) {
  // Cancel browser navigation even for files and URLs we do not accept.
  event.preventDefault();
  event.dataTransfer.dropEffect = isLocal ? 'copy' : 'none';
}

// Accept only a catalog card being dragged in this page, never arbitrary text,
// URLs, files or a stale payload from a different drag session.
export function resolveBreadDrop(payload, sourceBreadId, catalog) {
  if (!sourceBreadId || payload !== String(sourceBreadId)) return null;
  return catalog.find((bread) => bread.id === sourceBreadId) ?? null;
}
