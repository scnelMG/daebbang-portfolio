import { Crown, LockKeyhole } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiState } from '@/components/ApiState';
import { SiteShell } from './SiteShell';
import { localDate } from './service-data';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../../lib/api/useApiQuery';
import { rankingSummary } from '../account/account-model.mjs';

export function RankingPage({ go }) {
  const { api } = useAuth();
  const month = localDate().slice(0, 7);
  const ranking = useApiQuery(`ranking:${month}`, ({ signal }) => api.ranking({ period: 'monthly', yearMonth: month, signal }));
  const counts = ranking.data ? rankingSummary(ranking.data) : null;
  const rows = ranking.data ? [...ranking.data.entries, ...(ranking.data.myRank && !ranking.data.entries.some((entry) => entry.isMe) ? [ranking.data.myRank] : [])] : [];
  return <SiteShell active="ranking" go={go} className="ranking-screen">
    <main id="main-content" className="ranking-main">
      <header className="page-heading ranking-heading"><h1>리뷰 랭킹</h1><span>{Number(month.slice(0, 4))}년 {Number(month.slice(5))}월</span></header>
      {ranking.status !== 'success' ? <ApiState status={ranking.status} error={ranking.error} onRetry={ranking.status === 'error' ? ranking.reload : undefined} /> : <>
        <dl className="ranking-summary"><div><dt>내 순위</dt><dd>{counts.rank ?? '순위 없음'}{counts.rank != null ? <small>위</small> : null}</dd></div><div><dt>이번 달 방문 빵집</dt><dd>{counts.visitedBakeryCount ?? '—'}{counts.visitedBakeryCount != null ? <small>곳</small> : null}</dd></div><div><dt>이번 달 리뷰</dt><dd>{counts.reviewCount ?? '—'}{counts.reviewCount != null ? <small>개</small> : null}</dd></div></dl>
        <section className="ranking-board" aria-labelledby="ranking-table-title"><h2 id="ranking-table-title">이번 달 리뷰어 랭킹</h2>
          {rows.length ? <Table aria-label="이번 달 리뷰어 순위"><TableHeader><TableRow><TableHead>순위</TableHead><TableHead>리뷰어</TableHead><TableHead>방문 빵집</TableHead><TableHead>리뷰 수</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((row) => <TableRow key={`${row.rank}:${row.nickname}`} className={row.isMe ? 'my-ranking-row' : undefined} data-winner={row.rank === 1 || undefined}><TableCell><span className="rank-no">{row.rank}</span></TableCell><TableCell><div className="rank-reviewer"><span>{row.nickname}{row.isMe ? ' (나)' : ''}</span>{row.rank === 1 ? <Badge active className="rank-crown"><Crown aria-hidden="true" />이달의 대빵</Badge> : null}{row.isMe ? <Badge className="rank-me">내 순위</Badge> : null}</div></TableCell><TableCell>{row.visitedBakeryCount}곳</TableCell><TableCell>{row.reviewCount}개</TableCell></TableRow>)}</TableBody>
          </Table> : <ApiState title="이번 달 랭킹이 아직 없어요" description="집계된 리뷰가 있으면 순위가 표시돼요." />}
          <footer className="ranking-footer"><p><LockKeyhole aria-hidden="true" />다른 사람의 리뷰 내용은 공개되지 않아요.</p><p>리뷰 작성일을 기준으로 집계해요.</p></footer>
        </section>
      </>}
    </main>
  </SiteShell>;
}
