import { useRef, useState } from 'react';
import { BREAD_DRAG_TYPE, prepareTrayDrop, resolveBreadDrop } from './tray-drag.mjs';

export function useBreadDrag({ catalog, onDropBread }) {
  const sourceRef = useRef(null);
  const [draggedId, setDraggedId] = useState(null);
  const [isOverTray, setIsOverTray] = useState(false);

  const clearDrag = () => {
    sourceRef.current = null;
    setDraggedId(null);
    setIsOverTray(false);
  };

  const isLocalDrag = (event) => sourceRef.current
    && Array.from(event.dataTransfer.types).includes(BREAD_DRAG_TYPE);

  const startDrag = (event, bread) => {
    event.dataTransfer.setData(BREAD_DRAG_TYPE, bread.id);
    event.dataTransfer.effectAllowed = 'copy';
    const photo = event.currentTarget.querySelector('.db-bread-photo');
    if (photo) {
      const bounds = photo.getBoundingClientRect();
      event.dataTransfer.setDragImage(photo, bounds.width / 2, bounds.height / 2);
    }
    sourceRef.current = bread.id;
    setDraggedId(bread.id);
  };

  const dropTargetProps = {
    onDragEnter(event) {
      if (!isLocalDrag(event)) return;
      event.preventDefault();
      setIsOverTray(true);
    },
    onDragOver(event) {
      const local = Boolean(isLocalDrag(event));
      prepareTrayDrop(event, local);
      if (!local) return;
      setIsOverTray(true);
    },
    onDragLeave(event) {
      if (!event.currentTarget.contains(event.relatedTarget)) setIsOverTray(false);
    },
    onDrop(event) {
      // Never let an unrelated dropped file/URL navigate away from this page.
      event.preventDefault();
      const bread = resolveBreadDrop(
        event.dataTransfer.getData(BREAD_DRAG_TYPE), sourceRef.current, catalog,
      );
      clearDrag();
      if (bread) onDropBread(bread);
    },
  };

  return { draggedId, isOverTray, startDrag, clearDrag, dropTargetProps };
}
