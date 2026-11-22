'use client'
// Olexweb Meet's home (Install 58): the app for people who are signed in, the landing page for everyone else.
// The old home's actions all live on in the new app (components/meet/app).
import MeetApp from './app/MeetApp'
import Landing from './app/Landing'
export default function MeetHome({ user, providers, meetings, notice, faq = [], emailOn = false, morePast = 0, pricing = null, spotlight = null }) {
  return user ? <MeetApp user={user} meetings={meetings} pricing={pricing} morePast={morePast} notice={notice} />
    : <Landing providers={providers} emailOn={emailOn} pricing={pricing} faq={faq} spotlight={spotlight} notice={notice} />
}
