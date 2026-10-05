// Pure tray placement: which slot a bread sits in and how it lies there.
// No React, no DOM, no image imports — unit tested in test/tray-layout.test.mjs.
//
// The tray keeps the eight positions of the original composition (they were tuned
// so any bread looks natural there), but a bread no longer owns a position: the
// N-th bread you add takes the N-th free slot, and taking one out leaves a gap the
// next bread fills. A seed drawn when the tray goes from empty to one bread picks
// the fill order and every small variation, so a tray is stable while you fill it
// and looks different the next time you start from empty.

export const TRAY_SLOT_COUNT = 8;

// Scene coordinates (viewBox "10 180 1520 730"). `scale` gives a touch of depth:
// the back row is slightly smaller.
export const traySlots = [
  { cx: 300, cy: 632, angle: -16, scale: 1 },    // front left
  { cx: 612, cy: 630, angle: -9, scale: 1 },     // front centre
  { cx: 1190, cy: 540, angle: -6, scale: 1 },    // right
  { cx: 700, cy: 420, angle: -15, scale: .94 },  // back centre
  { cx: 318, cy: 428, angle: -12, scale: .94 },  // back left
  { cx: 930, cy: 652, angle: -14, scale: 1 },    // front gap
  { cx: 1110, cy: 378, angle: 18, scale: .94 },  // back right
  { cx: 1226, cy: 668, angle: 8, scale: 1 },     // front far right
];

// Four ways to fill the tray; the seed picks one. Each lists slot indexes in fill order.
export const slotOrders = [
  [0, 1, 2, 3, 4, 5, 6, 7], // from the front left
  [1, 2, 0, 3, 4, 6, 5, 7], // from the centre
  [2, 1, 0, 6, 3, 4, 7, 5], // from the right
  [1, 0, 2, 5, 3, 4, 6, 7], // centre → left → right → front gap
];

// Natural size and lean of each cutout (same numbers the fixed layout used).
export const breadVisuals = {
  loaf: { width: 460, height: 460, angle: -12 },
  ciabatta: { width: 600, height: 450, angle: -15 },
  baguette: { width: 680, height: 430, angle: 18 },
  croissant: { width: 630, height: 440, angle: -6 },
  salt: { width: 545, height: 470, angle: -16 },
  bagel: { width: 490, height: 405, angle: -9 },
  financier: { width: 425, height: 420, angle: -14 },
  egg: { width: 445, height: 372, angle: 8 },
};

const TILT = 1.2;      // overall lean multiplier
const SCATTER = 40;    // max offset from the slot centre, scene units
const RIM_LEFT = 95, RIM_RIGHT = 1455; // keep wide breads inside the tray rim

// FNV-1a → [0, 1). Deterministic, so a saved tray renders the same after reload.
export function hashUnit(input) {
  let hash = 2166136261;
  for (const char of String(input)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function createTraySeed(random = Math.random) {
  return Math.floor(random() * 1e9).toString(36);
}

export function slotOrderFor(seed) {
  return slotOrders[Math.floor(hashUnit(`${seed}:order`) * slotOrders.length)];
}

// Lowest free slot index, or -1 when the tray is full.
export function freeTraySlot(entries) {
  for (let slot = 0; slot < TRAY_SLOT_COUNT; slot += 1) {
    if (!entries.some((entry) => entry.slot === slot)) return slot;
  }
  return -1;
}

// Give slots to entries that have none (older saved trays) without moving the ones that do.
export function assignTraySlots(entries) {
  const taken = new Set();
  const keep = entries.map((entry) => {
    const valid = Number.isInteger(entry.slot) && entry.slot >= 0 && entry.slot < TRAY_SLOT_COUNT && !taken.has(entry.slot);
    if (valid) taken.add(entry.slot);
    return valid;
  });
  return entries.map((entry, index) => {
    if (keep[index]) return entry;
    let slot = 0;
    while (taken.has(slot)) slot += 1;
    if (slot >= TRAY_SLOT_COUNT) return entry;
    taken.add(slot);
    return { ...entry, slot };
  });
}

/**
 * Where each bread lies. `items` is [{ key, slot, ...rest }] where `key` is the
 * visual key (salt, loaf, …). Returns the same items with x/y/width/height/angle/flip,
 * sorted back to front so the caller can paint them in array order.
 */
export function placeTray(items, seed) {
  const order = slotOrderFor(seed);
  return items
    .map((item) => {
      const visual = breadVisuals[item.key];
      if (!visual || !Number.isInteger(item.slot) || item.slot < 0 || item.slot >= TRAY_SLOT_COUNT) return null;
      const slot = traySlots[order[item.slot]];
      const id = `${seed}:${item.key}:${item.slot}`;
      const lean = hashUnit(`${id}:a`), dx = hashUnit(`${id}:x`), dy = hashUnit(`${id}:y`), mirror = hashUnit(`${id}:m`), size = hashUnit(`${id}:s`);
      // The slot's own lean carries most of the pose; the bread's natural lean and a
      // little per-(seed, slot, bread) variation keep two trays from looking alike.
      const angle = (slot.angle * 0.7 + visual.angle * 0.3 + (lean - 0.5) * 24) * TILT;
      const sizeFactor = 0.94 + size * 0.12;
      const width = visual.width * slot.scale * sizeFactor;
      const height = visual.height * slot.scale * sizeFactor;
      const cy = slot.cy + (dy - 0.5) * 1.5 * SCATTER;
      let cx = slot.cx + (dx - 0.5) * 2 * SCATTER;
      cx = Math.max(RIM_LEFT + width * 0.36, Math.min(RIM_RIGHT - width * 0.36, cx));
      return {
        ...item,
        x: Math.round(cx - width / 2), y: Math.round(cy - height / 2),
        width: Math.round(width), height: Math.round(height),
        angle: Math.round(angle * 10) / 10,
        flip: mirror < 0.4,
        z: cy + height / 2,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.z - b.z);
}
