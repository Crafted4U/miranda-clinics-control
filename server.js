const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE = 'https://mc-api.solcredio.net/api/queue';
const STATE_FILE = path.join(__dirname, 'queue-state.json');

function loadRoomState() {
  try {
    const fileContents = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(fileContents);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function saveRoomState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

const roomState = loadRoomState();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

function normalizeRoom(roomKey, roomData) {
  if (!roomData || typeof roomData !== 'object') {
    return {
      room: roomKey,
      doctor: '',
      number: '000',
      doctorIn: true,
    };
  }

  return {
    ...roomData,
    room: roomData.room || roomKey,
    doctor: roomData.doctor || '',
    number: roomData.number ?? '000',
    doctorIn: roomData.doctorIn !== undefined ? Boolean(roomData.doctorIn) : true,
  };
}

function mergeRoomState(remoteData, localData = {}) {
  const merged = {};
  Object.entries(remoteData || {}).forEach(([roomKey, roomData]) => {
    merged[roomKey] = normalizeRoom(roomKey, {
      ...roomData,
      ...localData[roomKey],
    });
  });

  Object.entries(localData).forEach(([roomKey, roomData]) => {
    if (!merged[roomKey]) {
      merged[roomKey] = normalizeRoom(roomKey, roomData);
    }
  });

  return merged;
}

async function fetchRemoteQueue() {
  const response = await fetch(API_BASE);
  if (!response.ok) {
    throw new Error(`Upstream request failed with status ${response.status}`);
  }
  return response.json();
}

async function getQueueState() {
  const remoteData = await fetchRemoteQueue();
  return mergeRoomState(remoteData, roomState);
}

app.get('/api/queue', async (req, res) => {
  try {
    const data = await getQueueState();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

app.put('/api/queue/:room', async (req, res) => {
  try {
    const roomKey = req.params.room;
    const currentState = await getQueueState();
    const currentRoom = currentState[roomKey] || {
      room: roomKey,
      doctor: '',
      number: '000',
      doctorIn: true,
    };

    const nextRoom = normalizeRoom(roomKey, {
      ...currentRoom,
      ...req.body,
      number: req.body.number !== undefined ? String(req.body.number) : currentRoom.number,
      doctorIn: req.body.doctorIn !== undefined ? Boolean(req.body.doctorIn) : currentRoom.doctorIn,
    });

    roomState[roomKey] = nextRoom;
    saveRoomState(roomState);

    try {
      await fetch(`${API_BASE}/${roomKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
    } catch (upstreamError) {
      console.warn('Upstream toggle update failed, using local state instead.', upstreamError.message);
    }

    res.json({ success: true, room: nextRoom });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update queue' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Queue control app running on http://localhost:${PORT}`);
});
