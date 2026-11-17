/* luma.ts: where to register. The Luma event links are not out yet, so every city points at one placeholder address.

   PLACEHOLDER, not confirmed: the Luma links. */
export const LUMA = 'https://example.com/luma';
/* false while LUMA is the placeholder: a page shows no Register link until the real one is here */
export const LUMA_LIVE = false;
export const lumaHref = (city?: string) => LUMA + (city ? '?city=' + city : '');
