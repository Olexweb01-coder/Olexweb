// lib/seo.js: every search tag on olexweb.com comes from here.
// Titles stay under 60 characters and descriptions under 160, so search results show them in full.
export const SITE = 'https://olexweb.com';
export const OG_IMAGE = { url: '/og/olexweb.png', width: 1200, height: 630, alt: 'Olexweb: websites and apps that work' };

export const PAGES = {
  home: { path: '/', title: 'Olexweb | Websites, web apps and SaaS products that work', description: 'Olexweb builds websites, SaaS products and the systems behind them, so people understand what you do in seconds and can reach you at any hour.',
    keywords: ['Olexweb', 'Olaitan Adebayo', 'web designer', 'website developer Nigeria', 'business website', 'web app development', 'SaaS development', 'Next.js developer', 'admin system'] },
  about: { path: '/about', ogType: 'profile', title: 'About Olaitan Adebayo | Web developer and product builder', description: 'Olaitan Adebayo is a creative ideator, builder and web developer who turns ideas into websites, products and companies. His story and how he thinks.',
    keywords: ['Olaitan Adebayo', 'Olex', 'Olexweb founder', 'web developer', 'creative ideator', 'product builder Nigeria'] },
  portfolio: { path: '/portfolio', title: 'Portfolio | Websites and products built by Olexweb', description: 'Selected websites and products built by Olexweb, including Viverst Global, Mojatech Electrical, Leathrock, Tolu Afilaka Live, Needar and Aviirel.',
    keywords: ['Olexweb portfolio', 'website projects Nigeria', 'web design case studies', 'Viverst Global', 'Mojatech Electrical', 'Leathrock', 'Needar', 'Aviirel'] },
  workWithMe: { path: '/work-with-me', title: 'Work with me | Websites, web apps and SEO by Olexweb', description: 'How a project with Olexweb runs: the services, the four-step process, learning with Olaitan Adebayo, the Creator\u2019s Room community, and how to start.',
    keywords: ['hire a web developer', 'website design services Nigeria', 'web app development', 'UI UX design', 'SEO', 'learn web development', 'Creator\u2019s Room'] },
  blog: { path: '/insights', title: 'Blog | Plain advice on websites that bring in work', description: 'Plain advice on websites that bring in work, written by Olaitan Adebayo from the desk that builds them. No jargon, no theory you can\u2019t use on Monday.',
    keywords: ['website tips for business owners', 'website speed', 'web design advice', 'small business website Nigeria', 'Olexweb blog'] },
  studio: { path: '/studio', title: 'The 3D studio | Olexweb', description: 'Step inside the Olexweb studio: a cinematic 3D workspace where every object tells part of the story. The original version of olexweb.com.',
    keywords: ['Olexweb 3D studio', 'interactive 3D website', 'Three.js website', 'creative web experience'] },
  elvanex: { path: '/ventures/elvanex', title: 'Elvanex Digital | A technology venture by Olexweb', description: 'Elvanex Digital is the Olexweb venture where products, platforms and experiments that outgrow a single website are built and run.', keywords: ['Elvanex Digital', 'technology venture', 'Olexweb ventures'] },
  needar: { path: '/ventures/needar', title: 'Needar | The LinkedIn job search, rebuilt for you', description: 'Needar is a SaaS that rebuilds the LinkedIn job search around the person searching. From a problem worth fixing to a working product.', keywords: ['Needar', 'LinkedIn job search tool', 'job search SaaS'] },
  aviirel: { path: '/ventures/aviirel', title: 'Aviirel | An AI second brain, by Olexweb', description: 'Aviirel is an AI second brain: your notes, ideas and knowledge in one place that thinks with you, instead of sitting in folders.', keywords: ['Aviirel', 'AI second brain', 'AI notes app', 'knowledge management'] },
  privacy: { path: '/privacy', title: 'Privacy Policy | Olexweb', description: 'How olexweb.com handles information, written to meet the Nigeria Data Protection Act 2023.', keywords: ['Olexweb privacy policy'] },
  terms: { path: '/terms', title: 'Terms of Use | Olexweb', description: 'The terms for using olexweb.com, owned and operated by Olaitan Adebayo as a sole proprietor in Nigeria.', keywords: ['Olexweb terms of use'] },
  cookies: { path: '/cookies', title: 'Cookie Policy | Olexweb', description: 'Olexweb uses no advertising or tracking cookies. What the site stores on your device, and how to clear it.', keywords: ['Olexweb cookie policy'] },
};

// Metadata for a page, in the shape Next.js expects from `export const metadata` or `generateMetadata`.
export function pageMetadata(key, extra = {}) {
  const p = { ...PAGES[key], ...extra };
  const url = SITE + p.path;
  return {
    title: { absolute: p.title }, description: p.description, keywords: p.keywords,
    authors: [{ name: 'Olaitan Adebayo', url: SITE + '/about' }], creator: 'Olaitan Adebayo', publisher: 'Olexweb',
    alternates: { canonical: url, languages: { en: url, 'x-default': url } },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
    openGraph: { type: p.ogType || 'website', siteName: 'Olexweb', locale: 'en_NG', title: p.title, description: p.description, url, images: [p.image || OG_IMAGE],
      ...(p.publishedTime ? { publishedTime: p.publishedTime, authors: ['Olaitan Adebayo'] } : {}) },
    twitter: { card: 'summary_large_image', title: p.title, description: p.description, images: [(p.image || OG_IMAGE).url] },
  };
}

// Structured data (JSON-LD): tells search engines and AI assistants who, what and where.
const ORG = { '@type': 'Organization', '@id': SITE + '/#org', name: 'Olexweb', url: SITE + '/', logo: SITE + '/icon.png', email: 'info@olexweb.com', telephone: '+2347011726321',
  founder: { '@id': SITE + '/#olaitan' }, sameAs: ['https://contra.com/olexweb01'], description: 'Olexweb builds websites, SaaS products and the systems behind them.',
  address: { '@type': 'PostalAddress', addressCountry: 'NG' } };
const PERSON = { '@type': 'Person', '@id': SITE + '/#olaitan', name: 'Olaitan Adebayo', alternateName: ['Adebayo Olaitan', 'Olex'], jobTitle: 'Creative ideator, builder and web developer',
  url: SITE + '/about', worksFor: { '@id': SITE + '/#org' }, address: { '@type': 'PostalAddress', addressCountry: 'NG' } };
const WEBSITE = { '@type': 'WebSite', '@id': SITE + '/#website', name: 'Olexweb', url: SITE + '/', publisher: { '@id': SITE + '/#org' }, inLanguage: 'en' };

export function pageJsonLd(key, extraNodes = [], extra = {}) {
  const p = { ...PAGES[key], ...extra };
  const url = SITE + p.path;
  return { '@context': 'https://schema.org', '@graph': [ORG, PERSON, WEBSITE,
    { '@type': 'WebPage', '@id': url + '#page', url, name: p.title, description: p.description, isPartOf: { '@id': SITE + '/#website' }, inLanguage: 'en' }, ...extraNodes] };
}

// Article pages (/insights/[slug]) from content/site.js
export function articleMetadata(a) {
  return pageMetadata('blog', { path: '/insights/' + a.slug, title: (a.title.length > 50 ? a.title.slice(0, a.title.lastIndexOf(' ', 50)) + '\u2026' : a.title) + ' | Olexweb',
    description: a.summary.slice(0, 160), ogType: 'article', publishedTime: a.date, keywords: (a.keywords || []).concat(['Olexweb blog']) });
}
export function articleJsonLd(a) {
  return pageJsonLd('blog', [{ '@type': 'BlogPosting', headline: a.title, description: a.summary, datePublished: a.date, dateModified: a.date, url: SITE + '/insights/' + a.slug,
    mainEntityOfPage: SITE + '/insights/' + a.slug, author: { '@id': SITE + '/#olaitan' }, publisher: { '@id': SITE + '/#org' }, image: SITE + OG_IMAGE.url, timeRequired: 'PT' + a.minutes + 'M', inLanguage: 'en' }],
    { path: '/insights/' + a.slug, title: a.title, description: a.summary });
}

// The base graph (who Olexweb and Olaitan are), used by the studio's pages.
export function siteGraph() { return { '@context': 'https://schema.org', '@graph': [ORG, PERSON, WEBSITE] }; }
