const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const workspaceRoot = path.join(__dirname, '..');
const stateFilePath = path.join(workspaceRoot, 'queue-state.json');

async function waitForServer(url, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Keep retrying until the server responds.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start in time: ${url}`);
}

test('PUT /api/queue/:room/doctor-status updates the local queue state', async () => {
  const originalState = fs.readFileSync(stateFilePath, 'utf8');
  const child = spawn(process.execPath, ['server.js'], {
    cwd: workspaceRoot,
    env: { ...process.env, PORT: '3101' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const serverOutput = [];
  child.stdout.on('data', (chunk) => serverOutput.push(chunk.toString()));
  child.stderr.on('data', (chunk) => serverOutput.push(chunk.toString()));

  try {
    await waitForServer('http://127.0.0.1:3101/api/queue');

    const response = await fetch('http://127.0.0.1:3101/api/queue/room1/doctor-status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorIn: false }),
    });

    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.room.doctorIn, false);

    const savedState = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    assert.equal(savedState.room1.doctorIn, false);
  } finally {
    child.kill('SIGTERM');
    fs.writeFileSync(stateFilePath, originalState);
  }
});
