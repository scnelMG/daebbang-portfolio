import logo from '../../assets/daebbang/logo.png';

export function BrandLogo({ className = '' }) {
  return <svg className={`brand-logo ${className}`} viewBox="120 295 1210 510" role="img" aria-label="대빵" focusable="false">
    <image href={logo} width="1448" height="1086" />
  </svg>;
}
