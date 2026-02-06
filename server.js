const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "events.json");

app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

// --- Helpers ---

function readEvents() {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeEvents(events) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2) + "\n");
}

// --- API routes ---

// Get all events
app.get("/api/events", (req, res) => {
  res.json(readEvents());
});

// Add a new event
app.post("/api/events", (req, res) => {
  const events = readEvents();
  const event = req.body;
  if (!event.id || !event.name) {
    return res.status(400).json({ error: "Event must have id and name" });
  }
  events.push(event);
  writeEvents(events);
  res.status(201).json(event);
});

// Update an event
app.put("/api/events/:id", (req, res) => {
  const events = readEvents();
  const idx = events.findIndex((e) => e.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: "Event not found" });
  }
  events[idx] = { ...events[idx], ...req.body, id: req.params.id };
  writeEvents(events);
  res.json(events[idx]);
});

// Delete an event
app.delete("/api/events/:id", (req, res) => {
  let events = readEvents();
  const len = events.length;
  events = events.filter((e) => e.id !== req.params.id);
  if (events.length === len) {
    return res.status(404).json({ error: "Event not found" });
  }
  writeEvents(events);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Goings On server running on http://localhost:${PORT}`);
});
