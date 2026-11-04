# Install 5 (search): meet.olexweb.com read the way Google reads it. Run by run.sh in the Meet-app stage (MEET_ORIGIN set).
import json, re, sys, html as H
exec(open('tests/meet/app.py').read().split("print('The Meet address')")[0])        # helpers: raw, req, sql, MEET, OWNER
def meta(page, attr, key):
    m = re.search(r'<meta[^>]+%s="%s"[^>]+content="([^"]*)"' % (attr, re.escape(key)), page) or re.search(r'<meta[^>]+content="([^"]*)"[^>]+%s="%s"' % (attr, re.escape(key)), page)
    return H.unescape(m.group(1)) if m else None
print('The homepage, as Google reads it')
s, h, b = raw('/'); page = b.decode()
title = H.unescape(re.search(r'<title>(.*?)</title>', page).group(1))
check(title == 'Olexweb Meet: free video meetings that work on weak networks', 'title: ' + title)
d = meta(page, 'name', 'description'); check(d and 'Free online video meetings' in d and len(d) <= 220, f'description ({len(d or "")} characters)')
can = re.search(r'<link rel="canonical" href="([^"]+)"', page); check(can and can.group(1).rstrip('/') == MEET, 'its canonical address is the Meet address: ' + (can.group(1) if can else 'none'))
check('noindex' not in (meta(page, 'name', 'robots') or ''), 'Google may index it')
og = meta(page, 'property', 'og:image'); check(og == MEET + '/meet/og.png' and meta(page, 'property', 'og:title') == title, 'share image and title for WhatsApp, LinkedIn and Google: ' + str(og))
check(meta(page, 'name', 'twitter:card') == 'summary_large_image', 'large share card on X')
s2, h2, img = raw('/meet/og.png'); from PIL import Image; import io
w, hh = Image.open(io.BytesIO(img)).size; check(s2 == 200 and (w, hh) == (1200, 630), f'the share image is the standard 1200×630 ({w}×{hh})')
blocks = [json.loads(x) for x in re.findall(r'<script type="application/ld\+json">(.*?)</script>', page, re.S)]
app = next((x for x in blocks if x.get('@type') == 'WebApplication'), None); faq = next((x for x in blocks if x.get('@type') == 'FAQPage'), None)
check(app and app['offers']['price'] == '0' and app['url'] == MEET + '/' and app['name'] == 'Olexweb Meet', 'structured data: a free web app named Olexweb Meet')
check(faq and len(faq['mainEntity']) == 8, 'structured data: 8 questions and answers')
visible = H.unescape(re.sub(r'<script[^>]*>.*?</script>', '', page, flags=re.S))
check(all(q['name'] in visible and q['acceptedAnswer']['text'] in visible for q in faq['mainEntity']), 'every question and answer Google is told about is visible on the page (Google’s rule)')
check(len(re.findall(r'<h1[ >]', page)) == 1, 'one main heading')
print('Search instructions')
s, h, b = raw('/robots.txt'); r = b.decode()
check(s == 200 and 'Disallow: /api/' in r and f'Sitemap: {MEET}/sitemap.xml' in r, 'meet.olexweb.com/robots.txt points Google to the Meet sitemap')
s, h, b = raw('/sitemap.xml'); x = b.decode()
check(s == 200 and f'<loc>{MEET}/</loc>' in x and 'xml' in h.get('content-type', ''), 'meet.olexweb.com/sitemap.xml lists the homepage')
s, h, b = raw('/robots.txt', host='localhost:3000'); check('meet' not in b.decode().lower() or 'Sitemap: ' + MEET not in b.decode(), 'the main site keeps its own robots.txt')
print('Meetings stay private')
s, j = req('/admin/api/meetings', {'action': 'create', 'title': 'Private one'}, OWNER)
s, h, b = raw('/' + j['code']); rb = meta(b.decode(), 'name', 'robots') or ''
check('noindex' in rb and 'nofollow' in rb, 'meeting rooms are marked “don’t index, don’t follow”: ' + rb)
print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
