const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
const PORT = process.env.PORT || 3001;

// --- Supabase setup ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY environment variables.");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Anthropic setup ---
const anthropicKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicKey) {
  console.error("Missing ANTHROPIC_API_KEY environment variable.");
  process.exit(1);
}
const anthropic = new Anthropic({ apiKey: anthropicKey });

app.use(express.json({ limit: "5mb" }));
app.use(express.static(__dirname + "/public"));

// ============================================================
// PROFILE ROUTES
// ============================================================

app.get("/api/profile", async (req, res) => {
  const { data, error } = await supabase
    .from("trainer_profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error && error.code === "PGRST116") return res.json(null); // no rows
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/profile", async (req, res) => {
  const p = req.body;
  if (!p.name) return res.status(400).json({ error: "Name is required" });

  const row = {
    name: p.name,
    age: p.age || null,
    weight_kg: p.weight_kg || null,
    height_cm: p.height_cm || null,
    fitness_goal: p.fitness_goal || "",
    experience_level: p.experience_level || "beginner",
    injuries_notes: p.injuries_notes || "",
    available_equipment: p.available_equipment || "full gym",
    days_per_week: p.days_per_week || 3,
    notes: p.notes || "",
  };

  const { data, error } = await supabase
    .from("trainer_profiles")
    .upsert({ ...row, id: p.id || undefined }, { onConflict: "id" })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ============================================================
// EXERCISES ROUTES
// ============================================================

app.get("/api/exercises", async (req, res) => {
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .order("muscle_group");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ============================================================
// WORKOUT PLAN ROUTES
// ============================================================

app.get("/api/plans", async (req, res) => {
  const { profile_id, week_start } = req.query;
  let query = supabase
    .from("workout_plans")
    .select("*")
    .order("week_start", { ascending: false })
    .order("day_number");

  if (profile_id) query = query.eq("profile_id", profile_id);
  if (week_start) query = query.eq("week_start", week_start);

  const { data, error } = await query.limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/api/plans/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("id", req.params.id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ============================================================
// WORKOUT LOG ROUTES
// ============================================================

app.get("/api/logs", async (req, res) => {
  const { profile_id } = req.query;
  let query = supabase
    .from("workout_logs")
    .select("*")
    .order("completed_at", { ascending: false });
  if (profile_id) query = query.eq("profile_id", profile_id);
  const { data, error } = await query.limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/logs", async (req, res) => {
  const log = req.body;
  const { data, error } = await supabase
    .from("workout_logs")
    .insert({
      profile_id: log.profile_id,
      plan_id: log.plan_id || null,
      exercises_json: log.exercises_json || null,
      feeling: log.feeling || null,
      notes: log.notes || "",
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ============================================================
// AI WORKOUT GENERATION
// ============================================================

app.post("/api/generate", async (req, res) => {
  try {
    const { profile_id } = req.body;
    if (!profile_id)
      return res.status(400).json({ error: "profile_id is required" });

    // Fetch profile
    const { data: profile, error: profileErr } = await supabase
      .from("trainer_profiles")
      .select("*")
      .eq("id", profile_id)
      .single();
    if (profileErr) return res.status(500).json({ error: profileErr.message });

    // Fetch exercise library
    const { data: exercises } = await supabase
      .from("exercises")
      .select("name, muscle_group, equipment, video_url");

    // Fetch recent workout logs for progressive overload context
    const { data: recentLogs } = await supabase
      .from("workout_logs")
      .select("*")
      .eq("profile_id", profile_id)
      .order("completed_at", { ascending: false })
      .limit(10);

    // Fetch most recent plan for continuity
    const { data: recentPlans } = await supabase
      .from("workout_plans")
      .select("*")
      .eq("profile_id", profile_id)
      .order("week_start", { ascending: false })
      .limit(3);

    // Build the week start (next Monday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const nextMonday = new Date(today);
    nextMonday.setDate(
      today.getDate() + ((dayOfWeek === 0 ? 1 : 8 - dayOfWeek) % 7 || 7)
    );
    const weekStart = nextMonday.toISOString().split("T")[0];

    const daysPerWeek = profile.days_per_week || 3;

    const systemPrompt = `You are an expert personal trainer and exercise scientist. You create safe, effective, progressive workout programs.

RULES:
- Always warm up before heavy compounds
- Use progressive overload — if the user logged previous workouts, slightly increase volume or intensity
- Match exercises to available equipment
- Respect injuries and limitations
- Include rest times between sets
- Each workout should take 45-75 minutes
- Use exercises from the provided library when possible (include their video_url)
- You may add exercises not in the library if needed, but prefer library exercises

RESPONSE FORMAT: Return ONLY valid JSON, no markdown, no explanation. The format must be:
{
  "days": [
    {
      "day_number": 1,
      "day_label": "Push (Chest, Shoulders, Triceps)",
      "notes": "Focus on controlled negatives today",
      "exercises": [
        {
          "name": "Barbell Bench Press",
          "muscle_group": "chest",
          "sets": 4,
          "reps": "8-10",
          "rest_seconds": 90,
          "weight_suggestion": "Start at 60kg, increase if form is solid",
          "video_url": "https://www.youtube.com/watch?v=rT7DgCr-3pg",
          "notes": "Retract shoulder blades, arch slightly"
        }
      ]
    }
  ],
  "weekly_notes": "Overall tips for the week"
}`;

    const userMessage = `Generate a ${daysPerWeek}-day workout plan for this week.

USER PROFILE:
- Name: ${profile.name}
- Age: ${profile.age || "not specified"}
- Weight: ${profile.weight_kg ? profile.weight_kg + " kg" : "not specified"}
- Height: ${profile.height_cm ? profile.height_cm + " cm" : "not specified"}
- Goal: ${profile.fitness_goal || "general fitness"}
- Experience: ${profile.experience_level || "beginner"}
- Injuries/limitations: ${profile.injuries_notes || "none"}
- Available equipment: ${profile.available_equipment || "full gym"}
- Additional notes: ${profile.notes || "none"}

EXERCISE LIBRARY (prefer these, include video_url):
${JSON.stringify(exercises, null, 2)}

RECENT WORKOUT LOGS (for progressive overload):
${recentLogs && recentLogs.length > 0 ? JSON.stringify(recentLogs, null, 2) : "No previous logs yet — start with moderate weights."}

PREVIOUS PLANS (for continuity — vary exercises to avoid staleness):
${recentPlans && recentPlans.length > 0 ? JSON.stringify(recentPlans.map((p) => ({ day_label: p.day_label, day_number: p.day_number, week_start: p.week_start })), null, 2) : "No previous plans — this is the first week."}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0].text;
    let plan;
    try {
      plan = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: "AI returned invalid JSON",
        raw: text,
      });
    }

    // Save each day as a separate workout_plans row
    const savedPlans = [];
    for (const day of plan.days) {
      const { data: saved, error: saveErr } = await supabase
        .from("workout_plans")
        .insert({
          profile_id,
          week_start: weekStart,
          day_number: day.day_number,
          day_label: day.day_label,
          workout_json: day,
          notes: day.notes || plan.weekly_notes || "",
        })
        .select()
        .single();
      if (saveErr)
        return res.status(500).json({ error: saveErr.message });
      savedPlans.push(saved);
    }

    res.json({
      week_start: weekStart,
      weekly_notes: plan.weekly_notes,
      plans: savedPlans,
    });
  } catch (err) {
    console.error("Generate error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
app.listen(PORT, () => {
  console.log(`Personal Trainer running on http://localhost:${PORT}`);
});
