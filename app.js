(() => {
  'use strict';

  const STORAGE_KEY = 'remina.spaced-revision.v1';
  const LAST_SUBJECT_KEY = 'remina.last-subject.v1';
  const THEME_KEY = 'remina.theme.v1';
  const NAME_KEY = 'remina.name.v1';
  const NAME_ASKED_KEY = 'remina.name-asked.v1';
  const PACE_KEY = 'remina.daily-pace.v1';
  const DAY_MS = 86400000;
  const $ = (selector, root = document) => root.querySelector(selector);
  const svg = (name, extraClass = '') => `<svg class="icon ${extraClass}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const plural = (number, word, pluralWord = `${word}s`) => `${number} ${number === 1 ? word : pluralWord}`;
  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const addDays = (date, days) => { const result = startOfDay(date); result.setDate(result.getDate() + days); return result; };
  const dayDifference = (a, b) => Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / DAY_MS);
  const keyOf = (date) => `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  function parseKey(key) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return keyOf(date) === key ? date : null;
  }
  const monthFormat = new Intl.DateTimeFormat('en', { month:'long', year:'numeric' });
  const shortFormat = new Intl.DateTimeFormat('en', { month:'short', day:'numeric' });
  const fullFormat = new Intl.DateTimeFormat('en', { weekday:'long', month:'long', day:'numeric' });
  const monthShortFormat = new Intl.DateTimeFormat('en', { month:'short' });
  function formatShort(date, includeYear = false) {
    return shortFormat.format(date) + (includeYear ? `, ${date.getFullYear()}` : '');
  }
  function relativeDate(date) {
    const diff = dayDifference(date, today);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return formatShort(date, date.getFullYear() !== today.getFullYear());
  }
  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `entry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  const palettes = [
    { bg:'#e6f2e7', ink:'#698d70', dot:'#90bc94' },
    { bg:'#f0ebf9', ink:'#8977a8', dot:'#b09dcc' },
    { bg:'#fbf1d9', ink:'#a38b5c', dot:'#d9bb78' },
    { bg:'#faeae1', ink:'#ad806d', dot:'#dba98e' },
    { bg:'#e6f1f3', ink:'#6c9094', dot:'#9dc2c3' },
    { bg:'#edf1e1', ink:'#879366', dot:'#b7c88c' }
  ];
  const palettesDark = [
    { bg:'#2b3a30', ink:'#c4ddc7', dot:'#95bc99' },
    { bg:'#342c47', ink:'#d5c7ee', dot:'#ab98d0' },
    { bg:'#3b3222', ink:'#e7d7ab', dot:'#d4b57e' },
    { bg:'#3e2f2b', ink:'#e4cbba', dot:'#d5a98e' },
    { bg:'#26373b', ink:'#c2dde0', dot:'#96bbc0' },
    { bg:'#33372c', ink:'#d3ddc1', dot:'#a9b98f' }
  ];
  function paletteFor(subject) {
    const text = (subject || 'General').toLowerCase().trim();
    let index;
    if (/bio|life|nature/.test(text)) index = 0;
    else if (/math|algebra|geometry|language|french/.test(text)) index = 1;
    else if (/histor|literature|english/.test(text)) index = 2;
    else if (/chem|physics|science/.test(text)) index = 3;
    else if (/econom|computer|tech|coding/.test(text)) index = 4;
    else if (/geograph|environment/.test(text)) index = 5;
    else {
      let hash = 0;
      for (const char of text) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
      index = hash % 6;
    }
    const set = currentTheme === 'obsidian' ? palettesDark : palettes;
    return set[index];
  }
  function tone(subject) {
    const color = paletteFor(subject);
    return `--tone-bg:${color.bg};--tone-ink:${color.ink};--tone-dot:${color.dot}`;
  }

  let today = startOfDay(new Date());
  let currentTheme = 'editorial';
  let themeAsked = false;
  let quickSubjectDefault = '';
  let nameAsked = false;
  let userName = '';
  let dailyPace = '';
  try { userName = (localStorage.getItem(NAME_KEY) || '').trim().slice(0,32); dailyPace = localStorage.getItem(PACE_KEY) || ''; } catch (_) { /* Keep the session working. */ }
  let storageUsable = true;
  try {
    const testKey = '__remina_storage_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
  } catch (_) { storageUsable = false; }

  function reviewKey(entryId, offset) { return `${entryId}::${offset}`; }
  function createExample(referenceDate) {
    return {
      entries: [{
        id: makeId(),
        topic: 'Example',
        subject: 'General',
        studyDate: keyOf(referenceDate),
        notes: 'Your starter entry — log your own topics above and delete this whenever you like.',
        sample: false
      }],
      completed: {}
    };
  }
  function loadData() {
    if (storageUsable) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved && Array.isArray(saved.entries) && saved.completed && typeof saved.completed === 'object') {
            return {
              entries: saved.entries.filter(entry => entry && typeof entry.id === 'string' && typeof entry.topic === 'string' && parseKey(entry.studyDate)).map(entry => ({
                id: entry.id, topic: entry.topic, subject: typeof entry.subject === 'string' ? entry.subject : 'General', studyDate: entry.studyDate,
                notes: typeof entry.notes === 'string' ? entry.notes : '', sample: Boolean(entry.sample)
              })),
              completed: saved.completed
            };
          }
        }
      } catch (_) { /* Start with examples if the saved data is unreadable. */ }
    }
    return createExample(today);
  }
  let data = loadData();
  function saveData() {
    if (!storageUsable) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (_) {
      storageUsable = false;
      updateStorageLabel();
      toast('Storage is unavailable. Changes will last for this session only.');
    }
  }
  function subjectOptions() {
    const options = [];
    const seen = new Set();
    const push = (value) => {
      const trimmed = String(value || '').trim();
      if (trimmed && trimmed.toLowerCase() !== 'general' && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        options.push(trimmed);
      }
    };
    for (const entry of data.entries) push(entry.subject);
    return options;
  }
  function storedLastSubject() {
    try { return localStorage.getItem(LAST_SUBJECT_KEY) || ''; } catch (_) { return ''; }
  }
  function refreshQuickSubjects() {
    const input = $('#quickSubject');
    if (!input) return;
    const options = subjectOptions();
    const list = $('#quickSubjectList');
    if (list) list.innerHTML = ['General'].concat(options).map(subject => `<option value="${escapeHTML(subject)}">`).join('');
    const remembered = storedLastSubject();
    const preferred = options.includes(remembered) ? remembered : '';
    if (document.activeElement !== input && (input.value === '' || input.value === quickSubjectDefault)) input.value = preferred;
    quickSubjectDefault = preferred;
  }

  const themeOptions = [
    { id:'editorial', name:'Modern Editorial', tag:'Daytime focus & calm planning', desc:'Serif headers + warm off-white paper tones' },
    { id:'frost', name:'Frosted Glass', tag:'Sleek, modern app feel', desc:'Blurred translucent cards + soft shadows' },
    { id:'obsidian', name:'Obsidian & Champagne', tag:'Evening use & luxury dark mode', desc:'Matte dark greys + warm gold accents' }
  ];
  function themePreview(themeId) {
    if (themeId === 'editorial') return `<svg viewBox="0 0 80 56"><rect x="2" y="2" width="76" height="52" rx="7" fill="#fdfcf4" stroke="#e6dfcd"/><text x="11" y="35" font-family="Georgia,'Times New Roman',serif" font-size="19" fill="#6a7a68">Aa</text><circle cx="64" cy="34" r="5" fill="#b9a86a"/></svg>`;
    if (themeId === 'frost') return `<svg viewBox="0 0 80 56"><rect x="2" y="2" width="76" height="52" rx="7" fill="#e9eef3"/><rect x="10" y="10" width="26" height="20" rx="6" fill="#ffffff" opacity=".72"/><rect x="38" y="13" width="26" height="20" rx="6" fill="#ffffff" opacity=".55"/><rect x="20" y="34" width="38" height="14" rx="6" fill="#ffffff" opacity=".66"/></svg>`;
    return `<svg viewBox="0 0 80 56"><rect x="2" y="2" width="76" height="52" rx="7" fill="#1e1e22" stroke="#36363e"/><circle cx="63" cy="28" r="6" fill="#c9a24b"/><path d="M32 30c2-8 6-12 14-14-8 2-12 6-14 14Z" fill="#d8c48f"/></svg>`;
  }
  function storedThemeChoice() {
    try { return localStorage.getItem(THEME_KEY); } catch (_) { return null; }
  }
  const THEME_COLORS = { editorial:'#f9f7f2', frost:'#eef3ee', obsidian:'#131316' };
  function setThemeColorMeta(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[theme] || '#f9f7f2');
  }
  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.dataset.theme = theme;
    setThemeColorMeta(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (_) { /* Session-only storage. */ }
  }
  function openThemePicker(firstVisit) {
    const cards = themeOptions.map(theme => `<button type="button" class="theme-card" data-action="choose-theme" data-theme="${theme.id}"><span class="theme-preview">${themePreview(theme.id)}</span><div class="theme-card-copy"><strong>${theme.name}</strong><span>${theme.tag}</span><p>${theme.desc}</p></div></button>`).join('');
    showDialog(`<div class="dialog theme-dialog" role="dialog" aria-modal="true" aria-labelledby="themeDialogTitle">${dialogCloseButton()}<div class="dialog-kicker">${svg('sparkle')} WELCOME TO REMINA</div><h2 id="themeDialogTitle">${firstVisit ? 'Make it <em>yours.</em>' : 'Choose your <em>theme.</em>'}</h2><p class="dialog-intro">${firstVisit ? 'Pick the space that feels like you. You can change it anytime from the theme button up top.' : 'Switch between daytime calm, glassy modern, or evening luxury whenever you like.'}</p><div class="theme-cards">${cards}</div><div class="dialog-actions"><button class="secondary-button" data-action="choose-theme" data-theme="editorial">Keep it simple</button></div></div>`);
  }
  function maybeAskName() {
    let askedBefore = false;
    try { askedBefore = localStorage.getItem(NAME_ASKED_KEY) === '1'; } catch (_) { /* Session-only storage. */ }
    if (!userName && !nameAsked && !askedBefore) openNameDialog(true);
  }

  function greetingFor(date = new Date()) {
    const hour = date.getHours();
    // Return a greeting STEM; the caller appends ", <name>."
    if (hour >= 5 && hour < 9)   return 'Good morning, sunshine';
    if (hour >= 9 && hour < 12)  return 'Good morning';
    if (hour >= 12 && hour < 15) return 'Good afternoon';
    if (hour >= 15 && hour < 17) return 'Hope the afternoon is going well';
    if (hour >= 17 && hour < 19) return 'Good evening';
    if (hour >= 19 && hour < 22) return 'Evening wind-down';
    if (hour >= 22 || hour < 2)  return 'Still up';
    return 'Burning the midnight oil';
  }
  function greetingEmoji(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return '☀️';
    if (hour >= 12 && hour < 17) return '🌥️';
    if (hour >= 17 && hour < 22) return '🌙';
    return '✨️';
  }
  function dailyQuestionFor(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return 'What are we doing today?';
    if (hour >= 12 && hour < 17) return 'What’s on the cards this afternoon?';
    if (hour >= 17 && hour < 22) return 'What are we wrapping up tonight?';
    return 'Sneaking in a late session? What’s the plan?';
  }
  function paceForToday() {
    return dailyPace === `${keyOf(today)}:no` ? 'no' : dailyPace === `${keyOf(today)}:yes` ? 'yes' : '';
  }
  function updateGreeting() {
    const displayName = userName || 'friend';
    const letter = userName ? Array.from(userName)[0].toLocaleUpperCase() : 'Y';
    if (state.view === 'calendar') {
      const greet = greetingFor();
      const emoji = greetingEmoji();
      // If name isn't set yet, nudge softly instead of "friend".
      const title = userName
        ? `${escapeHTML(greet)}, <em>${escapeHTML(displayName)}</em> ${emoji}`
        : `${escapeHTML(greet)} ${emoji} <span style="opacity:.75;font-weight:500">— <button type="button" class="text-link" data-action="edit-name" style="font:inherit;border:0;padding:0;background:none;cursor:pointer">what should I call you?</button></span>`;
      $('#pageTitle').innerHTML = title;
      $('#pageSubtitle').textContent = `Log in a second. Review in the morning. I’m with you the whole way.`;
    }
    $('#profileName').textContent = userName || 'Your space';
    $('#profileAvatar').textContent = letter;
    $('#topAvatar').textContent = letter;
    $('#topAvatar').setAttribute('aria-label', userName ? `Edit your name, ${userName}` : 'Add your name');
    const pace = paceForToday();
    if (pace === 'no') {
      $('#dailyQuestion').textContent = 'Taking it easy today? Your plan will be right here when you’re ready.';
    } else if (pace === 'yes') {
      const hour = new Date().getHours();
      $('#dailyQuestion').textContent = hour < 12
        ? 'Let’s make something stick today — I’m with you.'
        : hour < 19 ? 'Love the energy. Let’s get to it.' : 'Night owl mode — let’s do this.';
    } else {
      $('#dailyQuestion').textContent = dailyQuestionFor();
    }
    $('#dailyYes').innerHTML = pace === 'no' ? `Changed my mind — let’s go ${svg('arrow-right')}` : `Yes, let’s study ${svg('arrow-right')}`;
    $('#dailyNo').textContent = 'Not today';
    $('#dailyYes').classList.toggle('is-selected', pace === 'yes');
    $('#dailyNo').classList.toggle('is-selected', pace === 'no');
    $('#dailyNo').setAttribute('aria-pressed', String(pace === 'no'));
    $('#dailyYes').setAttribute('aria-pressed', String(pace === 'yes'));
  }
  function openNameDialog(firstVisit = false) {
    nameAsked = true;
    if (firstVisit) { try { localStorage.setItem(NAME_ASKED_KEY, '1'); } catch (_) { /* Session-only storage. */ } }
    showDialog(`<div class="dialog name-dialog" role="dialog" aria-modal="true" aria-labelledby="nameDialogTitle">${dialogCloseButton()}<div class="dialog-kicker">${svg('sparkle')} ${firstVisit ? 'ONE LAST THING' : 'YOUR STUDY SPACE'}</div><h2 id="nameDialogTitle">${firstVisit ? 'What should we <em>call you?</em>' : 'Make it <em>personal.</em>'}</h2><p class="dialog-intro">${firstVisit ? 'A little hello feels better with your name. Just your first name is perfect.' : 'Update the name on your workspace anytime.'}</p><form id="nameForm" class="name-form"><div class="form-field"><label for="nameInput">Your name</label><input class="form-input" id="nameInput" name="name" type="text" maxlength="32" autocomplete="given-name" placeholder="e.g. Keshav" value="${escapeHTML(userName)}" required></div><div class="dialog-actions"><button type="button" class="secondary-button" data-action="close-dialog">${firstVisit ? 'Maybe later' : 'Cancel'}</button><button class="primary-button" type="submit">${firstVisit ? 'Let’s get started' : 'Save name'} ${svg('arrow-right')}</button></div></form></div>`, '#nameInput');
  }
  const state = {
    view: 'calendar',
    selectedDate: startOfDay(today),
    displayMonth: new Date(today.getFullYear(), today.getMonth(), 1),
    studySearch: '',
    queueFilter: 'todo'
  };
  const views = { calendar: $('#calendarView'), study: $('#studyView'), queue: $('#queueView') };
  let lastFocused = null;
  let toastTimer;

  function isDone(event) { return Boolean(data.completed[reviewKey(event.entry.id, event.offset)]); }
  function stageNumber(offset) {
    if (offset === 3) return 1;
    if (offset === 7) return 2;
    if (offset === 15) return 3;
    return Math.floor(offset / 30) + 3;
  }
  function ordinal(number) {
    const mod100 = number % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${number}th`;
    return `${number}${({1:'st',2:'nd',3:'rd'})[number % 10] || 'th'}`;
  }
  function reviewsForEntry(entry, start, end) {
    const studied = parseKey(entry.studyDate);
    if (!studied) return [];
    const startOffset = dayDifference(start, studied);
    const endOffset = dayDifference(end, studied);
    if (endOffset < 3) return [];
    const offsets = [3, 7, 15].filter(n => n >= startOffset && n <= endOffset);
    const firstMonthly = Math.max(1, Math.ceil(startOffset / 30));
    const lastMonthly = Math.floor(endOffset / 30);
    for (let n = firstMonthly; n <= lastMonthly; n++) offsets.push(n * 30);
    return offsets.map(offset => ({ entry, offset, date:addDays(studied, offset) }));
  }
  function reviewsBetween(start, end) {
    return data.entries.flatMap(entry => reviewsForEntry(entry, start, end))
      .sort((a,b) => dayDifference(a.date, b.date) || data.entries.indexOf(a.entry) - data.entries.indexOf(b.entry) || a.offset - b.offset);
  }
  function nextReview(entry, from = today) {
    const studied = parseKey(entry.studyDate);
    if (!studied) return null;
    const fromOffset = Math.max(0, dayDifference(from, studied));
    for (const offset of [3,7,15]) {
      if (offset >= fromOffset && !data.completed[reviewKey(entry.id, offset)]) return {entry, offset, date:addDays(studied, offset)};
    }
    let multiple = Math.max(1, Math.ceil(fromOffset / 30));
    while (data.completed[reviewKey(entry.id, multiple * 30)]) multiple++;
    const offset = multiple * 30;
    return { entry, offset, date:addDays(studied, offset) };
  }
  function dayEvents(date) {
    return reviewsBetween(date, date);
  }
  function overdueCount() {
    let count = 0;
    for (const entry of data.entries) {
      const studied = parseKey(entry.studyDate);
      if (!studied) continue;
      const lastPastOffset = dayDifference(today, studied) - 1;
      if (lastPastOffset < 3) continue;
      count += [3,7,15].filter(offset => offset <= lastPastOffset).length + Math.max(0, Math.floor(lastPastOffset / 30));
      for (const [key, done] of Object.entries(data.completed)) {
        if (!done || !key.startsWith(`${entry.id}::`)) continue;
        const offset = Number(key.slice(entry.id.length + 2));
        if (offset <= lastPastOffset && ([3,7,15].includes(offset) || (offset >= 30 && offset % 30 === 0))) count--;
      }
    }
    return Math.max(0, count);
  }
  function updateStorageLabel() {
    const label = $('#storageLabel');
    if (label) label.innerHTML = `${svg('check')} Saved`;
  }
  function renderOverview() {
    const reviews = dayEvents(today);
    const done = reviews.filter(isDone).length;
    const remaining = reviews.length - done;
    const overdue = overdueCount();
    const upcoming = reviewsBetween(addDays(today,1), addDays(today,7)).filter(event => !isDone(event));
    $('#statToday').textContent = reviews.length;
    $('#statTodayUnit').textContent = reviews.length === 1 ? 'review' : 'reviews';
    $('#statTodayCaption').textContent = overdue ? `${remaining} left today · ${overdue} overdue` : reviews.length === 0 ? 'Nothing due today' : remaining === 0 ? 'All caught up today' : `${remaining} left to review`;
    $('#statWeek').textContent = upcoming.length;
    $('#statWeekUnit').textContent = upcoming.length === 1 ? 'review' : 'reviews';
    $('#statEntries').textContent = data.entries.length;
    $('#statEntriesUnit').textContent = data.entries.length === 1 ? 'entry' : 'entries';
    $('#navStudyCount').textContent = data.entries.length > 99 ? '99+' : data.entries.length;
    const outstanding = remaining + overdue;
    $('#navDueCount').textContent = outstanding > 99 ? '99+' : outstanding;
    $('#navDueCount').setAttribute('aria-label', `${plural(outstanding,'outstanding review')}`);
    updateStorageLabel();
  }
  function renderNavigation() {
    document.querySelectorAll('.nav-item').forEach(button => {
      const active = button.dataset.view === state.view;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    });
    for (const [name, element] of Object.entries(views)) element.hidden = name !== state.view;
    const heading = {
      calendar: ['Calendar', 'Your revision <em>calendar.</em>', 'Log in a second. Review in the morning. That’s the whole routine.'],
      study: ['Study log', 'Your study <em>log.</em>', 'Everything you’ve learned, in one thoughtful little place.'],
      queue: ['Review queue', 'Time to <em>remember.</em>', 'Take it one review at a time. You’re building a lasting memory.']
    }[state.view];
    $('#breadcrumbCurrent').textContent = heading[0];
    $('#dailyChoice').hidden = state.view !== 'calendar';
    if (state.view !== 'calendar') {
      $('#pageTitle').innerHTML = heading[1];
      $('#pageSubtitle').textContent = heading[2];
    }
    // updateGreeting always refreshes avatar + profile, and overwrites the
    // calendar title/subtitle with the warm, time-aware greeting.
    updateGreeting();
    document.title = `${heading[0]} — Remina`;
  }
  function renderCalendar() {
    $('#monthLabel').textContent = monthFormat.format(state.displayMonth);
    const year = state.displayMonth.getFullYear();
    const month = state.displayMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const start = addDays(first, -first.getDay());
    const cellCount = Math.ceil((first.getDay() + last.getDate()) / 7) * 7;
    const end = addDays(start, cellCount - 1);
    const buckets = {};
    for (const event of reviewsBetween(start, end)) {
      const key = keyOf(event.date);
      (buckets[key] ||= []).push({ type:'review', ...event });
    }
    for (const entry of data.entries) {
      const studied = parseKey(entry.studyDate);
      if (studied && dayDifference(studied, start) >= 0 && dayDifference(studied, end) <= 0) {
        (buckets[entry.studyDate] ||= []).push({ type:'study', entry, date:studied });
      }
    }
    const selectedKey = keyOf(state.selectedDate);
    const todayKey = keyOf(today);
    const cells = [];
    for (let index = 0; index < cellCount; index++) {
      const date = addDays(start, index);
      const dateKey = keyOf(date);
      const events = buckets[dateKey] || [];
      const reviewCount = events.filter(event => event.type === 'review').length;
      const studyCount = events.length - reviewCount;
      const other = date.getMonth() !== month;
      const isToday = dateKey === todayKey;
      const selected = dateKey === selectedKey;
      const descriptions = [fullFormat.format(date) + `, ${date.getFullYear()}`];
      if (isToday) descriptions.push('today');
      if (reviewCount) descriptions.push(plural(reviewCount,'review'));
      if (studyCount) descriptions.push(plural(studyCount,'study entry','study entries'));
      const labels = events.slice(0,2).map(event => {
        const study = event.type === 'study';
        const done = !study && isDone(event);
        return `<span class="cal-event ${study ? 'is-study' : ''} ${done ? 'is-complete' : ''}" style="${tone(event.entry.subject)}"><span class="${study ? 'event-plus' : 'event-dot'}">${study ? '+' : ''}</span><span class="cal-event-text">${escapeHTML(event.entry.topic)}</span></span>`;
      }).join('');
      const extra = events.length > 2 ? `<span class="day-more">+${events.length - 2} more</span>` : '';
      cells.push(`<button type="button" class="calendar-day ${other ? 'is-other-month' : ''} ${isToday ? 'is-today' : ''} ${selected ? 'is-selected' : ''}" data-action="select-date" data-date="${dateKey}" aria-label="${escapeHTML(descriptions.join(', '))}" aria-pressed="${selected}"><span class="day-number-row"><span class="day-number">${date.getDate()}</span>${isToday ? '<span class="day-today-label">Today</span>' : ''}</span><span class="day-events">${labels}</span>${extra}</button>`);
    }
    $('#calendarGrid').innerHTML = cells.join('');
    renderDayPanel();
  }
  function reviewRow(event) {
    const completed = isDone(event);
    const stage = stageNumber(event.offset);
    const checkLabel = `${completed ? 'Mark as not reviewed' : 'Mark as reviewed'}: ${event.entry.topic}, day ${event.offset}`;
    return `<div class="review-row ${completed ? 'is-complete' : ''}" data-review-key="${escapeHTML(`${event.entry.id}::${event.offset}`)}">
      <button class="check-button ${completed ? 'is-checked' : ''}" data-action="toggle-review" data-id="${escapeHTML(event.entry.id)}" data-offset="${event.offset}" aria-label="${escapeHTML(checkLabel)}" aria-pressed="${completed}">${completed ? svg('check') : ''}</button>
      <div class="review-row-copy"><button class="review-title" data-action="details" data-id="${escapeHTML(event.entry.id)}" data-offset="${event.offset}" title="View study entry">${escapeHTML(event.entry.topic)}</button>
      <div class="review-meta" style="${tone(event.entry.subject)}"><span class="subject-dot"></span><span class="subject-name">${escapeHTML(event.entry.subject || 'General')}</span><span class="meta-divider">·</span><span>${ordinal(stage)} review</span></div></div>
      <span class="stage-tag">DAY ${event.offset}</span>
    </div>`;
  }
  function renderDayPanel() {
    const date = state.selectedDate;
    const dateKey = keyOf(date);
    const isToday = dateKey === keyOf(today);
    const reviews = dayEvents(date);
    const studied = data.entries.filter(entry => entry.studyDate === dateKey);
    const completed = reviews.filter(isDone).length;
    const remaining = reviews.length - completed;
    const overdue = isToday ? overdueCount() : 0;
    const sorted = [...reviews].sort((a,b) => Number(isDone(a)) - Number(isDone(b)));
    const title = isToday ? 'Today’s plan' : 'Your reviews';
    let subtitle;
    if (reviews.length === 0) subtitle = `${fullFormat.format(date)} · ${overdue ? 'Earlier reviews are waiting.' : 'A little room to breathe.'}`;
    else if (remaining === 0) subtitle = `${fullFormat.format(date)} · ${overdue ? 'All done for today.' : 'All caught up!'}`;
    else subtitle = `${fullFormat.format(date)} · You’ve got this.`;
    const progress = reviews.length ? `<div class="progress-area"><div class="progress-label"><span>YOUR PROGRESS</span><span>${completed} OF ${reviews.length} DONE</span></div><div class="progress-track" role="progressbar" aria-label="Reviews completed" aria-valuemin="0" aria-valuemax="${reviews.length}" aria-valuenow="${completed}"><div class="progress-fill" style="width:${Math.round((completed/reviews.length)*100)}%"></div></div></div>` : '';
    const rows = reviews.length
      ? `<div class="review-list">${sorted.map(reviewRow).join('')}</div>`
      : `<div class="empty-day"><div class="empty-day-icon">${svg('sparkle')}</div><strong>No reviews scheduled</strong><p>${studied.length ? 'Your study entries for this day are just below.' : overdue ? 'You have earlier reviews waiting in your queue.' : 'A little space to breathe, or learn something new.'}</p>${!studied.length && !overdue ? '<button data-action="add-entry">+ Log a study entry</button>' : ''}</div>`;
    const celebrate = reviews.length && remaining === 0 ? `<div class="celebrate"><div class="celebrate-icon">${svg('check')}</div><div><strong>All caught up!</strong><p>Every review on ${escapeHTML(fullFormat.format(date))} is done. Beautiful work.</p></div></div>` : '';
    const studiedHtml = studied.length ? `<div class="studied-block"><div class="tiny-label">STUDIED ON THIS DAY</div>${studied.map(entry => `<div class="studied-entry" style="${tone(entry.subject)}"><div class="studied-entry-icon">${svg('book')}</div><div><button data-action="details" data-id="${escapeHTML(entry.id)}">${escapeHTML(entry.topic)}</button><small>${escapeHTML(entry.subject || 'General')}</small></div></div>`).join('')}</div>` : '';
    const overdueHtml = overdue ? `<div class="overdue-alert"><span>${plural(overdue,'overdue review')}</span><button data-action="view" data-view="queue">Catch up →</button></div>` : '';
    const panel = $('#dayPanel');
    panel.className = `review-card card${isToday ? ' is-today' : ''}`;
    panel.innerHTML = `<div class="panel-topline"><div><div class="tiny-label">${isToday ? 'YOUR DAILY PLAN' : 'SELECTED DAY'}</div><h2>${title} <span class="count-bubble">${reviews.length}</span></h2></div><div class="date-tile"><strong>${date.getDate()}</strong><span>${monthShortFormat.format(date).toUpperCase()}</span></div></div>
      <p class="panel-description">${escapeHTML(subtitle)}</p>${progress}${rows}${celebrate}${studiedHtml}${overdueHtml}
      <div class="review-footer"><button data-action="view" data-view="queue">See your review queue ${svg('arrow-right')}</button><span>${reviews.length ? `${remaining} left` : 'One day at a time'}</span></div>`;
  }
  function entryNextText(entry) {
    const next = nextReview(entry);
    return next ? relativeDate(next.date) : '—';
  }
  function renderStudyView() {
    const count = data.entries.length;
    $('#studyView').innerHTML = `<div class="list-card card"><div class="list-card-header"><div><h2>All study entries</h2><p>${count ? `${plural(count,'entry','entries')} in your learning library.` : 'Your learning library starts here.'}</p></div><label class="search-wrap"><span class="sr-only">Search your study log</span>${svg('search')}<input id="studySearch" class="search-input" type="search" placeholder="Search your study log..." value="${escapeHTML(state.studySearch)}" autocomplete="off"></label></div>
      <div class="table-head" aria-hidden="true"><span>TOPIC</span><span>STUDIED ON</span><span>NEXT REVIEW</span><span></span></div><div id="studyRows"></div>
      <div class="list-subfooter">Saved. Everything stays right here.</div></div>`;
    renderStudyRows();
  }
  function renderStudyRows() {
    const root = $('#studyRows');
    if (!root) return;
    const query = state.studySearch.trim().toLowerCase();
    const entries = [...data.entries].filter(entry => [entry.topic, entry.subject, entry.notes].join(' ').toLowerCase().includes(query))
      .sort((a,b) => b.studyDate.localeCompare(a.studyDate));
    if (!entries.length) {
      root.innerHTML = `<div class="list-empty"><div class="empty-day-icon">${svg(query ? 'search' : 'book')}</div><h3>${query ? 'No matching entries' : 'A fresh page awaits'}</h3><p>${query ? 'Try a different topic or subject.' : 'Log something you studied and we’ll make a revision plan for you.'}</p>${query ? '' : `<button class="primary-button" data-action="add-entry">${svg('plus')} Log your first entry</button>`}</div>`;
      return;
    }
    root.innerHTML = entries.map(entry => {
      const studyDate = parseKey(entry.studyDate);
      return `<div class="study-row"><div class="study-topic-cell"><div class="topic-icon" style="${tone(entry.subject)}">${svg('book')}</div><div class="study-topic-copy"><button class="study-topic-name" data-action="details" data-id="${escapeHTML(entry.id)}">${escapeHTML(entry.topic)}</button><div class="study-topic-meta">${escapeHTML(entry.subject || 'General')} ${entry.sample ? '<span class="sample-tag">SAMPLE</span>' : ''}</div><div class="study-mobile-meta">Studied ${escapeHTML(formatShort(studyDate, studyDate.getFullYear() !== today.getFullYear()))} · Next ${escapeHTML(entryNextText(entry))}</div></div></div>
        <div class="table-date">${escapeHTML(formatShort(studyDate, studyDate.getFullYear() !== today.getFullYear()))}</div><div class="table-date"><strong>${escapeHTML(entryNextText(entry))}</strong></div>
        <div class="table-actions"><button class="table-icon-button" data-action="edit-entry" data-id="${escapeHTML(entry.id)}" aria-label="Edit ${escapeHTML(entry.topic)}" title="Edit entry">${svg('edit')}</button><button class="table-icon-button is-destructive" data-action="delete-entry" data-id="${escapeHTML(entry.id)}" aria-label="Delete ${escapeHTML(entry.topic)}" title="Delete entry">${svg('trash')}</button></div></div>`;
    }).join('');
  }
  function allQueueEvents() {
    if (!data.entries.length) return [];
    const starts = data.entries.map(entry => parseKey(entry.studyDate)).filter(Boolean);
    const earliest = starts.reduce((a,b) => dayDifference(a,b) < 0 ? a : b, today);
    const cutoff = addDays(today,-30);
    return reviewsBetween(earliest, addDays(today,30)).filter(event => !isDone(event) || dayDifference(event.date, cutoff) >= 0);
  }
  function queueRow(event) {
    const done = isDone(event);
    const dayDelta = dayDifference(event.date,today);
    const status = done ? 'Done' : dayDelta < 0 ? 'Overdue' : dayDelta === 0 ? 'Today' : dayDelta === 1 ? 'Tomorrow' : `In ${dayDelta} days`;
    const checkLabel = `${done ? 'Mark as not reviewed' : 'Mark as reviewed'}: ${event.entry.topic}, day ${event.offset}`;
    return `<div class="queue-row ${done ? 'is-complete' : ''}" data-review-key="${escapeHTML(`${event.entry.id}::${event.offset}`)}"><button class="check-button ${done ? 'is-checked' : ''}" data-action="toggle-review" data-id="${escapeHTML(event.entry.id)}" data-offset="${event.offset}" aria-label="${escapeHTML(checkLabel)}" aria-pressed="${done}">${done ? svg('check') : ''}</button><div class="queue-row-copy"><button class="review-title" data-action="details" data-id="${escapeHTML(event.entry.id)}" data-offset="${event.offset}">${escapeHTML(event.entry.topic)}</button><div class="review-meta" style="${tone(event.entry.subject)}"><span class="subject-dot"></span><span class="subject-name">${escapeHTML(event.entry.subject)}</span><span class="meta-divider">·</span><span>${ordinal(stageNumber(event.offset))} review · day ${event.offset}</span></div></div><button class="queue-date" data-action="jump-date" data-date="${keyOf(event.date)}" title="Show in calendar">${escapeHTML(formatShort(event.date, event.date.getFullYear() !== today.getFullYear()))} ↗</button><span class="queue-status ${done ? 'is-done' : dayDelta < 0 ? 'is-late' : ''}">${status}</span></div>`;
  }
  function renderQueueView() {
    const all = allQueueEvents();
    const filtered = all.filter(event => state.queueFilter === 'all' || (state.queueFilter === 'todo' ? !isDone(event) : isDone(event)));
    const groups = [
      ['Overdue', filtered.filter(event => dayDifference(event.date,today) < 0 && !isDone(event))],
      ['Today', filtered.filter(event => dayDifference(event.date,today) === 0)],
      ['Upcoming', filtered.filter(event => dayDifference(event.date,today) > 0)],
      ['Recently completed', filtered.filter(event => dayDifference(event.date,today) < 0 && isDone(event)).reverse()]
    ].filter(([,items]) => items.length);
    const content = groups.length ? groups.map(([label, items]) => `<div class="queue-group-heading">${label} <span>${items.length}</span></div>${items.slice(0,200).map(queueRow).join('')}${items.length > 200 ? '<div class="list-subfooter">Showing the first 200 reviews in this group. Use the calendar to explore more.</div>' : ''}`).join('')
      : `<div class="list-empty"><div class="empty-day-icon">${svg('sparkle')}</div><h3>${state.queueFilter === 'done' ? 'No completed reviews yet' : 'All clear for now'}</h3><p>${data.entries.length ? 'Your reviews will appear here as they come up.' : 'Add a study entry and we’ll schedule your first review.'}</p>${!data.entries.length ? `<button class="primary-button" data-action="add-entry">${svg('plus')} Log your first entry</button>` : ''}</div>`;
    $('#queueView').innerHTML = `<div class="list-card card"><div class="list-card-header"><div><h2>Your review queue</h2><p>Outstanding reviews and the next 30 days, all in one place.</p></div><div class="queue-tools" aria-label="Filter reviews"><button class="queue-filter ${state.queueFilter === 'todo' ? 'is-active' : ''}" data-action="queue-filter" data-filter="todo" aria-pressed="${state.queueFilter === 'todo'}">To review</button><button class="queue-filter ${state.queueFilter === 'all' ? 'is-active' : ''}" data-action="queue-filter" data-filter="all" aria-pressed="${state.queueFilter === 'all'}">All</button><button class="queue-filter ${state.queueFilter === 'done' ? 'is-active' : ''}" data-action="queue-filter" data-filter="done" aria-pressed="${state.queueFilter === 'done'}">Done</button></div></div>${content}<div class="list-subfooter">Showing upcoming reviews for 30 days, all overdue reviews, and completed reviews from the last 30 days.</div></div>`;
  }
  function renderAll() {
    refreshQuickSubjects();
    renderOverview();
    renderNavigation();
    if (state.view === 'calendar') renderCalendar();
    else if (state.view === 'study') renderStudyView();
    else renderQueueView();
  }
  function toast(message) {
    const element = $('#toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('is-visible'), 3400);
  }
  function showDialog(markup, focusSelector) {
    lastFocused = document.activeElement;
    const layer = $('#dialogLayer');
    layer.innerHTML = markup;
    layer.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      const focusTarget = focusSelector ? $(focusSelector, layer) : $('.dialog-close', layer);
      if (focusTarget) focusTarget.focus();
    });
  }
  function closeDialog() {
    const layer = $('#dialogLayer');
    layer.hidden = true;
    layer.innerHTML = '';
    document.body.style.overflow = '';
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  }
  function dialogCloseButton() { return `<button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close">${svg('close')}</button>`; }
  function scheduleDates(date) {
    if (!date) return 'Choose a study date to see your first review dates.';
    return `${[3,7,15,30].map(offset => formatShort(addDays(date,offset), addDays(date,offset).getFullYear() !== date.getFullYear())).join('  ·  ')} — then every 30 days.`;
  }
  function openEntryDialog(entryId) {
    const entry = entryId ? data.entries.find(item => item.id === entryId) : null;
    if (entryId && !entry) return;
    const selected = state.view === 'calendar' && dayDifference(state.selectedDate,today) <= 0 ? state.selectedDate : today;
    const dateValue = entry ? entry.studyDate : keyOf(selected);
    const title = entry ? 'Edit your <em>entry.</em>' : 'What did you <em>study?</em>';
    showDialog(`<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="entryDialogTitle">${dialogCloseButton()}<div class="dialog-kicker">${svg('sparkle')} A LITTLE EACH DAY</div><h2 id="entryDialogTitle">${title}</h2><p class="dialog-intro">${entry ? 'Update the details of this study session.' : 'Log a topic and we’ll make a revision plan for you.'}</p>
      <form id="entryForm" class="entry-form" data-entry-id="${entry ? escapeHTML(entry.id) : ''}">
        <div class="form-field"><label for="topicInput">Topic <span>· required</span></label><input class="form-input" id="topicInput" name="topic" type="text" placeholder="e.g. Cell structure" maxlength="65" required value="${entry ? escapeHTML(entry.topic) : ''}" autocomplete="off"></div>
        <div class="form-row"><div class="form-field"><label for="subjectInput">Subject <span>· optional</span></label><input class="form-input" id="subjectInput" name="subject" type="text" list="subjectSuggestions" placeholder="e.g. Biology" maxlength="35" value="${entry ? escapeHTML(entry.subject === 'General' ? '' : entry.subject) : ''}" autocomplete="off"><datalist id="subjectSuggestions">${[...new Set(['Biology','Mathematics','History','Chemistry','Physics','Languages','Economics','Geography','Literature','Computer science', ...subjectOptions()])].map(subject => `<option value="${escapeHTML(subject)}">`).join('')}</datalist></div><div class="form-field"><label for="studyDateInput">Date studied <span>· required</span></label><input class="form-input" id="studyDateInput" name="studyDate" type="date" min="1900-01-01" max="${keyOf(today)}" required value="${dateValue}"></div></div>
        <div class="form-field"><label for="notesInput">Notes <span>· optional</span></label><textarea class="form-textarea" id="notesInput" name="notes" maxlength="1000" placeholder="A few words about what you learned...">${entry ? escapeHTML(entry.notes) : ''}</textarea></div>
        <div class="schedule-preview"><div class="schedule-preview-top">${svg('calendar')} Your review dates</div><p id="schedulePreviewDates">${escapeHTML(scheduleDates(parseKey(dateValue)))}</p></div>
        ${entry ? '<div class="form-hint">Changing the study date resets completed reviews for this entry.</div>' : ''}
        <div class="dialog-actions"><button type="button" class="secondary-button" data-action="close-dialog">Cancel</button><button type="submit" class="primary-button">${entry ? 'Save changes' : 'Save & schedule'} ${svg('arrow-right')}</button></div>
      </form></div>`, '#topicInput');
  }
  function openGuide() {
    showDialog(`<div class="dialog guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guideTitle">${dialogCloseButton()}<div class="dialog-kicker">${svg('sparkle')} THE REMINA WAY</div><h2 id="guideTitle">A little review, <em>a lot remembered.</em></h2><p class="dialog-intro">Spaced revision brings information back to mind over time, instead of cramming it all at once.</p><div class="guide-hero"><strong>Your study rhythm, made simple.</strong><p>For every topic you log, Remina adds reviews to your calendar on these days after you studied it:</p><div class="guide-timeline"><div class="guide-step"><strong>3</strong><span>days</span></div><div class="guide-step"><strong>7</strong><span>days</span></div><div class="guide-step"><strong>15</strong><span>days</span></div><div class="guide-step"><strong>30</strong><span>days</span></div><div class="guide-step"><strong>+30</strong><span>days again</span></div></div><p class="guide-note">After day 30, reviews repeat every 30 days: day 60, day 90, day 120, and so on. These are fixed 30-day intervals, not calendar-month dates.</p></div><ul class="guide-list"><li>${svg('book')} <span><strong>Log it.</strong> Add what you studied and when.</span></li><li>${svg('calendar')} <span><strong>Revisit it.</strong> Select any day in your calendar to see what’s scheduled.</span></li><li>${svg('check')} <span><strong>Check it off.</strong> Mark a review complete when you’re done.</span></li><li>${svg('lock')} <span><strong>Kept private.</strong> Everything is saved on this device. Remina doesn’t send notifications, so check your calendar for what’s due.</span></li></ul><div class="dialog-actions"><button class="primary-button" data-action="close-dialog">Got it ${svg('check')}</button></div></div>`);
  }
  function openDetails(entryId, offsetValue) {
    const entry = data.entries.find(item => item.id === entryId);
    if (!entry) return;
    const studied = parseKey(entry.studyDate);
    const offset = Number(offsetValue);
    const next = nextReview(entry);
    const detail = Number.isFinite(offset) && offset > 0
      ? `${ordinal(stageNumber(offset))} review · day ${offset} · ${formatShort(addDays(studied,offset), true)}`
      : `Studied ${formatShort(studied,true)}`;
    showDialog(`<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="detailTitle">${dialogCloseButton()}<div class="dialog-kicker">${svg('book')} STUDY ENTRY</div><h2 id="detailTitle">${escapeHTML(entry.topic)}</h2><p class="dialog-intro">${escapeHTML(detail)}</p><div class="detail-topic"><div class="topic-icon" style="${tone(entry.subject)}">${svg('book')}</div><div><strong>${escapeHTML(entry.subject || 'General')}</strong><span>Studied on ${escapeHTML(formatShort(studied,true))}</span></div></div><div class="detail-notes"><span class="form-label">Your notes</span><p>${entry.notes ? escapeHTML(entry.notes) : 'No notes added for this entry yet.'}</p></div><div class="detail-next">${svg('calendar')} Next upcoming review: ${next ? escapeHTML(formatShort(next.date,true)) : '—'}</div><div class="dialog-actions"><button class="secondary-button" data-action="close-dialog">Close</button><button class="primary-button" data-action="edit-entry" data-id="${escapeHTML(entry.id)}">${svg('edit')} Edit entry</button></div></div>`);
  }
  function openDeleteConfirmation(entryId) {
    const entry = data.entries.find(item => item.id === entryId);
    if (!entry) return;
    showDialog(`<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="deleteTitle">${dialogCloseButton()}<div class="dialog-kicker">${svg('info')} ONE QUICK CHECK</div><h2 id="deleteTitle">Delete this <em>entry?</em></h2><p class="dialog-intro">“${escapeHTML(entry.topic)}” and all of its scheduled reviews will be removed. This can’t be undone.</p><div class="dialog-actions"><button class="secondary-button" data-action="close-dialog">Keep entry</button><button class="primary-button danger-button" data-action="confirm-delete" data-id="${escapeHTML(entry.id)}">Delete entry</button></div></div>`);
  }
  function removeEntries(ids) {
    const idSet = new Set(ids);
    data.entries = data.entries.filter(entry => !idSet.has(entry.id));
    for (const key of Object.keys(data.completed)) {
      const id = key.split('::')[0];
      if (idSet.has(id)) delete data.completed[key];
    }
  }
  function toggleReview(id, offset) {
    const entry = data.entries.find(item => item.id === id);
    if (!entry || ![3,7,15].includes(offset) && !(offset >= 30 && offset % 30 === 0)) return;
    const key = reviewKey(id,offset);
    const nowDone = !data.completed[key];
    if (nowDone) data.completed[key] = true; else delete data.completed[key];
    saveData();
    renderAll();
    if (nowDone) {
      const selector = `[data-review-key="${String(key).replace(/["\\]/g, '\\$&')}"]`;
      requestAnimationFrame(() => {
        const row = document.querySelector(selector);
        if (row) {
          row.classList.add('is-flashing');
          setTimeout(() => row.classList.remove('is-flashing'), 700);
        }
      });
    }
    toast(nowDone ? 'Review checked off. Nice work!' : 'Review marked as not done.');
  }
  function setView(view) {
    if (!views[view]) return;
    state.view = view;
    renderAll();
    window.scrollTo({top:0, behavior:'smooth'});
  }
  function selectDate(date, switchView = false) {
    if (!date) return;
    state.selectedDate = startOfDay(date);
    state.displayMonth = new Date(date.getFullYear(),date.getMonth(),1);
    if (switchView) state.view = 'calendar';
    renderAll();
  }
  document.addEventListener('click', event => {
    const layer = $('#dialogLayer');
    if (!layer.hidden && event.target === layer) { closeDialog(); return; }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'view') setView(button.dataset.view);
    else if (action === 'today') selectDate(today);
    else if (action === 'previous-month' || action === 'next-month') {
      const change = action === 'next-month' ? 1 : -1;
      const newMonth = new Date(state.displayMonth.getFullYear(),state.displayMonth.getMonth() + change,1);
      const lastDay = new Date(newMonth.getFullYear(),newMonth.getMonth()+1,0).getDate();
      selectDate(new Date(newMonth.getFullYear(),newMonth.getMonth(),Math.min(state.selectedDate.getDate(),lastDay)));
    }
    else if (action === 'select-date') {
      selectDate(parseKey(button.dataset.date));
      if (window.matchMedia('(max-width: 650px)').matches) $('#dayPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
    }
    else if (action === 'jump-date') { selectDate(parseKey(button.dataset.date),true); window.scrollTo({top:0,behavior:'smooth'}); }
    else if (action === 'add-entry') openEntryDialog();
    else if (action === 'edit-entry') openEntryDialog(button.dataset.id);
    else if (action === 'details') openDetails(button.dataset.id,button.dataset.offset);
    else if (action === 'guide') openGuide();
    else if (action === 'close-dialog') closeDialog();
    else if (action === 'delete-entry') openDeleteConfirmation(button.dataset.id);
    else if (action === 'confirm-delete') {
      removeEntries([button.dataset.id]); saveData(); closeDialog(); renderAll(); toast('Study entry and its reviews deleted.');
    }
    else if (action === 'toggle-review') toggleReview(button.dataset.id,Number(button.dataset.offset));
    else if (action === 'queue-filter') {
      if (['todo','all','done'].includes(button.dataset.filter)) { state.queueFilter = button.dataset.filter; renderQueueView(); }
    }
    else if (action === 'edit-name') openNameDialog();
    else if (action === 'daily-yes' || action === 'daily-no') {
      dailyPace = `${keyOf(today)}:${action === 'daily-yes' ? 'yes' : 'no'}`;
      try { localStorage.setItem(PACE_KEY, dailyPace); } catch (_) { /* Session-only storage. */ }
      updateGreeting();
      if (action === 'daily-yes') {
        $('#quickTopic').focus();
        const h = new Date().getHours();
        toast(h < 12 ? 'Love that morning energy — what did you study?' : h < 19 ? 'Let’s go — what did you study today?' : 'Night-owl grind, I love it. What did you study?');
      }
      else toast('Rest is part of the rhythm. I’ll be here whenever you’re ready.');
    }
    else if (action === 'theme') openThemePicker(false);
    else if (action === 'choose-theme') {
      applyTheme(button.dataset.theme);
      closeDialog();
      renderAll();
      toast('Theme set — enjoy your space.');
      maybeAskName();
    }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'studySearch') { state.studySearch = event.target.value; renderStudyRows(); }
    if (event.target.id === 'studyDateInput') {
      const preview = $('#schedulePreviewDates');
      if (preview) preview.textContent = scheduleDates(parseKey(event.target.value));
    }
    if (event.target.id === 'topicInput') event.target.setCustomValidity('');
  });
  document.addEventListener('submit', event => {
    if (event.target.id === 'quickAddForm') {
      event.preventDefault();
      const input = $('#quickTopic');
      const topic = input.value.trim();
      if (!topic) { input.focus(); return; }
      const subject = $('#quickSubject').value || 'General';
      data.entries.unshift({ id: makeId(), topic, subject, studyDate: keyOf(today), notes: '', sample: false });
      state.view = 'calendar';
      state.selectedDate = today;
      state.displayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      try { localStorage.setItem(LAST_SUBJECT_KEY, subject); } catch (_) { /* Session-only storage. */ }
      saveData();
      input.value = '';
      const first = formatShort(addDays(today, 3), addDays(today, 3).getFullYear() !== today.getFullYear());
      toast(`“${topic}” logged — first review on ${first}.`);
      renderAll();
      input.focus();
      const bar = $('#quickAddForm');
      bar.classList.remove('is-flash');
      void bar.offsetWidth;
      bar.classList.add('is-flash');
      return;
    }
    if (event.target.id === 'nameForm') {
      event.preventDefault();
      const name = $('#nameInput', event.target).value.trim().replace(/\s+/g,' ').slice(0,32);
      if (!name) { $('#nameInput', event.target).focus(); return; }
      userName = name;
      try { localStorage.setItem(NAME_KEY, name); } catch (_) { /* Session-only storage. */ }
      closeDialog(); renderAll();
      const hour = new Date().getHours();
      const welcomeToast = hour < 12 ? `Good morning, ${name} — so glad you’re here.` : hour < 19 ? `Hey ${name}, welcome in. Let’s get to it.` : `Good evening, ${name} — welcome.`;
      toast(welcomeToast);
      return;
    }
    if (event.target.id !== 'entryForm') return;
    event.preventDefault();
    const form = event.target;
    const topicInput = $('#topicInput',form);
    const topic = topicInput.value.trim();
    if (!topic) { topicInput.setCustomValidity('Please enter what you studied.'); topicInput.reportValidity(); topicInput.focus(); return; }
    const subject = $('#subjectInput',form).value.trim() || 'General';
    const studyDate = $('#studyDateInput',form).value;
    const notes = $('#notesInput',form).value.trim();
    const studied = parseKey(studyDate);
    if (!studied || dayDifference(studied,today) > 0 || studied.getFullYear() < 1900) { $('#studyDateInput',form).reportValidity(); return; }
    const entryId = form.dataset.entryId;
    const entry = entryId ? data.entries.find(item => item.id === entryId) : null;
    if (entryId && !entry) return;
    if (entry) {
      if (entry.studyDate !== studyDate) {
        for (const key of Object.keys(data.completed)) if (key.startsWith(`${entry.id}::`)) delete data.completed[key];
      }
      Object.assign(entry,{topic,subject,studyDate,notes,sample:false});
    } else {
      data.entries.unshift({id:makeId(),topic,subject,studyDate,notes,sample:false});
      state.view = 'calendar';
      state.selectedDate = studied;
      state.displayMonth = new Date(studied.getFullYear(),studied.getMonth(),1);
    }
    saveData(); closeDialog(); renderAll();
    toast(entry ? 'Your study entry was updated.' : `Entry saved! First review: ${formatShort(addDays(studied,3),addDays(studied,3).getFullYear() !== today.getFullYear())}.`);
  });
  document.addEventListener('keydown', event => {
    const layer = $('#dialogLayer');
    if (!layer.hidden && event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
    if (!layer.hidden && event.key === 'Tab') {
      const focusables = [...layer.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length-1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    if ((event.key === 'n' || event.key === '/') && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const active = document.activeElement;
      const tag = active && active.tagName;
      if (!['INPUT','TEXTAREA','SELECT','BUTTON'].includes(tag) && state.view === 'calendar' && $('#quickAddForm')) {
        event.preventDefault();
        $('#quickTopic').focus();
      }
    }
  });
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const updated = JSON.parse(event.newValue);
      if (Array.isArray(updated.entries) && updated.completed) { data = updated; renderAll(); }
    } catch (_) { /* Ignore malformed changes from another tab. */ }
  });
  setInterval(() => {
    const now = startOfDay(new Date());
    if (keyOf(now) !== keyOf(today)) {
      const wasToday = keyOf(state.selectedDate) === keyOf(today);
      today = now;
      if (wasToday) { state.selectedDate = now; state.displayMonth = new Date(now.getFullYear(),now.getMonth(),1); }
      renderAll();
    } else if (state.view === 'calendar') updateGreeting();
  },60000);
  // Restore the chosen theme, then persist the starter workspace.
  const initialTheme = storedThemeChoice();
  if (initialTheme) applyTheme(initialTheme);
  saveData();
  renderAll();
  if (!storedThemeChoice() && !themeAsked) {
    themeAsked = true;
    openThemePicker(true);
  } else if (!initialTheme || storedThemeChoice()) {
    maybeAskName();
  }
})();
