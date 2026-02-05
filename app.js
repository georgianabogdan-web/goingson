(function () {
  "use strict";

  const STORAGE_KEY = "goingson_events";

  // DOM elements
  const eventsGrid = document.getElementById("events-grid");
  const noEvents = document.getElementById("no-events");
  const addEventBtn = document.getElementById("add-event-btn");
  const modalOverlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const eventForm = document.getElementById("event-form");
  const filterSelect = document.getElementById("filter");
  const filterCategory = document.getElementById("filter-category");
  const cancelBtn = document.getElementById("cancel-btn");
  const detailOverlay = document.getElementById("detail-overlay");
  const detailContent = document.getElementById("detail-content");
  const detailClose = document.getElementById("detail-close");

  // Form fields
  const fieldId = document.getElementById("event-id");
  const fieldName = document.getElementById("event-name");
  const fieldLocation = document.getElementById("event-location");
  const fieldStart = document.getElementById("event-start");
  const fieldEnd = document.getElementById("event-end");
  const fieldCategory = document.getElementById("event-category");
  const fieldLink = document.getElementById("event-link");
  const fieldImage = document.getElementById("event-image");
  const imagePreview = document.getElementById("image-preview");
  const imageUploadBtn = document.getElementById("image-upload-btn");
  const imageRemoveBtn = document.getElementById("image-remove-btn");
  const fieldDetails = document.getElementById("event-details");

  // Pending image data URL (set during file selection)
  let pendingImageData = null;

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

  // --- Category to CSS class ---

  function categoryColorClass(category) {
    if (!category) return "card-color-exhibition";
    return "card-color-" + category.toLowerCase().replace(/\s+/g, "-");
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

  function formatDateShort(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatRangeShort(start, end) {
    const sameDay =
      new Date(start).toDateString() === new Date(end).toDateString();
    if (sameDay) {
      return formatDateShort(start);
    }
    return `${formatDateShort(start)} – ${formatDateShort(end)}`;
  }

  // --- Image helpers ---

  function resizeImage(file, maxSize, callback) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) {
            h = Math.round((h * maxSize) / w);
            w = maxSize;
          } else {
            w = Math.round((w * maxSize) / h);
            h = maxSize;
          }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function setImagePreview(dataUrl) {
    if (dataUrl) {
      imagePreview.style.backgroundImage = `url(${dataUrl})`;
      imagePreview.classList.add("has-image");
      imageRemoveBtn.hidden = false;
    } else {
      imagePreview.style.backgroundImage = "";
      imagePreview.classList.remove("has-image");
      imageRemoveBtn.hidden = true;
    }
  }

  imageUploadBtn.addEventListener("click", () => fieldImage.click());

  fieldImage.addEventListener("change", () => {
    const file = fieldImage.files[0];
    if (!file) return;
    resizeImage(file, 800, (dataUrl) => {
      pendingImageData = dataUrl;
      setImagePreview(dataUrl);
    });
  });

  imageRemoveBtn.addEventListener("click", () => {
    pendingImageData = "";
    fieldImage.value = "";
    setImagePreview(null);
  });

  // --- Rendering ---

  function render() {
    const events = loadEvents();
    const filter = filterSelect.value;
    const catFilter = filterCategory.value;

    const sorted = events
      .map((e) => ({ ...e, _status: getStatus(e) }))
      .filter((e) => {
        if (filter === "all") return true;
        if (filter === "attended") return e.attended;
        return e._status === filter;
      })
      .filter((e) => catFilter === "all" || e.category === catFilter)
      .sort((a, b) => {
        const order = { ongoing: 0, upcoming: 1, past: 2 };
        if (order[a._status] !== order[b._status])
          return order[a._status] - order[b._status];
        if (a._status === "past")
          return new Date(b.start) - new Date(a.start);
        return new Date(a.start) - new Date(b.start);
      });

    eventsGrid.innerHTML = "";

    if (sorted.length === 0) {
      noEvents.hidden = false;
      return;
    }

    noEvents.hidden = true;

    sorted.forEach((event) => {
      const card = document.createElement("article");
      const hasImage = !!event.image;
      card.className = `event-card ${categoryColorClass(event.category)} ${event._status}${hasImage ? " has-image" : ""}`;
      card.dataset.id = event.id;

      if (hasImage) {
        card.style.backgroundImage = `url(${event.image})`;
      }

      const attendedBadge = event.attended
        ? `<span class="event-card-attended">Attended</span>`
        : "";

      card.innerHTML = `
        <span class="event-card-status ${event._status}">${statusLabel(event._status)}</span>
        ${attendedBadge}
        <span class="event-card-category">${escapeHtml(event.category || "")}</span>
        <span class="event-card-name">${escapeHtml(event.name)}</span>
        <span class="event-card-date">${formatRangeShort(event.start, event.end)}</span>
        <span class="event-card-location">${escapeHtml(event.location)}</span>
      `;

      eventsGrid.appendChild(card);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Detail overlay ---

  function openDetail(event) {
    const status = getStatus(event);

    const linkHtml = event.link
      ? `<div class="detail-row">
           <span class="detail-label">Link</span>
           <span class="detail-value"><a href="${escapeHtml(event.link)}" target="_blank" rel="noopener">${escapeHtml(event.link)}</a></span>
         </div>`
      : "";

    const detailsHtml = event.details
      ? `<div class="detail-description">
           <h3>Details</h3>
           <p>${escapeHtml(event.details)}</p>
         </div>`
      : "";

    const imageHtml = event.image
      ? `<img class="detail-image" src="${event.image}" alt="${escapeHtml(event.name)}">`
      : "";

    detailContent.innerHTML = `
      ${imageHtml}
      <span class="detail-status ${status}">${statusLabel(status)}</span>
      <div class="detail-category">${escapeHtml(event.category || "")}</div>
      <div class="detail-name">${escapeHtml(event.name)}</div>
      <div class="detail-info">
        <div class="detail-row">
          <span class="detail-label">When</span>
          <span class="detail-value">${formatRange(event.start, event.end)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Where</span>
          <span class="detail-value">${escapeHtml(event.location)}</span>
        </div>
        ${linkHtml}
      </div>
      ${detailsHtml}
      <div class="detail-actions">
        <button class="btn btn-attended${event.attended ? " is-attended" : ""}" data-id="${event.id}">
          ${event.attended ? "Attended" : "Mark as Attended"}
        </button>
        <button class="btn btn-edit" data-id="${event.id}">Edit</button>
        <button class="btn btn-danger" data-id="${event.id}">Delete</button>
      </div>
    `;

    detailOverlay.hidden = false;
  }

  function closeDetail() {
    detailOverlay.hidden = true;
  }

  // --- Add/Edit modal ---

  function openModal(event) {
    if (event) {
      modalTitle.textContent = "Edit Event";
      fieldId.value = event.id;
      fieldName.value = event.name;
      fieldLocation.value = event.location;
      fieldStart.value = event.start;
      fieldEnd.value = event.end;
      fieldCategory.value = event.category || "";
      fieldLink.value = event.link || "";
      fieldDetails.value = event.details || "";
      pendingImageData = null;
      setImagePreview(event.image || null);
    } else {
      modalTitle.textContent = "Add Event";
      eventForm.reset();
      fieldId.value = "";
      pendingImageData = null;
      setImagePreview(null);
    }
    modalOverlay.hidden = false;
    fieldName.focus();
  }

  function closeModal() {
    modalOverlay.hidden = true;
    eventForm.reset();
    pendingImageData = null;
    setImagePreview(null);
  }

  // --- Event handlers ---

  addEventBtn.addEventListener("click", () => openModal(null));
  cancelBtn.addEventListener("click", closeModal);

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!modalOverlay.hidden) closeModal();
      if (!detailOverlay.hidden) closeDetail();
    }
  });

  eventForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const events = loadEvents();
    const id = fieldId.value || generateId();
    // Determine image: use pending if set, otherwise keep existing
    let imageValue;
    if (pendingImageData !== null) {
      imageValue = pendingImageData;
    } else {
      const existing = events.find((ev) => ev.id === id);
      imageValue = existing ? existing.image || "" : "";
    }

    const eventData = {
      id,
      name: fieldName.value.trim(),
      location: fieldLocation.value.trim(),
      category: fieldCategory.value,
      start: fieldStart.value,
      end: fieldEnd.value,
      link: fieldLink.value.trim(),
      image: imageValue,
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

  // Click card to open detail
  eventsGrid.addEventListener("click", (e) => {
    const card = e.target.closest(".event-card");
    if (!card) return;

    const id = card.dataset.id;
    const events = loadEvents();
    const event = events.find((ev) => ev.id === id);
    if (event) openDetail(event);
  });

  // Edit / Delete from detail overlay
  detailContent.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    const events = loadEvents();

    if (btn.classList.contains("btn-attended")) {
      const event = events.find((ev) => ev.id === id);
      if (event) {
        event.attended = !event.attended;
        saveEvents(events);
        openDetail(event);
        render();
      }
      return;
    }

    if (btn.classList.contains("btn-edit")) {
      closeDetail();
      const event = events.find((ev) => ev.id === id);
      if (event) openModal(event);
    }

    if (btn.classList.contains("btn-danger")) {
      if (!confirm("Delete this event?")) return;
      const updated = events.filter((ev) => ev.id !== id);
      saveEvents(updated);
      closeDetail();
      render();
    }
  });

  detailClose.addEventListener("click", closeDetail);
  detailOverlay.addEventListener("click", (e) => {
    if (e.target === detailOverlay) closeDetail();
  });

  filterSelect.addEventListener("change", render);
  filterCategory.addEventListener("change", render);

  // --- Initial render ---
  render();
})();
