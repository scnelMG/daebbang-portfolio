import closed from '../../../assets/daebbang/bag-closed.webp';
import opened from '../../../assets/daebbang/bag-open.webp';
import seal from '../../../assets/daebbang/seal.webp';
import labelArt from '../../../assets/daebbang/bag-label.webp';
import { BAG_LABEL_SLOTS } from './bag-label.mjs';

// A kraft bag drawn from the supplied transparent canvases (WebP: 6MB of PNG → 0.6MB, no visible change). Closed, it carries
// nothing but the seal. Opened, the printed label reads bakery name · ♥ · district
// and up to three features, and whatever is passed as children sits in the bag's
// mouth — clipped at the front rim so a card can rise out of it (see .bag-mouth).
export function BagArtwork({ open = false, label = null, children = null, compact = false, className = '' }) {
  return <div className={`bag-artwork ${open ? 'bag-artwork--open' : ''} ${compact ? 'bag-artwork--compact' : ''} ${className}`}>
    <svg className="bag-paper" viewBox="60 120 1000 1170" aria-hidden="true" focusable="false"><image href={open ? opened : closed} width="1122" height="1402" /></svg>
    {!open ? <svg className="bag-seal" viewBox="125 100 985 990" aria-hidden="true" focusable="false"><image href={seal} width="1254" height="1254" /></svg> : null}
    {open && label ? <div className="bag-print">
      <svg viewBox="145 110 970 980" aria-hidden="true" focusable="false"><image href={labelArt} width="1254" height="1254" /></svg>
      <strong className="bag-print-name">{label.name}</strong>
      <span className="bag-print-place">{label.district ? `대전 ${label.district}` : '대전'}</span>
      <ul className="bag-print-features" aria-label="특징">
        {Array.from({ length: BAG_LABEL_SLOTS }, (_, index) => <li key={index}>{label.features?.[index] ?? ''}</li>)}
      </ul>
    </div> : null}
    {open && children ? <div className="bag-mouth">{children}</div> : null}
  </div>;
}
