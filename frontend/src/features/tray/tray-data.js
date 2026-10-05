import empty from '../../../assets/tray-v3/tray-empty-v3.png';
import salt from '../../../assets/daebbang/salt.png';
import loaf from '../../../assets/daebbang/loaf.png';
import croissant from '../../../assets/daebbang/croissant.png';
import bagel from '../../../assets/daebbang/bagel.png';
import baguette from '../../../assets/daebbang/baguette.png';
import ciabatta from '../../../assets/daebbang/ciabatta.png';
import financier from '../../../assets/daebbang/financier.png';
import egg from '../../../assets/daebbang/egg.png';

export const trayAssets = { empty };

const tag = (id, label) => ({ id, label });

// Per-bread descriptors are taken from the project's agreed bread taxonomy.
// They are intentionally not shared as one generic list: the recommendation
// request must preserve which descriptors were chosen for which bread.
export const breadCatalog = [
  {
    id: 'salt', label: '소금빵', layer: salt,
    tags: [tag('original', '오리지널'), tag('crispy', '겉바삭'), tag('moist', '촉촉'), tag('butter', '버터 풍미'), tag('salty', '짭짤한 맛'), tag('chewy', '쫄깃')],
  },
  {
    id: 'loaf', label: '식빵', layer: loaf,
    tags: [tag('original', '오리지널'), tag('chewy', '쫄깃'), tag('soft', '부드러움'), tag('moist', '촉촉'), tag('butter', '버터 풍미'), tag('distinctive', '이색 특징'), tag('mild', '담백'), tag('nutty', '고소')],
  },
  {
    id: 'croissant', label: '크루아상', layer: croissant,
    tags: [tag('original', '오리지널'), tag('crispy', '겹겹 파삭'), tag('butter', '버터 풍미')],
  },
  {
    id: 'bagel', label: '베이글', layer: bagel,
    tags: [tag('original', '오리지널'), tag('chewy', '쫄깃'), tag('springy', '탄력감'), tag('dense', '밀도감')],
  },
  {
    id: 'baguette', label: '바게트', layer: baguette,
    tags: [tag('original', '오리지널'), tag('crispy', '겉바삭'), tag('moist', '촉촉'), tag('with-ingredients', '부재료 있음')],
  },
  {
    id: 'ciabatta', label: '치아바타', layer: ciabatta,
    tags: [tag('original', '오리지널'), tag('chewy', '쫄깃'), tag('open-crumb', '큰 기공'), tag('olive', '올리브 향'), tag('airy', '성긴 결'), tag('fluffy', '폭신')],
  },
  {
    id: 'financier', label: '휘낭시에', layer: financier,
    tags: [tag('original', '오리지널'), tag('moist', '촉촉'), tag('crispy', '겉바삭'), tag('soft', '부드러움'), tag('roasted', '구운 풍미')],
  },
  {
    id: 'egg', label: '에그타르트', layer: egg,
    tags: [tag('original', '오리지널'), tag('moist', '촉촉'), tag('crispy', '겹겹 파삭'), tag('custard', '커스터드 풍미')],
  },
].map((bread) => ({ ...bread, allowedTags: bread.tags.map(({ id }) => id) }));

// Crop of the 1254×1254 cutouts shared by the picker and the tray.
// Where a bread lies on the tray is decided by the slot it was added to — see tray-layout.mjs.
export const breadImageFrame = '145 175 1010 920';
