(() => {
    "use strict";

    const API = "php/";

    let adminTemplates = [];

    const $ = (id) => document.getElementById(id);

    // ==========================================
    // GENERAL HELPERS
    // ==========================================

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };

            return entities[character];
        });
    }

    async function apiRequest(file, data = null, method = "GET") {
        const options = {
            method,
            headers: {
                "Accept": "application/json"
            },
            credentials: "same-origin"
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
            throw new Error(result.message || "Something went wrong.");
        }

        return result;
    }

    function showMessage(elementId, message, isError = false) {
        const element = $(elementId);

        if (!element) return;

        element.textContent = message;
        element.className = isError
            ? "text-sm mt-4 text-red-600"
            : "text-sm mt-4 text-green-600";
    }

    function showToast(message) {
        const toast = $("toast");

        if (!toast) return;

        toast.textContent = message;
        toast.classList.add("show");

        window.clearTimeout(showToast.timer);

        showToast.timer = window.setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    function setAdminHeading(title, subtitle) {
        if ($("pageTitle")) {
            $("pageTitle").textContent = title;
        }

        if ($("pageSubtitle")) {
            $("pageSubtitle").textContent = subtitle;
        }

        if ($("addItemTop")) {
            $("addItemTop").classList.add("hidden");
        }
    }

    function updateAdminNavigation(activeView) {
        document.querySelectorAll("#adminNavigation [data-view]").forEach((button) => {
            button.classList.toggle(
                "active",
                button.dataset.view === activeView
            );
        });
    }

    function hideAllViews() {
        document.querySelectorAll(".view").forEach((view) => {
            view.classList.add("hidden");
        });
    }

    // ==========================================
    // ADMIN DASHBOARD
    // ==========================================

    async function loadAdminDashboard() {
        const table = $("adminUsersTable");

        if (table) {
            table.innerHTML = `
                <tr>
                    <td colspan="7" class="py-5 text-center text-slate-400">
                        Loading user accounts...
                    </td>
                </tr>
            `;
        }

        showMessage("adminMessage", "");

        try {
            const result = await apiRequest("admin_dashboard.php");

            const stats = result.stats || {};

            if ($("adminTotalUsers")) {
                $("adminTotalUsers").textContent =
                    stats.total_users ?? 0;
            }

            if ($("adminActiveRoutines")) {
                $("adminActiveRoutines").textContent =
                    stats.active_routines ?? 0;
            }

            if ($("adminArchivedRoutines")) {
                $("adminArchivedRoutines").textContent =
                    stats.archived_routines ?? 0;
            }

            if ($("adminCompletedItems")) {
                $("adminCompletedItems").textContent =
                    stats.completed_items ?? 0;
            }

            renderAdminUsers(result.users || []);

        } catch (error) {
            if (table) {
                table.innerHTML = `
                    <tr>
                        <td colspan="7" class="py-5 text-center text-red-500">
                            ${escapeHtml(error.message)}
                        </td>
                    </tr>
                `;
            }

            showMessage("adminMessage", error.message, true);
        }
    }

    function renderAdminUsers(users) {
        const table = $("adminUsersTable");

        if (!table) return;

        if (!Array.isArray(users) || users.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="7" class="py-5 text-center text-slate-400">
                        No registered users found.
                    </td>
                </tr>
            `;
            return;
        }

        table.innerHTML = users.map((user) => {
            const isAdmin = user.role === "admin";
            const isActive = Number(user.is_active) === 1;

            const roleBadge = isAdmin
                ? `<span class="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">Admin</span>`
                : `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">End User</span>`;

            const statusBadge = isActive
                ? `<span class="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">Active</span>`
                : `<span class="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">Inactive</span>`;

            const registeredDate = user.created_at
                ? new Date(String(user.created_at).replace(" ", "T")).toLocaleDateString()
                : "—";

            let actionButton = "";

            if (isAdmin) {
                actionButton = `
                    <span class="text-xs text-slate-400 font-semibold">
                        Protected
                    </span>
                `;
            } else {
                actionButton = `
                    <button
                        type="button"
                        class="px-3 py-2 rounded-lg text-xs font-semibold ${
                            isActive
                                ? "bg-red-50 text-red-600 hover:bg-red-100"
                                : "bg-green-50 text-green-700 hover:bg-green-100"
                        }"
                        data-user-action="toggle"
                        data-user-id="${escapeHtml(user.id)}"
                        data-user-active="${isActive ? "1" : "0"}">
                        ${isActive ? "Deactivate" : "Activate"}
                    </button>
                `;
            }

            return `
                <tr class="border-b border-slate-100">
                    <td class="py-4 px-3">${escapeHtml(user.id)}</td>

                    <td class="py-4 px-3 font-semibold text-slate-700">
                        ${escapeHtml(user.display_name)}
                    </td>

                    <td class="py-4 px-3">
                        ${escapeHtml(user.email)}
                    </td>

                    <td class="py-4 px-3">
                        ${roleBadge}
                    </td>

                    <td class="py-4 px-3">
                        ${statusBadge}
                    </td>

                    <td class="py-4 px-3 text-slate-500">
                        ${escapeHtml(registeredDate)}
                    </td>

                    <td class="py-4 px-3">
                        ${actionButton}
                    </td>
                </tr>
            `;
        }).join("");
    }

    async function toggleUserStatus(button) {
        const userId = button.dataset.userId;
        const currentlyActive = Number(button.dataset.userActive) === 1;

        const newStatus = currentlyActive ? 0 : 1;

        const actionText = currentlyActive
            ? "deactivate this account"
            : "activate this account";

        if (!confirm(`Are you sure you want to ${actionText}?`)) {
            return;
        }

        button.disabled = true;

        try {
            const result = await apiRequest(
                "toggle_user_status.php",
                {
                    user_id: Number(userId),
                    is_active: newStatus
                },
                "POST"
            );

            showMessage(
                "adminMessage",
                result.message || "Account status updated successfully."
            );

            await loadAdminDashboard();

        } catch (error) {
            showMessage("adminMessage", error.message, true);
            button.disabled = false;
        }
    }

    // ==========================================
    // ADMIN DASHBOARD VIEW
    // ==========================================

    function showAdminView() {
        hideAllViews();

        const adminView = $("adminView");

        if (adminView) {
            adminView.classList.remove("hidden");
        }

        updateAdminNavigation("admin");

        setAdminHeading(
            "Admin Dashboard",
            "Manage user accounts and monitor RoutineSync."
        );

        loadAdminDashboard();
    }

    // ==========================================
    // ADMIN TEMPLATE MANAGEMENT
    // ==========================================

    async function loadAdminTemplates() {
        const grid = $("adminTemplateGrid");

        if (!grid) return;

        grid.innerHTML = `
            <p class="text-sm text-slate-400">
                Loading templates...
            </p>
        `;

        showMessage("adminTemplateMessage", "");

        try {
            const result = await apiRequest("get_templates.php");

            adminTemplates = Array.isArray(result.templates)
                ? result.templates
                : [];

            renderAdminTemplates();

        } catch (error) {
            grid.innerHTML = `
                <p class="text-sm text-red-500">
                    ${escapeHtml(error.message)}
                </p>
            `;

            showMessage(
                "adminTemplateMessage",
                error.message,
                true
            );
        }
    }

    function getTemplateIcon(title) {
        const value = String(title || "").toLowerCase();

        if (value.includes("student")) return "🎒";
        if (value.includes("work")) return "💼";
        if (value.includes("professional")) return "💼";

        return "🌿";
    }

    function renderAdminTemplates() {
        const grid = $("adminTemplateGrid");

        if (!grid) return;

        if (adminTemplates.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <div class="text-4xl mb-3">📋</div>
                    <h3 class="font-bold text-slate-700">
                        No templates available
                    </h3>
                    <p class="text-sm text-slate-500 mt-2">
                        Click Add New Template to create your first template.
                    </p>
                </div>
            `;
            return;
        }

        grid.innerHTML = adminTemplates.map((template, index) => {
            const items = Array.isArray(template.items)
                ? template.items
                : [];

            const itemList = items.slice(0, 5).map((item) => {
                const phaseName = {
                    morning: "Morning",
                    midday: "Midday",
                    evening: "Evening"
                }[item.phase] || item.phase;

                return `
                    <li class="text-sm text-slate-600 py-1">
                        <span class="font-semibold">${escapeHtml(phaseName)}:</span>
                        ${escapeHtml(item.name)}
                    </li>
                `;
            }).join("");

            const remaining = items.length - 5;

            return `
                <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                    <div class="flex items-start justify-between gap-3">
                        <div class="text-3xl">
                            ${getTemplateIcon(template.title)}
                        </div>

                        <span class="text-xs rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 font-semibold">
                            ${items.length} items
                        </span>
                    </div>

                    <h3 class="font-bold text-lg text-slate-800 mt-4">
                        ${escapeHtml(template.title)}
                    </h3>

                    <p class="text-sm text-slate-500 mt-2 min-h-10">
                        ${escapeHtml(template.description)}
                    </p>

                    <div class="border-t border-slate-100 mt-4 pt-3">
                        <p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                            Included checklist items
                        </p>

                        <ul class="space-y-1">
                            ${itemList}
                        </ul>

                        ${
                            remaining > 0
                                ? `<p class="text-xs text-indigo-600 mt-2">+ ${remaining} more items</p>`
                                : ""
                        }
                    </div>

                    <div class="flex gap-2 mt-5 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            class="secondary-btn flex-1"
                            data-template-action="edit"
                            data-template-index="${index}">
                            Edit
                        </button>

                        <button
                            type="button"
                            class="flex-1 rounded-lg bg-red-50 text-red-600 px-3 py-2 text-sm font-semibold hover:bg-red-100"
                            data-template-action="delete"
                            data-template-index="${index}">
                            Delete
                        </button>
                    </div>

                </article>
            `;
        }).join("");
    }

    // ==========================================
    // TEMPLATE DIALOG
    // ==========================================

    function addTemplateItemRow(item = {}) {
        const container = $("templateItemsContainer");

        if (!container) return;

        const phase = ["morning", "midday", "evening"].includes(item.phase)
            ? item.phase
            : "morning";

        const row = document.createElement("div");

        row.className =
            "template-item-editor template-item-row";

        row.innerHTML = `
            <div class="grid gap-3">

                <div>
                    <label class="field-label">Routine Phase</label>

                    <select class="field template-item-phase" required>
                        <option value="morning" ${phase === "morning" ? "selected" : ""}>
                            Morning
                        </option>

                        <option value="midday" ${phase === "midday" ? "selected" : ""}>
                            Midday
                        </option>

                        <option value="evening" ${phase === "evening" ? "selected" : ""}>
                            Evening
                        </option>
                    </select>
                </div>

                <div>
                    <label class="field-label">Checklist Item</label>

                    <input
                        type="text"
                        class="field template-item-name"
                        maxlength="90"
                        required
                        placeholder="e.g. Check class schedule"
                        value="${escapeHtml(item.name || "")}">
                </div>

                <div>
                    <label class="field-label">Note (optional)</label>

                    <input
                        type="text"
                        class="field template-item-note"
                        maxlength="160"
                        placeholder="Add a short reminder"
                        value="${escapeHtml(item.note || "")}">
                </div>

                <div class="flex justify-end">
                    <button
                        type="button"
                        class="remove-template-item"
                        aria-label="Remove this item">
                        Remove item ✕
                    </button>
                </div>

            </div>
        `;

        container.appendChild(row);
    }

    function openTemplateDialog(template = null) {
        const dialog = $("templateDialog");
        const form = $("templateForm");

        if (!dialog || !form) return;

        form.reset();

        $("templateItemsContainer").innerHTML = "";

        showMessage("templateFormMessage", "");

        if (template) {
            $("templateDialogTitle").textContent = "Edit Template";
            $("saveTemplateButton").textContent = "Update Template";

            $("originalTemplateTitle").value = template.title || "";
            $("originalTemplateDescription").value =
                template.description || "";

            $("templateTitle").value = template.title || "";
            $("templateDescription").value =
                template.description || "";

            const items = Array.isArray(template.items)
                ? template.items
                : [];

            items.forEach((item) => {
                addTemplateItemRow(item);
            });

        } else {
            $("templateDialogTitle").textContent = "Add New Template";
            $("saveTemplateButton").textContent = "Save Template";

            $("originalTemplateTitle").value = "";
            $("originalTemplateDescription").value = "";

            $("templateTitle").value = "";
            $("templateDescription").value = "";

            addTemplateItemRow({
                phase: "morning",
                name: "",
                note: ""
            });
        }

        if (!dialog.open) {
            dialog.showModal();
        }
    }

    function closeTemplateDialog() {
        const dialog = $("templateDialog");

        if (dialog && dialog.open) {
            dialog.close();
        }
    }

    function collectTemplateItems() {
        const rows = document.querySelectorAll(
            "#templateItemsContainer .template-item-row"
        );

        const items = [];

        rows.forEach((row) => {
            const phase = row.querySelector(
                ".template-item-phase"
            ).value;

            const name = row.querySelector(
                ".template-item-name"
            ).value.trim();

            const note = row.querySelector(
                ".template-item-note"
            ).value.trim();

            items.push({
                phase,
                name,
                note
            });
        });

        return items;
    }

    // ==========================================
    // SAVE OR UPDATE TEMPLATE
    // ==========================================

    async function submitTemplateForm(event) {
        event.preventDefault();

        const title = $("templateTitle").value.trim();
        const description = $("templateDescription").value.trim();

        const originalTitle = $("originalTemplateTitle").value;
        const originalDescription =
            $("originalTemplateDescription").value;

        const items = collectTemplateItems();

        if (!title || !description) {
            showMessage(
                "templateFormMessage",
                "Please enter the template name and description.",
                true
            );
            return;
        }

        if (items.length === 0) {
            showMessage(
                "templateFormMessage",
                "Please add at least one checklist item.",
                true
            );
            return;
        }

        const invalidItem = items.find((item) => !item.name);

        if (invalidItem) {
            showMessage(
                "templateFormMessage",
                "Every checklist item must have a name.",
                true
            );
            return;
        }

        const isEditing = originalTitle !== "";

        const payload = {
            title,
            description,
            items
        };

        let endpoint = "save_template.php";

        if (isEditing) {
            endpoint = "update_template.php";

            payload.original_title = originalTitle;
            payload.original_description = originalDescription;
        }

        const saveButton = $("saveTemplateButton");

        saveButton.disabled = true;
        saveButton.textContent = isEditing
            ? "Updating..."
            : "Saving...";

        try {
            const result = await apiRequest(
                endpoint,
                payload,
                "POST"
            );

            closeTemplateDialog();

            showMessage(
                "adminTemplateMessage",
                result.message || (
                    isEditing
                        ? "Template updated successfully."
                        : "Template created successfully."
                )
            );

            showToast(
                isEditing
                    ? "Template updated successfully!"
                    : "New template created successfully!"
            );

            await loadAdminTemplates();

        } catch (error) {
            showMessage(
                "templateFormMessage",
                error.message,
                true
            );

        } finally {
            saveButton.disabled = false;
            saveButton.textContent = isEditing
                ? "Update Template"
                : "Save Template";
        }
    }

    // ==========================================
    // DELETE TEMPLATE
    // ==========================================

    async function deleteTemplate(index) {
        const template = adminTemplates[index];

        if (!template) return;

        const confirmed = confirm(
            `Are you sure you want to delete "${template.title}"?\n\nThis template will no longer appear in the End User Templates page.`
        );

        if (!confirmed) return;

        showMessage(
            "adminTemplateMessage",
            "Deleting template..."
        );

        try {
            const result = await apiRequest(
                "delete_template.php",
                {
                    original_title: template.title,
                    original_description: template.description
                },
                "POST"
            );

            showMessage(
                "adminTemplateMessage",
                result.message || "Template deleted successfully."
            );

            showToast("Template deleted successfully!");

            await loadAdminTemplates();

        } catch (error) {
            showMessage(
                "adminTemplateMessage",
                error.message,
                true
            );
        }
    }

    // ==========================================
    // ADMIN TEMPLATE VIEW
    // ==========================================

    function showAdminTemplatesView() {
        hideAllViews();

        const view = $("adminTemplatesView");

        if (view) {
            view.classList.remove("hidden");
        }

        updateAdminNavigation("admin-templates");

        setAdminHeading(
            "Template Management",
            "Create and manage routine templates for End Users."
        );

        loadAdminTemplates();
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    // Admin navigation
    document.querySelectorAll("#adminNavigation [data-view]").forEach((button) => {
        button.addEventListener("click", () => {
            if (button.dataset.view === "admin") {
                showAdminView();
            }

            if (button.dataset.view === "admin-templates") {
                showAdminTemplatesView();
            }
        });
    });

    // Admin login event from app.js
    document.addEventListener("routinesync:admin-login", () => {
        showAdminView();
    });

    // Refresh Admin Dashboard
    if ($("refreshAdminDashboard")) {
        $("refreshAdminDashboard").addEventListener("click", () => {
            loadAdminDashboard();
        });
    }

    // Activate / Deactivate account
    if ($("adminUsersTable")) {
        $("adminUsersTable").addEventListener("click", (event) => {
            const button = event.target.closest(
                '[data-user-action="toggle"]'
            );

            if (!button) return;

            toggleUserStatus(button);
        });
    }

    // Open Add Template dialog
    if ($("addTemplateButton")) {
        $("addTemplateButton").addEventListener("click", () => {
            openTemplateDialog();
        });
    }

    // Add checklist item row
    if ($("addTemplateItem")) {
        $("addTemplateItem").addEventListener("click", () => {
            addTemplateItemRow({
                phase: "morning",
                name: "",
                note: ""
            });
        });
    }

    // Remove checklist item row
    if ($("templateItemsContainer")) {
        $("templateItemsContainer").addEventListener("click", (event) => {
            const button = event.target.closest(
                ".remove-template-item"
            );

            if (!button) return;

            const rows = document.querySelectorAll(
                "#templateItemsContainer .template-item-row"
            );

            if (rows.length <= 1) {
                showMessage(
                    "templateFormMessage",
                    "A template must have at least one checklist item.",
                    true
                );
                return;
            }

            button.closest(".template-item-row").remove();

            showMessage("templateFormMessage", "");
        });
    }

    // Edit or Delete template
    if ($("adminTemplateGrid")) {
        $("adminTemplateGrid").addEventListener("click", (event) => {
            const button = event.target.closest(
                "[data-template-action]"
            );

            if (!button) return;

            const index = Number(button.dataset.templateIndex);

            if (!Number.isInteger(index)) return;

            const action = button.dataset.templateAction;

            if (action === "edit") {
                const template = adminTemplates[index];

                if (template) {
                    openTemplateDialog(template);
                }
            }

            if (action === "delete") {
                deleteTemplate(index);
            }
        });
    }

    // Submit template form
    if ($("templateForm")) {
        $("templateForm").addEventListener(
            "submit",
            submitTemplateForm
        );
    }

    // Close template dialog
    if ($("closeTemplateDialog")) {
        $("closeTemplateDialog").addEventListener(
            "click",
            closeTemplateDialog
        );
    }

    if ($("cancelTemplateDialog")) {
        $("cancelTemplateDialog").addEventListener(
            "click",
            closeTemplateDialog
        );
    }

    // Close dialog by clicking outside
    if ($("templateDialog")) {
        $("templateDialog").addEventListener("click", (event) => {
            if (event.target === $("templateDialog")) {
                closeTemplateDialog();
            }
        });
    }

})();