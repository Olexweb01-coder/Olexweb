// Olexweb Meet's search content: one place for the homepage's title, description, FAQ and structured data, so what Google
// reads always matches what people see (Google requires FAQ answers to be visible on the page). Honest claims only.
import { meetBase, mainOrigin } from '@/lib/site/meet'

export const homeUrl = () => (meetBase() || mainOrigin() + '/meet') + '/'
export const TITLE = 'Olexweb Meet: free video meetings that work on weak networks'
export const DESCRIPTION = 'Free online video meetings and calls that keep working on mobile data and slow connections. Join with a link, no account needed. Screen sharing, recording to your device, AI meeting notes, scheduling and invites.'

export const FAQ = [
  ['Is Olexweb Meet free?', 'Yes. Joining and hosting meetings is free. Hosts need a free account to create or schedule meetings; people joining never need one.'],
  ['Do guests need to sign up or install anything?', 'No. Guests open the meeting link in their browser, type a name and join. You can also install Olexweb Meet as an app on your phone or computer from the browser.'],
  ['Does it work on a slow or unstable connection?', 'Yes, that is what it is built for. Voice is protected first and video adjusts itself to the connection. Data saver turns cameras off to use far less data, and noise cancellation keeps voices clear.'],
  ['Can I record a meeting?', 'Yes. Hosts can record video and audio or audio only (as an MP3). Recordings are saved on the host’s own device, not on our servers, and everyone in the meeting can see when recording is on.'],
  ['Can it take notes for me?', 'Yes. Hosts can switch on AI notes to get a summary, decisions and action items after the meeting. The first 60 minutes of each meeting are free.'],
  ['Can I schedule meetings and send invites?', 'Yes. Schedule a meeting, copy a ready-made invite, and guests can add it to Google Calendar, Apple Calendar or Outlook with reminders.'],
  ['Can I see who attended?', 'Yes, if you choose. Hosts can ask guests for details such as phone or email when they join, and get an attendance list with a download for Excel after the meeting. Guests are told exactly what is asked and how long it is kept.'],
  ['Does it work on iPhone and Android?', 'Yes, in the browser on both. On Android and computers the meeting can keep going in a small floating window. On iPhone, Apple pauses a website’s microphone while you use another app, so keep the meeting page open while you talk.'],
]

export function structuredData() {
  const url = homeUrl()
  return [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Olexweb Meet', url, applicationCategory: 'CommunicationApplication', operatingSystem: 'Web, Android, iOS, Windows, macOS',
      description: DESCRIPTION, browserRequirements: 'A modern browser such as Chrome, Edge, Safari or Firefox',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: ['Video meetings that adapt to weak networks', 'Join with a link, no account needed', 'Screen sharing', 'Recording to your device (video or MP3)', 'AI meeting notes', 'Scheduling with calendar invites and reminders', 'Attendance lists', 'Noise cancellation and background blur'],
      image: url + 'meet/og.png', publisher: { '@type': 'Organization', name: 'Olexweb', url: mainOrigin() } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ]
}
