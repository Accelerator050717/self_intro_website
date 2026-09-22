import type { APIRoute } from 'astro';
import { siteUrl } from '../lib/site';
import { projects } from '../data/content';
import { mainPages } from '../i18n/ui';
export function getStaticPaths(){return [{params:{metadata:'robots.txt'}},...(siteUrl?[{params:{metadata:'sitemap.xml'}}]:[])];}
export const GET:APIRoute=({params})=>{
  if(params.metadata==='robots.txt')return new Response(siteUrl?`User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n',{headers:{'Content-Type':'text/plain;charset=utf-8'}});
  const paths=['',...mainPages,...projects.map(p=>`work/${p.slug}`)];
  const entries=['en','zh'].flatMap(lang=>paths.map(path=>`<url><loc>${siteUrl}/${lang}/${path?path+'/':''}</loc>${['en','zh'].map(other=>`<xhtml:link rel="alternate" hreflang="${other}" href="${siteUrl}/${other}/${path?path+'/':''}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/en/${path?path+'/':''}"/></url>`));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.join('')}</urlset>`,{headers:{'Content-Type':'application/xml'}});
};
