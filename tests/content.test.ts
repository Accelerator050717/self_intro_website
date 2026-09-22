import { describe, expect, it } from 'vitest';
import { aboutCopy, experiences, profile, projects, type Lang } from '../src/data/content';
import { siteContact } from '../src/data/site-config';

const languages: Lang[] = ['en', 'zh'];
const expectedSlugs = ['goldencamp', 'context-ai', 'yunxinyi', 'ml-pipeline', 'admin-modernization', 'registry-integrity'];
const body = (slug: string, lang: Lang) => projects.find(project => project.slug === slug)!.sections[lang].flatMap(section => section.paragraphs).join(' ');

describe('public content contract', () => {
  it('keeps the six supplied projects unique and the selected-work order intentional', () => {
    expect(projects.map(project => project.slug)).toEqual(expectedSlugs);
    expect(new Set(projects.map(project => project.slug)).size).toBe(6);
    expect(projects.slice(0, 4).map(project => project.slug)).toEqual(expectedSlugs.slice(0, 4));
  });

  it.each(projects)('$slug provides complete bilingual detail content and an illustrative workflow', project => {
    expect(project.categories.length).toBeGreaterThan(0);
    expect(project.categories.every(category => ['ai', 'software', 'experiments'].includes(category))).toBe(true);
    expect(project.tech.every(technology => technology.trim().length > 0)).toBe(true);
    expect(project.color).toMatch(/^#[0-9a-f]{6}$/i);
    for (const lang of languages) {
      for (const field of ['title', 'shortTitle', 'description', 'status', 'kind'] as const) {
        expect(project[field][lang].trim(), `${project.slug}.${field}.${lang}`).not.toBe('');
      }
      expect(project.sections[lang].length).toBeGreaterThanOrEqual(4);
      for (const section of project.sections[lang]) {
        expect(section.title.trim()).not.toBe('');
        expect(section.paragraphs.length).toBeGreaterThan(0);
        expect(section.paragraphs.every(paragraph => paragraph.trim().length > 0)).toBe(true);
      }
      expect(project.workflow[lang].length).toBeGreaterThanOrEqual(3);
      expect(project.workflow[lang].length).toBeLessThanOrEqual(5);
      expect(project.workflow[lang].every(step => step.trim().length > 0)).toBe(true);
    }
    expect(project.workflow.zh.every(step => /[\u4e00-\u9fff]/.test(step))).toBe(true);
    // This is a readability budget, not a target for invented accomplishments.
    const words = body(project.slug, 'en').split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(200);
    expect(words).toBeLessThanOrEqual(450);
  });

  it('uses only the supplied contact and year-level internship facts', () => {
    expect(profile).toEqual({
      name: { en: 'Mingyang Yu', zh: '余明阳' },
      email: 'yumin050717@gmail.com',
      github: 'https://github.com/Accelerator050717',
    });
    expect(experiences.map(experience => experience.year).sort()).toEqual(['2025', '2026']);
    for (const experience of experiences) {
      expect(experience.role).toEqual({ en: 'Intern', zh: '实习' });
      for (const lang of languages) {
        expect(experience.company[lang].trim()).not.toBe('');
        expect(experience.description[lang].trim()).not.toBe('');
      }
    }
    for (const lang of languages) {
      expect(aboutCopy[lang].length).toBeGreaterThanOrEqual(2);
      expect(aboutCopy[lang].length).toBeLessThanOrEqual(3);
    }
    expect(aboutCopy.en.join(' ')).toContain('undergraduate');
    expect(aboutCopy.zh.join(' ')).toContain('本科');
  });

  it('shares the new public contact without changing the UCI education facts', () => {
    expect(siteContact.email).toBe('yumin050717@gmail.com');
    expect(siteContact.mailto).toBe('mailto:yumin050717@gmail.com');
    expect(profile.email).toBe(siteContact.email);
    expect(profile.github).toBe(siteContact.github);
    expect(siteContact.email).not.toMatch(/\s|\\/);
    expect(aboutCopy.en.join(' ')).toContain('University of California, Irvine');
    expect(aboutCopy.zh.join(' ')).toContain('加州大学欧文分校');
  });

  it('removes the retired playground without removing game work or the experiments category', () => {
    expect(JSON.stringify({ aboutCopy, projects })).not.toMatch(/playground|冰积木(?:乐园|游乐场|小实验)/i);
    expect(projects.filter(project => project.categories.includes('experiments')).map(project => project.slug)).toEqual(['goldencamp', 'ml-pipeline']);
    expect(body('goldencamp', 'en')).toContain('game prototype');
  });

  it('keeps Yunxinyi client ownership and the V1 / V2 scope distinction explicit', () => {
    const project = projects.find(item => item.slug === 'yunxinyi')!;
    expect(body(project.slug, 'en')).toMatch(/whole mini-program client/i);
    expect(body(project.slug, 'en')).toMatch(/V1[\s\S]*Bluetooth/);
    expect(body(project.slug, 'en')).toMatch(/V2[\s\S]*read-only/);
    expect(body(project.slug, 'zh')).toContain('整个微信小程序客户端');
    expect(body(project.slug, 'zh')).toMatch(/V1[\s\S]*低功耗蓝牙/);
    expect(body(project.slug, 'zh')).toMatch(/V2[\s\S]*只读/);
    expect(project.workflow.en.join(' ')).toContain('V2');
    expect(project.workflow.en.join(' ')).not.toMatch(/control|measure|bluetooth/i);
    expect(project.workflow.zh.join(' ')).not.toMatch(/控制|测量|蓝牙/);
  });

  it('preserves the two stated prototype statuses without upgrading internship work to releases', () => {
    expect(projects.find(project => project.slug === 'goldencamp')!.status).toEqual({ en: 'In development', zh: '开发中原型' });
    expect(projects.find(project => project.slug === 'ml-pipeline')!.status).toEqual({ en: 'Research prototype', zh: '研究原型' });
    for (const slug of ['context-ai', 'yunxinyi', 'admin-modernization', 'registry-integrity']) {
      expect(projects.find(project => project.slug === slug)!.status).toEqual({ en: 'Internship project', zh: '实习项目' });
    }
    expect(projects.find(project => project.slug === 'goldencamp')!.tech).toEqual(['Unity', 'C#']);
  });

  it('retains the supplied clinical, research, and validation evidence boundaries', () => {
    expect(body('context-ai', 'en')).toMatch(/no claim of diagnostic ability/);
    expect(body('context-ai', 'zh')).toContain('不宣称具备诊断能力');
    expect(body('ml-pipeline', 'en')).toMatch(/not a promise of returns/);
    expect(body('ml-pipeline', 'zh')).toContain('不承诺收益');
    expect(body('admin-modernization', 'en')).toMatch(/does not claim[\s\S]*production system has been replaced/);
    expect(body('registry-integrity', 'en')).toMatch(/current record[\s\S]*duplicate/);
    expect(body('registry-integrity', 'zh')).toContain('软删除');
  });
});
