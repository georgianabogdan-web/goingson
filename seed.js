// Run once to import events.json into Supabase:
//   SUPABASE_URL=... SUPABASE_KEY=... node seed.js

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Set SUPABASE_URL and SUPABASE_KEY environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  const file = path.join(__dirname, "events.json");
  const events = JSON.parse(fs.readFileSync(file, "utf8"));

  const rows = events.map((e) => ({
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
  }));

  const { error } = await supabase.from("events").insert(rows);
  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
  console.log(`Seeded ${rows.length} events into Supabase.`);
}

seed();
