import { parseHTML } from 'linkedom';

// linkedom makes a fragment's first element the document element, so fragments get a page around them.
export const dom = (html: string): Document => {
  const page = /^\s*<(!doctype|html)/i.test(html)
    ? html
    : `<!doctype html><html><head></head><body>${html}</body></html>`;
  return parseHTML(page).document as unknown as Document;
};
