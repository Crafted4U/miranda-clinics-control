const API_BASE = '/api/queue';
const AUTH_STORAGE_KEY = 'miranda-clinic-auth';
const AUTH_TTL_MS = 12 * 60 * 60 * 1000;
const statusBanner = document.getElementById('statusBanner');
const roomCards = Array.from(document.querySelectorAll('.room-card'));
const loginOverlay = document.getElementById('loginOverlay');
const appContent = document.getElementById('appContent');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');

function readStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));
  } catch (error) {
    console.error(error);
    return null;
  }
}

function clearExpiredAuth() {
  const auth = readStoredAuth();
  if (auth && Date.now() > auth.expiresAt) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

function isSessionValid() {
  const auth = readStoredAuth();
  return Boolean(auth && auth.username === 'admin' && Date.now() < auth.expiresAt);
}

function showLogin(message = '') {
  loginOverlay.classList.remove('hidden');
  appContent.classList.add('hidden');
  loginError.textContent = message;
  usernameInput.value = '';
  passwordInput.value = '';
  usernameInput.focus();
}

function hideLogin() {
  loginOverlay.classList.add('hidden');
  appContent.classList.remove('hidden');
  loginError.textContent = '';
}

function saveAuth() {
  const expiresAt = Date.now() + AUTH_TTL_MS;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ username: 'admin', expiresAt }));
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '--';
  }
  return String(Number(value)).padStart(3, '0');
}

function showStatus(message, type = 'info') {
  statusBanner.textContent = message;
  statusBanner.style.background = type === 'error' ? '#fee2e2' : '#e8f0ff';
  statusBanner.style.color = type === 'error' ? '#991b1b' : '#1c3b82';
}

async function fetchQueue() {
  try {
    showStatus('Loading queue data...');
    const response = await fetch(API_BASE);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const data = await response.json();
    populateRooms(data);
    showStatus('Queue data loaded. Use the controls to update each room.');
  } catch (error) {
    console.error(error);
    showStatus('Unable to load queue data. Check network or API availability.', 'error');
  }
}

function populateRooms(data) {
  roomCards.forEach((card) => {
    const roomKey = card.dataset.room;
    const roomData = data[roomKey];
    if (!roomData) {
      return;
    }
    card.querySelector('.current-number').value = formatNumber(roomData.number);
    card.querySelector('.doctor-name').value = roomData.doctor || '';
    card.querySelector('.custom-number').value = '';
  });
}

async function updateRoom(roomKey, number, card) {
  if (number < 0) {
    number = 0;
  }
  const buttons = Array.from(card.querySelectorAll('button'));
  buttons.forEach((btn) => (btn.disabled = true));
  try {
    const response = await fetch(`${API_BASE}/${roomKey}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ number }),
    });
    if (!response.ok) {
      throw new Error(`Update failed: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success || !result.room) {
      throw new Error('Unexpected API response');
    }
    card.querySelector('.current-number').value = formatNumber(result.room.number);
    showStatus(`Updated ${result.room.room} to ${formatNumber(result.room.number)}.`);
  } catch (error) {
    console.error(error);
    showStatus(`Unable to update ${roomKey}. Try again.`, 'error');
  } finally {
    buttons.forEach((btn) => (btn.disabled = false));
  }
}

roomCards.forEach((card) => {
  const roomKey = card.dataset.room;
  const decrementButton = card.querySelector('.decrement');
  const incrementButton = card.querySelector('.increment');
  const setButton = card.querySelector('.set-number');
  const customNumberInput = card.querySelector('.custom-number');

  decrementButton.addEventListener('click', async () => {
    const current = Number(card.querySelector('.current-number').value || 0);
    await updateRoom(roomKey, Math.max(current - 1, 0), card);
  });

  incrementButton.addEventListener('click', async () => {
    const current = Number(card.querySelector('.current-number').value || 0);
    await updateRoom(roomKey, current + 1, card);
  });

  setButton.addEventListener('click', async () => {
    const value = Number(customNumberInput.value);
    if (Number.isNaN(value) || value < 0) {
      showStatus('Enter a valid non-negative number before sending.', 'error');
      return;
    }
    await updateRoom(roomKey, value, card);
    customNumberInput.value = '';
  });
});

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (username === 'admin' && password === 'miranda_12345') {
    saveAuth();
    hideLogin();
    fetchQueue();
  } else {
    showLogin('Incorrect username or password.');
  }
});

clearExpiredAuth();
if (isSessionValid()) {
  hideLogin();
  fetchQueue();
} else {
  showLogin();
}
