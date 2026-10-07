// Vercel gives each deployment its own ID; locally, the build's own ID is used.
import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
let local = null
export function adminVersion() {
  if (process.env.VERCEL_DEPLOYMENT_ID) return process.env.VERCEL_DEPLOYMENT_ID
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA
  if (local === null) { try { local = fs.readFileSync(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim() } catch { local = 'dev' } }
  return local
}
