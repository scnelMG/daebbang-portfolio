import { useState } from 'react';
import placeholder from '../../assets/bakery-placeholder.svg';

export function BakeryPhoto({ src, alt, ...props }) {
  const [failed, setFailed] = useState(null);
  const fallback = !src || failed === src;
  return <img {...props} src={fallback ? placeholder : src} alt={fallback ? `${alt} · 사진 준비 중` : alt}
    onError={fallback ? undefined : () => setFailed(src)} />;
}
