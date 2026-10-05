import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { ApiState } from '@/components/ApiState';
import { BakeryPhoto } from '@/components/BakeryPhoto';
import { AccountLayout } from './AccountLayout';
import { BreadSummary, Rating, PeriodFilter, HistoryEmpty, displayDate } from './HistoryParts';
import { filterHistory, mapReviews } from './account-model.mjs';
import { localDate } from '../service/service-data';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../../lib/api/useApiQuery';

export function MyReviewsPage({ go }) {
  const { api } = useAuth();
  const reviews = useApiQuery('my-reviews', async (options) => mapReviews(await api.myReviews(options)));
  const [period, setPeriod] = useState('all');
  const visible = filterHistory(reviews.data ?? [], period, localDate());
  return <AccountLayout active="my-reviews" go={go}>
    <header className="page-heading account-heading account-heading--filter"><div><h1>내가 쓴 리뷰</h1><p className="account-privacy"><LockKeyhole aria-hidden="true" />나만 볼 수 있어요.</p></div><PeriodFilter value={period} onChange={setPeriod} /></header>
    {reviews.status !== 'success' ? <ApiState status={reviews.status} error={reviews.error} onRetry={reviews.status === 'error' ? reviews.reload : undefined} /> : <>
      <div className="review-receipts">{visible.map((review) => <Card key={review.id} className="review-receipt" aria-label={`${review.bakeryName || '빵집 정보 없음'} ${displayDate(review.date)} 리뷰`}>
        <CardHeader className="receipt-top"><time dateTime={review.date}>{displayDate(review.date)}</time><Rating value={review.rating} /></CardHeader>
        <CardContent className="receipt-body"><BakeryPhoto className="receipt-store-photo" src={review.bakeryImageUrl} alt={`${review.bakeryName || '빵집 정보 없음'} 매장 사진`} />
          <div className="receipt-content"><CardTitle>{review.bakeryName || '빵집 정보 없음'}</CardTitle><p className="receipt-bread-count">먹은 빵 {review.breads.length + review.customBreadNames.length}종</p><p className="receipt-section-label">내가 선택한 리뷰</p>
            {review.breads.map((entry) => <BreadSummary key={entry.breadId} name={entry.breadName} tags={entry.tagNames} />)}
            {review.customBreadNames.map((name, index) => <BreadSummary key={`custom:${index}`} name={name} tags={[]} />)}
          </div>
        </CardContent>
      </Card>)}</div>
      {!visible.length ? <HistoryEmpty title="아직 남긴 리뷰가 없어요" description="다른 기간을 선택하거나, 먹어본 빵의 특징을 남겨보세요." action="리뷰 쓰기" onAction={() => go('review')} /> : null}
    </>}
  </AccountLayout>;
}
