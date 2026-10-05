import { Check, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// Tag picker for the active bread. On wide screens it is the right-hand column;
// below 1000px TrayPage renders it `inline`, right under the row of the tapped
// card, so picking tags never needs a scroll down past the tray.
export function PreferencePanel({ draft, entries, onTag, onCommit, onRemove, onClose, onRecommend, panelRef, catalog: breadCatalog, disabled, pending, inline = false }) {
  const bread = draft ? breadCatalog.find(({ id }) => id === draft.breadId) : null;
  const committed = bread ? entries.some(({ breadId }) => breadId === bread.id) : false;
  const selectedCount = draft?.tags.length ?? 0;

  const picker = bread ? (
    <>
      <header className="db-preferences-heading">
        <div>
          <h2 id="db-preference-title">{bread.label} 취향</h2>
          <p>이 빵에 원하는 특징을 최대 2개 골라주세요.</p>
        </div>
        <span><strong>{selectedCount}</strong> / 2</span>
        {inline && onClose ? (
          <button type="button" className="db-panel-close" onClick={onClose} aria-label="취향 선택 닫기"><X size={18} /></button>
        ) : null}
      </header>

      <ToggleGroup
        type="multiple"
        variant="outline"
        className="db-taste-tags"
        aria-label={`${bread.label} 취향 태그`}
        value={draft.tags.map(String)}
        onValueChange={(values) => {
          const ids = values.map(Number);
          const changed = ids.find((id) => !draft.tags.includes(id))
            ?? draft.tags.find((id) => !ids.includes(id));
          if (changed !== undefined) onTag(changed);
        }}
      >
        {bread.tags.map((tag) => {
          const selected = draft.tags.includes(tag.id);
          return (
            <ToggleGroupItem
              key={tag.id}
              value={String(tag.id)}
              disabled={disabled || (!selected && selectedCount >= 2)}
            >
              <span className="db-tag-check" aria-hidden="true">
                {selected ? <Check size={14} strokeWidth={3} /> : null}
              </span>
              {tag.label}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>

      <div className="db-draft-actions">
        <Button className="db-commit" disabled={disabled || !selectedCount} onClick={onCommit}>
          {committed ? '취향 수정하기' : '빵 담기'}
        </Button>
        {committed ? (
          <button className="db-remove" type="button" disabled={disabled} onClick={() => onRemove(bread.id)}>
            <Trash2 size={16} aria-hidden="true" />트레이에서 빼기
          </button>
        ) : null}
      </div>
    </>
  ) : null;

  if (inline) {
    // Only rendered while a bread is active; the empty copy lives under the tray on small screens.
    return bread ? (
      <div className="db-preferences db-preferences--inline" aria-labelledby="db-preference-title" ref={panelRef} tabIndex={-1}>
        <div className="db-preferences-main">{picker}</div>
      </div>
    ) : null;
  }

  return (
    <aside className="db-preferences" aria-labelledby="db-preference-title" ref={panelRef} tabIndex={-1}>
      <div className="db-preferences-main">
        {bread ? picker : (
          <div className="db-preferences-empty">
            <h2 id="db-preference-title">{breadCatalog.length > 0 && entries.length === breadCatalog.length ? '트레이가 가득 찼어요' : entries.length ? '다음 빵을 골라주세요' : '빵을 먼저 골라주세요'}</h2>
            {breadCatalog.length > 0 && entries.length === breadCatalog.length ? (
              <p>담은 빵의 취향을 바꾸거나,<br />빵집 추천을 받아보세요.</p>
            ) : (
              <p>원하는 빵을 고르고,<br />취향을 두 개까지 담아주세요.</p>
            )}
          </div>
        )}
      </div>

      <footer className="db-preferences-footer">
        <p className="db-count-summary" aria-live="polite"><strong>내 트레이</strong><span><strong>{entries.length}</strong> / 8</span></p>
        <Button variant="outline" className="db-recommend" disabled={disabled || !entries.length} onClick={onRecommend}>
          {pending ? '추천받는 중…' : '빵집 추천받기'}
        </Button>
      </footer>
    </aside>
  );
}
