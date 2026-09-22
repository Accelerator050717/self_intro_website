import { describe, expect, it, vi } from 'vitest';
import { projects } from '../src/data/content';
import { alternatePath, languages, mainPages, route, ui, type Lang } from '../src/i18n/ui';
import { GET } from '../src/pages/[...metadata]';

vi.mock('../src/lib/site', () => ({ siteUrl: 'https://portfolio.test' }));

const localPaths = ['', ...mainPages, ...projects.map(project => `work/${project.slug}`)];

describe('localized route mapping', () => {
  it('limits the shared navigation and page enumeration to the retained sections', () => {
    expect(mainPages).toEqual(['work', 'about', 'resume']);
    for (const lang of languages) {
      expect(Object.keys(ui[lang]).some(key => key.startsWith('play'))).toBe(false);
      for (const page of mainPages) expect(ui[lang][page]).not.toBe('');
    }
  });

  it('generates a sitemap containing the retained pages and every project, with no retired routes', async () => {
    const response = await GET({ params: { metadata: 'sitemap.xml' } } as unknown as Parameters<typeof GET>[0]);
    const xml = await response.text();
    expect(response.headers.get('Content-Type')).toContain('application/xml');
    expect(xml.match(/<loc>/g)).toHaveLength(20);
    for (const lang of languages) {
      for (const path of localPaths) expect(xml).toContain(`<loc>https://portfolio.test${route(lang, path)}</loc>`);
      expect(xml).not.toContain(`/${lang}/play/`);
    }
    expect(xml).not.toMatch(/playground/i);
  });

  it.each<Lang>(['en', 'zh'])('creates normalized %s routes for every page and project', lang => {
    for (const path of localPaths) {
      expect(route(lang, path)).toBe(`/${lang}/${path ? `${path}/` : ''}`);
      expect(route(lang, `/${path}/`)).toBe(route(lang, path));
    }
    expect(route(lang)).toBe(`/${lang}/`);
  });

  it('preserves the current page when switching language in either direction', () => {
    for (const path of localPaths) {
      const english = route('en', path);
      const chinese = route('zh', path);
      expect(alternatePath(english, 'zh')).toBe(chinese);
      expect(alternatePath(chinese, 'en')).toBe(english);
      expect(alternatePath(english, 'en')).toBe(english);
      expect(alternatePath(chinese, 'zh')).toBe(chinese);
    }
  });

  it('handles the root and nonlocalized deep paths without dropping their identity', () => {
    expect(alternatePath('/', 'en')).toBe('/en/');
    expect(alternatePath('/', 'zh')).toBe('/zh/');
    expect(alternatePath('/work/goldencamp/', 'zh')).toBe('/zh/work/goldencamp/');
    expect(alternatePath('/en', 'zh')).toBe('/zh/');
    expect(alternatePath('/zh', 'en')).toBe('/en/');
    expect(alternatePath('/english-guide/', 'zh')).toBe('/zh/english-guide/');
  });

  it('provides matching nonempty UI keys, arrays, and navigation labels in both languages', () => {
    expect(languages).toEqual(['en', 'zh']);
    expect(Object.keys(ui.en).sort()).toEqual(Object.keys(ui.zh).sort());
    for (const key of Object.keys(ui.en) as (keyof typeof ui.en)[]) {
      const english = ui.en[key];
      const chinese = ui.zh[key];
      if (typeof english !== 'string') {
        expect(Array.isArray(chinese)).toBe(true);
        expect(chinese).toHaveLength(english.length);
        expect(english.every(value => value.trim().length > 0)).toBe(true);
        expect((chinese as readonly string[]).every(value => value.trim().length > 0)).toBe(true);
      } else {
        expect(typeof chinese).toBe('string');
        expect(english.trim()).not.toBe('');
        expect((chinese as string).trim()).not.toBe('');
      }
    }
  });
});
