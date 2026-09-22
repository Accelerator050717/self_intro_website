import { existsSync } from 'node:fs';
export const siteUrl = (import.meta.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
export const resumePdf = existsSync(new URL('../../public/resume.pdf', import.meta.url)) ? '/resume.pdf' : null;
