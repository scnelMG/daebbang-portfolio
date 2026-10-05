import { ChevronLeft } from 'lucide-react';
import { SiteShell } from '../service/SiteShell';
import { accountMenu } from './account-data';

export function AccountLayout({ active, go, children }) {
  return <SiteShell active="mypage" go={go} className="account-screen">
    <main id="main-content" className="account-layout">
      <aside className="account-sidebar"><button className="account-back" onClick={() => go('mypage')}><ChevronLeft aria-hidden="true" />마이페이지</button>
        <nav aria-label="마이페이지 메뉴">{accountMenu.map(({ page, label }) => <button key={page} aria-current={active === page ? 'page' : undefined} onClick={() => go(page)}>{label}</button>)}</nav>
      </aside>
      <div className="account-content">{children}</div>
    </main>
  </SiteShell>;
}
