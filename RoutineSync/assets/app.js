(() => {
  "use strict";

  const API = "php/";

  const phases = {
    morning: {
      title: "Morning Launchpad",
      short: "Morning",
      icon: "☀️",
      color: "bg-amber-50 text-amber-700",
      subtitle: "Start your day prepared"
    },
    midday: {
      title: "Midday Focus",
      short: "Midday",
      icon: "🎯",
      color: "bg-indigo-50 text-indigo-700",
      subtitle: "Stay ready and focused"
    },
    evening: {
      title: "Evening Closure",
      short: "Evening",
      icon: "🌙",
      color: "bg-violet-50 text-violet-700",
      subtitle: "Reset for tomorrow"
    }
  };

  const $ = id => document.getElementById(id);

  let state = {
    items: [],
    archivedItems: [],
    templates: [],
    analytics: null,
    user: null
  };

  let activeView = "dashboard";
  let toastTimer;

  // Changes whenever the logged-in account changes.
  // This prevents old requests from updating the new account's screen.
  let accountVersion = 0;

  // ==========================================
  // GENERAL HELPERS
  // ==========================================

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function showToast(message) {
    const el = $("toast");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      el.classList.remove("show");
    }, 2500);
  }

  function showAuthMessage(message, error = false) {
    const el = $("authMessage");
    if (!el) return;

    el.textContent = message;
    el.className = "text-sm text-center mt-5 " +
      (error ? "text-red-600" : "text-green-600");
  }

  async function apiRequest(file, data = null, method = "POST") {
    const options = {
      method,
      credentials: "same-origin",
      headers: {
        "Accept": "application/json"
      }
    };

    if (data !== null) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(data);
    }

    const response = await fetch(API + file, options);

    let result;

    try {
      result = await response.json();
    } catch (error) {
      throw new Error("Invalid server response. Check your PHP files.");
    }

    if (!response.ok || result.ok === false) {
      throw new Error(
        result.message ||
        result.error ||
        "Something went wrong."
      );
    }

    return result;
  }

  // ==========================================
  // PASSWORD SHOW / HIDE
  // ==========================================

  function setupPasswordToggle() {
    document.querySelectorAll(
      '#authView input[type="password"]'
    ).forEach(input => {
      if (input.parentNode.classList.contains("password-wrapper")) {
        return;
      }

      const wrapper = document.createElement("div");
      wrapper.className = "password-wrapper";

      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "password-toggle";
      button.setAttribute("aria-label", "Show password");
      button.title = "Show password";

      function updateIcon() {
        if (input.type === "password") {
          button.innerHTML = `
            <svg viewBox="0 0 24 24">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          `;

          button.title = "Show password";
          button.setAttribute("aria-label", "Show password");
        } else {
          button.innerHTML = `
            <svg viewBox="0 0 24 24">
              <path d="M3 3l18 18"/>
              <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/>
              <path d="M9.9 5.2A11 11 0 0 1 12 5c6.4 0 10 7 10 7s-3.6 7-10 7a10 10 0 0 1-4-.8"/>
              <path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7"/>
            </svg>
          `;

          button.title = "Hide password";
          button.setAttribute("aria-label", "Hide password");
        }
      }

      button.addEventListener("click", () => {
        input.type = input.type === "password" ? "text" : "password";
        updateIcon();
      });

      wrapper.appendChild(button);
      updateIcon();
    });
  }

  // ==========================================
  // LOGIN / REGISTER FORM DISPLAY
  // ==========================================

  function showLogin() {
    $("loginForm").classList.remove("hidden");
    $("registerForm").classList.add("hidden");

    $("showLogin").classList.remove("secondary-btn");
    $("showLogin").classList.add("primary-btn");

    $("showRegister").classList.remove("primary-btn");
    $("showRegister").classList.add("secondary-btn");

    showAuthMessage("");
  }

  function showRegister() {
    $("loginForm").classList.add("hidden");
    $("registerForm").classList.remove("hidden");

    $("showRegister").classList.remove("secondary-btn");
    $("showRegister").classList.add("primary-btn");

    $("showLogin").classList.remove("primary-btn");
    $("showLogin").classList.add("secondary-btn");

    showAuthMessage("");
  }

  // ==========================================
  // SHOW APPLICATION BASED ON ROLE
  // ==========================================

  function showApplication(user) {
    // Start a new account session in the frontend.
    accountVersion++;

    // Clear data belonging to the previous account.
    state.items = [];
    state.archivedItems = [];
    state.templates = [];
    state.analytics = null;

    state.user = user;

    $("authView").classList.add("hidden");
    $("appShell").classList.remove("hidden");

    $("loggedUser").textContent =
      user.name || user.display_name || "User";

    const isAdmin = user.role === "admin";

    $("userNavigation").classList.toggle("hidden", isAdmin);
    $("adminNavigation").classList.toggle("hidden", !isAdmin);

    // Hide every previous screen before showing the correct one.
    document.querySelectorAll(".view").forEach(view => {
      view.classList.add("hidden");
    });

    if (isAdmin) {
      activeView = "admin";

      $("todayLabel").textContent = "";
      $("addItemTop").classList.add("hidden");

      // Show Admin Dashboard immediately.
      if ($("adminView")) {
        $("adminView").classList.remove("hidden");
      }

      // Notify admin.js using the same event target
      // that admin.js is listening to: document.
      document.dispatchEvent(
        new CustomEvent("routinesync:admin-login")
      );

    } else {
      activeView = "dashboard";

      setView("dashboard");
    }
  }

  // ==========================================
  // SHOW LOGIN SCREEN
  // ==========================================

  function showAuthentication() {
    // Invalidate requests from the previous account.
    accountVersion++;

    state.user = null;
    state.items = [];
    state.archivedItems = [];
    state.templates = [];
    state.analytics = null;

    activeView = "dashboard";

    $("appShell").classList.add("hidden");
    $("authView").classList.remove("hidden");

    $("userNavigation").classList.remove("hidden");
    $("adminNavigation").classList.add("hidden");

    // Hide all application views.
    document.querySelectorAll(".view").forEach(view => {
      view.classList.add("hidden");
    });

    $("loginForm").reset();
    $("registerForm").reset();

    showLogin();
  }

  // ==========================================
  // LOAD ANALYTICS
  // ==========================================

  async function loadAnalytics(version = accountVersion) {
    try {
      const result = await apiRequest(
        "analytics.php",
        null,
        "GET"
      );

      // Ignore results from a previous account.
      if (version !== accountVersion) return;

      state.analytics = result.ok === false ? null : result;

    } catch (error) {
      if (version !== accountVersion) return;

      state.analytics = null;
      console.error("Analytics error:", error);
    }
  }

  // ==========================================
  // LOAD ACTIVE ROUTINES
  // ==========================================

  async function loadRoutines() {
    const version = accountVersion;

    const result = await apiRequest(
      "get_routines.php",
      null,
      "GET"
    );

    // Do not display old account data.
    if (version !== accountVersion || !state.user ||
        state.user.role !== "end_user") {
      return;
    }

    state.items = (Array.isArray(result.items) ? result.items : [])
      .map(item => ({
        id: String(item.id),
        name: item.name,
        phase: item.phase,
        note: item.note || "",
        done: Boolean(Number(item.is_done))
      }));

    await loadAnalytics(version);

    if (version !== accountVersion || !state.user ||
        state.user.role !== "end_user") {
      return;
    }

    renderAll();
  }

  // ==========================================
  // LOAD ARCHIVED ROUTINES
  // ==========================================

  async function loadArchivedRoutines() {
    const version = accountVersion;

    const result = await apiRequest(
      "get_archived_routines.php",
      null,
      "GET"
    );

    if (version !== accountVersion || !state.user ||
        state.user.role !== "end_user") {
      return;
    }

    state.archivedItems = Array.isArray(result.items)
      ? result.items
      : [];

    renderArchivedRoutines();
  }

  // ==========================================
  // LOAD TEMPLATES FROM MYSQL
  // ==========================================

  async function loadTemplates() {
    const version = accountVersion;
    const grid = $("templateGrid");

    if (grid) {
      grid.innerHTML = `
        <p class="text-sm text-slate-400">
          Loading routine templates...
        </p>
      `;
    }

    try {
      const result = await apiRequest(
        "get_templates.php",
        null,
        "GET"
      );

      if (version !== accountVersion || !state.user ||
          state.user.role !== "end_user") {
        return;
      }

      state.templates = Array.isArray(result.templates)
        ? result.templates
        : [];

      renderTemplates();

    } catch (error) {
      if (version !== accountVersion) return;

      state.templates = [];

      if (grid) {
        grid.innerHTML = `
          <div class="col-span-full text-center py-10">
            <p class="text-red-500 text-sm">
              ${escapeHtml(error.message)}
            </p>
            <button
              type="button"
              class="secondary-btn mt-4"
              data-action="refresh-templates">
              ↻ Try Again
            </button>
          </div>
        `;
      }

      console.error("Template loading error:", error);
    }
  }

  function percent(done, total) {
    return total ? Math.round(done / total * 100) : 0;
  }

  // ==========================================
  // CHECKLIST ITEM DISPLAY
  // ==========================================

  function itemRow(item) {
    return `
      <div class="item-row">
        <input
          class="check-input"
          type="checkbox"
          data-action="toggle"
          data-id="${escapeHtml(item.id)}"
          ${item.done ? "checked" : ""}
          aria-label="Mark ${escapeHtml(item.name)} complete"
        >

        <div class="min-w-0 flex-1">
          <p class="item-title ${item.done ? "done" : ""}">
            ${escapeHtml(item.name)}
          </p>

          ${item.note
            ? `<p class="item-note">${escapeHtml(item.note)}</p>`
            : ""}
        </div>

        <div class="item-actions">
          <button
            class="icon-btn"
            data-action="edit"
            data-id="${escapeHtml(item.id)}"
            aria-label="Edit ${escapeHtml(item.name)}"
            title="Edit"
          >✎</button>

          <button
            class="icon-btn"
            data-action="archive"
            data-id="${escapeHtml(item.id)}"
            aria-label="Archive ${escapeHtml(item.name)}"
            title="Archive"
          >🗑</button>
        </div>
      </div>
    `;
  }

  // ==========================================
  // PHASE CARD
  // ==========================================

  function phaseCard(phase) {
    const meta = phases[phase];

    const items = state.items.filter(
      item => item.phase === phase
    );

    const done = items.filter(item => item.done).length;
    const rate = percent(done, items.length);

    return `
      <article class="phase-card">
        <div class="phase-heading">
          <span class="phase-icon ${meta.color}">
            ${meta.icon}
          </span>

          <div class="min-w-0">
            <h3 class="phase-name">${meta.title}</h3>
            <p class="phase-subtitle">${meta.subtitle}</p>
          </div>
        </div>

        <div class="flex items-center justify-between mt-5 mb-1 text-xs">
          <span class="text-slate-500">
            ${done} of ${items.length} completed
          </span>
          <strong class="text-slate-700">${rate}%</strong>
        </div>

        <div class="progress-track">
          <div
            class="progress-fill"
            style="width:${rate}%">
          </div>
        </div>

        <div class="mt-3">
          ${items.length
            ? items.map(itemRow).join("")
            : `<div class="empty-state">No items yet. Add one to get started.</div>`
          }
        </div>

        <div class="phase-footer">
          <span>
            ${items.length} ${items.length === 1 ? "item" : "items"}
          </span>

          <button
            class="font-bold text-indigo-600 hover:text-indigo-800"
            data-action="add-phase"
            data-phase="${phase}">
            ＋ Add item
          </button>
        </div>
      </article>
    `;
  }

  // ==========================================
  // DASHBOARD
  // ==========================================

  function renderDashboard() {
    const total = state.items.length;

    const done = state.items.filter(
      item => item.done
    ).length;

    const rate = percent(done, total);

    $("progressPercent").textContent = rate + "%";
    $("doneCount").textContent = `${done} of ${total} done`;
    $("completedStat").textContent = done;
    $("routineStat").textContent = total;
    $("progressBar").style.width = rate + "%";

    $("phaseLists").innerHTML =
      Object.keys(phases).map(phaseCard).join("");

    $("todayLabel").textContent = new Date().toLocaleDateString(
      undefined,
      {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      }
    );

    $("dateBadge").textContent = new Date().toLocaleDateString(
      undefined,
      {
        month: "short",
        day: "numeric",
        year: "numeric"
      }
    );

    const streak = Number(state.analytics?.streak) || 0;

    $("streakStat").textContent =
      `${streak} ${streak === 1 ? "day" : "days"}`;
  }

  // ==========================================
  // MY ROUTINES
  // ==========================================

  function renderRoutines() {
    $("allRoutines").innerHTML =
      Object.keys(phases).map(phase => {
        const items = state.items.filter(
          item => item.phase === phase
        );

        const meta = phases[phase];

        return `
          <section>
            <div class="flex items-center justify-between gap-3 mb-2">
              <div class="phase-heading">
                <span class="phase-icon ${meta.color}">
                  ${meta.icon}
                </span>

                <div>
                  <h3 class="phase-name">${meta.title}</h3>
                  <p class="phase-subtitle">
                    ${items.length} items
                  </p>
                </div>
              </div>

              <button
                class="secondary-btn"
                data-action="add-phase"
                data-phase="${phase}">
                ＋ Add
              </button>
            </div>

            ${items.length
              ? items.map(itemRow).join("")
              : `<div class="empty-state">No items in this phase.</div>`
            }
          </section>
        `;
      }).join("");
  }

  // ==========================================
  // ARCHIVED ROUTINES
  // ==========================================

  function renderArchivedRoutines() {
    const container = $("archivedRoutines");

    if (!container) return;

    if (!state.archivedItems.length) {
      container.innerHTML = `
        <div class="empty-state text-center py-10">
          <div class="text-4xl mb-3">🗄</div>

          <p class="font-semibold text-slate-700">
            No archived routines
          </p>

          <p class="text-sm text-slate-400 mt-1">
            Routines you archive will appear here.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = state.archivedItems.map(item => {
      const meta = phases[item.phase] || phases.morning;

      return `
        <article class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-200 rounded-xl bg-white">

          <div class="flex items-start gap-3 min-w-0">
            <span class="phase-icon ${meta.color}">
              ${meta.icon}
            </span>

            <div class="min-w-0">
              <h3 class="font-semibold text-slate-800 break-words">
                ${escapeHtml(item.name)}
              </h3>

              <p class="text-xs text-slate-500 mt-1">
                ${meta.title}
              </p>

              ${item.note
                ? `<p class="text-sm text-slate-500 mt-1">${escapeHtml(item.note)}</p>`
                : ""
              }

              <p class="text-xs text-slate-400 mt-2">
                Archived: ${escapeHtml(item.archived_at || "Date unavailable")}
              </p>
            </div>
          </div>

          <button
            class="secondary-btn shrink-0"
            data-action="restore"
            data-id="${escapeHtml(item.id)}">
            ↶ Restore
          </button>
        </article>
      `;
    }).join("");
  }

  // ==========================================
  // TEMPLATE ICON
  // ==========================================

  function getTemplateIcon(title) {
    const value = String(title || "").toLowerCase();

    if (value.includes("student")) return "🎒";
    if (value.includes("work")) return "💼";
    if (value.includes("professional")) return "💼";

    return "🌿";
  }

  // ==========================================
  // RENDER TEMPLATES FROM DATABASE
  // ==========================================

  function renderTemplates() {
    const grid = $("templateGrid");

    if (!grid) return;

    if (!state.templates.length) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-12">
          <div class="text-4xl mb-3">📋</div>

          <h3 class="font-bold text-slate-700">
            No routine templates available
          </h3>

          <p class="text-sm text-slate-500 mt-2">
            Templates created by the administrator will appear here.
          </p>

          <button
            type="button"
            class="secondary-btn mt-4"
            data-action="refresh-templates">
            ↻ Refresh templates
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = state.templates.map((template, index) => {
      const items = Array.isArray(template.items)
        ? template.items
        : [];

      const icon = getTemplateIcon(template.title);

      return `
        <article class="template-card">

          <div class="template-icon">${icon}</div>

          <h3>${escapeHtml(template.title)}</h3>

          <p>${escapeHtml(template.description || "")}</p>

          <span class="text-xs text-slate-400 mt-3">
            ${items.length} suggested ${items.length === 1 ? "item" : "items"}
          </span>

          <button
            class="secondary-btn"
            data-action="template"
            data-index="${index}">
            Use this template →
          </button>

        </article>
      `;
    }).join("");
  }

  // ==========================================
  // ANALYTICS
  // ==========================================

  function renderAnalytics() {
    const analytics = state.analytics;

    if (!analytics) {
      $("overallRate").textContent = "—";
      $("bestPhase").textContent = "—";
      $("trackedDays").textContent = "—";

      $("weeklyChart").innerHTML = `
        <div class="col-span-7 text-center text-sm text-red-500">
          Unable to load analytics. Please refresh the page.
        </div>
      `;

      $("phaseAnalytics").innerHTML = `
        <p class="text-sm text-slate-400">
          Analytics data is currently unavailable.
        </p>
      `;

      return;
    }

    $("overallRate").textContent =
      `${Number(analytics.overall_rate) || 0}%`;

    $("trackedDays").textContent =
      Number(analytics.tracked_days) || 0;

    const best = String(
      analytics.best_phase || ""
    ).toLowerCase();

    $("bestPhase").textContent =
      phases[best]?.short || analytics.best_phase || "—";

    const weekly = Array.isArray(analytics.weekly)
      ? analytics.weekly
      : [];

    $("weeklyChart").innerHTML = weekly.length
      ? weekly.map(day => {
          const rate = Math.max(
            0,
            Math.min(100, Number(day.rate) || 0)
          );

          const height = rate > 0 ? rate : 2;

          return `
            <div class="flex flex-col items-center justify-end h-full min-w-0">

              <span class="text-xs font-semibold text-slate-600 mb-2">
                ${rate}%
              </span>

              <div class="w-full max-w-10 h-36 bg-slate-100 rounded-t-lg flex items-end overflow-hidden">

                <div
                  class="w-full bg-indigo-500 rounded-t-lg transition-all"
                  style="height:${height}%"
                  title="${Number(day.completed) || 0} completed out of ${Number(day.total) || 0}">
                </div>

              </div>

              <span class="text-xs text-slate-500 mt-2">
                ${escapeHtml(day.label || "")}
              </span>

              <span class="text-xs text-slate-400 mt-1">
                ${Number(day.completed) || 0}
              </span>

            </div>
          `;
        }).join("")
      : `
        <div class="col-span-7 text-center text-sm text-slate-400">
          No completion history yet. Start checking off your routines.
        </div>
      `;

    const phaseData = {};

    if (Array.isArray(analytics.phases)) {
      analytics.phases.forEach(item => {
        if (item.phase) {
          phaseData[item.phase] = item;
        }
      });
    } else if (
      analytics.phases &&
      typeof analytics.phases === "object"
    ) {
      Object.assign(phaseData, analytics.phases);
    }

    $("phaseAnalytics").innerHTML =
      Object.keys(phases).map(phase => {
        const meta = phases[phase];

        const stats = phaseData[phase] || {
          total: 0,
          completed: 0,
          rate: 0
        };

        const total = Number(stats.total) || 0;
        const completed = Number(stats.completed) || 0;

        const rate = Math.max(
          0,
          Math.min(100, Number(stats.rate) || 0)
        );

        return `
          <div>
            <div class="flex justify-between gap-3 text-sm mb-2">

              <span class="font-semibold">
                ${meta.icon} ${meta.title}
              </span>

              <span class="text-slate-500">
                ${completed}/${total} · ${rate}%
              </span>

            </div>

            <div class="progress-track">
              <div
                class="progress-fill"
                style="width:${rate}%">
              </div>
            </div>
          </div>
        `;
      }).join("");
  }

  // ==========================================
  // RENDER ALL
  // ==========================================

  function renderAll() {
    // Only End Users should render routine screens.
    if (!state.user || state.user.role !== "end_user") {
      return;
    }

    renderDashboard();
    renderRoutines();
    renderTemplates();
    renderAnalytics();

    setView(activeView);
  }

  // ==========================================
  // NAVIGATION
  // ==========================================

  function setView(view) {
    const headings = {
      dashboard: [
        "Good day 👋",
        "Your routines, one step at a time."
      ],
      routines: [
        "My routines",
        "Customize the checklist to fit your day."
      ],
      templates: [
        "Routine templates",
        "Build a routine with a ready-made starting point."
      ],
      analytics: [
        "Your progress",
        "See how your habits are adding up."
      ],
      archived: [
        "Archived routines",
        "Restore routines you want to use again."
      ]
    };

    if (!headings[view]) return;

    if (state.user?.role === "admin") return;

    activeView = view;

    document.querySelectorAll(".view").forEach(el => {
      el.classList.add("hidden");
    });

    const targetView = $(view + "View");

    if (!targetView) return;

    targetView.classList.remove("hidden");

    document.querySelectorAll(
      "#userNavigation .nav-link"
    ).forEach(el => {
      el.classList.toggle(
        "active",
        el.dataset.view === view
      );
    });

    $("pageTitle").textContent = headings[view][0];
    $("pageSubtitle").textContent = headings[view][1];

    $("addItemTop").classList.toggle(
      "hidden",
      view === "templates" ||
      view === "analytics" ||
      view === "archived"
    );

    if (view === "archived") {
      loadArchivedRoutines().catch(error => {
        if (state.user?.role !== "end_user") return;

        $("archivedRoutines").innerHTML = `
          <p class="text-sm text-red-500">
            ${escapeHtml(error.message)}
          </p>
        `;
      });
    }

    if (view === "templates") {
      loadTemplates();
    }
  }

  // ==========================================
  // ADD / EDIT ROUTINE DIALOG
  // ==========================================

  function openItemDialog(item = null, phase = "morning") {
    $("itemForm").reset();

    $("itemId").value = item?.id || "";
    $("itemName").value = item?.name || "";
    $("itemNote").value = item?.note || "";
    $("itemPhase").value = item?.phase || phase;

    $("dialogTitle").textContent = item
      ? "Edit checklist item"
      : "Add checklist item";

    $("itemDialog").showModal();
    $("itemName").focus();
  }

  function closeDialog() {
    $("itemDialog").close();
  }

  function findItem(id) {
    return state.items.find(
      item => item.id === String(id)
    );
  }

  // ==========================================
  // BUTTON ACTIONS
  // ==========================================

  async function handleAction(event) {
    const target = event.target.closest("[data-action]");

    if (!target) return;

    // Do not allow End User actions while an Admin is logged in.
    if (!state.user || state.user.role !== "end_user") {
      return;
    }

    const { action, id, phase, index } = target.dataset;

    if (action === "toggle") return;

    // EDIT ITEM
    if (action === "edit") {
      const item = findItem(id);

      if (item) {
        openItemDialog(item);
      }

      return;
    }

    // ARCHIVE ITEM
    if (action === "archive") {
      const item = findItem(id);

      if (!item) return;

      const confirmed = confirm(
        `Are you sure you want to archive "${item.name}"?\n\n` +
        "You can restore it later from Archived Routines."
      );

      if (!confirmed) return;

      target.disabled = true;

      try {
        await apiRequest("delete_routine.php", {
          id: Number(item.id)
        });

        await loadRoutines();

        showToast("Routine archived successfully.");

      } catch (error) {
        target.disabled = false;
        showToast(error.message);
      }

      return;
    }

    // RESTORE ITEM
    if (action === "restore") {
      const item = state.archivedItems.find(
        archived => String(archived.id) === String(id)
      );

      if (!item) return;

      target.disabled = true;

      try {
        await apiRequest("restore_routine.php", {
          id: Number(id)
        });

        await loadRoutines();
        await loadArchivedRoutines();

        showToast(`"${item.name}" restored successfully!`);

      } catch (error) {
        target.disabled = false;
        showToast(error.message);
      }

      return;
    }

    // ADD ITEM TO PHASE
    if (action === "add-phase") {
      openItemDialog(null, phase);
      return;
    }

    // REFRESH TEMPLATES
    if (action === "refresh-templates") {
      await loadTemplates();
      return;
    }

    // APPLY DATABASE TEMPLATE
    if (action === "template") {
      const template = state.templates[Number(index)];

      if (!template) return;

      const items = Array.isArray(template.items)
        ? template.items
        : [];

      if (!items.length) {
        showToast("This template has no checklist items.");
        return;
      }

      const confirmed = confirm(
        `Add ${items.length} items from "${template.title}" to your checklist?`
      );

      if (!confirmed) return;

      target.disabled = true;

      let addedCount = 0;

      try {
        for (const item of items) {
          if (
            !item.name ||
            !["morning", "midday", "evening"].includes(item.phase)
          ) {
            continue;
          }

          await apiRequest("save_routine.php", {
            name: item.name,
            phase: item.phase,
            note: item.note || "",
            done: false
          });

          addedCount++;
        }

        await loadRoutines();

        showToast(
          `${addedCount} template ${addedCount === 1 ? "item" : "items"} added!`
        );

      } catch (error) {
        try {
          await loadRoutines();
        } catch (refreshError) {
          console.error(refreshError);
        }

        showToast(
          addedCount > 0
            ? `${addedCount} items were added before an error: ${error.message}`
            : error.message
        );

      } finally {
        target.disabled = false;
      }
    }
  }

  // ==========================================
  // CHECK / UNCHECK
  // ==========================================

  async function handleToggle(event) {
    const target = event.target;

    if (!target.matches('[data-action="toggle"]')) return;

    if (!state.user || state.user.role !== "end_user") {
      return;
    }

    const item = findItem(target.dataset.id);

    if (!item) return;

    const newDone = target.checked;

    target.disabled = true;

    try {
      await apiRequest("update_routine.php", {
        id: Number(item.id),
        name: item.name,
        phase: item.phase,
        note: item.note,
        done: newDone
      });

      await loadRoutines();

      showToast(
        newDone
          ? "Item completed!"
          : "Item marked incomplete."
      );

    } catch (error) {
      target.checked = !newDone;
      target.disabled = false;

      showToast(error.message);
    }
  }

  // ==========================================
  // LOGIN
  // ==========================================

  $("loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    try {
      showAuthMessage("Logging in...");

      const result = await apiRequest("auth.php", {
        action: "login",
        email,
        password
      });

      if (!result.user) {
        throw new Error("Login response did not include a user account.");
      }

      showApplication(result.user);

      $("loginForm").reset();

      if (result.user.role === "admin") {
        showToast("Welcome, Administrator!");
      } else {
        await loadRoutines();

        if (state.user?.role === "end_user") {
          showToast("Welcome to RoutineSync!");
        }
      }

    } catch (error) {
      showAuthMessage(error.message, true);
    }
  });

  // ==========================================
  // REGISTER
  // ==========================================

  $("registerForm").addEventListener("submit", async event => {
    event.preventDefault();

    const name = $("registerName").value.trim();
    const email = $("registerEmail").value.trim();
    const password = $("registerPassword").value;

    try {
      showAuthMessage("Creating your account...");

      const result = await apiRequest("auth.php", {
        action: "register",
        name,
        email,
        password
      });

      if (!result.user) {
        throw new Error("Registration response did not include a user account.");
      }

      showApplication(result.user);

      $("registerForm").reset();

      if (result.user.role === "admin") {
        showToast("Welcome, Administrator!");
      } else {
        await loadRoutines();

        if (state.user?.role === "end_user") {
          showToast("Account created successfully!");
        }
      }

    } catch (error) {
      showAuthMessage(error.message, true);
    }
  });

  // ==========================================
  // LOGIN / REGISTER SWITCH
  // ==========================================

  $("showLogin").addEventListener("click", showLogin);
  $("showRegister").addEventListener("click", showRegister);

  // ==========================================
  // LOGOUT
  // ==========================================

  $("logoutButton").addEventListener("click", async () => {
    if (!confirm("Are you sure you want to logout?")) {
      return;
    }

    try {
      await apiRequest("auth.php", {
        action: "logout"
      });

      showAuthentication();

      showToast("You have logged out.");

    } catch (error) {
      showToast(error.message);
    }
  });

  // ==========================================
  // ADD / EDIT ROUTINE
  // ==========================================

  $("itemForm").addEventListener("submit", async event => {
    event.preventDefault();

    if (!state.user || state.user.role !== "end_user") {
      return;
    }

    const id = $("itemId").value;
    const name = $("itemName").value.trim();
    const phase = $("itemPhase").value;
    const note = $("itemNote").value.trim();

    if (!name) return;

    try {
      if (id) {
        const item = findItem(id);

        if (!item) {
          showToast("Routine not found.");
          return;
        }

        await apiRequest("update_routine.php", {
          id: Number(id),
          name,
          phase,
          note,
          done: item.done
        });

        showToast("Item updated successfully.");

      } else {
        await apiRequest("save_routine.php", {
          name,
          phase,
          note,
          done: false
        });

        showToast("Item added successfully.");
      }

      closeDialog();

      await loadRoutines();

    } catch (error) {
      showToast(error.message);
    }
  });

  // ==========================================
  // ADD BUTTON
  // ==========================================

  $("addItemTop").addEventListener("click", () => {
    if (!state.user || state.user.role !== "end_user") return;

    openItemDialog();
  });

  $("closeDialog").addEventListener("click", closeDialog);
  $("cancelDialog").addEventListener("click", closeDialog);

  // ==========================================
  // REFRESH ARCHIVED LIST
  // ==========================================

  $("refreshArchived").addEventListener("click", async () => {
    if (!state.user || state.user.role !== "end_user") return;

    const button = $("refreshArchived");

    button.disabled = true;

    try {
      await loadArchivedRoutines();
      showToast("Archived routines refreshed.");

    } catch (error) {
      showToast(error.message);

    } finally {
      button.disabled = false;
    }
  });

  // ==========================================
  // USER NAVIGATION
  // ==========================================

  document.querySelectorAll(
    "#userNavigation .nav-link[data-view]"
  ).forEach(btn => {
    btn.addEventListener("click", () => {
      if (!state.user || state.user.role !== "end_user") return;

      setView(btn.dataset.view);
    });
  });

  // ==========================================
  // PROFILE NAVIGATION
  // ==========================================

  if ($("profileNavButton")) {
    $("profileNavButton").addEventListener("click", () => {
      if (!state.user) return;

      document.querySelectorAll(".view").forEach(view => {
        view.classList.add("hidden");
      });

      if ($("profileView")) {
        $("profileView").classList.remove("hidden");
      }

      const navigation = state.user.role === "admin"
        ? "#adminNavigation .nav-link"
        : "#userNavigation .nav-link";

      document.querySelectorAll(navigation).forEach(button => {
        button.classList.remove("active");
      });

      $("pageTitle").textContent = "Profile Settings";

      $("pageSubtitle").textContent =
        state.user.role === "admin"
          ? "Manage your administrator account details."
          : "Manage your account details and password.";

      $("addItemTop").classList.add("hidden");
    });
  }

  // ==========================================
  // CLICK EVENTS
  // ==========================================

  $("phaseLists").addEventListener("click", handleAction);
  $("allRoutines").addEventListener("click", handleAction);
  $("templateGrid").addEventListener("click", handleAction);
  $("archivedRoutines").addEventListener("click", handleAction);

  // ==========================================
  // CHECKBOX EVENTS
  // ==========================================

  $("phaseLists").addEventListener("change", handleToggle);
  $("allRoutines").addEventListener("change", handleToggle);

  // ==========================================
  // CHECK EXISTING LOGIN SESSION
  // ==========================================

  async function initializeApp() {
    const version = accountVersion;

    try {
      const result = await apiRequest(
        "auth.php?action=me",
        null,
        "GET"
      );

      if (version !== accountVersion) return;

      if (result.logged_in) {
        showApplication(result.user);

        if (result.user.role !== "admin") {
          await loadRoutines();
        }

      } else {
        showAuthentication();
      }

    } catch (error) {
      if (version !== accountVersion) return;

      showAuthentication();

      showAuthMessage(
        "Cannot connect to the server. Make sure Apache and MySQL are running.",
        true
      );

      console.error("Initialization error:", error);
    }
  }

  // ==========================================
  // START APPLICATION
  // ==========================================

  setupPasswordToggle();
  initializeApp();

})();