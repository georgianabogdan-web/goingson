const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

// --- API routes ---

// Get all events
app.get("/api/events", async (req, res) => {
  const { data, error } = await supabase.from("events").select("*");
  if (error) return res.status(500).json({ error: error.message });
  // Map DB rows to app format
  res.json(data.map(dbToEvent));
});

// Add a new event
app.post("/api/events", async (req, res) => {
  const event = req.body;
  if (!event.id || !event.name) {
    return res.status(400).json({ error: "Event must have id and name" });
  }
  const { data, error } = await supabase
    .from("events")
    .insert(eventToDb(event))
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(dbToEvent(data));
});

// Update an event
app.put("/api/events/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("events")
    .update(eventToDb(req.body))
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Event not found" });
  res.json(dbToEvent(data));
});

// Delete an event
app.delete("/api/events/:id", async (req, res) => {
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// --- DB <-> App format mapping ---

function eventToDb(e) {
  return {
    id: e.id,
    name: e.name,
    venue: e.venue || "",
    city: e.city || "",
    category: e.category || "",
    start_date: e.start,
    end_date: e.end,
    link: e.link || "",
    image: e.image || "",
    details: e.details || "",
    attended: e.attended || false,
  };
}

function dbToEvent(row) {
  return {
    id: row.id,
    name: row.name,
    venue: row.venue,
    city: row.city,
    category: row.category,
    start: row.start_date,
    end: row.end_date,
    link: row.link,
    image: row.image,
    details: row.details,
    attended: row.attended,
  };
}

app.listen(PORT, () => {
  console.log(`Goings On server running on http://localhost:${PORT}`);
});
