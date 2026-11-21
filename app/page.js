// The homepage, exactly as approved, with "What clients say" just above the footer (approved reviews only).
import V2Html from '@/components/V2Html'
import parts from '@/v2/live/home'
import HomeReviews from '@/components/site/HomeReviews'
import { getTestimonials, getWall } from '@/lib/site/data'
import { renderHomeReviews } from '@/lib/site/render'
import { pageMetadata } from '@/lib/seo'
import { integratedHtml } from '@/lib/site/trust'
export const revalidate = 3600
export const metadata = pageMetadata('home')
export default async function Home() {
  const [quotes, wall] = await Promise.all([getTestimonials(), getWall()])
  return (<><V2Html html={withWall(parts[0] + renderHomeReviews(quotes) + parts[1], wall).replace('<section class="sec intro-sec"', integratedHtml() + '<section class="sec intro-sec"')} />{quotes.length > 1 ? <HomeReviews /> : null}</>)
}

// Install 28: live projects added from a link join the sliding wall. Each new one takes a place in a different column
// (newest first); the wall's own pictures fill the rest. Nothing changes when there are none.
function withWall(html, wall) {
  const ok = (wall || []).filter((w) => /^\/media\/img\/[a-f0-9]{24}\.webp$/.test(w.wall || ''))
  if (!ok.length || !html.includes('var SITES = {') || !html.includes('  function buildWall() {')) return html
  const add = Object.fromEntries(ok.map((w) => ['p' + Number(w.id), w.wall])), keys = JSON.stringify(Object.keys(add))
  return html.replace('var SITES = {', 'var SITES = {' + JSON.stringify(add).slice(1, -1) + ', ')
    .replace('  function buildWall() {', `  ${keys}.forEach(function (k, i) { ORDER[i % ORDER.length][Math.floor(i / ORDER.length) % 3] = k; });\n  function buildWall() {`)
    .replace('.track img { width: 100%; height: auto; aspect-ratio: 440 / 962;', '.track img { width: 100%; height: auto; aspect-ratio: 440 / 962; object-fit: cover; object-position: top;')
}
