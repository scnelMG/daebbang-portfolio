import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, LockKeyhole, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldGroup, FieldLabel, FieldError, FieldSet, FieldLegend, FieldDescription } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ApiState } from '@/components/ApiState';
import { BakeryPhoto } from '@/components/BakeryPhoto';
import { SiteShell } from './SiteShell';
import { localDate } from './service-data';
import { BreadPhoto } from '../tray/TrayArt';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../../lib/api/useApiQuery';
import { errorMessage } from '../../lib/api/error-message.mjs';
import { createReviewSubmission, resolveReviewTarget } from '../account/account-model.mjs';

export function ReviewPage({ go, bakeryId, recommendationResultId, recommendationId, catalog }) {
  const { api } = useAuth();
  const history = useApiQuery(`review-history:${recommendationResultId}`, (options) => api.history(options), { enabled: Boolean(recommendationResultId) });
  const target = resolveReviewTarget({ bakeryId, recommendationResultId, recommendationId }, history.data ?? []);
  const bakery = useApiQuery(`review-bakery:${target?.bakeryId}`, (options) => api.bakeryDetail(target.bakeryId, options), { enabled: Boolean(target) });
  let state = null;
  if (recommendationResultId && history.status !== 'success') state = <ApiState status={history.status} error={history.error} onRetry={history.status === 'error' ? history.reload : undefined} />;
  else if (!target) state = <ApiState title="리뷰를 남길 빵집을 선택해주세요" description="추천 이력에서 리뷰를 남길 빵집을 선택해주세요."><Button onClick={() => go('recommendation-history')}>추천받은 빵집</Button></ApiState>;
  else if (bakery.status !== 'success') state = <ApiState status={bakery.status} error={bakery.error} onRetry={bakery.status === 'error' ? bakery.reload : undefined} />;
  else if (catalog.status !== 'success') state = <ApiState status={catalog.status} error={catalog.error} onRetry={catalog.status === 'error' ? catalog.reload : undefined} />;
  if (state) return <SiteShell active="review" go={go} className="review-screen"><main id="main-content" className="page-main">{state}</main></SiteShell>;
  return <ReviewForm key={`${target.bakeryId}:${target.recommendationResultId}`} go={go} target={target} store={bakery.data} catalog={catalog.data} />;
}

function ReviewForm({ go, target, store, catalog }) {
  const { api, session } = useAuth();
  const [review, setReview] = useState({ ...target, visitDate: localDate(), rating: 0, breads: [], customBreadNames: [] });
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const submission = useMemo(() => createReviewSubmission({ createReview: api.createReview, account: () => session.getSnapshot().accountGeneration }), [api, session]);
  const update = (patch) => { setError(null); setReview((current) => ({ ...current, ...patch })); };
  const chooseBreads = (ids) => update({ breads: ids.map(Number).map((breadId) => review.breads.find((entry) => entry.breadId === breadId) || { breadId, tagIds: [] }) });
  const chooseTags = (breadId, ids) => {
    if (ids.length > 2) return;
    update({ breads: review.breads.map((entry) => entry.breadId === breadId ? { ...entry, tagIds: ids.map(Number) } : entry) });
  };
  const submit = async (event) => {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    const owner = session.getSnapshot().accountGeneration;
    try {
      const reviewId = await submission.submit(review, catalog);
      // Mounting MyReviews performs a fresh GET only after the confirmed POST.
      if (reviewId && live.current) go('my-reviews');
    } catch (failure) {
      if (live.current && session.getSnapshot().accountGeneration === owner) setError(errorMessage(failure));
    } finally { if (live.current) setPending(false); }
  };
  return <SiteShell active="review" go={go} className="review-screen">
    <main id="main-content" className="review-layout">
      <aside className="review-bakery"><BakeryPhoto src={store.imageUrl} alt={`${store.name} 매장`} /><h2>{store.name}</h2><span className="privacy-note"><LockKeyhole aria-hidden="true" />내 리뷰는 나에게만 보여요.</span></aside>
      <section className="review-form-region"><header className="page-heading"><h1>리뷰 쓰기</h1><p>오늘 먹은 빵의 특징을 골라주세요.</p></header>
        <form onSubmit={submit} aria-busy={pending}>
          <FieldGroup className="review-meta-fields">
            <Field><FieldLabel htmlFor="visited-bakery">방문한 빵집</FieldLabel><Input id="visited-bakery" value={store.name} readOnly /></Field>
            <Field><FieldLabel htmlFor="visit-date">방문 날짜</FieldLabel><Input id="visit-date" type="date" value={review.visitDate} max={localDate()} required disabled={pending} onChange={(e) => update({ visitDate: e.target.value })} /></Field>
          </FieldGroup>
          <FieldSet disabled={pending}><FieldLegend>오늘의 별점</FieldLegend><ToggleGroup disabled={pending} type="single" className="rating-options" value={String(review.rating)} onValueChange={(value) => value && update({ rating: Number(value) })} aria-label="오늘의 별점">{[1, 2, 3, 4, 5].map((rating) => <ToggleGroupItem key={rating} value={String(rating)} aria-label={`${rating}점`}><Star fill={rating <= review.rating ? 'currentColor' : 'none'} strokeWidth={1.5} /></ToggleGroupItem>)}</ToggleGroup><span className="rating-value">{review.rating ? `${review.rating}점` : '별점을 선택해주세요'}</span></FieldSet>
          <FieldSet disabled={pending}><FieldLegend>먹어본 빵</FieldLegend><ToggleGroup disabled={pending} type="multiple" className="review-bread-options" value={review.breads.map(({ breadId }) => String(breadId))} onValueChange={chooseBreads} aria-label="먹어본 빵">{catalog.map((bread) => <ToggleGroupItem key={bread.id} value={String(bread.id)} aria-label={bread.label}><BreadPhoto visualKey={bread.visualKey} /><span>{bread.label}</span><Check className="review-bread-check" aria-hidden="true" /></ToggleGroupItem>)}</ToggleGroup></FieldSet>
          {review.breads.length ? <div className="review-tags">{review.breads.map((entry) => {
            const bread = catalog.find(({ id }) => id === entry.breadId);
            return <FieldSet key={entry.breadId} disabled={pending}><FieldLegend>{bread.label}의 맛과 식감 <span>{entry.tagIds.length} / 2</span></FieldLegend><ToggleGroup disabled={pending} type="multiple" variant="outline" value={entry.tagIds.map(String)} onValueChange={(tags) => chooseTags(entry.breadId, tags)} aria-label={`${bread.label} 리뷰 태그`}>{bread.tags.map((tag) => <ToggleGroupItem key={tag.id} value={String(tag.id)} disabled={pending || (entry.tagIds.length === 2 && !entry.tagIds.includes(tag.id))}><span className="tag-square" aria-hidden="true">{entry.tagIds.includes(tag.id) ? <Check /> : null}</span>{tag.label}</ToggleGroupItem>)}</ToggleGroup><FieldDescription>태그를 고르지 않고도 리뷰를 남길 수 있어요.</FieldDescription></FieldSet>;
          })}</div> : null}
          <FieldGroup><FieldSet disabled={pending}><FieldLegend>목록에 없는 빵 <span>{review.customBreadNames.length} / 5</span></FieldLegend><FieldDescription>먹은 빵 이름을 최대 5개까지 추가할 수 있어요.</FieldDescription>
            {review.customBreadNames.map((name, index) => <Field key={index}><FieldLabel htmlFor={`custom-bread-${index}`}>빵 이름 {index + 1}</FieldLabel><Input id={`custom-bread-${index}`} value={name} disabled={pending} onChange={(event) => update({ customBreadNames: review.customBreadNames.map((value, position) => position === index ? event.target.value : value) })} /><Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => update({ customBreadNames: review.customBreadNames.filter((_, position) => position !== index) })}>빵 이름 {index + 1} 삭제</Button></Field>)}
            <Button type="button" variant="outline" disabled={pending || review.customBreadNames.length >= 5} onClick={() => update({ customBreadNames: [...review.customBreadNames, ''] })}>목록 외 빵 추가</Button>
          </FieldSet></FieldGroup>
          <FieldError>{error}</FieldError>
          {error ? <Button type="button" variant="ghost" onClick={() => go('my-reviews')}>내가 쓴 리뷰 확인</Button> : null}
          <footer className="review-form-footer"><p>별점과 먹은 빵을 선택해주세요. 태그는 빵마다 0~2개예요.</p><Button type="submit" disabled={pending}>{pending ? '저장 중…' : '리뷰 저장'}</Button></footer>
        </form>
      </section>
    </main>
  </SiteShell>;
}
