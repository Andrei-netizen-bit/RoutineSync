(() => {
  "use strict";

  const API = "php/";

  const $ = id => document.getElementById(id);

  async function apiRequest(file, data = null, method = "POST") {
    const options = {
      method,
      credentials: "same-origin",
      headers: {}
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

    if (!response.ok) {
      throw new Error(result.error || "Something went wrong.");
    }

    return result;
  }

  function showProfileMessage(message, error = false) {
    const el = $("profileMessage");

    el.textContent = message;
    el.className = "text-sm mt-4 " +
      (error ? "text-red-600" : "text-green-600");
  }

  function showProfileView() {
    document.querySelectorAll(".view").forEach(view => {
      view.classList.add("hidden");
    });

    $("profileView").classList.remove("hidden");

    document.querySelectorAll(".nav-link").forEach(button => {
      button.classList.remove("active");
    });

    $("profileNavButton").classList.add("active");

    $("pageTitle").textContent = "Profile Settings";
    $("pageSubtitle").textContent =
      "Manage your account information and password.";

    $("addItemTop").classList.add("hidden");

    loadProfile();
  }

  async function loadProfile() {
    try {
      const result = await apiRequest(
        "auth.php?action=me",
        null,
        "GET"
      );

      if (!result.logged_in) {
        showProfileMessage(
          "Your session has expired. Please log in again.",
          true
        );
        return;
      }

      $("profileName").value = result.user.name || "";
      $("profileEmail").value = result.user.email || "";

      $("currentPassword").value = "";
      $("newPassword").value = "";
      $("confirmPassword").value = "";

      showProfileMessage("");
    } catch (error) {
      showProfileMessage(error.message, true);
    }
  }

  // OPEN PROFILE SETTINGS
  $("profileNavButton").addEventListener("click", showProfileView);

  // SAVE PROFILE CHANGES
  $("profileForm").addEventListener("submit", async event => {
    event.preventDefault();

    const name = $("profileName").value.trim();
    const email = $("profileEmail").value.trim();
    const currentPassword = $("currentPassword").value;
    const newPassword = $("newPassword").value;
    const confirmPassword = $("confirmPassword").value;
    const saveButton = $("saveProfileButton");

    if (!name || !email || !currentPassword) {
      showProfileMessage(
        "Please complete your name, email, and current password.",
        true
      );
      return;
    }

    if (newPassword && newPassword.length < 8) {
      showProfileMessage(
        "New password must be at least 8 characters.",
        true
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      showProfileMessage(
        "New password and confirmation do not match.",
        true
      );
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      const result = await apiRequest("update_profile.php", {
        name,
        email,
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      });

      $("loggedUser").textContent = result.user.name;

      $("currentPassword").value = "";
      $("newPassword").value = "";
      $("confirmPassword").value = "";

      showProfileMessage(
        result.message || "Profile updated successfully!"
      );

    } catch (error) {
      showProfileMessage(error.message, true);

    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save Changes";
    }
  });

  // PASSWORD EYE ICON - CAMPUS CANTEEN STYLE
  document.querySelectorAll(".toggle-password").forEach(button => {

    button.addEventListener("click", function () {

      const targetId = this.dataset.target;
      const passwordInput = $(targetId);

      if (!passwordInput) return;

      if (passwordInput.type === "password") {

        // SHOW PASSWORD
        passwordInput.type = "text";

        this.innerHTML = `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 3l18 18"></path>
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path>
            <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a15.5 15.5 0 0 1-3.1 3.8"></path>
            <path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10.7 10.7 0 0 0 4-.8"></path>
          </svg>
        `;

        this.setAttribute("aria-label", "Hide password");

      } else {

        // HIDE PASSWORD
        passwordInput.type = "password";

        this.innerHTML = `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        `;

        this.setAttribute("aria-label", "Show password");
      }
    });
  });

})();