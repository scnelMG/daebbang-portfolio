// Pure helper for the home headline. No React, no DOM — unit tested in test/home-carousel.test.mjs.

const DEFAULT_BREAD = '소금빵';
export const HEADLINE_SUFFIX = '에 진심인 당신에게';

/**
 * Headline for the active curation card: "<대표 빵>에 진심인 당신에게".
 * A campaign without `bread` falls back to the original copy (소금빵) so the page never shows an empty subject.
 * `subject` is rendered separately (accent colour) so only the bread name visibly changes between cards.
 */
export function campaignHeadline(campaign) {
  const bread = String(campaign?.bread ?? '').trim();
  const subject = bread || DEFAULT_BREAD;
  return { bread, subject, suffix: HEADLINE_SUFFIX, text: `${subject}${HEADLINE_SUFFIX}` };
}
