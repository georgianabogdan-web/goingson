(function () {
  "use strict";

  const STORAGE_KEY = "goingson_events";

  // DOM elements
  const eventsList = document.getElementById("events-list");
  const noEvents = document.getElementById("no-events");
  const addEventBtn = document.getElementById("add-event-btn");
  const modalOverlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const eventForm = document.getElementById("event-form");
  const filterSelect = document.getElementById("filter");
  const filterCategory = document.getElementById("filter-category");
  const cancelBtn = document.getElementById("cancel-btn");

  // Form fields
  const fieldId = document.getElementById("event-id");
  const fieldName = document.getElementById("event-name");
  const fieldLocation = document.getElementById("event-location");
  const fieldStart = document.getElementById("event-start");
  const fieldEnd = document.getElementById("event-end");
  const fieldCategory = document.getElementById("event-category");
  const fieldDetails = document.getElementById("event-details");

  // --- Data helpers ---

  function loadEvents() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveEvents(events) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // --- Status helpers ---

  function getStatus(event) {
    const now = new Date();
    const start = new Date(event.start);
    const end = new Date(event.end);
    if (now < start) return "upcoming";
    if (now >= start && now <= end) return "ongoing";
    return "past";
  }

  function statusLabel(status) {
    if (status === "upcoming") return "Upcoming";
    if (status === "ongoing") return "Happening Now";
    return "Past";
  }

  // --- Formatting ---

  function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatRange(start, end) {
    const sameDay =
      new Date(start).toDateString() === new Date(end).toDateString();
    if (sameDay) {
      return `${formatDate(start)}, ${formatTime(start)} – ${formatTime(end)}`;
    }
    return `${formatDate(start)} ${formatTime(start)} – ${formatDate(end)} ${formatTime(end)}`;
  }

  // --- Rendering ---

  function render() {
    const events = loadEvents();
    const filter = filterSelect.value;
    const catFilter = filterCategory.value;

    // Sort: ongoing first, then upcoming (soonest first), then past (most recent first)
    const sorted = events
      .map((e) => ({ ...e, _status: getStatus(e) }))
      .filter((e) => filter === "all" || e._status === filter)
      .filter((e) => catFilter === "all" || e.category === catFilter)
      .sort((a, b) => {
        const order = { ongoing: 0, upcoming: 1, past: 2 };
        if (order[a._status] !== order[b._status])
          return order[a._status] - order[b._status];
        if (a._status === "past")
          return new Date(b.start) - new Date(a.start);
        return new Date(a.start) - new Date(b.start);
      });

    eventsList.innerHTML = "";

    if (sorted.length === 0) {
      noEvents.hidden = false;
      return;
    }

    noEvents.hidden = true;

    sorted.forEach((event) => {
      const card = document.createElement("article");
      card.className = `event-card ${event._status}`;

      const detailsHtml = event.details
        ? `<p class="event-details">${escapeHtml(event.details)}</p>`
        : "";

      card.innerHTML = `
        <div class="event-header">
          <span class="event-name">${escapeHtml(event.name)}</span>
          <div class="event-badges">
            <span class="event-category">${escapeHtml(event.category || "")}</span>
            <span class="event-status ${event._status}">${statusLabel(event._status)}</span>
          </div>
        </div>
        <div class="event-meta">
          <span>${escapeHtml(event.location)}</span>
          <span>${formatRange(event.start, event.end)}</span>
        </div>
        ${detailsHtml}
        <div class="event-actions">
          <button class="btn btn-edit" data-id="${event.id}">Edit</button>
          <button class="btn btn-danger" data-id="${event.id}">Delete</button>
        </div>
      `;

      eventsList.appendChild(card);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Modal ---

  function openModal(event) {
    if (event) {
      modalTitle.textContent = "Edit Event";
      fieldId.value = event.id;
      fieldName.value = event.name;
      fieldLocation.value = event.location;
      fieldStart.value = event.start;
      fieldEnd.value = event.end;
      fieldCategory.value = event.category || "";
      fieldDetails.value = event.details || "";
    } else {
      modalTitle.textContent = "Add Event";
      eventForm.reset();
      fieldId.value = "";
    }
    modalOverlay.hidden = false;
    fieldName.focus();
  }

  function closeModal() {
    modalOverlay.hidden = true;
    eventForm.reset();
  }

  // --- Event handlers ---

  addEventBtn.addEventListener("click", () => openModal(null));
  cancelBtn.addEventListener("click", closeModal);

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalOverlay.hidden) closeModal();
  });

  eventForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const events = loadEvents();
    const id = fieldId.value || generateId();
    const eventData = {
      id,
      name: fieldName.value.trim(),
      location: fieldLocation.value.trim(),
      category: fieldCategory.value,
      start: fieldStart.value,
      end: fieldEnd.value,
      details: fieldDetails.value.trim(),
    };

    if (new Date(eventData.end) <= new Date(eventData.start)) {
      alert("End date must be after start date.");
      return;
    }

    const existingIndex = events.findIndex((ev) => ev.id === id);
    if (existingIndex >= 0) {
      events[existingIndex] = eventData;
    } else {
      events.push(eventData);
    }

    saveEvents(events);
    closeModal();
    render();
  });

  eventsList.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    const events = loadEvents();

    if (btn.classList.contains("btn-edit")) {
      const event = events.find((ev) => ev.id === id);
      if (event) openModal(event);
    }

    if (btn.classList.contains("btn-danger")) {
      if (!confirm("Delete this event?")) return;
      const updated = events.filter((ev) => ev.id !== id);
      saveEvents(updated);
      render();
    }
  });

  filterSelect.addEventListener("change", render);
  filterCategory.addEventListener("change", render);

  // --- Initial render ---
  render();
})();
