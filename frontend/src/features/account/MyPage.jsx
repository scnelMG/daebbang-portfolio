import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiteShell } from '../service/SiteShell';
import { accountMenu } from './account-data';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../../lib/api/useApiQuery';
import { ApiState } from '@/components/ApiState';

export function MyPage({ go }) {
  const { api, logout } = useAuth();
  const me = useApiQuery('me', (options) => api.me(options));
  return <SiteShell active="mypage" go={go} className="account-screen">
    <main id="main-content" className="mypage-main">
      <header className="page-heading"><h1>마이페이지</h1>{me.status === 'success' ? <p>{me.data.nickname}님, 오늘도 맛있는 하루 되세요!</p> : <ApiState status={me.status} error={me.error} onRetry={me.status === 'error' ? me.reload : undefined} />}</header>
      <nav className="account-menu" aria-label="마이페이지 메뉴">{accountMenu.map(({ page, label, description, icon: Icon }, index) => <button key={page} className={index === 0 ? 'account-menu-profile' : undefined} onClick={() => go(page)}>
        <Icon className="account-menu-icon" strokeWidth={1.35} aria-hidden="true" /><span><strong>{label}</strong><span>{description}</span></span><ChevronRight strokeWidth={1.5} aria-hidden="true" />
      </button>)}</nav>
      <footer className="mypage-footer"><Button variant="ghost" onClick={() => { logout().catch(() => {}); go('login'); }}>로그아웃</Button></footer>
    </main>
  </SiteShell>;
}
