// Everything the site says, in one place. Edit here; the room and the pages both read from this file.

export const site = {
  name: 'Olexweb',
  domain: 'https://olexweb.com',
  tagline: 'Digital experiences that matter.',
  description: 'Olexweb is the workspace where Olaitan Adebayo designs and builds websites, platforms, admin systems and digital experiences that are built to be found, trusted and used.',
  email: 'info@olexweb.com',
  phone: '+2347011726321', phoneDisplay: '0701 172 6321',
  phone2: '+2348037843784', phone2Display: '0803 784 3784',
  whatsapp: 'https://wa.me/2347011726321?text=' + encodeURIComponent("Hi Olexweb, I have a project in mind and I'd like to talk about it."),
  guide: "Olex's AI",
  music: '/studio/music.mp3',   // put your licensed track here (mp3). Set to null for no music.
}

export const person = {
  name: 'Olaitan Adebayo',
  alternateNames: ['Adebayo Olaitan', 'Olex'],
  role: 'Creative ideator. Builder. Web developer. Thinker. Learner.',
  key: 'Olexweb is built by Olaitan Adebayo, a creative ideator who uses technology, critical thinking, creativity and continuous learning to turn ideas into things.',
  line: 'I learn, I think, I explore, I develop ideas, and I turn them into things.',
  story: [
    'Every build starts the same way for me: a question I cannot leave alone. Some of those questions become websites for the businesses that asked them. Some become products nobody has asked for yet. A few become companies.',
    'Olexweb is where the web work lives: complete digital systems for real businesses, built to be found, trusted and used. It is a workspace, not a limit. Around it sit the ventures, the experiments and the thinking that feed it.',
    'I read widely, think slowly and ship quickly. The order matters.',
  ],
  interests: ['Critical thinking', 'Logical thinking', 'Creative thinking', 'Self-development', 'Reading and learning', 'Problem solving', 'Technology', 'Business', 'Human behaviour', 'Digital creation', 'Experimentation', 'Teaching'],
  photos: ['/studio/photos/olaitan-2.jpg', '/studio/photos/olaitan-1.jpg', '/studio/photos/olaitan-7.jpg', '/studio/photos/olaitan-6.jpg', '/studio/photos/olaitan-4.jpg', '/studio/photos/olaitan-3.jpg', '/studio/photos/olaitan-5.jpg'],
}

export const services = [
  { title: 'Websites and web applications', text: 'From a first idea to deployment: fast, well-built sites and apps for real businesses.' },
  { title: 'Frontend engineering', text: 'React, Next.js, animation and 3D on the web. Clean code with careful performance.' },
  { title: 'UI/UX', text: 'Interfaces people can use without being told how.' },
  { title: 'Interactive experiences', text: 'Cinematic, spatial and interactive web experiences, like this studio.' },
  { title: 'Performance and SEO', text: 'Built to be found by the people it was built for, and to load before they lose patience.' },
  { title: 'Deployment and maintenance', text: 'Shipped, monitored, kept healthy.' },
]

export const process = [
  { title: 'Ideas', text: 'Every build starts as a conversation and a sketch.' },
  { title: 'Design', text: 'Structure first, then the look. Nothing decorative that does not serve the goal.' },
  { title: 'Code', text: 'Built to be fast, accessible and searchable from day one.' },
  { title: 'Launch', text: 'Shipped, measured, improved.' },
]

// Selected web work. embed: whether the site allows being shown live on the monitor (its own headers decide this).
export const work = [
  { slug: 'viverst', key: 'viverst', name: 'Viverst Global', url: 'https://viverst.com', embed: true, role: 'Full design and development',
    built: ['Main website', 'Studio platform', 'Agro platform', 'Admin system'], text: 'A diversified corporate group with several businesses under one name. One site had to hold all of them without flattening any.', result: 'One name, separate markets, one system behind them: the main site, the studio and agro platforms, and the admin that runs them.' },
  { slug: 'mojatech', key: 'mojatech', name: 'Mojatech Electrical', url: 'https://mojatechelectrical.com', embed: false, role: 'Full design and development',
    built: ['Main website', 'Products experience', 'Admin interface'], text: 'Electrical, solar and security systems for homes and businesses. The site sells confidence first and products second.', result: 'Visitors request quotes from the site; the team manages the product range from its admin.' },
  { slug: 'leathrock', key: 'leathrock', name: 'Leathrock', url: 'https://leathrock.vercel.app', embed: true, role: 'Full website and admin',
    built: ['Full website', 'Admin interface'], text: 'Faith, growth and strategy, never separated. Communities, courses and events under one roof.', result: 'One website carrying the community, the courses and the events, with an admin to keep all three current.' },
  { slug: 'edithe-lekwachi', key: 'edithe', name: 'Edithe Lekwachi', url: 'https://edithelekwachi.vercel.app', embed: false, role: 'Full website',
    built: ['Full website'], text: 'A business operations consultant whose work is turning chaos into systems. The site had to feel like that.', result: 'A calm, ordered site that presents the work and leads to a conversation.' },
  { slug: 'ayodele-daniel', key: 'ayodele', name: 'Ayodele Daniel', url: 'https://ayodeledaniel.vercel.app', embed: true, role: 'Full website',
    built: ['Full website'], text: 'One centre, infinite orbits. A personal site for a man of many hats.', result: 'A single site that holds several roles without letting any of them crowd the others.' },
  { slug: 'tolu-afilaka', key: 'tolu', name: 'Tolu Afilaka Live', url: 'https://toluafilaka.com', embed: false, role: 'Frontend and admin',
    built: ['Frontend', 'Admin system'], text: 'A live event: tickets, information and the feeling of the night before the night.', result: 'The frontend that sells the night and the admin system behind it.' },
]

export const ventures = [
  { slug: 'elvanex', name: 'Elvanex Digital', line: 'A digital and technology venture.', text: ['Elvanex Digital is where the products, platforms and experiments that outgrow a single website are built and run. It exists because some ideas need a company around them, not a client.', 'It explores the problems worth building for: tools people use every day, systems that make small businesses look and work bigger, and the places where technology can remove friction.', 'Its direction is simple: build things that are useful, keep the ones that prove it, and let the rest teach.'] },
  { slug: 'needar', name: 'Needar', line: 'A SaaS that makes the LinkedIn job search work for the person searching.', text: ['Needar started with a problem that was easy to notice and hard to fix: searching for work on LinkedIn is built around the platform, not the person doing the searching.', 'It went the whole way from that observation to a product: the problem defined, the concept shaped, the software built and shipped as a service.', 'That arc, from noticing to shipping, is the point of Needar as much as the product is.'] },
  { slug: 'aviirel', name: 'Aviirel', line: 'An AI second brain.', text: ['Aviirel is a second brain: a place where your notes, ideas and knowledge live together and can think with you instead of sitting in folders.', 'It comes from an interest in knowledge systems, productivity and how people and machines work together, and from wanting a tool that remembers the way you do, only better.'] },
]

export const lab = [
  { title: 'SaaS concepts', text: 'Products that begin as a problem worth solving. Some become companies; most stay here.' },
  { title: 'AI experiments', text: 'Knowledge systems, second-brain ideas, AI-assisted workflows.' },
  { title: 'Web and UI experiments', text: 'Interaction, motion and 3D on the web. This studio started as one of them.' },
  { title: 'Business ideas', text: 'Problems noticed, models sketched, some tested.' },
  { title: 'Prototypes', text: 'Things built because they were interesting.' },
]

export const thinking = {
  line: 'Exploring ideas, systems, people, technology and the processes that turn thought into creation.',
  areas: [
      {
          "title": "Critical thinking",
          "text": "Questioning what is assumed before building on it.",
          "body": [
              "Most bad websites and most bad products share one cause: they were built on an assumption nobody checked. Who the visitor is, what they came for, what they already believe about the business, what they will do next. The assumption felt obvious, so it was never written down, so it was never tested, so the whole thing was built on it.",
              "The habit here is simple and slightly uncomfortable: before building anything, find the sentence everyone is treating as true and ask how we know. It is cheaper to test a sentence than to rebuild a system. Sometimes a five-minute conversation with three real customers changes the plan entirely.",
              "Critical thinking is not being negative. It is refusing to spend a month of work on something that could have been checked in an afternoon."
          ]
      },
      {
          "title": "Logical reasoning",
          "text": "Systems, cause and effect, and why things work.",
          "body": [
              "A website is a system. So is a business, a habit, a team, a city's traffic. Systems have inputs, rules and outputs, and when you understand one well enough you can predict what a change will do before you make it. That is the difference between fixing a problem and moving it somewhere you cannot see.",
              "In practice this means drawing the thing before building it: where does a visitor come from, what happens when they click, where does the enquiry go, who reads it, what happens if nobody does. Most failures are found on the drawing, where they cost nothing.",
              "Logic does not replace judgement. It gives judgement something solid to stand on."
          ]
      },
      {
          "title": "Creative thinking",
          "text": "Where the ideas come from.",
          "body": [
              "Ideas do not arrive by waiting. They come from reading widely and noticing what annoys people, from connecting two unrelated things, from asking what a website would be if it were a room instead of a page. The studio you are standing in is the answer to that last question.",
              "The other half of creativity is protection: giving an idea enough quiet to grow before judging it. Most ideas die in the first ten seconds, killed by the voice that says it has been done or it will not work. Write it down first. Judge it next week.",
              "The lab on the desk is where most of that noticing ends up, and where a few of the notes become products."
          ]
      },
      {
          "title": "Self-development",
          "text": "Extensive reading and learning, every day.",
          "body": [
              "The person doing the building is the most important part of the build. Every skill compounds: the tenth site is built with everything learnt on the first nine, and the hundredth book changes how the next one is read. So learning is not a hobby that happens after work here. It is the work that makes the work possible.",
              "The routine is unglamorous: read every day, write down what was learnt, try one new thing in every project, and revisit the notes. The results show up slowly and then all at once.",
              "The books on this shelf are the visible part of that habit."
          ]
      },
      {
          "title": "Books and reading",
          "text": "The shelf, and why these are on it.",
          "body": [
              "Clean Code, because the difference between code that works today and code that still works in two years is care, and care can be learnt. Atomic Habits, because the studio runs on habits more than on inspiration. The Psychology of Money, because every business decision is a money decision wearing a disguise. The Lean Startup, because the fastest way to find out if an idea is good is to build the smallest version of it and put it in front of someone.",
              "The rest of the shelf changes. Technology, business, human behaviour, how people think and decide. Reading widely is how the ideas in the lab get their raw material.",
              "If one book had to be recommended to someone building their first product, it would be The Lean Startup, read twice."
          ]
      }
  ],
}

export const teaching = {
  title: 'Learn with Olexweb',
  line: 'Web, products, thinking. Taught as it is learned, not from a pedestal.',
  topics: [
    { title: 'Web development', text: 'Building websites and web applications, from first idea to deployment.' },
    { title: 'UI/UX and digital products', text: 'Designing things people can use without being told how.' },
    { title: 'SEO', text: 'Being found by the people you built it for.' },
    { title: 'Creative thinking and problem solving', text: 'Turning a vague problem into a clear idea.' },
    { title: 'AI-assisted workflows', text: 'Building digital businesses with AI in the loop.' },
  ],
}

export const vision = {
  vision: 'Olexweb exists to use thought, technology and creativity to create useful things that solve problems, expand possibilities and help people grow.',
  mission: 'To keep learning, think deeply, develop ideas and turn them into useful digital products, businesses, experiences and knowledge that create value for others.',
  now: ['This studio.', 'The next set of websites, platforms and products. Each one has to be found, trusted and used, or it is not finished.'],
}

// Insights. Each article: paragraphs of plain text.
export const insights = [
  {
    "slug": "why-your-website-matters",
    "title": "Why your website matters: 10 things every business owner should know",
    "keywords": ["why a business needs a website", "business website", "website for small business", "web design", "website speed", "mobile-first website", "SEO for small business", "website conversion"],
    "date": "2026-09-30",
    "minutes": 12,
    "summary": "Ten things every business owner should know about the site that carries their name, written from the desk that builds them.",
    "body": [
      "## 1. It is open when you are not",
      "Your website is the only part of your business that works at three in the morning, on a public holiday, and while you are in a meeting. Someone hears your name at dinner, types it into a phone in a taxi, and decides in that moment whether you are real. You are not in that conversation. The site is. It should say what you would say if you were there: who you are, what you do, and how to reach you.",
      "## 2. People check before they call",
      "Almost nobody calls a business cold any more. They look first. A referral is a reason to look you up, not a reason to trust you; the trust is earned on the page they land on. If there is no site, or the site looks abandoned, the referral quietly dies and you never know it happened. A good site turns a mention into a conversation.",
      "## 3. Ten seconds decides it",
      "A visitor gives a new site about ten seconds before deciding whether to stay. In that time the site must tell them where they are, show them it is real, and make the next step obvious. A slogan is not a description; a stock photo of a handshake is not proof; a menu with nine items is not a next step. Say who you are in one line a stranger could repeat, show a real photograph, and put the phone number where a person looks for it.",
      "## 4. Speed is a design decision",
      "A slow site is not a technical fault waiting for a developer. It is a series of choices that were made without counting their cost: the autoplaying video, the four typefaces, the tracking scripts stacked six deep. Every element on a page must earn its weight the way it earns its place. A site that loads in a second on a phone in a market is worth more than one that looks spectacular on a designer's monitor.",
      "## 5. Your phone is the real screen",
      "Most of your visitors will open the site on a phone, often on a slow connection, often with one thumb. If the buttons are small, the text is tiny, the form asks for twelve things, or the number cannot be tapped to call, the site is failing the majority of the people it was built for. Build for the phone first and let the desktop be the bonus.",
      "## 6. Being findable is not luck",
      "Search engines do not guess what your business is. They read the page. Clear headings, plain language, a page for each service, a real address and phone number, fast loading and a structure a machine can follow: these are not tricks, they are hygiene. Do them and you appear when people search for what you do. Skip them and the competitor who did them appears instead.",
      "## 7. One clear action beats five",
      "A page that asks for a call, a form, a newsletter, a download and a follow has asked for nothing. Decide what you want the visitor to do next and make that one thing prominent, working, and written like a person would say it. \"Send my request\" outperforms \"Submit\" every time, and it is not close.",
      "## 8. Trust is built from small true things",
      "A named client. A real result. A review with a person's name on it. A photograph of the actual office, the actual product, the actual team. One is enough on each page, as long as it is true. Visitors have seen a thousand sites that promise excellence; they are looking for the one that shows evidence.",
      "## 9. A website is a system, not a poster",
      "The visible page is the smallest part. Behind a good business site sits an admin the owner can use without a developer, forms that reach the right inbox, analytics that answer real questions, backups, and hosting that stays up. Ask any web builder what happens when you need to change a price on a Sunday. The answer tells you whether you are buying a poster or a system.",
      "## 10. It is never finished, and that is the point",
      "A site that launched and was never touched again tells visitors the business stopped in that year. The best sites change a little every month: a new project, a new review, an updated price, a fresh photograph. Budget for that rhythm from the start. A website that grows with the business becomes its most reliable employee."
    ]
  },
  { slug: 'speed-is-a-design-decision', title: 'Why speed is a design decision', date: '2026-09-01', minutes: 4,
    summary: 'A slow website is not a technical problem waiting for a developer. It is a design choice someone already made.',
    body: [
      'People talk about website speed as if it were plumbing: something you call a specialist about after the house is built. It is not plumbing. It is the front door, and every extra second is a second the door stays shut.',
      'When a page takes four seconds to show anything, the visitor has already decided something about you. Not consciously, and not fairly, but firmly: this will be hard. Everything the page says after that is said to someone who is already leaving.',
      'Speed is a design decision because every slow site got that way through choices. The hero video that autoplays at full resolution. The four font families. The carousel nobody asked for. The tracking scripts stacked six deep. None of those were engineering mistakes. They were design decisions made without counting their cost.',
      'So I count. Every element on a page has to earn its weight in the same way it has to earn its place in the layout. If a picture cannot justify its bytes, it is not a design decision to include it; it is a design failure with a nice visual.',
      'The sites I build are fast because speed is designed in, not tuned in later. The layout is decided knowing what it will cost to load. The images are sized for where they sit. The scripts are there because they do something for the visitor, not for a dashboard.',
      'You do not need a faster developer. You need a designer who counts.',
    ] },
  { slug: 'built-for-people-not-browsers', title: 'Building for people, not for browsers', date: '2026-08-14', minutes: 5,
    summary: 'A website can pass every technical check and still fail the person who came to use it.',
    body: [
      'There is a way of building websites that is entirely about the browser. Does it render? Does it validate? Does it score well? These are good questions, and I ask all of them. They are also the wrong place to stop.',
      'The person who opens the site does not care whether it validates. They came with a question: can these people fix my roof, can I buy this before Friday, is this the consultant I have been looking for. The site is good if it answers that question quickly and honestly. Everything else is scaffolding.',
      'Building for people means starting from what they came for and working backwards. On a business site, the phone number goes where a person looks for a phone number, not where the template put it. The most important thing on the page is the thing they need, not the thing the business is proudest of.',
      'It also means writing like a person. Interfaces that say "Submit" are written for the machine. Interfaces that say "Send my request" are written for the human clicking them. The second one converts better, and not by a little.',
      'None of this argues against technical care. It argues for the right order: person first, browser second. Get the first right and the second is much easier, because you are no longer decorating a page. You are helping someone.',
    ] },
  { slug: 'a-small-room-a-big-digital-world', title: 'A small room, a big digital world', date: '2026-07-30', minutes: 3,
    summary: 'On the print that leans against the wall of the studio, and why it is there.',
    body: [
      'The studio is a small room. It has a desk, two monitors, a laptop, a chair, a shelf of books, a window with a view of the city, and a phone on the side table. Everything I have built came out of it.',
      'I used to think the room was the limit: that bigger work needed a bigger place. It does not. What it needs is a clear desk, a clear head and a reliable connection. The rest of the size is in the work.',
      'The print says "A small room, a big digital world" because that is the honest description of what happens here. A conversation on the phone becomes a sketch on the notebook becomes a build on the monitors becomes a site that runs in a city I have never visited.',
      'If you are building from a small room too: it is enough. Make it clear, make it quiet, and make things.',
    ] },
  { slug: 'the-first-ten-seconds', title: 'What a website should do in its first ten seconds', date: '2026-07-12', minutes: 4,
    summary: 'A checklist I run on every site I build, and on most that I visit.',
    body: [
      'Ten seconds is roughly what a new visitor gives a site before deciding whether to stay. Here is what a business website should have done by then.',
      'Told them where they are. Not a slogan, a description: who this is and what they do, in one line a stranger can repeat.',
      'Shown them it is real. A photograph of the place or the people, not a stock image of a handshake. Real is the whole point.',
      'Made the next step obvious. A phone number, a message button, a form. One of them, prominent, working on a phone.',
      'Loaded. Completely. Text readable, buttons clickable, nothing still arriving.',
      'Given them a reason to trust. A named client, a result, a review. One is enough; it must be true.',
      'That is the checklist. It fits on a sticky note, and it is worth more than most redesigns.',
    ] },
]

// The Olexweb anthem: plays in the room from the speaker; the lyrics open only when asked for.
export const anthem = {
  "title": "Unlimited",
  "sub": "The Olexweb anthem",
  "credit": "Written and produced for Olexweb by Olaitan Adebayo with Treblo",
  "lyrics": [
    [
      "Drop",
      [
        "Olexweb, Olexweb",
        "Nothing here can hold me down"
      ]
    ],
    [
      "Verse 1",
      [
        "Born inside a blank horizon",
        "Every thought becomes a door",
        "I map the maze before they draw it",
        "Blueprints sprawled across the floor",
        "Sharp as shattered glass my focus",
        "Wide as oceans I contain"
      ]
    ],
    [
      "Pre-chorus",
      [
        "Ideas falling like a meteor shower",
        "I catch them all in open hands"
      ]
    ],
    [
      "Chorus",
      [
        "Unstoppable and I know it",
        "Every wall I build I own it",
        "Watch me turn the spark to flame",
        "Unstoppable and I know it",
        "Nothing finite in my name",
        "I don't wait for fate I make it"
      ]
    ],
    [
      "Drop",
      [
        "Olexweb, Olexweb",
        "I create, I create"
      ]
    ],
    [
      "Verse 2",
      [
        "Strategies like constellations",
        "Threaded thick behind my eyes",
        "They chase the curve of my invention",
        "I outrun their borrowed skies",
        "Quiet storm and loud conviction",
        "Architect of my own rise"
      ]
    ],
    [
      "Pre-chorus",
      [
        "Every limit is a draft I'm erasing",
        "Every doubt a line I rewrite"
      ]
    ],
    [
      "Chorus",
      [
        "Unstoppable and I know it",
        "Every wall I build I own it",
        "Watch me turn the spark to flame",
        "Unstoppable and I know it",
        "Nothing finite in my name",
        "I don't wait for fate I make it"
      ]
    ],
    [
      "Breakdown",
      [
        "Build it",
        "Break it",
        "Build it bigger",
        "I am the idea and the fire"
      ]
    ],
    [
      "Chorus",
      [
        "Unstoppable and I know it",
        "Every wall I build I own it",
        "Watch me turn the spark to flame",
        "Unstoppable and I know it",
        "Nothing finite in my name",
        "I don't wait for fate I make it"
      ]
    ],
    [
      "Drop",
      [
        "Olexweb, Olexweb",
        "Unlimited, unlimited"
      ]
    ]
  ]
}

// Events. The first one shows on the TV in the studio. Add more here; a CMS can feed this list later.
export const events = [
  {
    "slug": "becoming-a-creator-2",
    "title": "Becoming a Creator 2.0",
    "kicker": "A live event with Olaitan Adebayo",
    "status": "Details to be announced",
    "summary": "A live event on the shift from consuming to creating: how ideas become products, businesses and work that carries your name.",
    "about": [
      "Becoming a Creator 2.0 is about the shift from consuming to creating. It is for people who have ideas and want to know how to turn them into something real: a product, a business, a piece of work that carries their name.",
      "The event draws on how this studio works: learning, thinking, building and teaching, in that order. It covers how to find an idea worth your time, how to test it before it costs you months, how to build the smallest real version, and how to put it in front of people who can use it.",
      "Date, venue and registration details will be announced here and in the studio. Register your interest now and you will be the first to know."
    ],
    "covers": [
      "Finding an idea worth your time",
      "Testing it before it costs you months",
      "Building the smallest real version",
      "Putting it in front of the right people",
      "Turning one creation into the next"
    ]
  }
]
