(function () {
  "use strict";

  // All events (loaded from server)
  let events = [];

  // DOM elements
  const eventsGrid = document.getElementById("events-grid");
  const noEvents = document.getElementById("no-events");
  const addEventBtn = document.getElementById("add-event-btn");
  const modalOverlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const eventForm = document.getElementById("event-form");
  const filterSelect = document.getElementById("filter");
  const filterMonth = document.getElementById("filter-month");
  const filterCategory = document.getElementById("filter-category");
  const filterCity = document.getElementById("filter-city");
  const cancelBtn = document.getElementById("cancel-btn");
  const searchInput = document.getElementById("search-input");
  const detailOverlay = document.getElementById("detail-overlay");
  const detailContent = document.getElementById("detail-content");
  const detailClose = document.getElementById("detail-close");

  // Form fields
  const fieldId = document.getElementById("event-id");
  const fieldName = document.getElementById("event-name");
  const fieldVenue = document.getElementById("event-venue");
  const fieldCity = document.getElementById("event-city");
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

  // --- API helpers ---

  async function fetchEvents() {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        events = await res.json();
      } else {
        events = [];
      }
    } catch {
      events = [];
    }
    render();
  }

  async function saveEvent(eventData) {
    const exists = events.some((e) => e.id === eventData.id);
    if (exists) {
      await fetch("/api/events/" + eventData.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
      });
    } else {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
      });
    }
    await fetchEvents();
  }

  async function deleteEvent(id) {
    await fetch("/api/events/" + id, { method: "DELETE" });
    await fetchEvents();
  }

  async function toggleAttended(id) {
    const event = events.find((e) => e.id === id);
    if (!event) return null;
    event.attended = !event.attended;
    await saveEvent(event);
    return event;
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // --- Status helpers ---

  function getStatus(event) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(event.start + "T00:00:00");
    const end = new Date(event.end + "T23:59:59");
    if (now < start) return "upcoming";
    if (now <= end) return "ongoing";
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

  function formatDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatDateShort(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatRange(start, end) {
    if (start === end) return formatDate(start);
    return `${formatDate(start)} – ${formatDate(end)}`;
  }

  function formatRangeShort(start, end) {
    if (start === end) return formatDateShort(start);
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

  // --- URL fetch / auto-fill ---

  const fetchBtn = document.getElementById("fetch-btn");
  const fetchStatus = document.getElementById("fetch-status");

  function showFetchStatus(msg, type) {
    fetchStatus.textContent = msg;
    fetchStatus.className = "fetch-status " + type;
    fetchStatus.hidden = false;
  }

  function toDateStr(d) {
    // Return YYYY-MM-DD from a Date or date-like string
    if (!d) return "";
    const parsed = new Date(d);
    if (isNaN(parsed)) return "";
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseEventPage(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const result = {};

    // Try JSON-LD structured data first (most reliable)
    const ldScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of ldScripts) {
      try {
        let data = JSON.parse(script.textContent);
        // Handle @graph arrays
        if (data["@graph"]) data = data["@graph"];
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item["@type"] === "Event" || item["@type"] === "MusicEvent" ||
              item["@type"] === "TheaterEvent" || item["@type"] === "Festival" ||
              (Array.isArray(item["@type"]) && item["@type"].some(t => t.includes("Event")))) {
            if (item.name) result.name = item.name;
            if (item.startDate) result.start = toDateStr(item.startDate);
            if (item.endDate) result.end = toDateStr(item.endDate);
            if (!result.end && result.start) result.end = result.start;
            if (item.description) result.details = item.description;
            // Location
            const loc = item.location;
            if (loc) {
              if (typeof loc === "string") {
                result.venue = loc;
              } else if (loc.name) {
                result.venue = loc.name;
              }
              if (loc.address) {
                const addr = loc.address;
                if (typeof addr === "string") {
                  result.city = addr;
                } else if (addr.addressLocality) {
                  result.city = addr.addressLocality;
                }
              }
            }
            break;
          }
        }
      } catch { /* skip bad JSON-LD */ }
    }

    // Fill gaps from Open Graph meta tags
    if (!result.name) {
      const ogTitle = doc.querySelector('meta[property="og:title"]');
      if (ogTitle) result.name = ogTitle.content;
    }
    if (!result.details) {
      const ogDesc = doc.querySelector('meta[property="og:description"]');
      if (ogDesc) result.details = ogDesc.content;
    }

    // Fill gaps from regular meta tags
    if (!result.name) {
      const title = doc.querySelector("title");
      if (title) result.name = title.textContent.split("|")[0].split("–")[0].split("-")[0].trim();
    }
    if (!result.details) {
      const desc = doc.querySelector('meta[name="description"]');
      if (desc) result.details = desc.content;
    }

    return result;
  }

  fetchBtn.addEventListener("click", async () => {
    const url = fieldLink.value.trim();
    if (!url) {
      showFetchStatus("Enter a URL first.", "error");
      return;
    }

    showFetchStatus("Fetching...", "");
    fetchBtn.disabled = true;

    try {
      const proxyUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("Could not fetch page");
      const html = await res.text();
      const data = parseEventPage(html);

      let filled = 0;
      if (data.name && !fieldName.value) { fieldName.value = data.name; filled++; }
      if (data.venue && !fieldVenue.value) { fieldVenue.value = data.venue; filled++; }
      if (data.city && !fieldCity.value) { fieldCity.value = data.city; filled++; }
      if (data.start && !fieldStart.value) { fieldStart.value = data.start; filled++; }
      if (data.end && !fieldEnd.value) { fieldEnd.value = data.end; filled++; }
      if (data.details && !fieldDetails.value) { fieldDetails.value = data.details; filled++; }

      if (filled > 0) {
        showFetchStatus(`Filled ${filled} field${filled > 1 ? "s" : ""}. Review and adjust as needed.`, "success");
      } else {
        showFetchStatus("Couldn't extract event details from this page. Fill in manually.", "error");
      }
    } catch {
      showFetchStatus("Failed to fetch. You may need to fill in manually.", "error");
    }

    fetchBtn.disabled = false;
  });

  // --- Month helpers ---

  function getEventMonth(dateStr) {
    return dateStr.slice(0, 7); // "YYYY-MM"
  }

  function formatMonth(ym) {
    const [year, month] = ym.split("-");
    const d = new Date(Number(year), Number(month) - 1);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function populateMonthFilter(evts) {
    const months = new Set();
    evts.forEach((e) => {
      months.add(getEventMonth(e.start));
      months.add(getEventMonth(e.end));
    });
    const sorted = [...months].sort();
    const current = filterMonth.value;
    filterMonth.innerHTML = '<option value="all">All Months</option>';
    sorted.forEach((ym) => {
      const opt = document.createElement("option");
      opt.value = ym;
      opt.textContent = formatMonth(ym);
      filterMonth.appendChild(opt);
    });
    // Restore selection if still valid
    if (sorted.includes(current)) {
      filterMonth.value = current;
    }
  }

  function eventOverlapsMonth(event, ym) {
    const startMonth = getEventMonth(event.start);
    const endMonth = getEventMonth(event.end);
    return startMonth <= ym && endMonth >= ym;
  }

  // --- City filter ---

  function populateCityFilter(evts) {
    const cities = new Set();
    evts.forEach((e) => {
      if (e.city) cities.add(e.city);
    });
    const sorted = [...cities].sort();
    const current = filterCity.value;
    filterCity.innerHTML = '<option value="all">All Cities</option>';
    sorted.forEach((city) => {
      const opt = document.createElement("option");
      opt.value = city;
      opt.textContent = city;
      filterCity.appendChild(opt);
    });
    if (sorted.includes(current)) {
      filterCity.value = current;
    }
  }

  // --- Fuzzy search ---

  function fuzzyMatch(text, query) {
    text = text.toLowerCase();
    query = query.toLowerCase();
    // Substring match
    if (text.includes(query)) return true;
    // Fuzzy: characters in order, but at least half must match consecutively
    let ti = 0;
    let matched = 0;
    let maxConsecutive = 0;
    let consecutive = 0;
    for (let qi = 0; qi < query.length; qi++) {
      while (ti < text.length && text[ti] !== query[qi]) { ti++; consecutive = 0; }
      if (ti >= text.length) return false;
      matched++;
      consecutive++;
      maxConsecutive = Math.max(maxConsecutive, consecutive);
      ti++;
    }
    // Require at least half the query length as a consecutive run
    return maxConsecutive >= Math.ceil(query.length / 2);
  }

  function eventMatchesSearch(event, query) {
    if (!query) return true;
    const fields = [event.name || "", event.venue || "", event.city || "", event.category || "", event.details || ""];
    // Split query into words, all must match at least one field
    return query.split(/\s+/).filter(Boolean).every((word) =>
      fields.some((field) => fuzzyMatch(field, word))
    );
  }

  // --- Rendering ---

  function render() {
    populateMonthFilter(events);
    populateCityFilter(events);
    const filter = filterSelect.value;
    const monthFilter = filterMonth.value;
    const catFilter = filterCategory.value;
    const cityFilter = filterCity.value;
    const searchQuery = searchInput.value.trim();

    const sorted = events
      .map((e) => ({ ...e, _status: getStatus(e) }))
      .filter((e) => {
        if (filter === "all") return true;
        if (filter === "attended") return e.attended;
        return e._status === filter;
      })
      .filter((e) => monthFilter === "all" || eventOverlapsMonth(e, monthFilter))
      .filter((e) => catFilter === "all" || e.category === catFilter)
      .filter((e) => cityFilter === "all" || e.city === cityFilter)
      .filter((e) => eventMatchesSearch(e, searchQuery))
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
        <span class="event-card-location">${escapeHtml(event.venue || "")}${event.city ? ", " + escapeHtml(event.city) : ""}</span>
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
          <span class="detail-label">Venue</span>
          <span class="detail-value">${escapeHtml(event.venue || "")}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">City</span>
          <span class="detail-value">${escapeHtml(event.city || "")}</span>
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
      fieldVenue.value = event.venue || "";
      fieldCity.value = event.city || "";
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
    fetchStatus.hidden = true;
    modalOverlay.hidden = false;
    fieldLink.focus();
  }

  function closeModal() {
    modalOverlay.hidden = true;
    fetchStatus.hidden = true;
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

  eventForm.addEventListener("submit", async (e) => {
    e.preventDefault();

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
      venue: fieldVenue.value.trim(),
      city: fieldCity.value.trim(),
      category: fieldCategory.value,
      start: fieldStart.value,
      end: fieldEnd.value,
      link: fieldLink.value.trim(),
      image: imageValue,
      details: fieldDetails.value.trim(),
    };

    // Preserve attended status if editing
    const existingEvent = events.find((ev) => ev.id === id);
    if (existingEvent && existingEvent.attended) {
      eventData.attended = true;
    }

    if (new Date(eventData.end) < new Date(eventData.start)) {
      alert("End date must not be before start date.");
      return;
    }

    await saveEvent(eventData);
    closeModal();
  });

  // Click card to open detail
  eventsGrid.addEventListener("click", (e) => {
    const card = e.target.closest(".event-card");
    if (!card) return;

    const id = card.dataset.id;
    const event = events.find((ev) => ev.id === id);
    if (event) openDetail(event);
  });

  // Edit / Delete from detail overlay
  detailContent.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;

    if (btn.classList.contains("btn-attended")) {
      const event = await toggleAttended(id);
      if (event) {
        openDetail(event);
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
      await deleteEvent(id);
      closeDetail();
    }
  });

  detailClose.addEventListener("click", closeDetail);
  detailOverlay.addEventListener("click", (e) => {
    if (e.target === detailOverlay) closeDetail();
  });

  filterSelect.addEventListener("change", render);
  filterMonth.addEventListener("change", render);
  filterCategory.addEventListener("change", render);
  filterCity.addEventListener("change", render);
  searchInput.addEventListener("input", render);

  // --- Initial load ---

  fetchEvents();
})();
