import { Home, ShoppingBasket, Trophy, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/BrandLogo';
import { useAuth } from '../auth/AuthProvider';

export const navigation = [
  { label: '홈', page: 'home', icon: Home },
  { label: '빵 담기', page: 'selection', icon: ShoppingBasket },
  { label: '리뷰 랭킹', page: 'ranking', icon: Trophy },
];
const isCurrent = (active, page) => active === page || (page === 'selection' && active === 'result');

export function SiteHeader({ active, go }) {
  const { isAuthenticated } = useAuth();
  return <header className="site-header">
    <button className="brand" onClick={() => go('home')} aria-label="대빵 홈"><BrandLogo /></button>
    <nav aria-label="주요 메뉴">{navigation.map(({ label, page }) => <button key={page} aria-current={isCurrent(active, page) ? 'page' : undefined} onClick={() => go(page)}>{label}</button>)}</nav>
    <Button variant="ghost" className="site-account-link" aria-label={isAuthenticated ? '마이페이지' : '로그인'} aria-current={active === 'mypage' ? 'page' : undefined} onClick={() => go(isAuthenticated ? 'mypage' : 'login')}><span className="site-account-icon"><UserRound strokeWidth={1.5} aria-hidden="true" /></span><span className="site-account-label">{isAuthenticated ? '마이페이지' : '로그인'}</span></Button>
  </header>;
}

export function MobileNavigation({ active, go }) {
  return <nav className="site-mobile-nav" aria-label="하단 메뉴">{navigation.map(({ label, page, icon: Icon }) => <button key={page} aria-current={isCurrent(active, page) ? 'page' : undefined} onClick={() => go(page)}><Icon strokeWidth={1.6} aria-hidden="true" /><span>{label}</span></button>)}</nav>;
}

export function SiteShell({ active, go, className, children, hideMobileNav = false, headerVariant }) {
  return <div className={cn('screen', hideMobileNav && 'screen--no-mobile-nav', className)}>
    <a className="skip-link" href="#main-content">본문 바로가기</a>
    <SiteHeader active={active} go={go} variant={headerVariant} />
    {children}
    {!hideMobileNav ? <MobileNavigation active={active} go={go} /> : null}
  </div>;
}
