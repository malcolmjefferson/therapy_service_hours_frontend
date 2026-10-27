// The PDF's fonts travel inside the lazy PDF chunk as data, not as files fetched on export: generating a PDF makes
// no network request (SEC-38, S4-09). They are the same Inter and Fredoka files the app serves, so the PDF matches
// the screen. `?inline` is what turns a font into data: the app-wide `assetsInlineLimit: 0` keeps the page's own
// fonts as separate files for the CSP, and this chunk only ever runs after the person asks for a PDF.
import fredokaSemiBold from '@fontsource/fredoka/files/fredoka-latin-600-normal.woff?inline';
import interRegular from '@fontsource/inter/files/inter-latin-400-normal.woff?inline';
import interSemiBold from '@fontsource/inter/files/inter-latin-600-normal.woff?inline';

/** The bytes of a `data:` URL, decoded without any request. */
export function dataUrlBytes(url: string): Uint8Array {
  const base64 = url.slice(url.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const FONT_FILES = {
  heading: fredokaSemiBold,
  body: interRegular,
  bodyBold: interSemiBold,
} as const;
