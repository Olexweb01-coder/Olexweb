// Pages whose middle comes from content: the shared bar, menu, footer, sound and layers around a React <main>.
import V2Html from '@/components/V2Html'
import blogTop from '@/v2/shell/blog-top'
import blogBottom from '@/v2/shell/blog-bottom'
import legalTop from '@/v2/shell/legal-top'
import legalBottom from '@/v2/shell/legal-bottom'
const SHELLS = { blog: [blogTop, blogBottom], legal: [legalTop, legalBottom] }
const CSS = `
.art-page{padding:calc(env(safe-area-inset-top,0px) + clamp(120px,18vh,170px)) clamp(20px,4.5vw,72px) clamp(80px,12vh,140px)}
.art-back{margin:0 0 28px}.art-back a,.legal-back a{color:var(--paper-dim);text-decoration:none;font-size:14px;font-weight:600}.art-back a:hover,.legal-back a:hover{color:var(--green)}
.art-next a{color:var(--paper);text-decoration:none;font-family:var(--display);font-weight:700;font-stretch:85%;font-size:clamp(22px,2vw,30px);line-height:1.1}.art-next a:hover{color:var(--green)}
.legal{max-width:760px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + clamp(120px,18vh,170px)) clamp(20px,4.5vw,40px) clamp(80px,12vh,140px)}
.legal h1{font-family:var(--display);font-weight:800;font-stretch:78%;font-size:clamp(40px,5.4vw,76px);line-height:.95;margin:0 0 10px;letter-spacing:-.02em}
.legal .upd{color:var(--paper-dim);font-size:14px;margin:0 0 34px}.legal h2{font-family:var(--display);font-weight:700;font-stretch:90%;font-size:22px;margin:34px 0 10px}
.legal p,.legal li{font-size:16.5px;line-height:1.72;color:rgba(242,239,233,.84);max-width:68ch}.legal ul{padding-left:20px}.legal a{color:var(--green)}
.legal-back{margin:44px 0 0}`
export default function V2Shell({ kind = 'legal', children }) {
  const [top, bottom] = SHELLS[kind]
  return (<><style dangerouslySetInnerHTML={{ __html: CSS }} /><V2Html html={top} /><main id="top">{children}</main><V2Html html={bottom} /></>)
}
