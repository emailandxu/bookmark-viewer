const app = document.getElementById('app');
const statusEl = document.querySelector('.status');
const jumpForm = document.querySelector('[data-role="jump-form"]');
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
let columnsContainer = null;
let calendarMonths = [];
let currentMonthIndex = 0;
let selectedDate = '';
let statusMessage = '';
let calendarOpen = false;

function highlightColumn(section) {
  section.classList.add('highlight');
  setTimeout(() => {
    section.classList.remove('highlight');
  }, 2000);
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
      list.append(createBookmarkItem(item));
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

document.addEventListener('click', () => {
  if (calendarOpen) {
    closeCalendar();
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && calendarOpen) {
    closeCalendar();
  }
});
