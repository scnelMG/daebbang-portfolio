import { ArrowRight, Check, Home, ShoppingBasket, Trophy, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SiteHeader } from '../service/SiteShell';
import {
  canCommitBreadDraft,
  clearBreadDraft,
  commitBreadDraft,
  removeTrayBread,
  restoreTrayBread,
  selectBreadDraft,
  toggleDraftTag,
} from './tray-model.mjs';
import { ApiState } from '../../components/ApiState';
import { errorMessage } from '../../lib/api/error-message.mjs';
import { BreadPhoto, TrayArt } from './TrayArt';
import { PreferencePanel } from './PreferencePanel';
import { useBreadDrag } from './useBreadDrag';
import './tray.css';

const navigation = [
  { label: '홈', page: 'home', icon: Home },
  { label: '빵 담기', page: 'selection', icon: ShoppingBasket },
  { label: '리뷰 랭킹', page: 'ranking', icon: Trophy },
];

// Below this width the tag panel is rendered inside the bread grid, right under the
// row of the active card (see PreferencePanel). Must match the CSS breakpoint.
const INLINE_PANEL_QUERY = '(max-width: 1000px)';
const INLINE_COLUMNS = 4; // bread grid columns whenever the panel is inline
const UNDO_MS = 4500;
const NOTICE_MS = 2800;

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function TrayPage({ go, tray, setTray, onRecommend, catalog, recommendation }) {
  const breadCatalog = catalog.data ?? [];
  const blocked = catalog.status !== 'success' || recommendation.pending;
  const [notice, setNotice] = useState('');
  const [undo, setUndo] = useState(null); // { entry, index } of the bread just removed
  const panelRef = useRef(null);
  const [dropFocusRequest, setDropFocusRequest] = useState(0);
  const inlinePanel = useMediaQuery(INLINE_PANEL_QUERY);
  const activeId = tray.draft?.breadId ?? null;

  useLayoutEffect(() => {
    if (!dropFocusRequest || !panelRef.current) return;
    const panel = panelRef.current;
    panel.focus({ preventScroll: true });
    const bounds = panel.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
      panel.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'instant' : 'smooth' });
    }
  }, [dropFocusRequest]);

  // Inline panel: keep the tapped card on screen and bring the panel up from under
  // the fixed bars (scroll-margin in CSS) instead of jumping to the top.
  useLayoutEffect(() => {
    if (!inlinePanel || !activeId || !panelRef.current) return;
    panelRef.current.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'instant' : 'smooth' });
  }, [inlinePanel, activeId]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = '대빵 · 빵 담기';
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => { setNotice(''); setUndo(null); }, undo ? UNDO_MS : NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice, undo]);

  const announce = (text, undoPayload = null) => { setNotice(text); setUndo(undoPayload); };

  const navigate = (page) => {
    if (page === 'selection') return;
    go(page);
  };

  const chooseBread = (bread) => {
    if (blocked) return;
    // Inline: tapping the open card again folds its panel; it never removes the bread.
    if (inlinePanel && tray.draft?.breadId === bread.id) setTray((current) => clearBreadDraft(current));
    else setTray((current) => selectBreadDraft(current, bread.id, breadCatalog));
    if (!undo) announce('');
  };

  const openFromTray = (breadId) => {
    if (blocked) return;
    setTray((current) => selectBreadDraft(current, breadId, breadCatalog));
    document.getElementById(`db-bread-${breadId}`)?.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'instant' : 'smooth' });
  };

  const drag = useBreadDrag({
    catalog: breadCatalog,
    onDropBread(bread) {
      chooseBread(bread);
      setDropFocusRequest((request) => request + 1);
      announce(`${bread.label} 취향을 고른 뒤 ‘빵 담기’를 눌러주세요.`);
    },
  });

  const updateDraftTag = (tagId) => {
    setTray((current) => toggleDraftTag(current, tagId, breadCatalog));
    if (!undo) announce('');
  };

  const commitDraft = () => {
    if (blocked || !canCommitBreadDraft(tray)) return;
    const bread = breadCatalog.find(({ id }) => id === tray.draft.breadId);
    if (!bread) return;
    const wasCommitted = tray.entries.some(({ breadId }) => breadId === bread.id);
    setTray((current) => commitBreadDraft(current, breadCatalog));
    announce(`${bread.label} ${wasCommitted ? '취향을 수정했어요.' : '담기 완료'}`);
  };

  const removeBread = (breadId) => {
    const bread = breadCatalog.find(({ id }) => id === breadId);
    const index = tray.entries.findIndex((entry) => entry.breadId === breadId);
    const entry = tray.entries[index];
    setTray((current) => removeTrayBread(current, breadId));
    announce(`${bread?.label || '빵'}을(를) 뺐어요.`, entry ? { entry, index } : null);
  };

  const undoRemove = () => {
    if (!undo) return;
    setTray((current) => restoreTrayBread(current, undo.entry, undo.index));
    announce('');
  };

  const recommend = () => {
    if (!blocked && tray.entries.length) onRecommend();
  };

  const tagLabel = (bread, tagId) => bread?.tags.find((tag) => tag.id === tagId)?.label;
  const panel = (
    <PreferencePanel
      catalog={breadCatalog}
      disabled={blocked}
      pending={recommendation.pending}
      draft={tray.draft}
      entries={tray.entries}
      onTag={updateDraftTag}
      onCommit={commitDraft}
      onRemove={removeBread}
      onClose={() => setTray((current) => clearBreadDraft(current))}
      onRecommend={recommend}
      panelRef={panelRef}
      inline={inlinePanel}
    />
  );
  // Inline: the panel goes after the last card of the active card's row.
  const activeIndex = breadCatalog.findIndex(({ id }) => id === activeId);
  const panelAfter = inlinePanel && activeIndex >= 0
    ? Math.min(breadCatalog.length, (Math.floor(activeIndex / INLINE_COLUMNS) + 1) * INLINE_COLUMNS) - 1
    : -1;

  return (
    <div className="daebbang-tray">
      <a className="db-skip" href="#db-main">본문 바로가기</a>
      <SiteHeader active="selection" go={navigate} variant="editorial" />

      <main id="db-main" className="db-layout">
        <section className="db-selection" aria-labelledby="db-page-title">
          <div className="db-page-heading">
            <h1 id="db-page-title">좋아하는 빵을 골라주세요</h1>
            <p>빵을 고르고, 취향을 담아주세요.</p>
          </div>

          {catalog.status !== 'success' ? <ApiState status={catalog.status} error={catalog.error} onRetry={catalog.status === 'error' ? catalog.reload : undefined} /> : !breadCatalog.length ? <ApiState title="선택할 빵이 없어요" description="빵 목록이 준비되면 선택할 수 있어요." onRetry={catalog.reload} /> : null}
          <div className="db-bread-grid" role="group" aria-label={`빵 종류 ${breadCatalog.length}개`}>
            {breadCatalog.flatMap((bread, index) => {
              const committed = tray.entries.some(({ breadId }) => breadId === bread.id);
              const focused = activeId === bread.id;
              const card = (
                <button
                  key={bread.id}
                  id={`db-bread-${bread.id}`}
                  type="button"
                  disabled={blocked}
                  className={cn('db-bread-option', focused && 'is-focused', committed && 'is-committed', drag.draggedId === bread.id && 'is-dragging')}
                  aria-pressed={focused}
                  aria-label={`${bread.label} 취향 선택${committed ? ' · 트레이에 담김' : ''}`}
                  aria-describedby="db-drag-instructions"
                  draggable={!blocked}
                  onDragStart={(event) => drag.startDrag(event, bread)}
                  onDragEnd={drag.clearDrag}
                  onClick={() => chooseBread(bread)}
                >
                  {committed ? <span className="db-selected-marker" aria-hidden="true"><Check size={12} strokeWidth={2} /></span> : null}
                  <BreadPhoto visualKey={bread.visualKey} />
                  <strong>{bread.label}</strong>
                </button>
              );
              return index === panelAfter ? [card, <div key="db-inline-panel" className="db-inline-panel">{panel}</div>] : [card];
            })}
          </div>

          <section className="db-tray-section" aria-labelledby="db-tray-title">
            <div className="db-tray-heading">
              <h2 id="db-tray-title">내 트레이</h2>
              <span><strong>{tray.entries.length}</strong> / 8 담음</span>
            </div>
            <div
              className={cn('db-drop-zone', drag.draggedId && 'is-drag-active', drag.isOverTray && 'is-drag-over')}
              {...drag.dropTargetProps}
            >
              <TrayArt entries={tray.entries} seed={tray.seed} catalog={breadCatalog} />
              {drag.draggedId ? <p className="db-drop-hint" aria-hidden="true">{drag.isOverTray ? '여기에 놓고 취향을 골라주세요' : '트레이 위에 놓아주세요'}</p> : null}
            </div>
            <p id="db-drag-instructions" className="db-drag-instructions">
              {inlinePanel
                ? (tray.entries.length >= 8 ? '트레이가 가득 찼어요. 담은 빵을 눌러 취향을 바꿀 수 있어요.' : tray.entries.length ? '다음 빵을 골라 담거나, 추천을 받아보세요.' : '빵을 누르고 취향을 골라 담아주세요.')
                : '빵을 클릭하거나 트레이로 끌어온 뒤, 취향을 골라 담아주세요.'}
            </p>
            {inlinePanel && tray.entries.length ? (
              <ul className="db-tray-list" aria-label="담은 빵">
                {tray.entries.map((entry) => {
                  const bread = breadCatalog.find(({ id }) => id === entry.breadId);
                  if (!bread) return null;
                  return (
                    <li key={entry.breadId}>
                      <button type="button" disabled={blocked} onClick={() => openFromTray(entry.breadId)} aria-label={`${bread.label} 취향 수정`}>
                        <BreadPhoto visualKey={bread.visualKey} />{bread.label}
                        <small>{entry.tags.map((tagId) => tagLabel(bread, tagId)).filter(Boolean).join(' · ')}</small>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div className="db-tray-cta">
              <p className="db-count-summary"><strong>내 트레이</strong><span><strong>{tray.entries.length}</strong> / 8</span></p>
              <Button variant="outline" className="db-recommend" disabled={blocked || !tray.entries.length} onClick={recommend}>
                {recommendation.pending ? '추천받는 중…' : '빵집 추천받기'}
              </Button>
            </div>
          </section>
        </section>

        {inlinePanel ? null : panel}
      </main>
      {recommendation.error ? <p className="api-inline-error" role="alert">{errorMessage(recommendation.error)}</p> : null}

      <div className={cn('db-notice', notice && 'is-visible')} role="status">
        <span>{notice}</span>
        {notice && undo ? <button type="button" className="db-notice-action" onClick={undoRemove}>실행취소</button> : null}
        {notice ? (
          <button aria-label="안내 닫기" onClick={() => announce('')}>
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div className="db-mobile-summary">
        <button
          onClick={() => document.getElementById('db-tray-title')?.scrollIntoView({ behavior: reduceMotion() ? 'instant' : 'smooth', block: 'start' })}
          aria-label="내 트레이로 이동"
        >
          <ShoppingBasket size={18} aria-hidden="true" />내 트레이 <strong>{tray.entries.length}</strong>
        </button>
        <Button onClick={recommend} disabled={blocked || !tray.entries.length}>{recommendation.pending ? '추천받는 중…' : '추천받기'} <ArrowRight size={16} /></Button>
      </div>

      <nav className="db-mobile-nav" aria-label="하단 메뉴">
        {navigation.map(({ label, page, icon: Icon }) => (
          <button key={page} aria-current={page === 'selection' ? 'page' : undefined} onClick={() => navigate(page)}>
            <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
