// Meetings (owner only): create, end, delete, and the host's controls in the room (let speak, stop speaking, remove).
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import * as M from '@/lib/site/meet'
import * as G from '@/lib/meet/guests'
import * as U from '@/lib/meet/usage'
import * as D from '@/lib/meet/dash'
import { confirmTransfer } from '@/lib/meet/plans'
export const dynamic = 'force-dynamic'
export const maxDuration = 300   // notes for a long meeting ask the AI more than once
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can do this.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    if (b.action === 'create') return M.createMeeting({ title: b.title, speakers: b.speakers, mode: b.mode, private: !!b.private, certs: !!b.certs, followup: !!b.followup, startsAt: b.startsAt, minutes: b.minutes, reminders: b.reminders, form: b.form || null }, u)
    if (b.action === 'update') { const f = {}; for (const k of ['title', 'speakers', 'startsAt', 'minutes', 'reminders', 'form']) if (k in b) f[k] = b[k]; return M.updateMeeting(b.code, f) }
    if (b.action === 'end') return M.endMeeting(b.code)
    if (b.action === 'delete') return M.deleteMeeting(b.code)
    if (['allow-speak', 'stop-speak', 'remove'].includes(b.action)) return M.hostAction(b.code, b.action, b.identity)
    if (b.action === 'notes') return M.makeNotes(b.code, b.transcript)
    if (b.action === 'get-notes') return M.getNotes(b.code)
    // the Meet app: accounts and reports (lib/meet/guests.js)
    if (b.action === 'meet-admin') return G.adminMeetData(b.search)
    if (b.action === 'usage') return { usage: await U.usageNow(), databases: await U.databases(), presets: U.PRESETS }
    if (b.action === 'limits') return U.saveLimits({ minutes: b.minutes, people: b.people })
    // Install B: Business (pricing, support, invoices, announcements, gifts)
    if (b.action === 'console') return D.consoleData()
    if (b.action === 'biz') return D.bizData()
    if (b.action === 'pricing') return D.savePricing(b)
    if (b.action === 'news') return D.postNews(b)
    if (b.action === 'news-delete') return D.deleteNews(b.id)
    if (b.action === 'ticket-reply') return D.replyTicket(b.id, b.reply)
    if (b.action === 'ticket-close') return D.closeTicket(b.id)
    if (b.action === 'invoice-paid') return D.markInvoicePaid(b.id)
    if (b.action === 'bank') return D.saveBank(b)
    if (b.action === 'transfer') return confirmTransfer(b.id, !!b.yes)
    if (b.action === 'give-pro') return D.givePro(b.email, b.days, b.reason)
    if (b.action === 'bonus-list') return (await import('@/lib/meet/bonus')).bonusList()                 // Install 58k
    if (b.action === 'bonus-cancel') return (await import('@/lib/meet/bonus')).cancelGrant(b.id, b.reason)
    if (b.action === 'welcome-bonus') return (await import('@/lib/meet/bonus')).setWelcome(b)
    if (b.action === 'payouts-now') return (await import('@/lib/meet/payouts')).mondayPayouts(true)   // Install 58: send what's waiting now (not only on Monday)
    if (b.action === 'setup') return { items: (await import('@/lib/meet/setup')).setupChecklist() }   // Install 58i
    if (b.action === 'ps-limit') return (await import('@/lib/meet/payouts')).setLimit(b)          // Install 58h
    if (b.action === 'ambassador-prize') return (await import('@/lib/meet/payouts')).setPrize(b.naira)
    if (b.action === 'money') return (await import('@/lib/meet/payouts')).ledger()   // Install 58b: balance, set aside, yours, payouts
    if (b.action === 'renewals-now') return (await import('@/lib/meet/members')).renewals()
    if (b.action === 'ban') return G.banUser(b.id, b.reason, M.endMeeting)
    if (b.action === 'unban') return G.unbanUser(b.id)
    if (b.action === 'dismiss') return G.dismissReport(b.id)
    if (b.action === 'let-back' || b.action === 'keep-paused') return (await import('@/lib/meet/solo')).decideAppeal(b.id, b.action === 'let-back')   // Install 66
    throw new Refused('Unknown action.')
  })
}
