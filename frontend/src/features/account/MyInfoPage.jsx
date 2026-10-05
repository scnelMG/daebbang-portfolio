import { UserRound } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { ApiState } from '@/components/ApiState';
import { AccountLayout } from './AccountLayout';
import { useAuth } from '../auth/AuthProvider';
import { useApiQuery } from '../../lib/api/useApiQuery';

export function MyInfoPage({ go }) {
  const { api } = useAuth();
  const me = useApiQuery('me', (options) => api.me(options));
  return <AccountLayout active="my-info" go={go}>
    <header className="page-heading account-heading"><h1>내 정보</h1></header>
    {me.status !== 'success' ? <ApiState status={me.status} error={me.error} onRetry={me.status === 'error' ? me.reload : undefined} /> : <>
      <Card className="profile-card"><CardContent>
        <p className="profile-image-label">프로필 이미지</p>
        <Avatar className="profile-avatar"><AvatarFallback><UserRound aria-label="기본 프로필" /></AvatarFallback></Avatar>
        <dl className="profile-details"><div><dt>닉네임</dt><dd>{me.data.nickname}</dd></div><div><dt>아이디</dt><dd>{me.data.userId}</dd></div><div><dt>로그인 방식</dt><dd>{me.data.provider === 'google' ? 'Google' : me.data.provider === 'local' ? '이메일 로그인' : me.data.provider}</dd></div></dl>
      </CardContent></Card><p className="account-footnote">내 계정의 기본 정보예요.</p>
    </>}
  </AccountLayout>;
}
