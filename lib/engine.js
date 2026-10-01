/* Olexweb Studio — photo build v4
   Normal lens. Drag to look; nothing moves unless the visitor moves it.
   Interfaces measure the screen and sit where there is room. Back goes one step. */
export function initStudio(THREE, cfg) {
  'use strict';
  var LITE = Math.min(window.innerWidth, window.innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;   // phones and weak machines get the light path
  var IMG = { pano: (LITE && cfg.panoLite) ? cfg.panoLite : cfg.pano };
  var listeners = [], rafId = 0;
  function on(t, ev, fn, o) { t.addEventListener(ev, fn, o); listeners.push([t, ev, fn, o]); }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var canvas = document.getElementById('studio');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LITE ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  var scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);

  // ---------- Panorama (full wrap; centre keeps true proportions, sides compressed toward the seam) ----------
  var THETA = THREE.MathUtils.degToRad(160), R = 10;
  var A = (160 / 1024) * 768 / 180;
  function yawFromU(u) { var x = 2 * u - 1; return Math.PI * x * (A + (1 - A) * x * x); }
  function dirFromUV(u, v, r) {
    var yaw = yawFromU(u), pitch = (v - 0.5) * THETA;
    return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch) * r, Math.sin(pitch) * r, -Math.cos(yaw) * Math.cos(pitch) * r);
  }
  var geo = new THREE.PlaneGeometry(1, 1, 180, 80), pos = geo.attributes.position, uv = geo.attributes.uv;
  for (var i = 0; i < pos.count; i++) { var d = dirFromUV(uv.getX(i), uv.getY(i), R); pos.setXYZ(i, d.x, d.y, d.z); }
  pos.needsUpdate = true;
  var panoTex = new THREE.TextureLoader().load(IMG.pano, function (tx) {
    try { if (LITE) throw 0; var pm = new THREE.PMREMGenerator(renderer); pm.compileEquirectangularShader(); var eq = tx.clone(); eq.needsUpdate = true; eq.mapping = THREE.EquirectangularReflectionMapping; scene.environment = pm.fromEquirectangular(eq).texture; pm.dispose(); } catch (e) {}
    renderer.render(scene, camera);
  });
  panoTex.encoding = THREE.LinearEncoding; panoTex.minFilter = THREE.LinearFilter; panoTex.magFilter = THREE.LinearFilter; panoTex.generateMipmaps = false; panoTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  var panoMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: panoTex }, night: { value: 0 } }, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D map; uniform float night; varying vec2 vUv;\n' +
      'void main(){ vec4 c = texture2D(map, vUv); float lum = dot(c.rgb, vec3(.299,.587,.114));\n' +
      '  float lit = smoothstep(0.62, 0.92, lum);\n' +                                   // light sources stay on
      '  vec3 dark = c.rgb * mix(vec3(0.20, 0.24, 0.34), vec3(1.0), lit * 0.9);\n' +
      '  gl_FragColor = vec4(mix(c.rgb, dark, night), 1.0); }'
  });
  scene.add(new THREE.Mesh(geo, panoMat));
  var night = false;
  function setNight(on) {
    night = on; tween(panoMat.uniforms.night, { value: on ? 1 : 0 }, reduceMotion ? 0 : 1800);
    surfaces.forEach(function (sf) { if (!sf.lit) { var col = { k: sf.mesh.material.color.r }; tween(col, { k: on ? 0.3 : 1 }, reduceMotion ? 0 : 1800, function () { sf.mesh.material.color.setScalar(col.k); }); } });
    document.documentElement.setAttribute('data-time', on ? 'night' : 'day');
    showCaption(on ? 'Lights off.' : 'Lights on.', 1800); sound.play('lights');
  }
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(R + 1, 32, 24), new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.BackSide })));

  var ICON = {
    mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    call: '<svg viewBox="0 0 24 24"><path d="M6 3h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 014 5a2 2 0 012-2z"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    site: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 21h8"/></svg>',
    doc: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 5v14l11-7z"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.5-6-10a6 6 0 0112 0c0 4.5-6 10-6 10z"/><circle cx="12" cy="11" r="2"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    code: '<svg viewBox="0 0 24 24"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
    pen: '<svg viewBox="0 0 24 24"><path d="M4 20l4-1 11-11-3-3L5 16z"/></svg>',
    rocket: '<svg viewBox="0 0 24 24"><path d="M5 19l3-3M14 4c3 0 5 2 5 5 0 5-6 9-6 9l-4-4s4-6 5-10zM8 14l-4 1 3-5 3 1"/></svg>',
    bot: '<svg viewBox="0 0 24 24"><rect x="5" y="8" width="14" height="11" rx="4"/><circle cx="10" cy="13" r="1"/><circle cx="14" cy="13" r="1"/><path d="M12 8V4"/></svg>'
  };

  // ---------- Objects (pixel positions on the 1536×1024 source; push-in lens; what grows out) ----------
  var SITES = cfg.sites;
  function siteItems(list) { return list.map(function (x) { var host = x.url.replace(/^https?:\/\//, ''); return { icon: 'site', label: x.name, title: x.name, text: x.text + (x.embed ? ' It is live on the monitor now: scroll it and click around.' : ' It is playing on the monitor; open it to use the full site.'), cta: x.embed ? 'Expand on the desk' : 'Open ' + host, link: x.embed ? null : x.url, site: x.key, live: !!x.embed }; }); }
  var WA = cfg.contact.whatsapp;
  var hotspots = [
    { id: 'phone', px: 1232, py: 622, rect: [1212, 596, 1254, 648], fov: 34, title: 'Start your next project', hint: 'Work with Olexweb', items: [
      { icon: 'chat', label: 'WhatsApp', title: 'Chat on WhatsApp', text: 'Opens a chat with a message already written for you. The quickest way to start.', link: WA, cta: 'Open WhatsApp' },
      { icon: 'mail', label: 'Email', title: cfg.contact.email, text: 'Tell me about your idea. You\'ll get a reply within a day.', link: 'mailto:' + cfg.contact.email + '?subject=' + encodeURIComponent('New project for Olexweb'), cta: 'Write an email' },
      { icon: 'call', label: 'Call', title: cfg.contact.phoneDisplay, text: 'For anything that is easier said than typed.', link: 'tel:' + cfg.contact.phone, cta: 'Call now' },
      { icon: 'user', label: 'Hire me on Contra', title: 'Hire Olexweb on Contra', text: 'Contra is where independent work is commissioned and paid, with the agreement, the milestones and the payment handled on the platform. If you prefer to hire that way, this is the door.', link: 'https://contra.com/olexweb01', cta: 'Open the Contra profile' },
      { icon: 'call', label: 'Other line', title: cfg.contact.phone2Display, text: 'If the first line is busy.', link: 'tel:' + cfg.contact.phone2, cta: 'Call this line' } ] },
    { id: 'monitors', px: 320, py: 480, rect: [205, 424, 432, 548], fov: 40, title: 'Selected web work', hint: 'Olexweb builds complete digital systems', items: siteItems(SITES) },
    { id: 'laptop', px: 470, py: 522, rect: [432, 478, 520, 562], fov: 38, title: 'How Olexweb works', hint: 'Services, process, and how to start', items: cfg.services.map(function (x) { return { icon: 'code', label: x.title, title: x.title, text: x.text }; }).concat([{ icon: 'rocket', label: 'The process', title: 'Ideas, design, code, launch', text: cfg.process.map(function (p) { return p.title + ': ' + p.text; }).join(' ') }]) },
    { id: 'notebook', px: 205, py: 606, rect: [170, 588, 262, 628], fov: 34, title: 'The lab', hint: 'Olaitan\'s ideas and experiments', items: [
      { icon: 'spark', label: 'SaaS concepts', title: 'SaaS concepts', text: 'Every SaaS idea here began as a problem someone kept having. The question is never whether it can be built; it is whether anyone would keep using it once the novelty wears off. The ones that pass that test become products, like Needar did. The rest stay here as sketches, and that is fine: a good idea that is not yet needed is still a good idea.' },
      { icon: 'code', label: 'AI experiments', title: 'AI experiments', text: 'How should a person and a machine share the work of thinking? That question runs through most of what happens here: knowledge systems that remember the way you do, second-brain ideas like Aviirel, and workflows where AI drafts and a person decides. The interest is not in what AI can generate but in what it can help a thoughtful person finish.' },
      { icon: 'eye', label: 'Web and UI experiments', title: 'Web and UI experiments', text: 'Interaction, motion and 3D on the web, tried for their own sake first. This studio started as one of these experiments: a question about whether a website could be a place you stand in rather than a page you scroll. It grew into the front door of Olexweb. Not every experiment goes that far, but that is why they are worth running.' },
      { icon: 'pen', label: 'Business ideas', title: 'Business ideas', text: 'A business idea is a problem, a person who has it, and a reason they would pay to make it go away. Most of what gets written down here fails one of those three tests, and finding out which one is the useful part. The few that pass all three are sketched into models and, sometimes, tested with real people before a line of code is written.' },
      { icon: 'rocket', label: 'Prototypes', title: 'Prototypes', text: 'Things built because they were interesting, not because a client asked. A prototype answers a question faster than a plan can, and it costs a weekend rather than a quarter. Some of them are shown here once they are presentable; the rest taught something and were put away.' } ] },
    { id: 'portrait', px: 1202, py: 343, rect: [1168, 268, 1238, 416], fov: 30, title: 'Olaitan Adebayo', hint: 'Photographs', gallery: true, link: '/olaitan', items: [] },
    { id: 'robot', px: 700, py: 665, rect: [0, 0, 0, 0], fov: 46, title: cfg.guideName, hint: 'Your guide around the studio', ask: true, items: [
      { icon: 'bot', label: 'Show me the latest work', say: 'The laptop holds the latest work. Let me take you there.', go: 'laptop' },
      { icon: 'bot', label: 'Who is Olaitan?', say: 'That photograph on the shelf is Olaitan, the person behind Olexweb. His story is there.', go: 'portrait' },
      { icon: 'bot', label: 'How do I work with Olexweb?', say: 'The phone is the fastest way. WhatsApp, email or a call.', go: 'phone' },
      { icon: 'bot', label: 'What is Olexweb?', say: 'Olexweb is Olaitan\'s workspace for the web: websites, platforms, admin systems and digital experiences, built to be found, trusted and used.' } ] },
    { id: 'window', px: 760, py: 430, rect: [640, 300, 886, 532], fov: 46, title: 'Vision and mission', hint: 'Olexweb', items: [
      { icon: 'eye', label: 'Vision', title: 'Vision', text: 'Olexweb exists to use thought, technology and creativity to create useful things that solve problems, expand possibilities and help people grow. Useful is the word that matters. A website that wins awards and loses customers is not useful. A product that is clever and unused is not useful. The vision is a body of work that people rely on, from businesses whose sites bring them clients to products that quietly make someone\'s day easier.' },
      { icon: 'rocket', label: 'Mission', title: 'Mission', text: 'To keep learning, think deeply, develop ideas and turn them into useful digital products, businesses, experiences and knowledge that create value for others. In practice that is a daily order of operations: learn something, think about it long enough to have an idea, build the idea into something real, and pass on what the building taught. Learning, thinking, building, teaching. The workspace is arranged around exactly that loop.' },
      { icon: 'spark', label: 'Now building', title: 'Now building', text: 'This studio, first of all: a home page that is a room, with real pages beneath it for the people and the search engines that need them. Beyond it, the next set of websites, platforms and products for the businesses that come through the phone on the side table. Each one has to be found, trusted and used, or it is not finished.' } ] },
    { id: 'shelf', px: 1040, py: 470, rect: [960, 290, 1132, 700], fov: 40, title: 'The shelf', hint: 'Pick a book and it opens.', items: cfg.insights.map(function (a) { return { icon: 'doc', label: a.title, title: a.title, text: a.summary, book: a, link: '/insights/' + a.slug, cta: 'Read in full' }; }).concat(cfg.thinking.areas.map(function (a) { return { icon: 'doc', label: a.title, title: a.title, text: a.text, book: { title: a.title, summary: a.text, body: a.body || [a.text] } }; })) },
    { id: 'wall', px: 1365, py: 330, rect: [1250, 238, 1492, 432], fov: 42, title: 'Ventures and products', hint: 'Things Olaitan originated', items: [
      { icon: 'pin', label: 'Elvanex Digital', title: 'Elvanex Digital', text: 'A digital and technology venture. Where the products, platforms and experiments that outgrow a single website are built and run.', link: '/ventures/elvanex', cta: 'About Elvanex' },
      { icon: 'pin', label: 'Needar', title: 'Needar', text: 'A SaaS for the LinkedIn job search, built for the person searching rather than the platform. It began as a problem noticed, became a concept, and was built into a product.', link: '/ventures/needar', cta: 'About Needar' },
      { icon: 'pin', label: 'Aviirel', title: 'Aviirel', text: 'An AI second brain: a place your notes, ideas and knowledge can think with you. Knowledge systems, productivity and how people work with machines.', link: '/ventures/aviirel', cta: 'About Aviirel' },
      { icon: 'spark', label: 'Next', title: 'What comes next', text: 'There will be more. This wall grows.' } ] },
    { id: 'speaker', px: 1400, py: 628, rect: [1348, 590, 1452, 662], fov: 34, title: cfg.anthem.title, hint: cfg.anthem.sub, items: [
      { icon: 'play', label: 'Now playing', title: cfg.anthem.title + ' \u2014 ' + cfg.anthem.sub, text: cfg.anthem.credit + '. It plays in the room on a loop; the \u266a button turns it off.', cta: 'Play / pause', music: true },
      { icon: 'doc', label: 'Lyrics', title: cfg.anthem.title, text: 'The words, section by section.', lyrics: cfg.anthem.lyrics } ] },
    { id: 'switch1', px: 129, py: 466, rect: [116, 452, 142, 480], toggle: true, title: 'Light switch', hint: 'Day and night' },
    { id: 'switch2', px: 1489, py: 460, rect: [1476, 444, 1502, 478], toggle: true, title: 'Light switch', hint: 'Day and night' },
    { id: 'tv', px: 1377, py: 470, rect: [1284, 397, 1472, 543], fov: 40, title: 'Learn with Olexweb', hint: 'Teaching, and the events that come with it', items: [
      { icon: 'play', label: 'Web development', title: 'Web development', text: 'Building websites and web applications from the first idea to deployment: how to structure a site so it can grow, how to choose what to build and what to leave out, how to ship something real on a Friday and improve it on Monday. Taught the way it is practised here, with real projects rather than exercises.' },
      { icon: 'play', label: 'UI/UX and digital products', title: 'UI/UX and digital products', text: 'Designing things people can use without being told how. What a person came for, where their eye lands first, what they need to trust before they will act, and why a button that says \'Send my request\' beats one that says \'Submit\'. Product thinking for people who have to build, not just draw.' },
      { icon: 'play', label: 'SEO', title: 'SEO', text: 'Being found by the people you built it for. Not tricks: structure, speed, honest content and the technical hygiene that lets a search engine understand what a page is about. Everything this studio does underneath its room, explained so that you can do it for your own site.' },
      { icon: 'play', label: 'Creative thinking', title: 'Creative thinking and problem solving', text: 'Turning a vague problem into a clear idea, and a clear idea into the first step. The habits behind it: asking what is actually being assumed, holding two options open at once, and knowing when to stop thinking and make something so the thinking can continue with evidence.' },
      { icon: 'play', label: 'AI-assisted workflows', title: 'AI-assisted workflows', text: 'Building digital businesses with AI in the loop: where it saves days, where it quietly makes things worse, and how to keep a person in charge of the decisions that matter. Taught as it is learned, not from a pedestal.' },
      { icon: 'cal', label: 'Events', title: cfg.events[0].title, text: cfg.events[0].kicker + '. ' + cfg.events[0].about.join(' ') + ' It covers: ' + cfg.events[0].covers.join('; ') + '.', link: (cfg.contact.whatsapp.replace(/text=.*$/, 'text=' + encodeURIComponent('Hi Olexweb, I want to register my interest in Becoming a Creator 2.0.'))), cta: 'Register interest' } ] }
  ];
  var SURF = cfg.surfaces;
  var surfaces = [];
  function surface(corners, cw, ch, lit) {                       // corners: [TL, TR, BR, BL] in panorama pixels
    var g = new THREE.BufferGeometry(), v = [], uvs = [], idx = [], NX = 16, NY = 10;
    for (var iy = 0; iy <= NY; iy++) for (var ix = 0; ix <= NX; ix++) {
      var a = ix / NX, b = iy / NY;                             // bilinear in pixel space
      var px = (1 - b) * ((1 - a) * corners[0][0] + a * corners[1][0]) + b * ((1 - a) * corners[3][0] + a * corners[2][0]);
      var py = (1 - b) * ((1 - a) * corners[0][1] + a * corners[1][1]) + b * ((1 - a) * corners[3][1] + a * corners[2][1]);
      var d = dirFromUV(px / 1536, 1 - py / 1024, R * 0.99); v.push(d.x, d.y, d.z); uvs.push(a, 1 - b);
    }
    for (var jy = 0; jy < NY; jy++) for (var jx = 0; jx < NX; jx++) { var i0 = jy * (NX + 1) + jx, i1 = i0 + 1, i2 = i0 + NX + 1, i3 = i2 + 1; idx.push(i0, i1, i3, i0, i3, i2); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    var tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.LinearEncoding; tex.minFilter = THREE.LinearFilter; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); scene.add(m);
    var sf = { mesh: m, cv: cv, ctx: cv.getContext('2d'), tex: tex, lit: lit }; surfaces.push(sf); return sf;
  }
  function loadImg(src, cb) { var im = new Image(); im.onload = function () { cb(im); }; im.src = src; return im; }
  var fontReady = false; if (document.fonts && document.fonts.load) document.fonts.load('600 40px Manrope').then(function () { fontReady = true; drawStatic(); });

  // Monitors: the real websites, one after another, each scrolling by itself
  var monL = surface([[208, 438], [323, 441], [323, 533], [208, 537]], 640, 520, true);
  var monR = surface([[331, 441], [426, 444], [426, 526], [331, 531]], 560, 500, true);
  var siteImgs = {}, monState = { i: 0, t0: performance.now(), off: 0 };
  setTimeout(function () { SITES.forEach(function (x) { if (SURF['site_' + x.key]) siteImgs[x.key] = loadImg(SURF['site_' + x.key], function () {}); }); }, LITE ? 4000 : 1500);
  function drawPage(sf, site, alpha, offset) {
    var c = sf.ctx, W = sf.cv.width, H = sf.cv.height, im = siteImgs[site.key]; if (!im || !im.complete || !im.naturalWidth) return;
    c.globalAlpha = alpha; c.fillStyle = '#0d0f0d'; c.fillRect(0, 0, W, H);
    var sc = W / im.naturalWidth, ph = im.naturalHeight * sc, y = 30 - Math.min(offset, Math.max(0, ph - (H - 30)));
    c.drawImage(im, 0, y, W, ph);
    c.fillStyle = '#121412'; c.fillRect(0, 0, W, 30);
    c.fillStyle = '#8fe36a'; c.beginPath(); c.arc(16, 15, 5, 0, 7); c.fill();
    c.fillStyle = '#e9e6e0'; c.font = '600 14px Manrope, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(site.url.replace(/^https?:\/\//, ''), 30, 15);
    c.fillStyle = 'rgba(233,230,224,.5)'; c.font = '500 11px Manrope, sans-serif'; c.textAlign = 'right'; c.fillText(site.name, W - 12, 15); c.textAlign = 'left';
    c.globalAlpha = 1; sf.tex.needsUpdate = true;
  }
  var monTick = 0;
  function drawMonitors(now) {
    if (now - monTick < 66) return; monTick = now;
    var DUR = 9000, FADE = 900, n = SITES.length;
    if (monState.hold) monState.t0 = now - Math.min(now - monState.t0, DUR - FADE - 1);
    var el = now - monState.t0; if (el > DUR) { monState.i = (monState.i + 1) % n; monState.t0 = now; el = 0; }
    var a = SITES[monState.i], b = SITES[(monState.i + 1) % n], c2 = SITES[(monState.i + 2) % n];
    drawPage(monL, a, 1, el / DUR * 1200);                       // left: the current site, scrolling
    drawPage(monR, b, 1, 200 + el / DUR * 700);                  // right: the next one, already open
    if (el > DUR - FADE) { var k = (el - (DUR - FADE)) / FADE; drawPage(monL, b, k, 200 + el / DUR * 700); drawPage(monR, c2, k, 200); }
  }
  // Live website on the left monitor: a real frame warped to the monitor's four corners every frame
  var live = document.getElementById('live'), liveFrame = document.getElementById('live-frame'), liveKey = null, liveExpanded = false;
  var LIVE_W = 1100, LIVE_H = 880;
  var monLCorners = [[208, 438], [323, 441], [323, 533], [208, 537]];
  function homography(dst) {
    var W = LIVE_W, H = LIVE_H, src = [[0, 0], [W, 0], [W, H], [0, H]], A = [], bb = [];
    for (var i = 0; i < 4; i++) { var x = src[i][0], y = src[i][1], u = dst[i][0], v = dst[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); bb.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); bb.push(v); }
    for (var c = 0; c < 8; c++) { var p = c; for (var r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      var t = A[c]; A[c] = A[p]; A[p] = t; t = bb[c]; bb[c] = bb[p]; bb[p] = t;
      for (var r2 = 0; r2 < 8; r2++) { if (r2 === c) continue; var f = A[r2][c] / A[c][c]; if (!f) continue; for (var k = c; k < 8; k++) A[r2][k] -= f * A[c][k]; bb[r2] -= f * bb[c]; } }
    var h = []; for (var i2 = 0; i2 < 8; i2++) h.push(bb[i2] / A[i2][i2]); h.push(1);
    return 'matrix3d(' + [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]].map(function (n) { return n.toFixed(6); }).join(',') + ')';
  }
  function placeLive() {
    if (!liveKey || liveExpanded) return;
    var pts = monLCorners.map(function (c) { var p = project(dirFromUV(c[0] / 1536, 1 - c[1] / 1024, 1)); return [p.x, p.y]; });
    live.style.transform = homography(pts);
  }
  function showLive(key) {
    var site = SITES.filter(function (x) { return x.key === key; })[0]; if (!site || !site.embed) { hideLive(); return; }
    if (liveKey !== key) { liveNav(site.url); liveKey = key; }
    live.classList.add('on'); placeLive();
  }
  function liveNav(url) { try { liveFrame.contentWindow.location.replace(url); } catch (e) { liveFrame.src = url; } }   // replace: no history entry
  function hideLive() { live.classList.remove('on', 'full'); liveExpanded = false; if (liveKey) { liveNav('about:blank'); liveKey = null; } }
  function expandLive(on) { liveExpanded = on; live.classList.toggle('full', on); if (!on) placeLive(); }
  document.getElementById('live-close').addEventListener('click', function () { expandLive(false); });


  // ---------- The book: slides out of the shelf, opens, and its leaves turn as you read ----------
  var bookEl = document.getElementById('book'), bookLeaves = document.getElementById('book-leaves'), bookOpen = false, leafIdx = 0, leafCount = 0;
  var bookSpot = dirFromUV(1046 / 1536, 1 - 520 / 1024, 1);
  var THEMES = [['#17201a', '#8fe36a'], ['#1b2a3a', '#7cc7ff'], ['#3a1f1b', '#ffb37c'], ['#2a1b3a', '#d9a6ff'], ['#1e2a24', '#9be8b8'], ['#2f2a1b', '#ffd97c']];
  function themeFor(title) { var h = 0; for (var i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0; return THEMES[h % THEMES.length]; }
  function firstSentence(t) { var m = t.match(/^[^.!?]*[.!?]/); return m ? m[0] : t; }
  function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function chTitle(t) { return esc(t.replace(/^\d+\.\s*/, '')); }
  function readMins(article) { return Math.max(1, Math.round(article.body.join(' ').split(/\s+/).length / 200)); }
  function paginate(article) {
    var meas = document.querySelector('#book-measure .face'), pages = [], cur = [], chapters = [], n = 0;
    article.body.forEach(function (p) { if (p.indexOf('## ') === 0) chapters.push(p.slice(3)); });
    function fits(html) { meas.innerHTML = html; return meas.scrollHeight <= meas.clientHeight + 1; }
    function flush() { if (cur.length) pages.push({ html: cur.join('') }); cur = []; }
    var byline = '<p class="byline">Written by Olaitan Adebayo \u00b7 ' + readMins(article) + '-minute read</p>';
    // inside cover: the contents for chaptered books, a colophon for the rest. The summary lives only on the cover.
    var inside = chapters.length
      ? '<div class="opener"><h5>In this book</h5><ol>' + chapters.map(function (c) { return '<li>' + chTitle(c) + '</li>'; }).join('') + '</ol>' + byline + '</div>'
      : '<div class="opener colophon"><h5>From the Olexweb shelf</h5><p>Written by Olaitan Adebayo</p><p>A ' + readMins(article) + '-minute read</p><p class="go">Turn the page to begin \u203a</p></div>';
    // one existing paragraph is set as a highlight (styled, never duplicated)
    var hl = -1, best = 1e9;
    if (!chapters.length) article.body.forEach(function (p, i) { var w = p.split(/\s+/).length; if (i > 0 && w >= 12 && w <= 45 && w < best) { best = w; hl = i; } });
    article.body.forEach(function (para, idx) {
      if (para.indexOf('## ') === 0) { flush(); n++; cur.push('<div class="ch"><span class="num">' + n + '</span><h4>' + chTitle(para.slice(3)) + '</h4></div>'); return; }
      var words = para.split(/\s+/), isFirst = cur.length && cur[cur.length - 1].indexOf('class="ch"') > 0, firstChunk = true;
      if (isFirst) { var short = firstSentence(para); cur.push('<p class="short">' + esc(short) + '</p>'); words = para.slice(short.length).trim().split(/\s+/).filter(Boolean); if (!words.length) return; }
      while (words.length) {
        var open = (idx === hl && firstChunk) ? '<p class="hl">' : '<p>';
        if (fits(cur.join('') + open + words.join(' ') + '</p>')) { cur.push(open + words.join(' ') + '</p>'); break; }
        var lo = 0, hi = words.length;
        while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (fits(cur.join('') + open + words.slice(0, mid).join(' ') + '</p>')) lo = mid; else hi = mid - 1; }
        if (lo < 12 && cur.length) { flush(); continue; }
        if (lo === 0) lo = Math.min(words.length, 40);
        cur.push(open + words.slice(0, lo).join(' ') + '</p>'); words = words.slice(lo); flush(); firstChunk = false;
      }
    });
    flush();
    var others = ((byId.shelf && byId.shelf.items) || []).filter(function (i) { return i.book && i.title !== article.title; }).slice(0, 4);
    var closing = '<div class="closing"><h5>The end</h5><p>Thanks for reading.</p>' + (others.length ? '<p class="mf">More from the shelf</p><ul>' + others.map(function (o) { return '<li>' + esc(o.title) + '</li>'; }).join('') + '</ul>' : '') + '<p>Want this done for your business, or want to learn it properly? The buttons under the book start that conversation.</p></div>';
    pages.push({ html: closing, end: true });
    if (pages.length % 2 === 0) pages.push({ html: '<div class="closing"><h5>Olexweb</h5><p>Digital experiences that matter. Websites, platforms and products built to be found, trusted and used.</p><p>The studio you are standing in is one of them.</p></div>' });
    meas.innerHTML = '';
    return { inside: inside, pages: pages };
  }
  function openBook(article) {
    var th = themeFor(article.title), inner = document.getElementById('book-inner');
    inner.style.setProperty('--bk-cover', th[0]); inner.style.setProperty('--bk-accent', th[1]);
    var pg = paginate(article), pages = pg.pages; bookLeaves.innerHTML = ''; leafIdx = 0;
    document.getElementById('book-left').innerHTML = '<div class="face static">' + pg.inside + '</div>';
    leafCount = Math.ceil((pages.length + 1) / 2);
    for (var i = 0; i < leafCount; i++) {
      var leaf = document.createElement('div'); leaf.className = 'leaf'; leaf.style.zIndex = leafCount - i;
      var f = i === 0 ? { cover: true } : pages[i * 2 - 1] || { html: '' }, b = pages[i * 2] || { html: '' };
      leaf.innerHTML = '<div class="face front">' + (f.cover ? '<div class="cover"><span class="mark"></span><span class="band"></span><h3>' + esc(article.title) + '</h3><p>' + esc(article.summary) + '</p><em>Turn the page \u203a</em></div>' : (f.html || '') + '<span class="pm"></span><span class="pn">' + (i * 2) + '</span>') + '</div>' +
                       '<div class="face back">' + (b.html || '') + '<span class="pm"></span><span class="pn">' + (i * 2 + 1) + '</span></div>';
      bookLeaves.appendChild(leaf);
    }
    document.getElementById('book-title').textContent = article.title;
    var bc = document.getElementById('book-ctas'); if (bc) { bc.innerHTML = ''; [{ label: 'Learn this', link: waMsg('I want to learn more about "' + article.title + '".') }, { label: 'Order as a service', link: waMsg('I want to order help with "' + article.title + '" for my business.') }].forEach(function (c) { var a = document.createElement('a'); a.className = 'cta2'; a.href = c.link; a.target = '_blank'; a.rel = 'noopener'; a.textContent = c.label; bc.appendChild(a); }); }
    bookEl.classList.add('out'); bookOpen = true; setHover(null); ui.detail.classList.add('behind'); ui.orbit.classList.add('behind');
    document.documentElement.classList.add('is-reading');
    setTimeout(function () { if (bookOpen) bookEl.classList.add('open'); }, 700);
    updateLeaves();
  }
  // swipe to turn pages on touch screens
  var swipeX = null;
  on(bookEl, 'touchstart', function (e) { if (bookOpen && e.touches.length === 1) swipeX = e.touches[0].clientX; }, { passive: true });
  on(bookEl, 'touchend', function (e) { if (swipeX === null) return; var dx = e.changedTouches[0].clientX - swipeX; swipeX = null; if (Math.abs(dx) > 40) turn(dx < 0 ? 1 : -1); }, { passive: true });
  on(document.getElementById('book-close'), 'click', function (e) { e.stopPropagation(); stepBack(); });
  function closeBook() { if (!bookOpen) return; bookOpen = false; document.documentElement.classList.remove('is-reading'); ui.detail.classList.remove('behind'); ui.orbit.classList.remove('behind'); bookEl.classList.remove('open'); setTimeout(function () { if (!bookOpen) bookEl.classList.remove('out'); }, 500); }
  function updateLeaves() { Array.prototype.forEach.call(bookLeaves.children, function (l, i) { l.classList.toggle('turned', i < leafIdx); l.style.zIndex = i < leafIdx ? i : leafCount - i; }); }
  function turn(d) { if (!bookOpen) return; var n = Math.max(0, Math.min(leafCount, leafIdx + d)); if (n !== leafIdx) sound.play('flip'); leafIdx = n; updateLeaves(); }
  function placeBook() {}
  on(document.getElementById('book-next'), 'click', function () { turn(1); });
  on(document.getElementById('book-prev'), 'click', function () { turn(-1); });
  on(bookEl, 'wheel', function (e) { if (!bookOpen) return; e.preventDefault(); e.stopPropagation(); if (Math.abs(e.deltaY) > 20) turn(e.deltaY > 0 ? 1 : -1); }, { passive: false });
  on(document, 'keydown', function (e) { if (!bookOpen) return; if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); turn(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-1); } });

  var STORY = { key: cfg.person.key, story: cfg.person.story, line: cfg.person.line, interests: cfg.person.interests, link: '/olaitan' };
  var galleryEl = document.getElementById('gallery'), galleryOn = false;
  var frameQuad = [[1174.5, 293.5], [1229.5, 273], [1230.5, 407], [1175, 412.5]];
  function placeGallery() {
    if (!galleryOn) return;
    var xs = [], ys = [];
    frameQuad.forEach(function (c) { var p = project(dirFromUV(c[0] / 1536, 1 - c[1] / 1024, 1)); xs.push(p.x); ys.push(p.y); });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var W = window.innerWidth; galleryEl.style.setProperty('--gl', Math.max(30, minX - 56).toFixed(0) + 'px'); galleryEl.style.setProperty('--gr', Math.min(W - 30, maxX + 56).toFixed(0) + 'px');
    galleryEl.style.setProperty('--gy', ((minY + maxY) / 2).toFixed(0) + 'px'); galleryEl.style.setProperty('--gt', (minY - 8).toFixed(0) + 'px'); galleryEl.style.setProperty('--gx', ((minX + maxX) / 2).toFixed(0) + 'px');
    var H = window.innerHeight, cb = maxY + 30; if (cb + 96 > H - 60) cb = minY - 96; if (cb < 70) cb = H - 118;   /* below the frame, else above it, else pinned inside the bottom edge */
    galleryEl.style.setProperty('--gb', cb.toFixed(0) + 'px'); galleryEl.style.setProperty('--gs', (cb + 44).toFixed(0) + 'px'); galleryEl.style.setProperty('--gt', (minY - 30).toFixed(0) + 'px');
  }
  function stepPhoto(d) { photoIdx = (photoIdx + d + PHOTOS) % PHOTOS; drawPortrait(); sound.play('shutter'); }
  function showGallery() { galleryOn = true; galleryEl.classList.add('on'); drawPortrait(); placeGallery(); }
  function openStory() {
    var P = STORY;
    ui.detail.classList.add('lyrics'); ui.dTitle.textContent = 'Olaitan Adebayo';
    var html = '<b>Creative ideator</b><span>' + P.key + '</span>';
    html += '<b>The story</b>' + P.story.map(function (p) { return '<span>' + p + '</span>'; }).join('');
    html += '<b>How I think</b><span>' + P.line + '</span><span>' + P.interests.join(' \u00b7 ') + '</span>';
    ui.dText.innerHTML = html; ui.dLink.style.display = P.link ? '' : 'none'; ui.dLink.textContent = 'The full story'; ui.dLink.href = P.link || '#'; ui.dLink.target = ''; ui.dLink.onclick = null;
    activeBtn = document.getElementById('gallery-story'); ui.detail.classList.add('on'); placeStoryCard();
  }
  function placeStoryCard() { if (!galleryOn || !ui.detail.classList.contains('on')) return; var W = window.innerWidth, dW = ui.detail.offsetWidth, dH = ui.detail.offsetHeight; var gr = parseFloat(galleryEl.style.getPropertyValue('--gr')) || W * 0.6, gl = parseFloat(galleryEl.style.getPropertyValue('--gl')) || W * 0.4; var left = gr + 40; if (left + dW > W - 14) left = Math.max(14, gl - 40 - dW); ui.detail.style.left = left + 'px'; ui.detail.style.top = Math.max(14 + dH / 2, Math.min(window.innerHeight - 14 - dH / 2, window.innerHeight / 2)) + 'px'; ui.detail.classList.remove('flip'); }
  on(document.getElementById('gallery-story'), 'click', function (e) { e.stopPropagation(); openStory(); });
  function hideGallery() { galleryOn = false; galleryEl.classList.remove('on'); ui.detail.classList.remove('on', 'lyrics'); }
  document.getElementById('gallery-close').addEventListener('click', function (e) { e.stopPropagation(); nav({ s: 'room' }, true); });
  function listen(t, ev, fn) { t.addEventListener(ev, fn); }
  on(document.getElementById('gallery-next'), 'click', function (e) { e.stopPropagation(); stepPhoto(1); });
  on(document.getElementById('gallery-prev'), 'click', function (e) { e.stopPropagation(); stepPhoto(-1); });


  // ---------- Sound: a room tone, small sounds for actions, and a voice for the guide. Nothing to download; all synthesised ----------
  var sound = (function () {
    var ctx = null, master = null, ambient = null, started = false;
    var store = { vol: 0.6, on: true, voice: true, music: true };
    var analyser = null, freq = null;
    var music = null, musicGain = null, musicSrc = cfg.music;
    try { var saved = JSON.parse(localStorage.getItem('olex-sound') || 'null'); if (saved) store = Object.assign(store, saved); } catch (e) {}
    function save() { try { localStorage.setItem('olex-sound', JSON.stringify(store)); } catch (e) {} }
    function ensure() {
      if (ctx) return true;
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
      master = ctx.createGain(); master.gain.value = store.on ? store.vol : 0; master.connect(ctx.destination);
      // room tone: filtered noise + a very low hum, breathing slowly
      var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), b0 = 0, b1 = 0, b2 = 0;
      for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.05; }
      var noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      var ng = ctx.createGain(); ng.gain.value = 0.35;
      var hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 58; var hg = ctx.createGain(); hg.gain.value = 0.03;
      var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; var lg = ctx.createGain(); lg.gain.value = 0.12; lfo.connect(lg); lg.connect(ng.gain);
      ambient = ctx.createGain(); ambient.gain.value = 0;
      noise.connect(lp); lp.connect(ng); ng.connect(ambient); hum.connect(hg); hg.connect(ambient); ambient.connect(master);
      noise.start(); hum.start(); lfo.start();
      ambient.gain.linearRampToValueAtTime(1, ctx.currentTime + 4);
      started = true;
      // music: a track you supply (loops, follows the volume, has its own switch, dips under the guide's voice)
      if (musicSrc) {
        try {
          music = new Audio(); music.loop = true; music.preload = LITE ? 'metadata' : 'auto'; music.crossOrigin = 'anonymous'; music.src = musicSrc;
          musicGain = ctx.createGain(); musicGain.gain.value = 0;
          var mSrc = ctx.createMediaElementSource(music); mSrc.connect(musicGain); musicGain.connect(master);
          analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.6; musicGain.connect(analyser); freq = new Uint8Array(analyser.frequencyBinCount);
          music.addEventListener('canplay', function () { if (store.music) { music.play().catch(function () {}); musicGain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 6); } });
          music.addEventListener('error', function () { music = null; var mb = document.getElementById('music-toggle'); if (mb) mb.classList.add('none'); });
        } catch (e) { music = null; }
      } else { var mb0 = document.getElementById('music-toggle'); if (mb0) mb0.classList.add('none'); }
      return true;
    }
    function duck(on) { if (musicGain) musicGain.gain.linearRampToValueAtTime(on ? 0.15 : 0.55, ctx.currentTime + 0.4); }
    function env(node, t, a, d, peak) { var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); node.connect(g); g.connect(master); return g; }
    function play(kind) {
      if (!ctx || !store.on) return;
      var t = ctx.currentTime;
      if (kind === 'click') { var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(440, t + 0.08); env(o, t, 0.005, 0.09, 0.12); o.start(t); o.stop(t + 0.12); }
      if (kind === 'whoosh' || kind === 'flip' || kind === 'shutter') {
        var n = ctx.createBufferSource(); var len = ctx.sampleRate * 0.5, b = ctx.createBuffer(1, len, ctx.sampleRate), dd = b.getChannelData(0); for (var i = 0; i < len; i++) dd[i] = Math.random() * 2 - 1; n.buffer = b;
        var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = kind === 'flip' ? 0.8 : 0.5;
        var f0 = kind === 'whoosh' ? 300 : kind === 'flip' ? 1800 : 2400, f1 = kind === 'whoosh' ? 1400 : kind === 'flip' ? 500 : 900, dur = kind === 'whoosh' ? 0.6 : 0.18;
        f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); n.connect(f); env(f, t, kind === 'whoosh' ? 0.15 : 0.01, dur, kind === 'whoosh' ? 0.09 : 0.16); n.start(t); n.stop(t + dur + 0.05);
      }
      if (kind === 'lights') { var o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 1200; env(o2, t, 0.002, 0.03, 0.06); o2.start(t); o2.stop(t + 0.05); }
    }
    function say(text) {
      if (!store.on || !store.voice || !window.speechSynthesis) return;
      try { window.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(text); u.rate = 1; u.pitch = 1.05; u.volume = store.vol; duck(true); u.onend = u.onerror = function () { duck(false); }; window.speechSynthesis.speak(u); } catch (e) { duck(false); }
    }
    function applyMusic() { if (!music) return; if (store.music && store.on) { music.play().catch(function () {}); musicGain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 1); } else { musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6); setTimeout(function () { if (!(store.music && store.on) && music) music.pause(); }, 700); } }
    function apply() { if (master) master.gain.linearRampToValueAtTime(store.on ? store.vol : 0, ctx.currentTime + 0.3); applyMusic(); if (!store.on && window.speechSynthesis) window.speechSynthesis.cancel(); save(); syncUI(); }
    function syncUI() { var b = document.getElementById('sound-toggle'), r = document.getElementById('sound-vol'); if (b) { b.classList.toggle('off', !store.on); b.setAttribute('aria-label', store.on ? 'Turn sound off' : 'Turn sound on'); } if (r) r.value = Math.round(store.vol * 100); var mb = document.getElementById('music-toggle'); if (mb) { mb.classList.toggle('off', !store.music); mb.setAttribute('aria-label', store.music ? 'Turn music off' : 'Turn music on'); } }
    function level() { if (!analyser) return 0; analyser.getByteFrequencyData(freq); var n = 24, sum = 0; for (var i = 1; i <= n; i++) sum += freq[i]; return Math.min(1, (sum / n) / 170); }
    function playing() { return !!(music && !music.paused && store.on && store.music); }
    return { ensure: ensure, play: play, say: say, store: store, apply: apply, syncUI: syncUI, started: function () { return started; }, level: level, playing: playing };
  })();
  sound.syncUI();
  on(document.getElementById('music-toggle'), 'click', function (e) { e.stopPropagation(); sound.ensure(); sound.store.music = !sound.store.music; sound.apply(); sound.play('click'); });
  function armSound() { if (sound.ensure()) { document.getElementById('sound').classList.add('ready'); } }
  on(window, 'pointerdown', armSound, { once: true }); on(window, 'keydown', armSound, { once: true });
  on(document.getElementById('sound-toggle'), 'click', function (e) { e.stopPropagation(); sound.ensure(); sound.store.on = !sound.store.on; sound.apply(); if (sound.store.on) sound.play('click'); });
  on(document.getElementById('sound-vol'), 'input', function (e) { sound.ensure(); sound.store.vol = e.target.value / 100; if (sound.store.vol > 0) sound.store.on = true; sound.apply(); });
  on(document.getElementById('sound-vol'), 'change', function () { sound.play('click'); });


  // ---------- The stereo: a 3D unit standing where the painted box was. Its lights follow the music. ----------
  var stereo = new THREE.Group(), stereoLevel = 0, stereoRings = [], stereoLight, stereoMeter;
  (function buildStereo() {
    if (!scene.getObjectByName('olex-lights')) { var la = new THREE.HemisphereLight(0xfff1dc, 0x3a3230, 1.1); la.name = 'olex-lights'; scene.add(la); var lb = new THREE.DirectionalLight(0xffd9b0, 0.9); lb.position.set(1, 3, 2); scene.add(lb); }
    var c0 = dirFromUV(1362 / 1536, 1 - 598 / 1024, 1), c1 = dirFromUV(1438 / 1536, 1 - 655 / 1024, 1), cc = dirFromUV(1400 / 1536, 1 - 630 / 1024, 1);
    var D = 3.2, angW = c0.angleTo(new THREE.Vector3(c1.x, c0.y, c1.z)), angH = c0.angleTo(new THREE.Vector3(c0.x, c1.y, c0.z));
    var W = 2 * D * Math.tan(angW / 2) * 1.28, H = 2 * D * Math.tan(angH / 2) * 1.15, Dp = W * 0.45;
    var body = new THREE.MeshStandardMaterial({ color: 0x040404, roughness: 0.95, metalness: 0 });
    var grille = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.9 });
    var ringMat = new THREE.MeshStandardMaterial({ color: 0x3f7a2c, emissive: 0x6fd14a, emissiveIntensity: 0.25 });
    stereo.add(new THREE.Mesh(new THREE.BoxGeometry(W, H, Dp), body));
    var top = new THREE.Mesh(new THREE.BoxGeometry(W * 1.02, H * 0.06, Dp * 1.02), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5, metalness: 0.3 })); top.position.y = H * 0.5; stereo.add(top);
    [-1, 1].forEach(function (side) {
      var cx = side * W * 0.32;
      var woof = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.30, H * 0.30, 0.01, 40), grille); woof.rotation.x = Math.PI / 2; woof.position.set(cx, -H * 0.08, Dp / 2 + 0.005); stereo.add(woof);
      var cone = new THREE.Mesh(new THREE.ConeGeometry(H * 0.22, 0.05, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.8, side: THREE.DoubleSide })); cone.rotation.x = -Math.PI / 2; cone.position.set(cx, -H * 0.08, Dp / 2 + 0.03); stereo.add(cone);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(H * 0.31, 0.006, 8, 48), ringMat.clone()); ring.position.set(cx, -H * 0.08, Dp / 2 + 0.012); stereo.add(ring); stereoRings.push(ring);
      var tw = new THREE.Mesh(new THREE.TorusGeometry(H * 0.09, 0.004, 8, 32), ringMat.clone()); tw.position.set(cx, H * 0.32, Dp / 2 + 0.012); stereo.add(tw); stereoRings.push(tw);
    });
    // centre display: track name + level meter
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; var ctx2 = cv.getContext('2d');
    var tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.LinearEncoding;
    stereoMeter = { cv: cv, ctx: ctx2, tex: tex };
    var disp = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.26, H * 0.36), new THREE.MeshBasicMaterial({ map: tex })); disp.position.set(0, 0.02, Dp / 2 + 0.008); stereo.add(disp);
    stereoLight = new THREE.PointLight(0x8fe36a, 0.0, W * 2.2, 2); stereoLight.position.set(0, -H * 0.9, Dp / 2 + 0.7); stereo.add(stereoLight);
    stereo.position.copy(cc).multiplyScalar(D); stereo.lookAt(0, stereo.position.y, 0); /* placeholder: not added to the room until the stereo is painted into the panorama */
  })();
  function drawMeter(level, playing) {
    var c = stereoMeter.ctx, W = 256, H = 128; c.fillStyle = '#050605'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#8fe36a'; c.font = '700 26px Manrope, sans-serif'; c.textBaseline = 'top'; c.textAlign = 'center'; c.fillText('UNLIMITED', W / 2, 14);
    c.fillStyle = 'rgba(143,227,106,.6)'; c.font = '500 14px Manrope, sans-serif'; c.fillText(playing ? 'Olexweb anthem  \u00b7  playing' : 'Olexweb anthem  \u00b7  paused', W / 2, 46);
    var bars = 14, bw = 12, gap = 4, x0 = (W - bars * (bw + gap)) / 2;
    for (var i = 0; i < bars; i++) { var v = playing ? Math.max(0, Math.min(1, level * (1.15 - Math.abs(i - bars / 2) / bars) + (Math.sin(i * 1.7 + performance.now() / 180) * 0.08))) : 0.06; c.fillStyle = i > bars * 0.8 ? '#ff9a5a' : '#8fe36a'; c.globalAlpha = 0.35 + v * 0.65; c.fillRect(x0 + i * (bw + gap), 116 - v * 44, bw, v * 44 + 2); }
    c.globalAlpha = 1; stereoMeter.tex.needsUpdate = true;
  }
  var meterTick = 0;
  function stepStereo(dt, t) {
    if (!stereo.parent) return;
    var playing = sound.playing(), target = playing ? sound.level() : 0;
    stereoLevel += (target - stereoLevel) * (target > stereoLevel ? 0.5 : 0.12);
    var breathe = 0.18 + Math.sin(t * 1.2) * 0.08, glow = playing ? Math.min(1.5, 0.35 + stereoLevel * 1.6) : breathe;
    stereoRings.forEach(function (r, i) { r.material.emissiveIntensity = glow * (i % 2 ? 0.7 : 1); r.scale.setScalar(1 + (playing ? stereoLevel * 0.06 : 0)); });
    stereoLight.intensity = playing ? 0.15 + stereoLevel * 1.6 : 0.05 + (breathe - 0.18) * 0.3;
    meterTick += dt; if (meterTick > 0.05) { meterTick = 0; drawMeter(stereoLevel, playing); }
  }


  // ---------- Olex's AI: modelled from the robot frames. Smooth white shell, glossy visor, lit eyes, dark lower shell with a green stripe, black base with a glowing ring, soft shadow. ----------
  var robot = new THREE.Group(), RB = 2.6, robotParts = {};
  try { (function buildRobot() {
    if (!scene.getObjectByName('olex-lights')) { var la = new THREE.HemisphereLight(0xfff1dc, 0x3a3230, 0.55); la.name = 'olex-lights'; scene.add(la); var lb = new THREE.DirectionalLight(0xffd9b0, 0.55); lb.position.set(-2, 3, 2); scene.add(lb); }
    var white = new THREE.MeshPhysicalMaterial({ color: 0xf1efe9, roughness: 0.28, metalness: 0.0, clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 0.9 });
    var darkShell = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.55, metalness: 0.1 });
    var visorMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.06, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2 });
    var green = new THREE.MeshStandardMaterial({ color: 0x7fd85a, emissive: 0x8fe36a, emissiveIntensity: 1.3 });
    // body profile (radius against height), lathed into a smooth capsule
    var pts = [];
    [[0.0, 0.11], [0.25, 0.11], [0.255, 0.16], [0.24, 0.30], [0.225, 0.44], [0.22, 0.60], [0.222, 0.80], [0.215, 0.92], [0.19, 1.02], [0.14, 1.09], [0.07, 1.13], [0.0, 1.14]].forEach(function (p) { pts.push(new THREE.Vector2(p[0], p[1])); });
    var shell = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), white); shell.castShadow = true; robot.add(shell);
    var lowerPts = []; [[0.0, 0.10], [0.252, 0.10], [0.258, 0.16], [0.245, 0.30], [0.232, 0.44], [0.0, 0.44]].forEach(function (p) { lowerPts.push(new THREE.Vector2(p[0], p[1])); });
    var lower = new THREE.Mesh(new THREE.LatheGeometry(lowerPts, 64), darkShell); lower.scale.set(1.012, 1, 1.012); robot.add(lower);
    var base = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.32, 0.10, 64), darkShell); base.position.y = 0.05; robot.add(base);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.007, 10, 80), green); ring.rotation.x = Math.PI / 2; ring.position.y = 0.105; robot.add(ring); robotParts.ring = ring;
    var ringGlow = new THREE.PointLight(0x8fe36a, 0.5, 1.2, 2); ringGlow.position.set(0, 0.12, 0); robot.add(ringGlow); robotParts.glow = ringGlow;
    // visor: a glossy black oval set into the front of the head
    var visor = new THREE.Mesh(new THREE.SphereGeometry(0.165, 40, 28), visorMat); visor.scale.set(1, 0.62, 0.45); visor.position.set(0, 0.96, 0.135); robot.add(visor);
    var eyeMat = new THREE.MeshStandardMaterial({ color: 0x8fe36a, emissive: 0x8fe36a, emissiveIntensity: 2.2 });
    var eyeL = new THREE.Mesh(new THREE.CircleGeometry(0.022, 24), eyeMat); eyeL.position.set(-0.055, 0.975, 0.207); robot.add(eyeL);
    var eyeR = new THREE.Mesh(new THREE.CircleGeometry(0.022, 24), eyeMat); eyeR.position.set(0.055, 0.975, 0.207); robot.add(eyeR);
    robotParts.eyes = [eyeL, eyeR];
    // green stripe on the side, small sensor on top
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.16, 0.014), green); stripe.position.set(0.215, 0.66, 0.08); stripe.rotation.y = 0.35; robot.add(stripe);
    var sensor = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 12), darkShell); sensor.position.set(-0.07, 1.14, 0.03); sensor.rotation.z = 0.25; robot.add(sensor);
    // "Olexweb" on the body, wrapped around the front
    var tcv = document.createElement('canvas'); tcv.width = 512; tcv.height = 96; var tc = tcv.getContext('2d');
    tc.fillStyle = '#1a1a1a'; tc.font = '700 46px Manrope, sans-serif'; tc.textAlign = 'center'; tc.textBaseline = 'middle'; tc.fillText('Olexweb', 256, 48);
    var ttex = new THREE.CanvasTexture(tcv); ttex.encoding = THREE.LinearEncoding;
    var label = new THREE.Mesh(new THREE.CylinderGeometry(0.224, 0.224, 0.07, 48, 1, true, -0.55, 1.1), new THREE.MeshBasicMaterial({ map: ttex, transparent: true })); label.position.y = 0.58; label.rotation.y = Math.PI; robot.add(label);
    var bcv = document.createElement('canvas'); bcv.width = 256; bcv.height = 48; var bc = bcv.getContext('2d'); bc.fillStyle = '#e9e6e0'; bc.font = '600 24px Manrope, sans-serif'; bc.textAlign = 'center'; bc.textBaseline = 'middle'; bc.fillText('Olexweb', 128, 24);
    var btex = new THREE.CanvasTexture(bcv); btex.encoding = THREE.LinearEncoding;
    var blabel = new THREE.Mesh(new THREE.CylinderGeometry(0.312, 0.312, 0.045, 48, 1, true, -0.4, 0.8), new THREE.MeshBasicMaterial({ map: btex, transparent: true })); blabel.position.y = 0.05; blabel.rotation.y = Math.PI; robot.add(blabel);
    // the face reads its words: a transparent layer over the visor
    var faceCv = document.createElement('canvas'); faceCv.width = 256; faceCv.height = 128; robotParts.faceCtx = faceCv.getContext('2d');
    var faceTex = new THREE.CanvasTexture(faceCv); faceTex.encoding = THREE.LinearEncoding; robotParts.faceTex = faceTex;
    var face = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true })); face.position.set(0, 0.955, 0.212); robot.add(face);
    // soft contact shadow on the rug
    var scv = document.createElement('canvas'); scv.width = 128; scv.height = 128; var sc = scv.getContext('2d');
    var g = sc.createRadialGradient(64, 64, 8, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.6, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); sc.fillStyle = g; sc.fillRect(0, 0, 128, 128);
    var stex = new THREE.CanvasTexture(scv);
    var shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshBasicMaterial({ map: stex, transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.set(0.06, 0.002, 0.03); robot.add(shadow);
  })(); } catch (e) { console.warn('robot build skipped', e); }
  var faceText = '', faceTimer = 0;
  function drawFace(text) {
    var c = robotParts.faceCtx; c.clearRect(0, 0, 256, 128);
    if (text) { c.fillStyle = '#8fe36a'; c.font = '600 19px Manrope, sans-serif'; c.textBaseline = 'top'; c.textAlign = 'center';
      var words = text.split(' '), line = '', y = 40, lines = []; for (var i = 0; i < words.length; i++) { var test = line + words[i] + ' '; if (c.measureText(test).width > 220 && line) { lines.push(line); line = words[i] + ' '; } else line = test; } lines.push(line);
      lines = lines.slice(0, 3); y = 64 - lines.length * 12; lines.forEach(function (l) { c.fillText(l.trim(), 128, y); y += 24; }); }
    robotParts.faceTex.needsUpdate = true;
    robotParts.eyes.forEach(function (e) { e.visible = !text; });
  }
  drawFace('');
  function robotSay(text, ms) { faceText = text; drawFace(text); clearTimeout(faceTimer); faceTimer = setTimeout(function () { faceText = ''; drawFace(''); }, ms || 4000); }
  // The floor: the camera stands at eye height, so every floor pixel in the photo is a real point on the plane below it.
  var EYE = 1.5;
  function floorPoint(px, py) { var d = dirFromUV(px / 1536, 1 - py / 1024, 1); if (d.y >= -0.05) d.y = -0.05; return d.multiplyScalar(-EYE / d.y); }
  // spots on the open rug only: clear of the print (right), the chair (left) and the shelf
  var spots = [[640, 712], [790, 732], [560, 790], [700, 768], [850, 724]].map(function (p) { return floorPoint(p[0], p[1]); });
  var rTarget = spots[0].clone(); robot.position.copy(rTarget); var rNext = 1, rWait = 0;
  robot.scale.setScalar(0.72); if (cfg.robot) scene.add(robot);   // about 0.85 m tall
  function stepRobot(dt, t) {
    if (!robot.parent) return;
    try {
    var d = rTarget.clone().sub(robot.position); var dist = d.length();
    if (dist > 0.01) { robot.position.addScaledVector(d.normalize(), Math.min(dist, 0.22 * dt)); }
    else if (state === 'idle' && focused !== 'robot') { rWait += dt; if (rWait > 6 + Math.random() * 6) { rWait = 0; rTarget.copy(spots[rNext]); rNext = (rNext + 1) % spots.length; } }
    var toCam = new THREE.Vector3().subVectors(camera.position, robot.position); var ang = Math.atan2(toCam.x, toCam.z); var dd = ang - robot.rotation.y; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); robot.rotation.y += dd * 0.04;
    robotParts.ring.material.emissiveIntensity = 1.1 + Math.sin(t * 2.2) * 0.3; robotParts.glow.intensity = 0.4 + Math.sin(t * 2.2) * 0.12;
    var blink = (t % 4.7) < 0.12; robotParts.eyes.forEach(function (e) { e.scale.y = blink ? 0.15 : 1; });
    } catch (e) {}
  }

  // The stereo: the painted box's front face re-skinned as a hi-fi front, in the box's own perspective; its rings follow the music
  var stereoFace = surface([[1363, 604], [1425, 607], [1425, 655], [1363, 655]], 640, 480, true);
  var stereoLvl = 0, stereoTick = 0;
  function drawStereo(level, playing, t) {
    var c = stereoFace.ctx, W = 640, H = 480;
    var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b1b1b'); g.addColorStop(0.5, '#0e0e0e'); g.addColorStop(1, '#070707'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    // brushed strip along the top, seam at the bottom
    var s2 = c.createLinearGradient(0, 0, 0, 26); s2.addColorStop(0, '#3a3a3a'); s2.addColorStop(1, '#161616'); c.fillStyle = s2; c.fillRect(0, 0, W, 26);
    c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, 26, W, 2);
    // fine grille
    c.fillStyle = 'rgba(0,0,0,.35)'; for (var y = 40; y < H - 16; y += 6) c.fillRect(24, y, W - 48, 2);
    var glow = playing ? Math.min(1, 0.25 + level * 1.1) : 0.12 + Math.sin(t * 1.2) * 0.05;
    [[150, 262], [490, 262]].forEach(function (p) {
      var rr = 118;
      var sh = c.createRadialGradient(p[0], p[1], rr * 0.2, p[0], p[1], rr); sh.addColorStop(0, '#0a0a0a'); sh.addColorStop(0.55, '#141414'); sh.addColorStop(0.85, '#050505'); sh.addColorStop(1, '#222'); c.fillStyle = sh; c.beginPath(); c.arc(p[0], p[1], rr, 0, 7); c.fill();
      c.lineWidth = 6; c.strokeStyle = '#2b2b2b'; c.beginPath(); c.arc(p[0], p[1], rr - 3, 0, 7); c.stroke();
      c.lineWidth = 3; c.strokeStyle = 'rgba(143,227,106,' + glow.toFixed(2) + ')'; c.shadowColor = '#8fe36a'; c.shadowBlur = playing ? 8 + level * 26 : 4; c.beginPath(); c.arc(p[0], p[1], rr - 12 - (playing ? level * 3 : 0), 0, 7); c.stroke(); c.shadowBlur = 0;
      var cone = c.createRadialGradient(p[0] - 10, p[1] - 10, 4, p[0], p[1], rr * 0.6); cone.addColorStop(0, '#1e1e1e'); cone.addColorStop(1, '#090909'); c.fillStyle = cone; c.beginPath(); c.arc(p[0], p[1], rr * 0.58, 0, 7); c.fill();
      c.fillStyle = '#0d0d0d'; c.beginPath(); c.arc(p[0], p[1], rr * 0.16, 0, 7); c.fill();
    });
    // centre display
    c.fillStyle = '#050605'; c.fillRect(268, 150, 104, 224); c.strokeStyle = '#2a2a2a'; c.lineWidth = 2; c.strokeRect(268, 150, 104, 224);
    c.fillStyle = '#8fe36a'; c.font = '700 22px Manrope, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText('UNLIMITED', 320, 164);
    c.fillStyle = 'rgba(143,227,106,.55)'; c.font = '500 12px Manrope, sans-serif'; c.fillText(playing ? 'playing' : 'paused', 320, 192);
    for (var i = 0; i < 10; i++) { var v = playing ? Math.max(0.05, Math.min(1, level * (1.2 - i / 14) + Math.sin(i * 2.1 + t * 7) * 0.06)) : 0.05; c.fillStyle = i > 7 ? '#ff9a5a' : '#8fe36a'; c.globalAlpha = 0.3 + v * 0.7; c.fillRect(284 + i * 8, 356 - v * 130, 6, v * 130); }
    c.globalAlpha = 1;
    // the light of the room falls from the left
    var lit = c.createLinearGradient(0, 0, W, 0); lit.addColorStop(0, 'rgba(255,225,190,.10)'); lit.addColorStop(0.5, 'rgba(0,0,0,0)'); lit.addColorStop(1, 'rgba(0,0,0,.28)'); c.fillStyle = lit; c.fillRect(0, 0, W, H);
    stereoFace.tex.needsUpdate = true;
  }
  try { drawStereo(0, false, 0); } catch (e) { console.warn('stereo face skipped', e); }
  function stepStereoFace(dt, t) {
    try {
    var playing = sound.playing(), target = playing ? sound.level() : 0;
    stereoLvl += (target - stereoLvl) * (target > stereoLvl ? 0.5 : 0.12);
    stereoTick += dt; if (stereoTick > 0.066) { stereoTick = 0; drawStereo(stereoLvl, playing, t); }
    } catch (e) {}
  }

  // Laptop: crisp text
  var lap = surface([[439, 487], [497, 489], [497, 533], [439, 535]], 512, 400, true);
  // TV: teaching
  var tvS = surface([[1282.5, 414], [1468.3, 398.2], [1469.5, 541.2], [1286, 524.5]], 1024, 720, true);
  var markImg = SURF.mark ? loadImg(SURF.mark, function () { drawStatic(); }) : null;
  // Portrait in the frame
  var por = surface([[1174.5, 293.5], [1229.5, 273], [1230.5, 407], [1175, 412.5]], 440, 1000, false);
  var PHOTOS = 7, photoIdx = 0, photoImgs = {};
  for (var pi = 1; pi <= PHOTOS; pi++) (function (k) { if (SURF['photo_' + k]) photoImgs[k] = loadImg(SURF['photo_' + k], function () { if (k === 1) drawPortrait(); }); })(pi);
  function drawPortrait() {
    var im = photoImgs[photoIdx + 1], c = por.ctx, W = por.cv.width, H = por.cv.height; if (!im || !im.complete) return;
    c.fillStyle = '#ece7db'; c.fillRect(0, 0, W, H);
    var m = Math.round(W * 0.07), iw = W - m * 2, ih = H - m * 2;
    var sc = Math.max(iw / im.naturalWidth, ih / im.naturalHeight), w = im.naturalWidth * sc, h = im.naturalHeight * sc;
    c.save(); c.beginPath(); c.rect(m, m, iw, ih); c.clip(); c.drawImage(im, m + (iw - w) / 2, m + (ih - h) / 2, w, h); c.restore();
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(m, m, iw, 3);
    por.tex.needsUpdate = true;
    var cap = document.getElementById('gallery-caption'); if (cap) cap.textContent = 'Olaitan Adebayo  \u00b7  ' + (photoIdx + 1) + ' / ' + PHOTOS;
  }
  function drawStatic() {
    var c = lap.ctx, W = lap.cv.width, H = lap.cv.height;
    c.fillStyle = '#0c0e0c'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#eceae4'; c.font = '700 52px Manrope, sans-serif'; c.textBaseline = 'top';
    ['Build.', 'Design.', 'Ship.', 'Repeat.'].forEach(function (l, i) { c.fillText(l, 40, 44 + i * 66); });
    c.fillStyle = '#8fe36a'; c.font = '600 20px Manrope, sans-serif'; c.fillText('olexweb.com', 40, H - 44);
    lap.tex.needsUpdate = true;
    c = tvS.ctx; W = tvS.cv.width; H = tvS.cv.height; var EVP = cfg.events[0];
    c.fillStyle = '#0a0b0a'; c.fillRect(0, 0, W, H);
    var g = c.createRadialGradient(W * 0.5, H * 0.45, 40, W * 0.5, H * 0.45, W * 0.6); g.addColorStop(0, 'rgba(143,227,106,.10)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (markImg && markImg.complete) c.drawImage(markImg, W / 2 - 55, H * 0.16, 110, 125);
    c.fillStyle = '#f2efe9'; c.textAlign = 'center'; c.textBaseline = 'top';
    c.font = '700 64px Manrope, sans-serif'; c.fillText('Learn with Olexweb', W / 2, H * 0.40);
    c.fillStyle = 'rgba(242,239,233,.72)'; c.font = '500 30px Manrope, sans-serif'; c.fillText('Web, products, thinking. Taught as it is learned.', W / 2, H * 0.52);
    c.fillStyle = 'rgba(143,227,106,.14)'; c.fillRect(0, H - 118, W, 118);
    c.fillStyle = '#8fe36a'; c.font = '600 20px Manrope, sans-serif'; c.textAlign = 'left'; c.fillText('UPCOMING EVENT', 56, H - 96);
    c.fillStyle = '#f2efe9'; c.font = '700 36px Manrope, sans-serif'; c.fillText(EVP.title, 56, H - 68);
    c.fillStyle = 'rgba(242,239,233,.6)'; c.font = '500 20px Manrope, sans-serif'; c.textAlign = 'right'; c.fillText(EVP.status, W - 56, H - 56); c.textAlign = 'left';
    c.textAlign = 'left'; tvS.tex.needsUpdate = true;
  }
  var DEBUG = /debugsurf/.test(location.search), DOTS = /debugdots/.test(location.search), dotEls = [];
  if (DOTS) { surfaces.forEach(function (sf) { sf.mesh.visible = false; });
    [[1300,398],[1468,404],[1468,528],[1300,534],[206,432],[428,438],[428,530],[206,542],[437,485],[500,486],[500,535],[437,536]].forEach(function (c) {
      var d = document.createElement('div'); d.style.cssText = 'position:fixed;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;background:#f0f;z-index:50;pointer-events:none'; document.body.appendChild(d); dotEls.push({ el: d, dir: dirFromUV(c[0] / 1536, 1 - c[1] / 1024, 1) }); }); }
  drawStatic();
  if (DEBUG) surfaces.forEach(function (sf) { sf.ctx.fillStyle = 'rgba(255,0,255,.7)'; sf.ctx.fillRect(0, 0, sf.cv.width, sf.cv.height); sf.tex.needsUpdate = true; });
  function waMsg(text) { return cfg.contact.whatsapp.replace(/text=.*$/, 'text=' + encodeURIComponent('Hi Olexweb, ' + text)); }
  // Every card carries its own way in. Where a thing can be learnt or ordered, both are offered and the message says which.
  var CTAS = {
    tv: function (it) { return it.label === 'Events' ? null : [{ label: 'Learn this', link: waMsg('I want to learn ' + it.title + '.') }, { label: 'Order as a service', link: waMsg('I want to order ' + it.title + ' as a service for my business.') }]; },
    laptop: function (it) { return [{ label: 'Order this service', link: waMsg('I want to order ' + it.title + '. Here is what I need: ') }, { label: 'Ask a question', link: waMsg('I have a question about ' + it.title + ': ') }]; },
    monitors: function (it) { return [{ label: 'Build something like this', link: waMsg('I want a website like ' + it.title + '. Here is what I do: ') }]; },
    wall: function (it) { return it.label === 'Next' ? null : [{ label: 'Partner or collaborate', link: waMsg('I want to talk about ' + it.title + ': ') }]; },
    notebook: function (it) { return [{ label: 'Talk about this idea', link: waMsg('I want to talk about ' + it.title + ' with you: ') }]; },
    window: function (it) { return [{ label: 'Start a project', link: waMsg('I want to start a project with Olexweb. The idea: ') }]; },
    speaker: function (it) { return null; },
    shelf: function (it) { return [{ label: 'Learn this', link: waMsg('I want to learn more about "' + it.title + '".') }, { label: 'Order as a service', link: waMsg('I want to order help with "' + it.title + '" for my business.') }]; }
  };
  var byId = {}, markers = document.getElementById('markers');
  hotspots.forEach(function (h) {
    byId[h.id] = h;
    if (CTAS[h.id] && h.items) h.items.forEach(function (it) { if (!it.ctas && !it.say) it.ctas = CTAS[h.id](it); });
    h.dir = dirFromUV(h.px / 1536, 1 - h.py / 1024, 1);
    h.yaw = Math.atan2(h.dir.x, -h.dir.z); h.pitch = Math.asin(h.dir.y);
    var el = document.createElement('button'); el.type = 'button'; el.className = 'marker'; el.setAttribute('aria-label', h.title);
    el.innerHTML = '<i></i><span>' + h.title + '</span>';
    if (h.toggle) el.classList.add('switch');
    el.addEventListener('click', function (e) { e.stopPropagation(); if (dragMoved) return; if (h.toggle) { setNight(!night); return; } if (state === 'idle' || (state === 'focus' && focused !== h.id)) nav({ s: 'object', id: h.id }, true); });
    markers.appendChild(el); h.el = el;
  });

  // screen point -> panorama pixel (inverse of the non-linear yaw mapping), for area hit-testing
  function uFromYaw(yaw) { var lo = 0, hi = 1; for (var i = 0; i < 30; i++) { var mid = (lo + hi) / 2; if (yawFromU(mid) < yaw) lo = mid; else hi = mid; } return (lo + hi) / 2; }
  var unp = new THREE.Vector3();
  function pixelAt(cx, cy) {
    unp.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1, 0.5).unproject(camera).normalize();
    var yaw = Math.atan2(unp.x, -unp.z), pitch = Math.asin(THREE.MathUtils.clamp(unp.y, -1, 1));
    return { x: uFromYaw(yaw) * 1536, y: (1 - (pitch / THETA + 0.5)) * 1024 };
  }
  var rayc = new THREE.Raycaster(), rayNdc = new THREE.Vector2();
  function robotAt(cx, cy) {
    if (typeof robot === 'undefined' || !robot.parent) return null;
    rayNdc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1); rayc.setFromCamera(rayNdc, camera);
    return rayc.intersectObject(robot, true).length ? byId.robot : null;
  }
  function objectAt(cx, cy) {
    var rb = robotAt(cx, cy); if (rb) return rb;
    var p = pixelAt(cx, cy), best = null, bestArea = 1e12;
    hotspots.forEach(function (h) { var r = h.rect; if (p.x >= r[0] && p.x <= r[2] && p.y >= r[1] && p.y <= r[3]) { var a = (r[2] - r[0]) * (r[3] - r[1]); if (a < bestArea) { best = h; bestArea = a; } } });
    return best;
  }
  var hilite = document.getElementById('hilite'), hiliteLabel = document.getElementById('hilite-label'), hovered = null;
  function setHover(h, cx, cy) {
    hovered = h; canvas.style.cursor = h ? 'pointer' : '';
    if (!h) { hilite.style.opacity = 0; hiliteLabel.classList.remove('on'); return; }
    var r = h.rect, pts = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]], out = [], ok = true;
    pts.forEach(function (q) { var p = project(dirFromUV(q[0] / 1536, 1 - q[1] / 1024, 1)); if (p.behind) ok = false; out.push(p.x.toFixed(1) + ',' + p.y.toFixed(1)); });
    hilite.querySelector('polygon').setAttribute('points', out.join(' ')); hilite.style.opacity = ok ? 1 : 0;
    hiliteLabel.textContent = h.toggle ? (night ? 'Lights on' : 'Lights off') : h.title; hiliteLabel.classList.add('on');
    var lw = hiliteLabel.offsetWidth || 120, lx = Math.min(cx + 16, window.innerWidth - lw - 8), ly = Math.min(cy + 18, window.innerHeight - 40);
    hiliteLabel.style.transform = 'translate(' + lx + 'px,' + ly + 'px)';
  }

  // ---------- Tween ----------
  var tweens = [];
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function tween(obj, to, ms, onUpdate, onDone) {
    var from = {}; for (var k in to) from[k] = obj[k];
    var tw = { obj: obj, from: from, to: to, ms: Math.max(ms, 1), start: performance.now(), onUpdate: onUpdate, onDone: onDone, dead: false };
    tweens.push(tw); return tw;
  }
  function stepTweens(now) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i]; if (tw.dead) { tweens.splice(i, 1); continue; }
      var t = Math.min(1, (now - tw.start) / tw.ms), e = easeInOut(t);
      for (var k in tw.to) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
      if (tw.onUpdate) tw.onUpdate(e);
      if (t >= 1) { tw.dead = true; tweens.splice(i, 1); if (tw.onDone) tw.onDone(); }
    }
  }

  // ---------- View: the visitor owns the camera ----------
  var BASE_FOV = 60;
  var view = { yaw: Math.PI - 0.6, pitch: 0.05, fov: 44 };
  var vel = { yaw: 0, pitch: 0 };
  var state = 'arrival', focused = null, camTween = null;
  var drag = { on: false, x: 0, y: 0, lx: 0, ly: 0, t: 0 }, dragMoved = false;
  var keys = { left: false, right: false, up: false, down: false };
  function pitchLimit() { var vFov = THREE.MathUtils.degToRad(camera.fov); return Math.max(0.03, THETA / 2 - vFov / 2 - 0.02); }
  var overviewBtn;
  function wrapTo(target, from) { var d = target - from; return from + Math.atan2(Math.sin(d), Math.cos(d)); }
  function aimAt(yaw, pitch, fov, ms, onDone) {
    yaw = wrapTo(yaw, view.yaw); vel.yaw = vel.pitch = 0; if (ms > 300 && state !== 'arrival') sound.play('whoosh');
    if (camTween) camTween.dead = true;
    camTween = tween(view, { yaw: yaw, pitch: pitch, fov: fov }, reduceMotion ? 0 : ms, null, function () { camTween = null; if (onDone) onDone(); });
  }
  function stopCameraTween() { if (camTween) { camTween.dead = true; camTween = null; } }

  // ---------- UI ----------
  var $ = function (id) { return document.getElementById(id); };
  var ui = { veil: $('veil'), skip: $('skip'), caption: $('caption'), back: $('back'), ask: $('ask'), hint: $('hint'), shade: $('shade'),
             orbit: $('orbit'), ring: $('orbit-ring'), col: $('orbit-col'), head: $('orbit-head'), items: $('orbit-items'), detail: $('orbit-detail'),
             dTitle: $('d-title'), dText: $('d-text'), dLink: $('d-link'), dBack: $('d-back'), dClose: $('d-close') };
  function showCaption(text, ms) { ui.caption.textContent = text; ui.caption.classList.add('on'); clearTimeout(showCaption.t); showCaption.t = setTimeout(function () { ui.caption.classList.remove('on'); }, ms || 3200); }

  var activeBtn = null, activeIndex = -1;
  function buildOrbit(h) {
    ui.head.innerHTML = '<strong>' + h.title + '</strong><span>' + h.hint + '</span><button type="button" class="x hx" aria-label="Close">×</button>';
    ui.head.querySelector('.hx').addEventListener('click', function (e) { e.stopPropagation(); nav({ s: 'room' }, true); });
    ui.items.innerHTML = '';
    h.items.forEach(function (it, idx) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'item'; b.style.transitionDelay = (idx * 70) + 'ms';
      b.innerHTML = '<i>' + ICON[it.icon] + '</i><span>' + it.label + '</span>';
      b.addEventListener('click', function (e) { e.stopPropagation(); sound.play('click'); if (it.say) runIntent(it); else nav({ s: 'item', id: h.id, i: idx }, true); });
      ui.items.appendChild(b);
    });
    closeDetail();
  }
  function runIntent(it) {
    showCaption(it.say, 4200); robotSay(it.say, 4200); sound.say(it.say); robotSay(it.say, 4200);
    if (it.go) { var go = it.go; setTimeout(function () { nav({ s: 'object', id: go }, true); }, 700); }
  }
  function openItem(h, idx) {
    var it = h.items[idx], btn = ui.items.children[idx]; if (!it || !btn) return;
    Array.prototype.forEach.call(ui.items.children, function (c) { c.classList.remove('active'); });
    btn.classList.add('active'); activeBtn = btn; activeIndex = idx;
    ui.detail.classList.remove('on'); void ui.detail.offsetWidth;
    ui.dTitle.textContent = it.title; ui.dText.textContent = it.text; ui.dText.scrollTop = 0;
    ui.detail.classList.toggle('lyrics', !!it.lyrics);
    if (it.lyrics) { var html = ''; it.lyrics.forEach(function (sec) { html += '<b>' + sec[0] + '</b>' + sec[1].map(function (l) { return '<span>' + l + '</span>'; }).join(''); }); ui.dText.innerHTML = html; }
    if (it.cta) {
      ui.dLink.style.display = ''; ui.dLink.textContent = it.cta; ui.dLink.href = it.link || '#';
      ui.dLink.target = /^https?:/.test(it.link || '') ? '_blank' : ''; ui.dLink.rel = 'noopener';
      if (it.toPhone) ui.dLink.href = '/contact';
      ui.dLink.onclick = it.toPhone ? function (e) { e.preventDefault(); nav({ s: 'object', id: 'phone' }, true); }
                       : (it.link && it.link.charAt(0) === '#' ? function (e) { e.preventDefault(); showCaption('Coming soon: ' + it.title + '.'); } : null);
      if (it.live) ui.dLink.onclick = function (e) { e.preventDefault(); expandLive(true); };
      if (it.music) ui.dLink.onclick = function (e) { e.preventDefault(); sound.ensure(); sound.store.music = !sound.store.music; if (sound.store.music) sound.store.on = true; sound.apply(); sound.play('click'); };
      if (it.book) { ui.dLink.onclick = function (e) { e.preventDefault(); if (cfg.onReadArticle) cfg.onReadArticle(it.book.slug); }; }
    } else ui.dLink.style.display = 'none';
    if (it.site) { monState.i = SITES.map(function (x) { return x.key; }).indexOf(it.site); monState.t0 = performance.now(); monState.hold = true; if (it.live) showLive(it.site); else hideLive(); }
    var ctas = document.getElementById('d-ctas'); ctas.innerHTML = '';
    if (it.ctas) it.ctas.forEach(function (c) { var a = document.createElement('a'); a.className = 'cta2'; a.href = c.link; a.target = '_blank'; a.rel = 'noopener'; a.textContent = c.label; ctas.appendChild(a); });
    if (it.book) openBook(it.book); else closeBook();
    placeOrbit(); ui.detail.classList.add('on');
  }
  function closeDetail() {
    hideLive(); monState.hold = false; closeBook();
    ui.detail.classList.remove('on'); activeBtn = null; activeIndex = -1;
    Array.prototype.forEach.call(ui.items.children, function (c) { c.classList.remove('active'); });
  }

  // The interface measures the screen every frame and sits where there is room.
  var colW = 230, detailW = 290, gap = 52, gap2 = 40, margin = 14;
  function hintScroll(el, host) { if (!el || !host) return; host.classList.toggle('has-more', el.scrollHeight - el.scrollTop - el.clientHeight > 6); }
  function placeOrbit() {
    hintScroll(ui.items, ui.col); hintScroll(ui.dText, ui.detail);
    if (!focused) return;
    var W = window.innerWidth, H = window.innerHeight, mobile = W <= 720;
    var p = project(byId[focused].dir);
    ui.orbit.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)';
    ui.shade.style.setProperty('--cx', p.x.toFixed(0) + 'px'); ui.shade.style.setProperty('--cy', p.y.toFixed(0) + 'px');
    var cw = mobile ? 150 : colW, g = mobile ? 32 : gap;
    var needRight = g + cw + (mobile ? 0 : gap2 + detailW) + margin, needLeft = needRight;
    var roomRight = W - p.x, roomLeft = p.x;
    var flip;
    if (roomRight >= needRight) flip = false; else if (roomLeft >= needLeft) flip = true; else flip = roomLeft > roomRight;
    ui.orbit.classList.toggle('flip', flip);
    // keep the column inside the viewport horizontally and vertically
    var colH = Math.min(ui.col.offsetHeight, H - 2 * (margin + 56)), top = p.y - colH / 2, dy = 0;
    if (top < margin + 56) dy = (margin + 56) - top; else if (top + colH > H - margin - 56) dy = (H - margin - 56) - (top + colH);
    var dx = 0, colLeft = flip ? p.x - g - cw : p.x + g;
    if (colLeft < margin) dx = margin - colLeft; else if (colLeft + cw > W - margin) dx = (W - margin) - (colLeft + cw);
    ui.col.style.transform = 'translate(' + dx.toFixed(1) + 'px, calc(-50% + ' + dy.toFixed(1) + 'px))';
    ui.col.style.setProperty('--cy', 'calc(50% - ' + dy.toFixed(1) + 'px)'); ui.col.style.setProperty('--lw', Math.max(8, g + (flip ? -dx : dx)).toFixed(1) + 'px');
    // detail card: beside the active item, on the side with room, clamped to the viewport
    ui.detail.classList.toggle('flip', flip);
    if (!activeBtn) return;
    if (mobile) { ui.detail.style.left = ui.detail.style.top = ''; return; }
    var r = activeBtn.getBoundingClientRect(), dW = ui.detail.offsetWidth, dH = ui.detail.offsetHeight;
    var left = flip ? r.left - gap2 - dW : r.right + gap2;
    if (!flip && left + dW > W - margin && r.left - gap2 - dW >= margin) { left = r.left - gap2 - dW; ui.detail.classList.add('flip'); }
    else if (flip && left < margin && r.right + gap2 + dW <= W - margin) { left = r.right + gap2; ui.detail.classList.remove('flip'); }
    left = Math.max(margin, Math.min(W - margin - dW, left));
    var cy = r.top + r.height / 2; cy = Math.max(margin + dH / 2, Math.min(H - margin - dH / 2, cy));
    ui.detail.style.left = left + 'px'; ui.detail.style.top = cy + 'px';
  }

  function focusObject(id) {
    document.documentElement.classList.add('is-focus');
    var h = byId[id]; if (!h) return;
    if (state === 'focus' && focused === id) { closeDetail(); return; }
    focused = id; state = 'focus'; setHover(null); overviewBtn.classList.remove('on');
    markers.classList.add('off'); ui.hint.classList.remove('on'); ui.back.classList.add('on');
    if (h.gallery) { closeDetail(); ui.items.innerHTML = ''; } else buildOrbit(h); ui.orbit.classList.remove('on');
    aimAt(h.yaw, THREE.MathUtils.clamp(h.pitch, -pitchLimit(), pitchLimit()), h.fov, 1500, function () {
      if (focused !== id) return;
      if (h.gallery) { showGallery(); ui.shade.classList.add('on'); return; }
      placeOrbit(); ui.orbit.classList.add('on'); ui.shade.classList.add('on');
      if (h.ask) { showCaption('Ask me anything about the studio.', 2600); robotSay('Ask me anything.', 2600); }
    });
  }
  function returnToRoom() {
    document.documentElement.classList.remove('is-focus');
    if (state !== 'focus') return;
    state = 'idle'; focused = null; overviewBtn.classList.add('on');
    ui.orbit.classList.remove('on'); ui.shade.classList.remove('on'); closeDetail(); hideGallery(); ui.back.classList.remove('on');
    aimAt(view.yaw, THREE.MathUtils.clamp(view.pitch, -0.35, 0.35), BASE_FOV, 1200);
    setTimeout(function () { if (state === 'idle') markers.classList.remove('off'); }, 600);
  }

  // ---------- Navigation: room → object → item, one step at a time, mirrored in browser history ----------
  function nav(to, push) {
    if (push) history.pushState(to, '', to.s === 'room' ? location.pathname : '#' + to.id + (to.s === 'item' ? '/' + to.i : ''));
    if (to.s === 'room') { returnToRoom(); return; }
    if (to.s === 'object') { if (focused !== to.id) focusObject(to.id); else closeDetail(); return; }
    if (to.s === 'item') {
      var h = byId[to.id];
      if (focused !== to.id) { focusObject(to.id); var wait = setInterval(function () { if (ui.orbit.classList.contains('on') && focused === to.id) { clearInterval(wait); openItem(h, to.i); } }, 60); }
      else openItem(h, to.i);
    }
  }
  function stepBack() { if (state === 'focus') history.back(); }
  on(window, 'popstate', function (e) { var st = e.state || { s: 'room' }; nav(st, false); });
  var startHash = (location.hash || '').slice(1);
  history.replaceState({ s: 'room' }, '', location.pathname);
  ui.back.addEventListener('click', function () { nav({ s: 'room' }, true); });
  ui.dBack.addEventListener('click', stepBack);
  ui.dClose.addEventListener('click', stepBack);
  ui.ask.addEventListener('click', function () { if (state === 'arrival') return; if (focused === 'robot') return; nav({ s: 'object', id: 'robot' }, true); });
  on(document, 'keydown', function (e) {
    if (e.key === 'Escape') stepBack();
    if (galleryOn && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); stepPhoto(e.key === 'ArrowRight' ? 1 : -1); return; }
    if (e.key === 'ArrowLeft') keys.left = true; if (e.key === 'ArrowRight') keys.right = true; if (e.key === 'ArrowUp') keys.up = true; if (e.key === 'ArrowDown') keys.down = true;
  });
  on(document, 'keyup', function (e) {
    if (e.key === 'ArrowLeft') keys.left = false; if (e.key === 'ArrowRight') keys.right = false; if (e.key === 'ArrowUp') keys.up = false; if (e.key === 'ArrowDown') keys.down = false;
  });

  // ---------- Input: drag to look; release and it settles ----------
  on(window, 'pointerdown', function (ev) {
    if (state === 'arrival') return;
    if (ev.target.closest && ev.target.closest('button, a, input, #sound, #orbit, #orbit-detail, #live, #gallery, #book')) return;
    drag.on = true; dragMoved = false; drag.x = drag.lx = ev.clientX; drag.y = drag.ly = ev.clientY; drag.t = performance.now();
    vel.yaw = vel.pitch = 0; stopCameraTween();
  });
  var lastPointer = { x: 0, y: 0 };
  on(window, 'pointermove', function (ev) {
    lastPointer.x = ev.clientX; lastPointer.y = ev.clientY;
    if (!drag.on) { if (state !== 'arrival' && !bookOpen && !(ev.target.closest && ev.target.closest('button, a, input, #sound, #orbit, #orbit-detail, #live, #gallery, #book'))) setHover(objectAt(ev.clientX, ev.clientY), ev.clientX, ev.clientY); else setHover(null); return; }
    setHover(null);
    var now = performance.now(), dt = Math.max(8, now - drag.t) / 1000;
    var k = THREE.MathUtils.degToRad(camera.fov) / window.innerHeight;     // one screen pixel = one image pixel of turn
    var dyaw = -(ev.clientX - drag.lx) * k, dpitch = (ev.clientY - drag.ly) * k;
    view.yaw += dyaw; view.pitch = THREE.MathUtils.clamp(view.pitch + dpitch, -pitchLimit(), pitchLimit());
    vel.yaw = dyaw / dt; vel.pitch = dpitch / dt;
    drag.lx = ev.clientX; drag.ly = ev.clientY; drag.t = now;
    if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) > 4) dragMoved = true;
  });
  function endDrag() { if (!drag.on) return; drag.on = false; if (performance.now() - drag.t > 80) vel.yaw = vel.pitch = 0; setTimeout(function () { dragMoved = false; }, 0); }
  on(window, 'pointerup', endDrag); on(window, 'pointercancel', endDrag);
  canvas.addEventListener('click', function (ev) {
    if (dragMoved || state === 'arrival') return;
    var h = objectAt(ev.clientX, ev.clientY); if (!h) return;
    if (h.toggle) { setNight(!night); setHover(h, ev.clientX, ev.clientY); return; }
    if (state === 'idle' || (state === 'focus' && focused !== h.id)) nav({ s: 'object', id: h.id }, true);
  });
  // third lens: scroll or pinch between the standing view and a wide overview
  var OVERVIEW_FOV = 82;
  function zoomTo(fov, ms) { if (state !== 'idle') return; stopCameraTween(); tween(view, { fov: fov }, reduceMotion ? 0 : (ms || 700)); }
  on(window, 'wheel', function (ev) {
    if (state !== 'idle' || (ev.target.closest && ev.target.closest('#orbit, #orbit-detail'))) return;
    ev.preventDefault(); stopCameraTween();
    view.fov = THREE.MathUtils.clamp(view.fov + ev.deltaY * 0.04, BASE_FOV - 12, OVERVIEW_FOV);
  }, { passive: false });
  var pinch = null;
  on(window, 'touchstart', function (ev) { if (ev.touches.length === 2) { pinch = { d: Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY), fov: view.fov }; drag.on = false; } }, { passive: true });
  on(window, 'touchmove', function (ev) { if (pinch && ev.touches.length === 2 && state === 'idle') { var d = Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY); view.fov = THREE.MathUtils.clamp(pinch.fov * pinch.d / d, BASE_FOV - 12, OVERVIEW_FOV); } }, { passive: true });
  on(window, 'touchend', function () { pinch = null; });
  overviewBtn = document.getElementById('overview');
  overviewBtn.addEventListener('click', function () { if (state !== 'idle') return; zoomTo(view.fov > (BASE_FOV + OVERVIEW_FOV) / 2 ? BASE_FOV : OVERVIEW_FOV, 900); });
  function fit() {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    BASE_FOV = camera.aspect < 0.8 ? 78 : (camera.aspect < 1.2 ? 68 : 60);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  on(window, 'resize', fit); fit();

  // ---------- Arrival ----------
  function beginIdle() {
    state = 'idle'; ui.skip.classList.remove('on'); ui.ask.classList.add('on'); overviewBtn.classList.add('on'); ui.hint.classList.add('on'); markers.classList.remove('off');
    showCaption('Welcome to Olexweb.', 3000); robotSay('Welcome to Olexweb.', 3000);
    setTimeout(function () { ui.hint.classList.remove('on'); }, 9000);
    var m = startHash.split('/');
    if (byId[m[0]]) setTimeout(function () { nav({ s: 'object', id: m[0] }, true); if (m[1] !== undefined) setTimeout(function () { nav({ s: 'item', id: m[0], i: +m[1] }, true); }, 1700); }, 600);
  }
  function arrival() {
    if (reduceMotion) { view.yaw = 0; view.pitch = 0.02; view.fov = BASE_FOV; ui.veil.classList.add('off'); beginIdle(); return; }
    ui.skip.classList.add('on');
    setTimeout(function () { ui.veil.classList.add('off'); }, 400);
    setTimeout(function () { aimAt(-0.05, 0.02, BASE_FOV, 8000, beginIdle); }, 900);
  }
  ui.skip.addEventListener('click', function () {
    if (state !== 'arrival') return;
    stopCameraTween(); view.yaw = 0; view.pitch = 0.02; view.fov = BASE_FOV; ui.veil.classList.add('off'); beginIdle();
  });

  // ---------- Loop ----------
  var proj = new THREE.Vector3(), lastFrame = performance.now(), t0 = performance.now();
  function project(dir) { proj.copy(dir).multiplyScalar(R * 0.98).project(camera); return { x: (proj.x + 1) / 2 * window.innerWidth, y: (1 - proj.y) / 2 * window.innerHeight, vis: proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1, behind: proj.z >= 1 || Math.abs(proj.x) > 4 || Math.abs(proj.y) > 4 }; }
  function frame() {
    try { frameBody(); } catch (e) { if (!frame.warned) { frame.warned = true; console.warn('frame error', e); } }
    rafId = requestAnimationFrame(frame);
  }
  function frameBody() {
    var now = performance.now(), dt = Math.min(0.05, (now - lastFrame) / 1000), t = (now - t0) / 1000; lastFrame = now;
    stepTweens(now);
    if (state !== 'arrival' && !camTween) {
      var kr = 1.2 * dt;                                           // arrow keys
      if (keys.left) view.yaw -= kr; if (keys.right) view.yaw += kr;
      if (keys.up) view.pitch += kr * 0.6; if (keys.down) view.pitch -= kr * 0.6;
      if (!drag.on) {                                              // settle after release
        view.yaw += vel.yaw * dt; view.pitch += vel.pitch * dt;
        var f = Math.pow(0.001, dt);                               // ~99.9% gone in a second
        vel.yaw *= f; vel.pitch *= f; if (Math.abs(vel.yaw) < 0.002) vel.yaw = 0; if (Math.abs(vel.pitch) < 0.002) vel.pitch = 0;
      }
      view.pitch = THREE.MathUtils.clamp(view.pitch, -pitchLimit(), pitchLimit());
    }
    camera.fov = view.fov; camera.updateProjectionMatrix();
    camera.rotation.set(0, 0, 0); camera.rotation.order = 'YXZ'; camera.rotation.y = -view.yaw; camera.rotation.x = view.pitch;
    var edge = Math.abs(view.pitch) / pitchLimit();
    document.getElementById('edge').style.opacity = state === 'focus' ? '0' : Math.max(0, (edge - 0.85) * 4).toFixed(2);

    if (typeof robot !== 'undefined' && robot.parent) { var rd = robot.position.clone().normalize(); byId.robot.dir.copy(rd); byId.robot.yaw = Math.atan2(rd.x, -rd.z); byId.robot.pitch = Math.asin(rd.y) + 0.06; }
    if (!markers.classList.contains('off')) hotspots.forEach(function (h) {
      var p = project(h.dir); h.el.style.display = p.vis ? '' : 'none';
      if (p.vis) h.el.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)';
    });
    if (!DEBUG) drawMonitors(now);
    if (DOTS) dotEls.forEach(function (o) { var p = project(o.dir); o.el.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)'; o.el.style.display = p.behind ? 'none' : ''; });
    if (focused) { if (byId[focused].gallery) { placeGallery(); placeStoryCard(); hintScroll(ui.dText, ui.detail); } else placeOrbit(); }
    placeLive(); placeBook();
    if (hovered && !drag.on) setHover(hovered, lastPointer.x, lastPointer.y);
    stepRobot(dt, t); stepStereoFace(dt, t);
    renderer.render(scene, camera);
  }
  frame();
  var arrivalTimer = setTimeout(function () { try { arrival(); } catch (e) { console.warn('arrival error', e); document.getElementById('veil').classList.add('off'); state = 'idle'; } }, 300);
  return { destroy: function () { cancelAnimationFrame(rafId); clearTimeout(arrivalTimer); listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); }); renderer.dispose(); }, setNight: setNight, focus: function (id) { nav({ s: 'object', id: id }, true); } };
}
