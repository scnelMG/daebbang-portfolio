import { useState } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { ApiState } from '@/components/ApiState';
import { AccountLayout } from './AccountLayout';
import { HistoryBakeryCard } from './HistoryBakeryCard';
import { BreadSummary, PeriodFilter, HistoryEmpty, displayDate } from './HistoryParts';
import { filterHistory, mapHistoryRecords } from './account-model.mjs';
import { localDate } from '../service/service-data';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../../lib/api/useApiQuery';

function RecommendationGroups({ records, go }) {
  return <Accordion type="multiple" defaultValue={records.length ? [String(records[0].id)] : []} className="recommendation-history-list">
    {records.map((record) => <AccordionItem value={String(record.id)} key={record.id} className="recommendation-history-group">
      <AccordionTrigger aria-label={`${displayDate(record.date)} ${record.tray.map(({ bread }) => bread).join(', ')} 추천 이력`}><span><time dateTime={record.createdAt}>{record.createdAt.replace('T', ' ').slice(0, 16)}</time><span className="history-collapsed-summary">{record.tray.map(({ bread }) => bread).join(' · ')}<span>추천 빵집 {record.results.length}곳</span></span></span></AccordionTrigger>
      <AccordionContent><div className="recommendation-breads">{record.tray.map((entry, index) => <BreadSummary name={entry.bread} tags={entry.tags} key={index} />)}</div>
        {record.results.map((store) => <HistoryBakeryCard key={store.recommendationResultId} store={store} recommendationId={record.recommendationId} go={go} />)}
        {!record.results.length ? <p>추천된 빵집이 없었던 이력이에요.</p> : null}
      </AccordionContent>
    </AccordionItem>)}
  </Accordion>;
}

export function RecommendationHistoryPage({ go }) {
  const { api } = useAuth();
  const history = useApiQuery('recommendation-history', async (options) => mapHistoryRecords(await api.history(options)));
  const [period, setPeriod] = useState('all');
  const visible = filterHistory(history.data ?? [], period, localDate());
  return <AccountLayout active="recommendation-history" go={go}>
    <header className="page-heading account-heading account-heading--filter"><div><h1>추천받은 빵집</h1><p>이전에 추천받은 빵집을 다시 확인해보세요.</p></div><PeriodFilter value={period} onChange={setPeriod} /></header>
    {history.status !== 'success' ? <ApiState status={history.status} error={history.error} onRetry={history.status === 'error' ? history.reload : undefined} /> : visible.length ? <RecommendationGroups key={period} records={visible} go={go} /> : <HistoryEmpty title="이 기간에는 추천 이력이 없어요" description="빵과 취향을 담으면 어울리는 빵집을 추천해드려요." action="빵 담으러 가기" onAction={() => go('selection')} />}
    <p className="account-footnote">빵과 취향은 추천 당시의 기록이에요. 빵집 이름·사진·지역·지도는 현재 등록된 정보로 보여드려요.</p>
  </AccountLayout>;
}
