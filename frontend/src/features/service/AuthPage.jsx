import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError, FieldSet, FieldLegend } from '@/components/ui/field';
import { SiteShell } from './SiteShell';
import { trayPhoto } from './service-data';
import { useAuth } from '../auth/AuthProvider';
import { GoogleSignIn } from '../auth/GoogleSignIn';
import { loginReturn } from '../../lib/routes.mjs';
import { errorMessage } from '../../lib/api/error-message.mjs';

export function AuthPage({ go, signup = false, returnTo, notice }) {
  const { api, login, google } = useAuth();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const run = async (operation, onSuccess) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true); setError('');
    try {
      await operation({ signal: controller.signal });
      if (!controller.signal.aborted) onSuccess();
    } catch (reason) { if (!controller.signal.aborted) setError(errorMessage(reason)); }
    finally { if (!controller.signal.aborted) setPending(false); request.current = null; }
  };
  const completeLogin = () => { const route = loginReturn(returnTo); go(route.page, route); };
  const submit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const dto = { email: data.get('email').trim(), password: data.get('password') };
    if (signup) {
      Object.assign(dto, { nickname: data.get('nickname').trim(), passwordConfirm: data.get('passwordConfirm'), termsAgreed: data.get('termsAgreed') === 'on', privacyAgreed: data.get('privacyAgreed') === 'on' });
      if (dto.password !== dto.passwordConfirm) { setError('비밀번호 확인이 일치하지 않아요.'); return; }
      run((options) => api.signup(dto, options), () => go('login', { returnTo, notice: 'signup' }));
    } else run((options) => login(dto, options), completeLogin);
  };
  return <SiteShell go={go} hideMobileNav className="auth-screen">
    <main id="main-content" className="auth-layout">
      <figure className="auth-photo"><img src={trayPhoto} alt="따뜻한 빵이 담긴 나무 트레이" /></figure>
      <section className="auth-form-region">
        <Button variant="ghost" size="sm" className="auth-back" onClick={() => go('home')}><ArrowLeft data-icon="inline-start" />홈으로</Button>
        <div className="auth-content"><header><h1>{signup ? '회원가입' : '로그인'}</h1><p>{signup ? '나만의 빵 취향을 모아보세요.' : '나의 빵 취향을 이어가요.'}</p></header>
          {notice === 'signup' ? <p className="auth-feedback" role="status">회원가입이 완료됐어요. 로그인해주세요.</p> : null}
          <form onSubmit={submit} aria-busy={pending}>
            <FieldGroup>
              {signup ? <Field><FieldLabel htmlFor="nickname">닉네임</FieldLabel><Input id="nickname" name="nickname" placeholder="사용할 닉네임" required minLength={2} maxLength={50} autoComplete="nickname" disabled={pending} /></Field> : null}
              <Field><FieldLabel htmlFor="email">이메일</FieldLabel><Input id="email" name="email" type="email" placeholder="bread@example.com" required autoComplete="email" disabled={pending} /></Field>
              <Field><FieldLabel htmlFor="password">비밀번호</FieldLabel><Input id="password" name="password" type="password" placeholder="8자 이상 입력해주세요" required minLength={8} maxLength={64} autoComplete={signup ? 'new-password' : 'current-password'} disabled={pending} /></Field>
              {signup ? <><Field><FieldLabel htmlFor="passwordConfirm">비밀번호 확인</FieldLabel><Input id="passwordConfirm" name="passwordConfirm" type="password" required minLength={8} autoComplete="new-password" disabled={pending} /></Field>
                <FieldSet disabled={pending}><FieldLegend>필수 동의</FieldLegend><FieldGroup>
                  <Field><label className="consent"><input name="termsAgreed" type="checkbox" required /><span>이용약관 동의 (필수)</span></label></Field>
                  <Field><label className="consent"><input name="privacyAgreed" type="checkbox" required /><span>개인정보 처리방침 동의 (필수)</span></label></Field>
                </FieldGroup></FieldSet></> : null}
            </FieldGroup>
            <Button type="submit" className="full" disabled={pending}>{pending ? '처리 중…' : signup ? '회원가입' : '로그인'}<ArrowRight data-icon="inline-end" /></Button>
            <FieldError>{error}</FieldError>
          </form>
          <p className="auth-switch">{signup ? '이미 계정이 있나요?' : '처음 오셨나요?'}<button disabled={pending} onClick={() => go(signup ? 'login' : 'signup', { returnTo })}>{signup ? '로그인' : '회원가입'}</button></p>
          <GoogleSignIn disabled={pending} onCredential={(idToken) => run((options) => google({ idToken }, options), completeLogin)} />
          {!signup && returnTo ? <FieldDescription>로그인 후 이전 화면으로 돌아가요. 담아둔 빵은 유지돼요.</FieldDescription> : null}
        </div>
      </section>
    </main>
  </SiteShell>;
}
