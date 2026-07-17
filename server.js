const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE = 'https://mc-api.solcredio.net/api/queue';

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/queue', async (req, res) => {
  try {
    const response = await fetch(API_BASE);
    const data = await response.text();
    res.status(response.status).set('Content-Type', 'application/json').send(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

app.put('/api/queue/:room', async (req, res) => {
  try {
    const response = await fetch(`${API_BASE}/${req.params.room}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    const text = await response.text();
    res.status(response.status).set('Content-Type', 'application/json').send(text);
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
