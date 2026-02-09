// ============================================================
// Personal Trainer AI — Frontend
// ============================================================

const API = "";

let currentProfile = null;
let allExercises = [];
let allPlans = [];

// ============================================================
// NAVIGATION
// ============================================================

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("view-" + btn.dataset.view).classList.add("active");

    // Load data when switching views
    const view = btn.dataset.view;
    if (view === "generate") loadGenerateView();
    if (view === "plans") loadPlans();
    if (view === "log") loadLogView();
    if (view === "exercises") loadExercises();
  });
});

// ============================================================
// PROFILE
// ============================================================

document.getElementById("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = document.getElementById("profile-status");
  status.textContent = "Saving...";
  status.className = "status-msg";

  const body = {
    id: document.getElementById("profile-id").value || undefined,
    name: document.getElementById("profile-name").value,
    age: parseInt(document.getElementById("profile-age").value) || null,
    weight_kg: parseFloat(document.getElementById("profile-weight").value) || null,
    height_cm: parseFloat(document.getElementById("profile-height").value) || null,
    fitness_goal: document.getElementById("profile-goal").value,
    experience_level: document.getElementById("profile-experience").value,
    available_equipment: document.getElementById("profile-equipment").value,
    days_per_week: parseInt(document.getElementById("profile-days").value),
    injuries_notes: document.getElementById("profile-injuries").value,
    notes: document.getElementById("profile-notes").value,
  };

  try {
    const res = await fetch(API + "/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    currentProfile = data;
    document.getElementById("profile-id").value = data.id;
    status.textContent = "Profile saved!";
  } catch (err) {
    status.textContent = "Error: " + err.message;
    status.className = "status-msg error";
  }
});

async function loadProfile() {
  try {
    const res = await fetch(API + "/api/profile");
    const data = await res.json();
    if (!data) return;
    currentProfile = data;
    document.getElementById("profile-id").value = data.id || "";
    document.getElementById("profile-name").value = data.name || "";
    document.getElementById("profile-age").value = data.age || "";
    document.getElementById("profile-weight").value = data.weight_kg || "";
    document.getElementById("profile-height").value = data.height_cm || "";
    document.getElementById("profile-goal").value = data.fitness_goal || "general fitness";
    document.getElementById("profile-experience").value = data.experience_level || "beginner";
    document.getElementById("profile-equipment").value = data.available_equipment || "full gym";
    document.getElementById("profile-days").value = data.days_per_week || 3;
    document.getElementById("profile-injuries").value = data.injuries_notes || "";
    document.getElementById("profile-notes").value = data.notes || "";
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
}

// ============================================================
// GENERATE PLAN
// ============================================================

function loadGenerateView() {
  const summary = document.getElementById("generate-profile-summary");
  if (!currentProfile) {
    summary.innerHTML = '<span>No profile set up yet. Go to the Profile tab first.</span>';
    document.getElementById("btn-generate").disabled = true;
    return;
  }
  document.getElementById("btn-generate").disabled = false;
  summary.innerHTML = `
    <strong>${esc(currentProfile.name)}</strong><br>
    <span>Age:</span> ${currentProfile.age || "—"} &nbsp;|&nbsp;
    <span>Weight:</span> ${currentProfile.weight_kg ? currentProfile.weight_kg + " kg" : "—"} &nbsp;|&nbsp;
    <span>Height:</span> ${currentProfile.height_cm ? currentProfile.height_cm + " cm" : "—"}<br>
    <span>Goal:</span> ${esc(currentProfile.fitness_goal || "—")} &nbsp;|&nbsp;
    <span>Experience:</span> ${esc(currentProfile.experience_level || "—")} &nbsp;|&nbsp;
    <span>Equipment:</span> ${esc(currentProfile.available_equipment || "—")}<br>
    <span>Days/week:</span> ${currentProfile.days_per_week || 3} &nbsp;|&nbsp;
    <span>Injuries:</span> ${esc(currentProfile.injuries_notes || "none")}
  `;
}

document.getElementById("btn-generate").addEventListener("click", async () => {
  if (!currentProfile) return;

  const btn = document.getElementById("btn-generate");
  const status = document.getElementById("generate-status");
  const planDiv = document.getElementById("generated-plan");

  btn.disabled = true;
  status.innerHTML = '<span class="spinner"></span> Generating your workout plan... (this may take 15-30 seconds)';
  status.className = "status-msg";
  planDiv.innerHTML = "";

  try {
    const res = await fetch(API + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: currentProfile.id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    status.textContent = "Plan generated for week of " + data.week_start + "!";

    if (data.weekly_notes) {
      planDiv.innerHTML += `<div class="weekly-notes">${esc(data.weekly_notes)}</div>`;
    }

    for (const plan of data.plans) {
      planDiv.innerHTML += renderDayCard(plan.workout_json);
    }
  } catch (err) {
    status.textContent = "Error: " + err.message;
    status.className = "status-msg error";
  } finally {
    btn.disabled = false;
  }
});

function renderDayCard(day) {
  let html = `<div class="day-card">`;
  html += `<h3>Day ${day.day_number}: ${esc(day.day_label)}</h3>`;
  if (day.notes) html += `<div class="day-notes">${esc(day.notes)}</div>`;

  for (const ex of day.exercises) {
    const nameHtml = ex.video_url
      ? `<a href="${esc(ex.video_url)}" target="_blank">${esc(ex.name)}</a>`
      : esc(ex.name);

    html += `<div class="exercise-row">
      <div class="exercise-name">
        ${nameHtml}
        <span class="muscle-tag">${esc(ex.muscle_group || "")}</span>
      </div>
      <div class="exercise-detail">${ex.sets} x ${esc(String(ex.reps))}</div>
      <div class="exercise-detail">Rest: ${ex.rest_seconds}s</div>
    </div>`;
    if (ex.weight_suggestion) {
      html += `<div class="exercise-suggestion">${esc(ex.weight_suggestion)}</div>`;
    }
    if (ex.notes) {
      html += `<div class="exercise-suggestion">${esc(ex.notes)}</div>`;
    }
  }
  html += `</div>`;
  return html;
}

// ============================================================
// PLANS LIST
// ============================================================

async function loadPlans() {
  if (!currentProfile) {
    document.getElementById("plans-list").innerHTML = "<p>Set up your profile first.</p>";
    return;
  }

  try {
    const res = await fetch(API + "/api/plans?profile_id=" + currentProfile.id);
    allPlans = await res.json();

    const container = document.getElementById("plans-list");
    if (allPlans.length === 0) {
      container.innerHTML = "<p>No plans yet. Go to Generate Plan to create one!</p>";
      return;
    }

    // Group by week
    const weeks = {};
    for (const p of allPlans) {
      if (!weeks[p.week_start]) weeks[p.week_start] = [];
      weeks[p.week_start].push(p);
    }

    let html = "";
    for (const [week, plans] of Object.entries(weeks)) {
      html += `<div class="week-group">`;
      html += `<div class="week-label">Week of ${week}</div>`;
      for (const plan of plans.sort((a, b) => a.day_number - b.day_number)) {
        html += renderDayCard(plan.workout_json);
      }
      html += `</div>`;
    }
    container.innerHTML = html;
  } catch (err) {
    document.getElementById("plans-list").innerHTML =
      "<p>Error loading plans: " + esc(err.message) + "</p>";
  }
}

// ============================================================
// WORKOUT LOG
// ============================================================

async function loadLogView() {
  // Populate plan dropdown
  if (currentProfile) {
    try {
      const res = await fetch(API + "/api/plans?profile_id=" + currentProfile.id);
      const plans = await res.json();
      const select = document.getElementById("log-plan");
      select.innerHTML = '<option value="">— No linked plan —</option>';
      for (const p of plans) {
        select.innerHTML += `<option value="${p.id}">Week ${p.week_start} — Day ${p.day_number}: ${esc(p.day_label)}</option>`;
      }
    } catch {}
  }

  loadLogs();
}

async function loadLogs() {
  if (!currentProfile) {
    document.getElementById("logs-list").innerHTML = "<p>Set up your profile first.</p>";
    return;
  }

  try {
    const res = await fetch(API + "/api/logs?profile_id=" + currentProfile.id);
    const logs = await res.json();

    const container = document.getElementById("logs-list");
    if (logs.length === 0) {
      container.innerHTML = "<p>No workout logs yet.</p>";
      return;
    }

    let html = "";
    for (const log of logs) {
      const date = new Date(log.completed_at).toLocaleDateString("en-GB", {
        weekday: "short", day: "numeric", month: "short", year: "numeric"
      });
      html += `<div class="log-card">
        <div>
          <span class="log-date">${date}</span>
          ${log.feeling ? `<span class="log-feeling ${log.feeling}">${log.feeling}</span>` : ""}
        </div>
        ${log.exercises_json ? `<pre>${esc(typeof log.exercises_json === "string" ? log.exercises_json : JSON.stringify(log.exercises_json, null, 2))}</pre>` : ""}
        ${log.notes ? `<p style="margin-top:0.5rem;color:var(--text-muted);font-size:0.85rem">${esc(log.notes)}</p>` : ""}
      </div>`;
    }
    container.innerHTML = html;
  } catch (err) {
    document.getElementById("logs-list").innerHTML =
      "<p>Error loading logs: " + esc(err.message) + "</p>";
  }
}

document.getElementById("log-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = document.getElementById("log-status");
  status.textContent = "Saving...";
  status.className = "status-msg";

  const body = {
    profile_id: currentProfile?.id,
    plan_id: document.getElementById("log-plan").value || null,
    exercises_json: document.getElementById("log-exercises").value,
    feeling: document.getElementById("log-feeling").value,
    notes: document.getElementById("log-notes").value,
  };

  if (!body.profile_id) {
    status.textContent = "Set up your profile first.";
    status.className = "status-msg error";
    return;
  }

  try {
    const res = await fetch(API + "/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    status.textContent = "Logged!";
    document.getElementById("log-exercises").value = "";
    document.getElementById("log-notes").value = "";
    loadLogs();
  } catch (err) {
    status.textContent = "Error: " + err.message;
    status.className = "status-msg error";
  }
});

// ============================================================
// EXERCISE LIBRARY
// ============================================================

async function loadExercises() {
  try {
    const res = await fetch(API + "/api/exercises");
    allExercises = await res.json();
    populateExerciseFilters();
    renderExercises(allExercises);
  } catch (err) {
    document.getElementById("exercises-list").innerHTML =
      "<p>Error loading exercises: " + esc(err.message) + "</p>";
  }
}

function populateExerciseFilters() {
  const muscles = [...new Set(allExercises.map((e) => e.muscle_group).filter(Boolean))].sort();
  const equipment = [...new Set(allExercises.map((e) => e.equipment).filter(Boolean))].sort();

  const muscleSelect = document.getElementById("filter-muscle");
  muscleSelect.innerHTML = '<option value="">All Muscle Groups</option>';
  for (const m of muscles) {
    muscleSelect.innerHTML += `<option value="${esc(m)}">${esc(m)}</option>`;
  }

  const equipSelect = document.getElementById("filter-equipment");
  equipSelect.innerHTML = '<option value="">All Equipment</option>';
  for (const eq of equipment) {
    equipSelect.innerHTML += `<option value="${esc(eq)}">${esc(eq)}</option>`;
  }
}

document.getElementById("filter-muscle").addEventListener("change", filterExercises);
document.getElementById("filter-equipment").addEventListener("change", filterExercises);

function filterExercises() {
  const muscle = document.getElementById("filter-muscle").value;
  const equip = document.getElementById("filter-equipment").value;
  let filtered = allExercises;
  if (muscle) filtered = filtered.filter((e) => e.muscle_group === muscle);
  if (equip) filtered = filtered.filter((e) => e.equipment === equip);
  renderExercises(filtered);
}

function renderExercises(exercises) {
  const container = document.getElementById("exercises-list");
  if (exercises.length === 0) {
    container.innerHTML = "<p>No exercises found.</p>";
    return;
  }

  let html = "";
  for (const ex of exercises) {
    const nameHtml = ex.video_url
      ? `<a href="${esc(ex.video_url)}" target="_blank">${esc(ex.name)}</a>`
      : esc(ex.name);

    html += `<div class="exercise-card">
      <h4>${nameHtml}</h4>
      <div class="tags">
        ${ex.muscle_group ? `<span class="tag">${esc(ex.muscle_group)}</span>` : ""}
        ${ex.equipment ? `<span class="tag">${esc(ex.equipment)}</span>` : ""}
      </div>
      ${ex.description ? `<p>${esc(ex.description)}</p>` : ""}
    </div>`;
  }
  container.innerHTML = html;
}

// ============================================================
// UTILS
// ============================================================

function esc(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// INIT
// ============================================================

loadProfile();
