import { useEffect, useId, useRef, useState } from 'react';
import { breadCatalog, breadImageFrame, trayAssets } from './tray-data';
import { placeTray } from './tray-layout.mjs';

const LIFT_MS = 220;
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function BreadPhoto({ visualKey, index: legacyIndex, className = '' }) {
  const index = visualKey === undefined ? legacyIndex : breadCatalog.findIndex((bread) => bread.id === visualKey);
  if (!Number.isInteger(index) || index < 0 || index > 7) return <span className={`db-bread-photo ${className}`} aria-hidden="true" />;
  return (
    <svg className={`db-bread-photo ${className}`} viewBox={breadImageFrame} aria-hidden="true" focusable="false">
      <image href={breadCatalog[index].layer} width="1254" height="1254" />
    </svg>
  );
}

// Breads sit in the slot they were added to (see tray-layout.mjs), painted back to
// front. A bread that was just added drops in; one that was just removed lifts off
// for a moment before it disappears.
export function TrayArt({ entries, seed, catalog = [] }) {
  const clipId = useId();
  const byBread = new Map(catalog.map((bread) => [bread.id, bread]));
  const items = entries.flatMap((entry) => {
    const bread = byBread.get(entry.breadId);
    return bread?.visualKey ? [{ breadId: entry.breadId, key: bread.visualKey, slot: entry.slot, label: bread.label, image: bread.layer }] : [];
  });

  const previous = useRef(null); // breadId → item, as rendered last time (seeded on mount so nothing drops on first paint)
  if (previous.current === null) previous.current = new Map(items.map((item) => [item.breadId, item]));
  const [leaving, setLeaving] = useState([]);
  useEffect(() => {
    const current = new Set(items.map((item) => item.breadId));
    const gone = [...previous.current.values()].filter((item) => !current.has(item.breadId));
    previous.current = new Map(items.map((item) => [item.breadId, item]));
    if (!gone.length || reduceMotion()) return undefined;
    setLeaving((list) => [...list.filter((item) => !current.has(item.breadId)), ...gone]);
    const timer = window.setTimeout(() => setLeaving((list) => list.filter((item) => !gone.includes(item))), LIFT_MS);
    return () => window.clearTimeout(timer);
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const placed = placeTray([...items, ...leaving.map((item) => ({ ...item, leaving: true }))], seed);
  const names = items.map((item) => item.label);
  const dropping = new Set(items.filter((item) => !previous.current.has(item.breadId)).map((item) => item.breadId));

  return (
    <figure className="db-tray-art">
      <svg viewBox="10 180 1520 730" role="img" aria-label={names.length ? `${names.join(', ')} 담긴 트레이` : '빈 나무 트레이'}>
        <defs>
          <clipPath id={clipId}>
            <path d="M39 724 C54 608 83 433 110 374 Q117 361 130 363 L145 321 C158 278 188 259 233 260 L1315 254 C1370 254 1405 283 1427 349 Q1444 347 1450 362 C1484 427 1503 625 1517 713 C1517 831 1481 870 1392 879 L153 881 C85 881 50 859 41 776 Q37 746 39 724 Z" />
          </clipPath>
        </defs>
        <g className="db-tray-base">
          <image href={trayAssets.empty} width="1536" height="1024" clipPath={`url(#${clipId})`} />
        </g>
        {placed.map(({ breadId, image, x, y, width, height, angle, flip, leaving: isLeaving }) => {
          const centre = `${x + width / 2} ${y + height / 2}`;
          const mirror = flip ? ` translate(${2 * x + width} 0) scale(-1 1)` : '';
          const state = isLeaving ? ' is-leaving' : dropping.has(breadId) && !reduceMotion() ? ' is-dropping' : '';
          return (
            <g key={`${breadId}${isLeaving ? ':leaving' : ''}`} className={`db-tray-layer${state}`} aria-hidden="true">
              <g transform={`rotate(${angle} ${centre})${mirror}`}>
                <svg x={x} y={y} width={width} height={height} viewBox={breadImageFrame} overflow="visible" focusable="false">
                  <image href={image} width="1254" height="1254" />
                </svg>
              </g>
            </g>
          );
        })}
      </svg>
      {!entries.length ? <figcaption>어떤 빵부터 담아볼까요?</figcaption> : null}
    </figure>
  );
}
