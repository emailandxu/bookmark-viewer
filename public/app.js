const app = document.getElementById('app');
const statusEl = document.querySelector('.status');
const jumpForm = document.querySelector('[data-role="jump-form"]');
const searchBox = document.querySelector('[data-role="search-box"]');
const searchInput = document.querySelector('[data-role="search-input"]');
const searchResultsEl = document.querySelector('[data-role="search-results"]');
const dateButton = document.querySelector('[data-role="date-button"]');
const calendarEl = document.querySelector('[data-role="calendar"]');
const dateValueInput = document.querySelector('[data-role="date-value"]');
const todayButton = document.querySelector('[data-role="jump-today"]');
const prevDayButton = document.querySelector('[data-role="jump-prev-day"]');
const nextDayButton = document.querySelector('[data-role="jump-next-day"]');
const prevWeekButton = document.querySelector('[data-role="jump-prev-week"]');
const nextWeekButton = document.querySelector('[data-role="jump-next-week"]');

const columnsMap = new Map();
const availableDates = new Set();
const bookmarkElementMap = new Map();
let allBookmarks = [];
let columnsContainer = null;
let calendarMonths = [];
let currentMonthIndex = 0;
let selectedDate = '';
let statusMessage = '';
let calendarOpen = false;
let currentSearchResults = [];
let lastHighlightedBookmark = null;
let bookmarkHighlightTimer = null;
const MAX_SEARCH_RESULTS = 8;
let searchActiveIndex = -1;

function highlightColumn(section) {
  section.classList.add('highlight');
  setTimeout(() => {
    section.classList.remove('highlight');
  }, 2000);
}

function highlightBookmark(element) {
  if (!element) {
    return;
  }
  if (lastHighlightedBookmark && lastHighlightedBookmark !== element) {
    lastHighlightedBookmark.classList.remove('search-highlight');
  }
  element.classList.add('search-highlight');
  if (bookmarkHighlightTimer) {
    clearTimeout(bookmarkHighlightTimer);
  }
  bookmarkHighlightTimer = setTimeout(() => {
    element.classList.remove('search-highlight');
    bookmarkHighlightTimer = null;
  }, 2500);
  lastHighlightedBookmark = element;
}

function showTemporaryStatus(message) {
  if (!statusEl) return;
  statusEl.textContent = message;
  if (!statusMessage) {
    return;
  }
  setTimeout(() => {
    if (statusEl.textContent === message) {
      statusEl.textContent = statusMessage;
    }
  }, 2500);
}

function formatDateLabel(dateString) {
  if (!dateString || dateString === 'unknown') {
    return 'Unknown date';
  }
  const date = new Date(`${dateString}T00:00:00`);
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const fullFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' });
  const shortLabel = formatter.format(date);
  const twoDigitYear = String(date.getFullYear()).slice(-2).padStart(2, '0');
  return {
    short: `${shortLabel}, ${twoDigitYear}`,
    full: fullFormatter.format(date),
  };
}

function createBookmarkItem(item) {
  const li = document.createElement('li');
  li.className = 'bookmark-item';

  const header = document.createElement('div');
  header.className = 'bookmark-header';

  const link = document.createElement('a');
  link.href = item.url;
  link.textContent = item.title;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  const hostname = (() => {
    try {
      return new URL(item.url).hostname;
    } catch (error) {
      return '';
    }
  })();

  const meta = document.createElement('div');
  meta.className = 'bookmark-meta';
  const parts = [];
  if (hostname) {
    parts.push(hostname);
  }
  if (item.dateAdded) {
    const addedDate = new Date(item.dateAdded);
    parts.push(`Added ${addedDate.toLocaleString()}`);
  }
  if (item.path && item.path.length > 0) {
    parts.push(`Path: ${item.path.join(' / ')}`);
  }
  meta.textContent = parts.join(' · ');

  const toggle = document.createElement('button');
  toggle.className = 'bookmark-toggle';
  toggle.type = 'button';
  toggle.textContent = 'Details';
  toggle.setAttribute('aria-expanded', 'false');

  const panel = document.createElement('div');
  panel.className = 'bookmark-details';
  panel.hidden = true;
  panel.innerHTML = `<p>Additional details can live here in a future update.</p>`;

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
  });

  header.append(link, toggle);
  li.append(header, meta, panel);
  return li;
}

function dateStringToUTC(value) {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  if ([year, month, day].some(Number.isNaN)) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function dateToString(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

function getTodayString() {
  const now = new Date();
  return dateToString(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

function getSortedAvailableDates() {
  return Array.from(availableDates).sort();
}

function findDateOnOrBefore(dateString) {
  if (!dateString) {
    return null;
  }
  const sorted = getSortedAvailableDates();
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i] <= dateString) {
      return sorted[i];
    }
  }
  return null;
}

function findDateOnOrAfter(dateString) {
  if (!dateString) {
    return null;
  }
  const sorted = getSortedAvailableDates();
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i] >= dateString) {
      return sorted[i];
    }
  }
  return null;
}

function addDays(dateString, amount) {
  const date = dateStringToUTC(dateString);
  if (!date) {
    return null;
  }
  date.setUTCDate(date.getUTCDate() + amount);
  return dateToString(date);
}

function getCurrentBaseDate() {
  const sorted = getSortedAvailableDates();
  if (sorted.length === 0) {
    return null;
  }
  if (selectedDate && availableDates.has(selectedDate)) {
    return selectedDate;
  }
  return sorted[0];
}

function getPrevWeekTarget() {
  const base = getCurrentBaseDate();
  if (!base) {
    return null;
  }
  const target = addDays(base, -7);
  const candidate = target ? findDateOnOrBefore(target) : null;
  if (candidate && candidate !== base) {
    return candidate;
  }
  const sorted = getSortedAvailableDates();
  const index = sorted.indexOf(base);
  if (index > 0) {
    return sorted[index - 1];
  }
  return null;
}

function getNextWeekTarget() {
  const base = getCurrentBaseDate();
  if (!base) {
    return null;
  }
  const target = addDays(base, 7);
  const candidate = target ? findDateOnOrAfter(target) : null;
  if (candidate && candidate !== base) {
    return candidate;
  }
  const sorted = getSortedAvailableDates();
  const index = sorted.indexOf(base);
  if (index >= 0 && index < sorted.length - 1) {
    return sorted[index + 1];
  }
  return null;
}

function getPrevDayTarget() {
  const base = getCurrentBaseDate();
  if (!base) {
    return null;
  }
  const sorted = getSortedAvailableDates();
  const index = sorted.indexOf(base);
  if (index > 0) {
    return sorted[index - 1];
  }
  return null;
}

function getNextDayTarget() {
  const base = getCurrentBaseDate();
  if (!base) {
    return null;
  }
  const sorted = getSortedAvailableDates();
  const index = sorted.indexOf(base);
  if (index >= 0 && index < sorted.length - 1) {
    return sorted[index + 1];
  }
  return null;
}

function getTodayTarget() {
  const sorted = getSortedAvailableDates();
  if (sorted.length === 0) {
    return null;
  }
  const today = getTodayString();
  if (availableDates.has(today)) {
    return today;
  }
  const after = findDateOnOrAfter(today);
  if (after) {
    return after;
  }
  return findDateOnOrBefore(today);
}

function fuzzyScore(target, query) {
  if (!target || !query) {
    return null;
  }
  const haystack = target.toLowerCase();
  const needle = query.toLowerCase();
  let score = 0;
  let searchIndex = 0;
  let lastMatchIndex = -1;

  for (const char of needle) {
    const index = haystack.indexOf(char, searchIndex);
    if (index === -1) {
      return null;
    }
    if (index === searchIndex) {
      score += 2;
    } else {
      score += 1;
    }
    if (lastMatchIndex !== -1) {
      const gap = index - lastMatchIndex - 1;
      score += Math.max(0, 2 - gap * 0.1);
    }
    searchIndex = index + 1;
    lastMatchIndex = index;
  }

  return score - (haystack.length - needle.length) * 0.01;
}

function computeBookmarkScore(bookmark, query) {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) {
    return null;
  }
  const targets = [
    { value: (bookmark.title || '').toLowerCase(), weight: 1.2 },
    { value: (bookmark.url || '').toLowerCase(), weight: 0.8 },
    { value: (bookmark.pathLabel || '').toLowerCase(), weight: 0.6 },
  ];

  let bestScore = -Infinity;
  for (const { value, weight } of targets) {
    if (!value) continue;
    const rawScore = fuzzyScore(value, normalizedQuery);
    if (rawScore == null) continue;
    const weighted = rawScore * weight;
    if (weighted > bestScore) {
      bestScore = weighted;
    }
  }

  if (!Number.isFinite(bestScore) || bestScore === -Infinity) {
    return null;
  }
  return bestScore;
}

function performSearch(query) {
  const cleaned = query.trim();
  if (!cleaned) {
    return [];
  }

  const matches = [];
  for (const bookmark of allBookmarks) {
    const score = computeBookmarkScore(bookmark, cleaned);
    if (score == null) continue;
    matches.push({ ...bookmark, score });
  }

  matches.sort((a, b) => {
    if (b.score === a.score) {
      return a.title.localeCompare(b.title);
    }
    return b.score - a.score;
  });

  return matches.slice(0, MAX_SEARCH_RESULTS);
}

function clearSearchResults() {
  currentSearchResults = [];
  searchActiveIndex = -1;
  if (searchResultsEl) {
    searchResultsEl.innerHTML = '';
    searchResultsEl.hidden = true;
  }
}

function renderSearchResults(matches) {
  if (!searchResultsEl) {
    return;
  }

  searchResultsEl.innerHTML = '';
  currentSearchResults = matches;
  searchActiveIndex = -1;

  if (!matches.length) {
    const empty = document.createElement('div');
    empty.className = 'search-result-empty';
    empty.textContent = 'No matches found.';
    searchResultsEl.append(empty);
    searchResultsEl.hidden = false;
    return;
  }

  for (const result of matches) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-result-item';
    button.dataset.guid = result.guid;
    button.dataset.date = result.date;

    const title = document.createElement('span');
    title.className = 'search-result-title';
    title.textContent = result.title || result.url;

    const meta = document.createElement('span');
    meta.className = 'search-result-meta';
    const metaParts = [];
    metaParts.push(result.date);
    if (result.pathLabel) {
      metaParts.push(result.pathLabel);
    }
    if (result.hostname) {
      metaParts.push(result.hostname);
    }
    meta.textContent = metaParts.join(' • ');

    button.append(title, meta);
    button.addEventListener('click', () => {
      selectSearchResult(result);
    });
    button.addEventListener('keydown', event => {
      handleSearchResultKeydown(event);
    });

    searchResultsEl.append(button);
  }

  searchResultsEl.hidden = false;
}

function handleSearchInput() {
  if (!searchInput) {
    return;
  }
  const query = searchInput.value.trim();
  if (!query) {
    clearSearchResults();
    return;
  }

  const matches = performSearch(query);
  renderSearchResults(matches);
}

function selectSearchResult(result) {
  if (!result) {
    return;
  }
  setSelectedDate(result.date);
  jumpToDate(result.date);
  const element = bookmarkElementMap.get(result.guid) || result.element;
  if (element) {
    highlightBookmark(element);
    const list = element.closest('.bookmark-list');
    if (list && list.scrollHeight > list.clientHeight) {
      const offset = element.offsetTop - list.offsetTop;
      const targetScroll = Math.max(0, offset - list.clientHeight / 3);
      list.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  }
  if (searchResultsEl) {
    searchResultsEl.hidden = true;
  }
  searchActiveIndex = -1;
}

function focusSearchResult(index) {
  if (!searchResultsEl) {
    return;
  }
  const buttons = Array.from(searchResultsEl.querySelectorAll('.search-result-item'));
  if (!buttons.length) {
    return;
  }
  if (index < 0) {
    searchActiveIndex = -1;
    if (searchInput) {
      searchInput.focus();
    }
    return;
  }
  const normalized = Math.max(0, Math.min(index, buttons.length - 1));
  searchActiveIndex = normalized;
  const button = buttons[normalized];
  button.focus();
}

function handleSearchResultKeydown(event) {
  if (!currentSearchResults.length) {
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    focusSearchResult(searchActiveIndex + 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    focusSearchResult(searchActiveIndex - 1);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const result = currentSearchResults[searchActiveIndex];
    if (result) {
      selectSearchResult(result);
    }
  } else if (event.key === 'Escape') {
    clearSearchResults();
    if (searchInput) {
      searchInput.focus();
    }
  }
}

function updateQuickJumpButtons() {
  if (todayButton) {
    todayButton.disabled = !getTodayTarget();
  }
  if (prevDayButton) {
    prevDayButton.disabled = !getPrevDayTarget();
  }
  if (nextDayButton) {
    nextDayButton.disabled = !getNextDayTarget();
  }
  if (prevWeekButton) {
    prevWeekButton.disabled = !getPrevWeekTarget();
  }
  if (nextWeekButton) {
    nextWeekButton.disabled = !getNextWeekTarget();
  }
}

function buildCalendarMonths() {
  const dates = getSortedAvailableDates();
  const monthMap = new Map();
  const monthFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  });

  for (const dateString of dates) {
    const [year, month] = dateString.split('-', 2);
    const key = `${year}-${month}`;
    if (!monthMap.has(key)) {
      const date = new Date(`${key}-01T00:00:00`);
      monthMap.set(key, {
        key,
        year: Number(year),
        monthIndex: Number(month) - 1,
        label: monthFormatter.format(date),
        dates: new Set(),
      });
    }
    monthMap.get(key).dates.add(dateString);
  }

  return Array.from(monthMap.values()).sort((a, b) => {
    if (a.year === b.year) {
      return a.monthIndex - b.monthIndex;
    }
    return a.year - b.year;
  });
}

function renderCalendar(monthIndex = currentMonthIndex) {
  if (!calendarEl) {
    return;
  }

  calendarEl.innerHTML = '';

  if (calendarMonths.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'calendar-empty';
    empty.textContent = 'No available dates yet.';
    calendarEl.append(empty);
    return;
  }

  currentMonthIndex = Math.min(Math.max(monthIndex, 0), calendarMonths.length - 1);
  const month = calendarMonths[currentMonthIndex];

  const header = document.createElement('div');
  header.className = 'calendar-header';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'calendar-nav';
  prevBtn.textContent = '‹';
  prevBtn.disabled = currentMonthIndex === 0;
  prevBtn.addEventListener('click', () => {
    renderCalendar(currentMonthIndex - 1);
  });

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'calendar-nav';
  nextBtn.textContent = '›';
  nextBtn.disabled = currentMonthIndex === calendarMonths.length - 1;
  nextBtn.addEventListener('click', () => {
    renderCalendar(currentMonthIndex + 1);
  });

  const title = document.createElement('div');
  title.className = 'calendar-title';
  title.textContent = month.label;

  header.append(prevBtn, title, nextBtn);

  const weekdaysRow = document.createElement('div');
  weekdaysRow.className = 'calendar-weekdays';
  const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  const baseWeekDate = new Date(2024, 0, 7);
  for (let day = 0; day < 7; day += 1) {
    const weekday = document.createElement('div');
    weekday.className = 'calendar-weekday';
    const referenceDate = new Date(baseWeekDate);
    referenceDate.setDate(baseWeekDate.getDate() + day);
    weekday.textContent = weekdayFormatter.format(referenceDate);
    weekdaysRow.append(weekday);
  }

  const grid = document.createElement('div');
  grid.className = 'calendar-grid';

  const firstDay = new Date(month.year, month.monthIndex, 1).getDay();
  const daysInMonth = new Date(month.year, month.monthIndex + 1, 0).getDate();

  for (let i = 0; i < firstDay; i += 1) {
    const filler = document.createElement('div');
    filler.className = 'calendar-cell filler';
    grid.append(filler);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayCell = document.createElement('button');
    dayCell.type = 'button';
    const monthNumber = String(month.monthIndex + 1).padStart(2, '0');
    const dayNumber = String(day).padStart(2, '0');
    const dateString = `${month.year}-${monthNumber}-${dayNumber}`;
    dayCell.textContent = String(day);
    dayCell.className = 'calendar-cell calendar-day';

    if (!month.dates.has(dateString)) {
      dayCell.disabled = true;
      dayCell.classList.add('disabled');
    } else {
      dayCell.dataset.date = dateString;
      if (selectedDate === dateString) {
        dayCell.classList.add('selected');
      }
      dayCell.addEventListener('click', () => {
        setSelectedDate(dateString);
        closeCalendar();
        jumpToDate(dateString);
      });
    }

    grid.append(dayCell);
  }

  const totalCells = firstDay + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < trailing; i += 1) {
    const filler = document.createElement('div');
    filler.className = 'calendar-cell filler';
    grid.append(filler);
  }

  calendarEl.append(header, weekdaysRow, grid);
}

function setSelectedDate(value) {
  selectedDate = value;
  if (dateValueInput) {
    dateValueInput.value = value;
  }
  if (dateButton) {
    if (!value) {
      if (availableDates.size === 0) {
        dateButton.textContent = 'No dates available';
        dateButton.title = '';
        dateButton.disabled = true;
      } else {
        dateButton.textContent = 'Select date';
        dateButton.title = '';
        dateButton.disabled = false;
      }
    } else {
      dateButton.disabled = false;
      const formatted = formatDateLabel(value);
      if (typeof formatted === 'object') {
        dateButton.textContent = formatted.short;
        dateButton.title = formatted.full;
      } else {
        dateButton.textContent = formatted;
        dateButton.title = formatted;
      }
    }
  }

  if (value) {
    const monthKey = value.slice(0, 7);
    const index = calendarMonths.findIndex(month => month.key === monthKey);
    if (index >= 0) {
      currentMonthIndex = index;
    }
  }

  updateQuickJumpButtons();
  renderCalendar(currentMonthIndex);
}

function openCalendar() {
  if (!calendarEl || calendarOpen || availableDates.size === 0) {
    return;
  }
  calendarEl.hidden = false;
  calendarOpen = true;
  renderCalendar(currentMonthIndex);
}

function closeCalendar() {
  if (!calendarEl || !calendarOpen) {
    return;
  }
  calendarEl.hidden = true;
  calendarOpen = false;
}

function toggleCalendar() {
  if (availableDates.size === 0) {
    return;
  }
  if (calendarOpen) {
    closeCalendar();
  } else {
    openCalendar();
  }
}

function renderGroups(data) {
  const existingColumns = document.querySelector('.columns');
  if (existingColumns) {
    existingColumns.remove();
  }

  const container = document.createElement('div');
  container.className = 'columns';
  columnsContainer = container;
  columnsMap.clear();
  availableDates.clear();
  bookmarkElementMap.clear();
  allBookmarks = [];

  if (!data.groups || data.groups.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Nothing found under the 看过 folder yet.';
    container.append(empty);
    app.append(container);
    calendarMonths = [];
    setSelectedDate('');
    closeCalendar();
    columnsContainer = container;
    return;
  }

  for (const group of data.groups) {
    const section = document.createElement('section');
    section.className = 'day-column';
    section.dataset.date = group.date;

    const header = document.createElement('header');
    header.className = 'day-header';

    let label = 'Unknown date';
    let fullLabel = 'Unknown date';
    const formatted = formatDateLabel(group.date);
    if (typeof formatted === 'object') {
      label = formatted.short;
      fullLabel = formatted.full;
    } else if (typeof formatted === 'string') {
      label = formatted;
      fullLabel = formatted;
    }

    const title = document.createElement('h2');
    title.textContent = label;
    title.title = fullLabel;

    const count = document.createElement('span');
    count.className = 'badge';
    count.textContent = `${group.count}`;
    count.title = `${group.count} bookmark${group.count === 1 ? '' : 's'}`;

    header.append(title, count);

    const list = document.createElement('ul');
    list.className = 'bookmark-list';

    for (const item of group.items) {
      const listItem = createBookmarkItem(item);
      listItem.dataset.bookmarkGuid = item.guid;
      list.append(listItem);
      bookmarkElementMap.set(item.guid, listItem);

      const hostname = (() => {
        try {
          return new URL(item.url).hostname;
        } catch (error) {
          return '';
        }
      })();
      const pathLabel = item.path && item.path.length > 0 ? item.path.join(' / ') : '';

      allBookmarks.push({
        guid: item.guid,
        title: item.title,
        url: item.url,
        date: group.date,
        path: item.path,
        pathLabel,
        hostname,
        element: listItem,
      });
    }

    section.append(header, list);
    container.append(section);
    columnsMap.set(group.date, section);
    availableDates.add(group.date);
  }

  app.append(container);

  calendarMonths = buildCalendarMonths();
  if (!selectedDate || !availableDates.has(selectedDate)) {
    const sorted = getSortedAvailableDates();
    selectedDate = sorted[sorted.length - 1];
  }

  setSelectedDate(selectedDate);

  if (searchInput && searchInput.value.trim()) {
    handleSearchInput();
  }
}

async function init() {
  statusEl.textContent = 'Loading bookmarks…';
  try {
    const response = await fetch('/api/watched');
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }
    const data = await response.json();

    renderGroups(data);

    const summaryParts = [];
    if (data.totalCount != null) {
      summaryParts.push(`${data.totalCount} total bookmarks`);
    }
    if (data.sourcePath) {
      summaryParts.push(`Source: ${data.sourcePath}`);
    }
    summaryParts.push(`Synced ${new Date(data.updatedAt).toLocaleString()}`);

    statusMessage = summaryParts.join(' • ');
    statusEl.textContent = statusMessage;
  } catch (error) {
    console.error('Failed to load bookmarks', error);
    statusEl.textContent = 'Unable to load bookmarks. See console for details.';
  }
}

function jumpToDate(value) {
  if (!value) {
    return;
  }
  if (!availableDates.has(value)) {
    showTemporaryStatus(`No bookmarks found for ${value}.`);
    return;
  }
  const target = columnsMap.get(value);
  if (!target) {
    showTemporaryStatus(`No bookmarks found for ${value}.`);
    return;
  }
  scrollColumnIntoView(target);
  highlightColumn(target);
  if (statusMessage) {
    statusEl.textContent = statusMessage;
  }
}

function scrollColumnIntoView(section) {
  const container = columnsContainer;
  if (!container || !section) {
    return;
  }
  const containerWidth = container.clientWidth;
  const maxScroll = container.scrollWidth - containerWidth;
  if (maxScroll <= 0) {
    return;
  }
  const sectionCenter = section.offsetLeft + section.offsetWidth / 2;
  const desiredScroll = sectionCenter - containerWidth / 2;
  const nextScroll = Math.max(0, Math.min(maxScroll, desiredScroll));
  container.scrollTo({ left: nextScroll, behavior: 'smooth' });
}

function jumpToToday() {
  const target = getTodayTarget();
  if (!target) {
    showTemporaryStatus('No bookmarks available near today.');
    return;
  }
  setSelectedDate(target);
  jumpToDate(target);
}

function jumpWeek(direction) {
  const target = direction === 'previous' ? getPrevWeekTarget() : getNextWeekTarget();
  if (!target) {
    showTemporaryStatus(direction === 'previous' ? 'No earlier bookmarks available.' : 'No later bookmarks available.');
    return;
  }
  setSelectedDate(target);
  jumpToDate(target);
}

function jumpDay(direction) {
  const target = direction === 'previous' ? getPrevDayTarget() : getNextDayTarget();
  if (!target) {
    showTemporaryStatus(direction === 'previous' ? 'No earlier bookmarks available.' : 'No later bookmarks available.');
    return;
  }
  setSelectedDate(target);
  jumpToDate(target);
}

setSelectedDate('');
updateQuickJumpButtons();
init();

if (searchInput) {
  searchInput.addEventListener('input', () => {
    handleSearchInput();
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) {
      handleSearchInput();
    }
  });

  searchInput.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      if (currentSearchResults.length) {
        event.preventDefault();
        focusSearchResult(0);
      }
    } else if (event.key === 'Enter') {
      const targetResult = currentSearchResults[searchActiveIndex >= 0 ? searchActiveIndex : 0];
      if (targetResult) {
        event.preventDefault();
        selectSearchResult(targetResult);
      }
    } else if (event.key === 'Escape') {
      if (searchInput.value) {
        searchInput.value = '';
      }
      clearSearchResults();
    }
  });
}

if (jumpForm) {
  jumpForm.addEventListener('submit', event => {
    event.preventDefault();
    closeCalendar();
    if (selectedDate) {
      jumpToDate(selectedDate);
    }
  });
}

if (dateButton) {
  dateButton.addEventListener('click', event => {
    event.stopPropagation();
    toggleCalendar();
  });
}

if (calendarEl) {
  calendarEl.addEventListener('click', event => {
    event.stopPropagation();
  });
}

if (todayButton) {
  todayButton.addEventListener('click', event => {
    event.preventDefault();
    closeCalendar();
    jumpToToday();
  });
}

if (prevWeekButton) {
  prevWeekButton.addEventListener('click', event => {
    event.preventDefault();
    closeCalendar();
    jumpWeek('previous');
  });
}

if (nextWeekButton) {
  nextWeekButton.addEventListener('click', event => {
    event.preventDefault();
    closeCalendar();
    jumpWeek('next');
  });
}

if (prevDayButton) {
  prevDayButton.addEventListener('click', event => {
    event.preventDefault();
    closeCalendar();
    jumpDay('previous');
  });
}

if (nextDayButton) {
  nextDayButton.addEventListener('click', event => {
    event.preventDefault();
    closeCalendar();
    jumpDay('next');
  });
}

document.addEventListener('click', event => {
  const targetNode = event.target instanceof Node ? event.target : null;

  if (calendarOpen) {
    if (
      calendarEl &&
      !calendarEl.contains(targetNode) &&
      dateButton &&
      !dateButton.contains(targetNode)
    ) {
      closeCalendar();
    }
  }

  if (searchBox) {
    if (
      searchResultsEl &&
      !searchResultsEl.hidden &&
      !(searchBox.contains(targetNode))
    ) {
      clearSearchResults();
    }
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (calendarOpen) {
      closeCalendar();
    }
    if (searchResultsEl && !searchResultsEl.hidden) {
      clearSearchResults();
    }
  }
});
