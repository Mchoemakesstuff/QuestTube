#!/usr/bin/env node
/**
 * Dev file watcher for QuestTube Chrome extension.
 * Watches extension/ for changes and serves a reload signal on port 3001.
 *
 * Usage:  node dev-reload.mjs
 * Then in background.js, the dev-reload block polls localhost:3001/reload
 */

import { watch } from 'fs';
import { createServer } from 'http';
import { resolve } from 'path';

const WATCH_DIR = resolve('extension');
const PORT = 3001;

let lastChange = Date.now();

// Watch the extension directory recursively
watch(WATCH_DIR, { recursive: true }, (eventType, filename) => {
  if (!filename) return;
  // Ignore .DS_Store and other junk
  if (filename.startsWith('.') || filename.includes('node_modules')) return;
  lastChange = Date.now();
  console.log(`\x1b[33m[reload]\x1b[0m ${eventType}: ${filename}`);
});

// Simple HTTP endpoint that returns the last-change timestamp
const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ts: lastChange }));
});

server.listen(PORT, () => {
  console.log(`\x1b[36m[dev-reload]\x1b[0m Watching ${WATCH_DIR}`);
  console.log(`\x1b[36m[dev-reload]\x1b[0m Reload signal on http://localhost:${PORT}`);
  console.log(`\x1b[36m[dev-reload]\x1b[0m Extension will auto-reload on file changes\n`);
});
