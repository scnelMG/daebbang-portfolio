import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BakeryPhoto } from '@/components/BakeryPhoto';
import { SiteShell } from '../service/SiteShell';
import { campaignDistance, campaignPosition, wrapCampaignIndex } from '../../design-model.mjs';
import { campaignHeadline } from './home-model.mjs';
import { campaigns as fallbackCampaigns } from './campaigns';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../../lib/api/useApiQuery';
import { mapHomeCampaigns, mapLinkLabel } from '../../lib/api/adapters.mjs';
import trayLifestyle from '../../../assets/home-curation/tray-lifestyle.webp';
import './home.css';

const HOME_CARD_COUNT = 5;
const AUTOPLAY_MS = 3500;
const reducedMotionQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null);

export function HomePage({ go }) {
  const { api } = useAuth();
  // "오늘의 빵집": the server picks the day's bakeries (date-seeded, same for everyone).
  // While loading the stage stays empty; if the request fails or returns nothing, the curated fallback cards are shown.
  const today = useApiQuery('home-bakeries', async (options) => mapHomeCampaigns(await api.homeBakeries({ size: HOME_CARD_COUNT, ...options })), { private: false });
  const live = today.status === 'success' && today.data.length > 0;
  const pending = today.status === 'loading' || today.status === 'idle';
  const campaigns = live ? today.data : pending ? [] : fallbackCampaigns;

  const [index, setIndex] = useState(0);
  const cardRefs = useRef([]);
  const moveCardFocus = useRef(false);
  useEffect(() => { setIndex(0); }, [live]);

  // Autoplay: advance every AUTOPLAY_MS, re-armed on every index change (so a manual move restarts the wait).
  // Paused while hovered / focused / tab hidden, and never runs under prefers-reduced-motion.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.visibilityState === 'hidden');
  const [reduceMotion, setReduceMotion] = useState(() => Boolean(reducedMotionQuery()?.matches));
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    const media = reducedMotionQuery();
    const onMotion = (event) => setReduceMotion(event.matches);
    media?.addEventListener('change', onMotion);
    return () => { document.removeEventListener('visibilitychange', onVisibility); media?.removeEventListener('change', onMotion); };
  }, []);
  useLayoutEffect(() => {
    if (moveCardFocus.current) {
      cardRefs.current[index]?.focus({ preventScroll: true });
      moveCardFocus.current = false;
    }
  }, [index]);
  const count = campaigns.length;
  const select = (next) => setIndex((current) => count ? wrapCampaignIndex(typeof next === 'function' ? next(current) : next, count) : 0);
  const move = (direction) => select((current) => current + direction);
  const onKeyDown = (event) => {
    if (!count || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : wrapCampaignIndex(index + (event.key === 'ArrowRight' ? 1 : -1), count);
    moveCardFocus.current = Boolean(event.target.closest('.campaign-card')) && next !== index;
    select(next);
  };
  const autoplay = count > 1 && !hovered && !focused && !hidden && !reduceMotion;
  useEffect(() => {
    if (!autoplay) return undefined;
    const timer = window.setTimeout(() => setIndex((current) => wrapCampaignIndex(current + 1, count)), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoplay, count, index]);
  const selected = count ? campaigns[wrapCampaignIndex(index, count)] : null;
  const headline = selected ? campaignHeadline(selected) : { text: '오늘의 빵집을 준비하고 있어요' };

  return <SiteShell active="home" go={go} className="curation-home" headerVariant="editorial">
    <main id="main-content">
      <section className="home-curation" aria-labelledby="curation-title">
        <h1 id="curation-title">
          {headline.subject ? <><span className="curation-subject">{headline.subject}</span>{headline.suffix}</> : headline.text}
        </h1>
        <div className="campaign-carousel" role="region" aria-roledescription="캐러셀" aria-labelledby="curation-title" aria-busy={pending} onKeyDown={onKeyDown} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
          <div className="campaign-stage">
            {campaigns.map((campaign, position) => {
              const active = index === position;
              const mapLabel = campaign.mapUrl ? `${campaign.store} ${mapLinkLabel(campaign.mapUrl)}에서 보기 (새 탭)` : `${campaign.store} (지도 링크 없음)`;
              return <div key={campaign.id} className="campaign-slot" data-position={campaignPosition(position, index, count)} data-distance={campaignDistance(position, index, count)} role="group" aria-roledescription="슬라이드" aria-label={`${position + 1} / ${count}`} aria-hidden={!active}>
                <a ref={(element) => { cardRefs.current[position] = element; }} className="campaign-card" href={campaign.mapUrl ?? undefined} target="_blank" rel="noreferrer" draggable="false" tabIndex={active ? 0 : -1} aria-label={mapLabel}>
                  <BakeryPhoto src={campaign.image} alt={campaign.alt} width={campaign.width} height={campaign.height} draggable="false" fetchPriority={position === 0 ? 'high' : 'auto'} />
                  <div className="campaign-caption"><div><h2>{campaign.title ?? campaign.store}</h2><p>{campaign.title ? <>{campaign.store}<span aria-hidden="true"> · </span>{campaign.area}</> : campaign.area}</p></div><ArrowUpRight aria-hidden="true" strokeWidth={1.5} /></div>
                </a>
              </div>;
            })}
            <Button variant="outline" size="round" className="campaign-arrow campaign-arrow--previous" aria-label="이전 빵집" disabled={!count} onClick={() => move(-1)}><ChevronLeft data-icon="inline-start" /></Button>
            <Button variant="outline" size="round" className="campaign-arrow campaign-arrow--next" aria-label="다음 빵집" disabled={!count} onClick={() => move(1)}><ChevronRight data-icon="inline-start" /></Button>
          </div>
          <div className="campaign-controls">
            <span className="campaign-count" aria-live={autoplay ? 'off' : 'polite'} aria-atomic="true"><strong>{String(count ? index + 1 : 0).padStart(2, '0')}</strong><span>/ {String(count).padStart(2, '0')}</span><span className="home-sr-only">{selected ? ` · ${selected.store}` : ''}</span></span>
            <div className="campaign-dots" role="group" aria-label="빵집 선택">
              {campaigns.map((campaign, position) => <button key={campaign.id} aria-label={`${position + 1}번 ${campaign.store} 보기`} aria-current={position === index ? 'true' : undefined} onClick={() => select(position)}><span /></button>)}
            </div>
          </div>
        </div>
      </section>

      <section className="home-invitation" aria-labelledby="invitation-title">
        <div className="invitation-copy"><h2 id="invitation-title">이제, 내 취향을 담아볼까요?</h2><p>좋아하는 빵과 취향을 고르면,<br />어울리는 빵집을 찾아드려요.</p><Button size="campaign" onClick={() => go('selection')}>빵 담으러 가기<ArrowRight data-icon="inline-end" /></Button></div>
        <figure className="invitation-photo"><img src={trayLifestyle} alt="다양한 빵이 가득 담긴 나무 트레이 — 서비스 연출 이미지" width="1536" height="1024" loading="lazy" /></figure>
      </section>
    </main>
    <footer className="home-footer">
      <div className="home-footer-brand"><span>대빵</span><span>좋아하는 빵에서 시작하는 빵집 찾기</span></div>
      <details className="campaign-sources"><summary>이미지 안내</summary>
        <p>공개 스냅샷에서는 수집한 매장 사진을 제외했습니다. 샘플 매장 일러스트와 빵·트레이 연출 이미지는 실제 매장이나 판매 상품을 나타내지 않습니다.</p>
      </details>
    </footer>
  </SiteShell>;
}
