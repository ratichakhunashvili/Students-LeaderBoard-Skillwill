import {
  auth,
  db,
  firebaseConfig,
  initializeApp,
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  setDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  increment,
} from "./firebase.js";

let currentUser = null;
let currentRole = null;
let currentUserData = null;
let unsubscribePageListener = null;
let allAdminStudents = [];
let allAdminPointRecords = [];
let viewedStudent = null;
let viewedStudentPointRecords = [];

// ================= HELPERS =================

function goTo(page) {
  if (getCurrentPage() !== page) window.location.href = page;
}

function getCurrentPage() {
  return window.location.pathname.split("/").pop() || "index.html";
}

function cleanRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase();
}

function getSelectedLoginRole() {
  return document.querySelector("#loginTabs .nav-link.active")?.dataset.role || "student";
}

function isStudent(data) {
  return cleanRole(data?.role) === "student";
}

function isAdmin(data) {
  return cleanRole(data?.role) === "admin";
}

function requireAdminAction() {
  if (currentRole !== "admin") {
    showError("Only admin users can do this action.");
    return false;
  }
  return true;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  return 0;
}

function formatDate(value) {
  return value?.toDate ? value.toDate().toLocaleDateString() : "-";
}

function getSnapshotDocs(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function makeActivityQrToken() {
  const randomPart = crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `activity-${randomPart}`;
}

const QR_TTL_SECONDS = 30;
let activityQrRefreshTimer = null;
let renderedQrActivities = [];

function makeActivityQrPayload(token) {
  return `doable-activity:${token}`;
}

function getCurrentQrSlot() {
  return Math.floor(Date.now() / (QR_TTL_SECONDS * 1000));
}

function getQrSecondsLeft() {
  return QR_TTL_SECONDS - (Math.floor(Date.now() / 1000) % QR_TTL_SECONDS);
}

function makeTimedActivityQrPayload(activity, slot = getCurrentQrSlot()) {
  return JSON.stringify({
    type: 'doable-activity-v2',
    activityId: activity.id,
    token: activity.qrToken || activity.id,
    slot,
  });
}

function getQrImageUrlFromPayload(payload, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}`;
}

function getActivityQrImageUrl(activity, size = 220) {
  return getQrImageUrlFromPayload(makeTimedActivityQrPayload(activity), size);
}

function parseActivityQrPayload(rawValue) {
  const value = String(rawValue || '').trim();

  try {
    const parsed = JSON.parse(value);
    if (parsed?.type === 'doable-activity-v2') {
      return {
        version: 2,
        activityId: String(parsed.activityId || '').trim(),
        token: String(parsed.token || '').trim(),
        slot: Number(parsed.slot),
      };
    }
    if (parsed?.type === 'activity') {
      return { version: 1, token: String(parsed.token || '').trim() };
    }
  } catch (_) {
    // fallback below
  }

  if (value.startsWith('doable-activity:')) {
    return { version: 1, token: value.replace('doable-activity:', '').trim() };
  }

  return null;
}

function sortStudentsByPoints(students) {
  return students
    .filter(isStudent)
    .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function clearPageListener() {
  if (typeof unsubscribePageListener === "function") {
    unsubscribePageListener();
    unsubscribePageListener = null;
  }
  stopActivityQrTimer();
}

// ================= AUTH STATE =================

onAuthStateChanged(auth, async (user) => {
  const page = getCurrentPage();
  clearPageListener();

  if (!user) {
    currentUser = null;
    currentRole = null;
    currentUserData = null;

    if (page !== "login.html" && page !== "index.html") goTo("login.html");
    return;
  }

  currentUser = user;
  await loadUserData(user.uid, user.email, { createIfMissing: page !== "login.html", defaultRole: "student" });

  if (!currentUserData || !currentRole) {
    // On the login page, handleLogin() may still be creating the missing profile.
    // On protected pages, send the user back to login instead of creating redirect loops.
    if (page !== "login.html") {
      console.error(
        "User exists in Authentication but not in Firestore users collection.",
      );
      await signOut(auth);
      goTo("login.html");
    }
    return;
  }

  routeUser(page);
});

async function loadUserData(uid, email, options = {}) {
  const { createIfMissing = false, defaultRole = "student", displayName = "" } = options;

  try {
    currentUserData = null;
    currentRole = null;

    let snapshot = await getDocs(
      query(collection(db, "users"), where("uid", "==", uid)),
    );

    if (snapshot.empty && email) {
      snapshot = await getDocs(
        query(collection(db, "users"), where("email", "==", email)),
      );

      if (!snapshot.empty) {
        await updateDoc(doc(db, "users", snapshot.docs[0].id), {
          uid,
          updatedAt: Timestamp.now(),
        });
      }
    }

    if (snapshot.empty) {
      if (!createIfMissing) return;

      const safeRole = cleanRole(defaultRole) === "admin" ? "admin" : "student";
      const generatedName =
        displayName ||
        (email ? email.split("@")[0].replace(/[._-]+/g, " ") : "Student");

      const userRef = doc(db, "users", uid);
      const profile = {
        uid,
        name: generatedName,
        email: email || "",
        role: safeRole,
        totalPoints: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await setDoc(userRef, profile);
      currentUserData = { id: uid, ...profile };
      currentRole = safeRole;
      return;
    }

    const userDoc = snapshot.docs[0];
    currentUserData = { id: userDoc.id, ...userDoc.data() };
    currentRole = cleanRole(currentUserData.role);
  } catch (error) {
    console.error("loadUserData error:", error);
    currentUserData = null;
    currentRole = null;
  }
}

function routeUser(page) {
  if (page === "login.html" || page === "index.html") {
    goTo(currentRole === "admin" ? "admin.html" : "students.html");
    return;
  }

  if (
    (page === "admin.html" || page === "activities.html") &&
    currentRole !== "admin"
  ) {
    goTo("students.html");
    return;
  }

  if (
    (page === "students.html" || page === "history.html") &&
    currentRole !== "student"
  ) {
    goTo("admin.html");
    return;
  }

  if (page === "admin.html") initAdminDashboard();
  if (page === "activities.html") initActivitiesPage();
  if (page === "students.html") initStudentDashboard();
  if (page === "history.html") initHistory();
  if (page === "leaderboard.html") initLeaderboard();
}

// ================= LOGIN / SIGNUP UI =================

window.toggleSignup = function (e) {
  e.preventDefault();

  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const toggleText = document.getElementById("toggleText");

  if (!loginForm || !signupForm || !toggleText) return;

  hideAlerts();

  const showLogin = loginForm.style.display === "none";
  loginForm.style.display = showLogin ? "block" : "none";
  signupForm.style.display = showLogin ? "none" : "block";
  toggleText.innerHTML = showLogin
    ? 'Don\'t have an account? <a href="#" onclick="toggleSignup(event)" class="text-link">Sign up</a>'
    : 'Already have an account? <a href="#" onclick="toggleSignup(event)" class="text-link">Login</a>';
};

document.addEventListener("DOMContentLoaded", () => {
  const loginTabs = document.getElementById("loginTabs");
  if (loginTabs) {
    const tabs = loginTabs.querySelectorAll("[data-role]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", function (e) {
        e.preventDefault();
        tabs.forEach((t) => t.classList.remove("active"));
        this.classList.add("active");
        const roleLabel = document.getElementById("roleLabel");
        if (roleLabel) {
          roleLabel.innerHTML =
            this.dataset.role === "admin"
              ? "Logging in as <strong>Admin</strong>"
              : "📚 Logging in as <strong>Student</strong>";
        }
      });
    });
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", handleLogin);
});

// ================= LOGIN =================

async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value.trim();
  const selectedRole = getSelectedLoginRole();

  if (!email || !password) {
    showError("Please enter email and password.");
    return;
  }

  showLoading();

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    currentUser = userCredential.user;

    await loadUserData(currentUser.uid, currentUser.email, {
      createIfMissing: selectedRole === "student",
      defaultRole: "student",
    });

    if (!currentUserData || !currentRole) {
      showError(
        "This admin account exists in Authentication, but it does not have a Firestore users document. Create a document in Firestore > users with this account uid, email, name, and role: admin.",
      );
      await signOut(auth);
      return;
    }

    if (selectedRole === "admin" && currentRole !== "admin") {
      showError("This account is registered as a student, not an admin.");
      await signOut(auth);
      return;
    }

    if (currentRole === "admin") goTo("admin.html");
    else if (currentRole === "student") goTo("students.html");
    else {
      showError("Invalid role. Firestore role must be admin or student.");
      await signOut(auth);
    }
  } catch (error) {
    console.error("Login error:", error);
    showError(getFriendlyFirebaseError(error));
  } finally {
    hideLoading();
  }
}

// ================= SIGNUP =================

window.signupUser = async function () {
  const name = document.getElementById("signupName")?.value.trim();
  const email = document.getElementById("signupEmail")?.value.trim();
  const password = document.getElementById("signupPassword")?.value.trim();

  if (!name || !email || !password) {
    showError("Please fill in all fields.");
    return;
  }

  showLoading();

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;

    const docRef = await addDoc(collection(db, "users"), {
      uid: user.uid,
      name,
      email,
      role: "student",
      totalPoints: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    currentUser = user;
    currentRole = "student";
    currentUserData = {
      id: docRef.id,
      uid: user.uid,
      name,
      email,
      role: "student",
      totalPoints: 0,
    };
    goTo("students.html");
  } catch (error) {
    console.error("Signup error:", error);
    showError(getFriendlyFirebaseError(error));
  } finally {
    hideLoading();
  }
};

// ================= LOGOUT =================

window.logout = logoutUser;
window.logoutAdmin = logoutUser;
window.logoutStudent = logoutUser;

async function logoutUser() {
  try {
    clearPageListener();
    await signOut(auth);
    currentUser = null;
    currentRole = null;
    currentUserData = null;
    goTo("login.html");
  } catch (error) {
    console.error("Logout error:", error);
    showError(getFriendlyFirebaseError(error));
  }
}

// ================= ADMIN DASHBOARD =================

function initAdminDashboard() {
  setupAdminStudentSearch();
  setupStudentHistorySearch();
  loadStudents();
  loadStats();
}

function setupAdminStudentSearch() {
  const input = document.getElementById("studentSearchInput");
  if (!input) return;
  input.addEventListener("input", () => renderAdminStudents());
}

function setupStudentHistorySearch() {
  const input = document.getElementById("studentHistorySearchInput");
  if (!input) return;
  input.addEventListener("input", () => renderStudentHistoryRecords());
}

window.clearStudentSearch = function () {
  setValue("studentSearchInput", "");
  renderAdminStudents();
};

window.clearStudentHistorySearch = function () {
  setValue("studentHistorySearchInput", "");
  renderStudentHistoryRecords();
};

function loadStudents() {
  unsubscribePageListener = onSnapshot(
    collection(db, "users"),
    (snapshot) => {
      allAdminStudents = sortStudentsByPoints(getSnapshotDocs(snapshot));
      renderAdminStudents();
    },
    handleSnapshotError,
  );
}

function renderAdminStudents() {
  const tbody = document.getElementById("studentsTableBody");
  if (!tbody) return;

  const term = String(document.getElementById("studentSearchInput")?.value || "").toLowerCase().trim();
  const students = allAdminStudents.filter((student) => {
    if (!term) return true;
    return `${student.name || ""} ${student.email || ""}`.toLowerCase().includes(term);
  });

  tbody.innerHTML = "";

  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No students found</td></tr>';
    return;
  }

  students.forEach((student) => {
    tbody.insertAdjacentHTML(
      "beforeend",
      `<tr>
        <td>
          <strong>${escapeHtml(student.name || "")}</strong>
          <small class="d-block text-muted">${escapeHtml(student.uid || "")}</small>
        </td>
        <td>${escapeHtml(student.email || "")}</td>
        <td><strong>${student.totalPoints || 0}</strong> pts</td>
        <td>${formatDate(student.createdAt)}</td>
        <td class="table-actions">
          <button class="btn btn-sm btn-gradient me-1" onclick="viewStudentHistory('${student.id}')">
            <i class="bi bi-clock-history"></i> History
          </button>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="editStudent('${student.id}', '${escapeAttr(student.name || "")}', '${escapeAttr(student.email || "")}')">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${student.id}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>`,
    );
  });
}


window.viewStudentHistory = async function (studentId) {
  if (!requireAdminAction()) return;

  viewedStudent = allAdminStudents.find((student) => student.id === studentId) || null;
  if (!viewedStudent) {
    const snap = await getDoc(doc(db, "users", studentId));
    if (!snap.exists()) {
      showError("Student not found.");
      return;
    }
    viewedStudent = { id: snap.id, ...snap.data() };
  }

  setText("studentHistoryTitle", `${viewedStudent.name || "Student"} — Point History`);
  setText("studentHistorySubtitle", `${viewedStudent.email || ""} • ${viewedStudent.totalPoints || 0} total points`);
  setValue("studentHistorySearchInput", "");

  await loadModalActivitySelect();
  await loadViewedStudentPointRecords();

  new bootstrap.Modal(document.getElementById("studentHistoryModal")).show();
};

async function loadModalActivitySelect() {
  const select = document.getElementById("modalPointActivity");
  if (!select) return;

  const snapshot = await getDocs(collection(db, "activities"));
  const activities = getSnapshotDocs(snapshot).sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || "")),
  );

  select.innerHTML = '<option value="">Select an activity</option>';
  activities.forEach((activity) => {
    select.insertAdjacentHTML(
      "beforeend",
      `<option value="${activity.id}" data-points="${Number(activity.defaultPoints || 0)}">${escapeHtml(activity.name || "")} (${activity.defaultPoints || 0} pts)</option>`,
    );
  });

  select.onchange = () => {
    const selected = select.selectedOptions[0];
    const amount = document.getElementById("modalPointAmount");
    if (amount) amount.value = selected?.dataset.points || "";
  };
}

async function loadViewedStudentPointRecords() {
  if (!viewedStudent) return;
  const snapshot = await getDocs(
    query(collection(db, "points"), where("studentId", "==", viewedStudent.id)),
  );
  viewedStudentPointRecords = getSnapshotDocs(snapshot).sort(
    (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt),
  );
  renderStudentHistoryRecords();
}

function renderStudentHistoryRecords() {
  const tbody = document.getElementById("studentHistoryTableBody");
  if (!tbody) return;

  const term = String(document.getElementById("studentHistorySearchInput")?.value || "").toLowerCase().trim();
  const records = viewedStudentPointRecords.filter((point) => {
    if (!term) return true;
    return `${point.activityName || ""} ${point.source || ""} ${formatDate(point.createdAt)} ${point.points || ""}`.toLowerCase().includes(term);
  });

  tbody.innerHTML = "";
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No point records found.</td></tr>';
    return;
  }

  records.forEach((point) => {
    const sourceLabel = point.source === "qr" ? "QR Scan" : "Admin";
    tbody.insertAdjacentHTML(
      "beforeend",
      `<tr>
        <td>${escapeHtml(point.activityName || "Activity")}</td>
        <td><strong>${Number(point.points || 0)}</strong></td>
        <td><span class="badge ${point.source === "qr" ? "bg-danger" : "bg-secondary"}">${sourceLabel}</span></td>
        <td>${formatDate(point.createdAt)}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteStudentPoint('${point.id}', '${escapeAttr(point.studentId || "")}', ${Number(point.points || 0)})">
            <i class="bi bi-trash"></i> Delete
          </button>
        </td>
      </tr>`,
    );
  });
}

window.assignPointsToViewedStudent = async function () {
  if (!requireAdminAction()) return;
  if (!viewedStudent) {
    showError("Select a student first.");
    return;
  }

  const activityId = document.getElementById("modalPointActivity")?.value;
  if (!activityId) {
    showError("Please select an activity.");
    return;
  }

  await assignActivityPointsToStudent(viewedStudent.id, activityId);
  await loadViewedStudentPointRecords();
  await loadStats();
};

window.addStudent = async function () {
  const name = document.getElementById("studentName")?.value.trim();
  const email = document.getElementById("studentEmail")?.value.trim();
  const password = document.getElementById("studentPassword")?.value.trim();

  if (!name || !email || !password) {
    showError("Please fill in student name, email, and password.");
    return;
  }

  try {
    const secondaryApp = initializeApp(
      firebaseConfig,
      `secondary-${Date.now()}`,
    );
    const secondaryAuth = getAuth(secondaryApp);
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      password,
    );

    await addDoc(collection(db, "users"), {
      uid: userCredential.user.uid,
      name,
      email,
      role: "student",
      totalPoints: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await signOut(secondaryAuth);

    setValue("studentName", "");
    setValue("studentEmail", "");
    setValue("studentPassword", "");
    bootstrap.Modal.getInstance(
      document.getElementById("addStudentModal"),
    )?.hide();
    showSuccess("Student account created successfully.");
    loadStats();
  } catch (error) {
    console.error("Add student error:", error);
    showError(getFriendlyFirebaseError(error));
  }
};

window.editStudent = function (docId, name, email) {
  setValue("editStudentName", name);
  setValue("editStudentEmail", email);
  const nameInput = document.getElementById("editStudentName");
  if (nameInput) nameInput.dataset.docId = docId;
  new bootstrap.Modal(document.getElementById("editStudentModal")).show();
};

window.saveStudentEdit = async function () {
  const docId = document.getElementById("editStudentName")?.dataset.docId;
  const name = document.getElementById("editStudentName")?.value.trim();
  const email = document.getElementById("editStudentEmail")?.value.trim();

  if (!docId || !name || !email) {
    showError("Please fill in all fields.");
    return;
  }

  try {
    await updateDoc(doc(db, "users", docId), {
      name,
      email,
      updatedAt: Timestamp.now(),
    });
    showSuccess("Student updated successfully.");
    bootstrap.Modal.getInstance(
      document.getElementById("editStudentModal"),
    )?.hide();
  } catch (error) {
    console.error("Error updating student:", error);
    showError(getFriendlyFirebaseError(error));
  }
};

window.deleteStudent = async function (docId) {
  if (
    !confirm(
      "Are you sure you want to delete this student from Firestore? This will not delete their Firebase Auth account.",
    )
  )
    return;

  try {
    await deleteDoc(doc(db, "users", docId));
    showSuccess("Student deleted from Firestore successfully.");
    loadStats();
  } catch (error) {
    console.error("Error deleting student:", error);
    showError(getFriendlyFirebaseError(error));
  }
};

async function loadStats() {
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const activitiesSnapshot = await getDocs(collection(db, "activities"));
    setText(
      "totalStudents",
      getSnapshotDocs(usersSnapshot).filter(isStudent).length,
    );
    setText("totalActivities", activitiesSnapshot.size);
  } catch (error) {
    console.error("Error loading stats:", error);
  }
}

// ================= ACTIVITIES =================

function initActivitiesPage() {
  setupAdminPointRecordSearch();
  loadActivities();
  loadStudentSelects();
  loadActivitySelects();
  loadAdminPointLedger();
}

function setupAdminPointRecordSearch() {
  const input = document.getElementById("pointRecordsSearchInput");
  if (!input) return;
  input.addEventListener("input", () => renderAdminPointLedger());
}

function loadActivities() {
  unsubscribePageListener = onSnapshot(
    collection(db, "activities"),
    (snapshot) => {
      const grid = document.getElementById("activitiesGrid");
      if (!grid) return;

      const activities = getSnapshotDocs(snapshot).sort(
        (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt),
      );
      renderedQrActivities = activities;
      grid.innerHTML = "";

      if (!activities.length) {
        grid.innerHTML =
          '<div class="col-12"><p class="text-muted text-center py-4">No activities created yet</p></div>';
        stopActivityQrTimer();
        return;
      }

      activities.forEach((activity) => {
        const qrToken = activity.qrToken || activity.id;
        grid.insertAdjacentHTML(
          "beforeend",
          `<div class="col-md-6 col-lg-4">
          <div class="activity-card skill-card">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <span class="eyebrow">Skillwill Activity</span>
                <h5>${escapeHtml(activity.name || "")}</h5>
                <p>${escapeHtml(activity.description || "")}</p>
                <p><strong>${activity.defaultPoints || 0} pts</strong></p>
              </div>
              <span class="badge rounded-pill bg-info text-dark">Live QR</span>
            </div>
            <div class="qr-box my-3 text-center">
              <img src="${getActivityQrImageUrl(activity, 180)}" data-activity-id="${escapeAttr(activity.id)}" data-qr-token="${escapeAttr(qrToken)}" alt="QR code for ${escapeAttr(activity.name || 'activity')}" class="activity-qr-img" />
              <small class="d-block text-muted mt-2">QR refreshes in <strong class="qr-countdown" data-activity-id="${escapeAttr(activity.id)}">${getQrSecondsLeft()}s</strong></small>
              <small class="d-block text-muted">Screenshots expire after 30 seconds.</small>
            </div>
            <div class="d-grid gap-2">
              <button class="btn btn-sm btn-gradient" onclick="downloadActivityQr('${escapeAttr(activity.id)}')">Download Current QR</button>
              <button class="btn btn-sm btn-outline-danger" onclick="deleteActivity('${activity.id}')">Delete Activity</button>
            </div>
          </div>
        </div>`,
        );
      });

      startActivityQrTimer();
    },
    handleSnapshotError,
  );
}

function startActivityQrTimer() {
  if (activityQrRefreshTimer) return;
  activityQrRefreshTimer = setInterval(refreshActivityQrCodes, 1000);
  refreshActivityQrCodes();
}

function stopActivityQrTimer() {
  if (activityQrRefreshTimer) {
    clearInterval(activityQrRefreshTimer);
    activityQrRefreshTimer = null;
  }
}

function refreshActivityQrCodes() {
  if (!renderedQrActivities.length) return;

  const secondsLeft = getQrSecondsLeft();

  renderedQrActivities.forEach((activity) => {
    const img = document.querySelector(`.activity-qr-img[data-activity-id="${CSS.escape(activity.id)}"]`);
    const countdown = document.querySelector(`.qr-countdown[data-activity-id="${CSS.escape(activity.id)}"]`);

    if (countdown) countdown.textContent = `${secondsLeft}s`;
    if (img && (secondsLeft === QR_TTL_SECONDS || secondsLeft === 30)) {
      img.src = getActivityQrImageUrl(activity, 180);
    }
  });
}


window.createActivity = async function () {
  if (!requireAdminAction()) return;

  const name = document.getElementById("activityName")?.value.trim();
  const description = document
    .getElementById("activityDescription")
    ?.value.trim();
  const points = parseInt(document.getElementById("activityPoints")?.value, 10);

  if (!name || !description || Number.isNaN(points) || points < 0) {
    showError("Please fill in all fields correctly.");
    return;
  }

  try {
    const qrToken = makeActivityQrToken();

    await addDoc(collection(db, "activities"), {
      name,
      description,
      defaultPoints: points,
      qrToken,
      qrPayloadType: "timed-30s",
      qrTtlSeconds: QR_TTL_SECONDS,
      createdByUid: currentUser?.uid || "",
      createdByEmail: currentUser?.email || "admin",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    showSuccess("Activity created successfully.");
    setValue("activityName", "");
    setValue("activityDescription", "");
    setValue("activityPoints", "");
    bootstrap.Modal.getInstance(
      document.getElementById("addActivityModal"),
    )?.hide();
    loadActivitySelects();
  } catch (error) {
    console.error("Error creating activity:", error);
    showError(getFriendlyFirebaseError(error));
  }
};

window.downloadActivityQr = function (activityId) {
  const activity = renderedQrActivities.find((item) => item.id === activityId);
  if (!activity) {
    showError('Activity QR not found. Refresh the page and try again.');
    return;
  }

  const safeName = String(activity.name || 'activity')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '') || 'activity';
  const link = document.createElement('a');
  link.href = getActivityQrImageUrl(activity, 600);
  link.download = `${safeName}-live-qr.png`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.click();
};


window.deleteActivity = async function (docId) {
  if (!requireAdminAction()) return;

  if (!confirm("Are you sure you want to delete this activity?")) return;

  try {
    await deleteDoc(doc(db, "activities", docId));
    showSuccess("Activity deleted successfully.");
    loadActivitySelects();
  } catch (error) {
    console.error("Error deleting activity:", error);
    showError(getFriendlyFirebaseError(error));
  }
};

async function loadActivitySelects() {
  try {
    const select = document.getElementById("pointActivity");
    if (!select) return;

    const snapshot = await getDocs(collection(db, "activities"));
    const activities = getSnapshotDocs(snapshot).sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || "")),
    );

    select.innerHTML = '<option value="">Select an activity</option>';
    activities.forEach((activity) => {
      select.insertAdjacentHTML(
        "beforeend",
        `<option value="${activity.id}" data-points="${Number(activity.defaultPoints || 0)}">${escapeHtml(activity.name || "")} (${activity.defaultPoints || 0} pts)</option>`,
      );
    });

    select.onchange = () => {
      const selected = select.selectedOptions[0];
      const pointAmount = document.getElementById("pointAmount");
      if (pointAmount && selected?.dataset.points) {
        pointAmount.value = selected.dataset.points;
        pointAmount.readOnly = true;
        pointAmount.title = "Points are automatically taken from the selected activity.";
      }
    };
  } catch (error) {
    console.error("Error loading activities:", error);
  }
}

async function loadStudentSelects() {
  try {
    const select = document.getElementById("pointStudent");
    if (!select) return;

    const snapshot = await getDocs(collection(db, "users"));
    const students = getSnapshotDocs(snapshot)
      .filter(isStudent)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    select.innerHTML = '<option value="">Select a student</option>';
    students.forEach((student) => {
      select.insertAdjacentHTML(
        "beforeend",
        `<option value="${student.id}">${escapeHtml(student.name || "Student")} — ${escapeHtml(student.email || "")}</option>`,
      );
    });
  } catch (error) {
    console.error("Error loading students:", error);
  }
}


async function assignActivityPointsToStudent(studentId, activityId) {
  const studentDocSnap = await getDoc(doc(db, "users", studentId));
  const activityDocSnap = await getDoc(doc(db, "activities", activityId));

  if (!studentDocSnap.exists() || !activityDocSnap.exists()) {
    showError("Student or activity not found.");
    return false;
  }

  const studentData = studentDocSnap.data();
  const activityData = activityDocSnap.data();
  const amount = Number(activityData.defaultPoints || 0);

  if (!isStudent(studentData)) {
    showError("Selected user is not a student.");
    return false;
  }

  if (!amount || amount <= 0) {
    showError("This activity does not have valid points assigned.");
    return false;
  }

  await addDoc(collection(db, "points"), {
    studentId,
    studentUid: studentData.uid || "",
    studentName: studentData.name || "",
    activityId,
    activityName: activityData.name || "",
    points: amount,
    source: "manual",
    givenByUid: currentUser?.uid || "",
    givenBy: currentUser?.email || "admin",
    createdAt: Timestamp.now(),
  });

  await updateDoc(doc(db, "users", studentId), {
    totalPoints: increment(amount),
    updatedAt: Timestamp.now(),
  });

  showSuccess(`${amount} points assigned to ${studentData.name || "student"} for ${activityData.name || "activity"}.`);
  return true;
}

window.assignPoints = async function () {
  if (!requireAdminAction()) return;

  const studentId = document.getElementById("pointStudent")?.value;
  const activityId = document.getElementById("pointActivity")?.value;

  if (!studentId || !activityId) {
    showError("Please select both a student and an activity.");
    return;
  }

  try {
    const ok = await assignActivityPointsToStudent(studentId, activityId);
    if (ok) {
      setValue("pointAmount", "");
      setValue("pointStudent", "");
      setValue("pointActivity", "");
    }
  } catch (error) {
    console.error("Error assigning points:", error);
    showError(getFriendlyFirebaseError(error));
  }
};

function loadAdminPointLedger() {
  const tbody = document.getElementById("adminPointsTableBody");
  if (!tbody) return;

  onSnapshot(
    collection(db, "points"),
    (snapshot) => {
      allAdminPointRecords = getSnapshotDocs(snapshot).sort(
        (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt),
      );
      renderAdminPointLedger();
    },
    handleSnapshotError,
  );
}

function renderAdminPointLedger() {
  const tbody = document.getElementById("adminPointsTableBody");
  if (!tbody) return;

  const term = String(document.getElementById("pointRecordsSearchInput")?.value || "").toLowerCase().trim();
  const points = allAdminPointRecords.filter((point) => {
    if (!term) return true;
    return `${point.studentName || ""} ${point.activityName || ""} ${point.source || ""} ${formatDate(point.createdAt)} ${point.points || ""}`.toLowerCase().includes(term);
  }).slice(0, 200);

  tbody.innerHTML = "";

  if (!points.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No point records found</td></tr>';
    return;
  }

  points.forEach((point) => {
    const sourceLabel = point.source === "qr" ? "QR Scan" : "Admin";
    tbody.insertAdjacentHTML(
      "beforeend",
      `<tr>
        <td>${escapeHtml(point.studentName || "Student")}</td>
        <td>${escapeHtml(point.activityName || "Activity")}</td>
        <td><strong>${Number(point.points || 0)}</strong></td>
        <td><span class="badge ${point.source === "qr" ? "bg-danger" : "bg-secondary"}">${sourceLabel}</span></td>
        <td>${formatDate(point.createdAt)}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteStudentPoint('${point.id}', '${escapeAttr(point.studentId || "")}', ${Number(point.points || 0)})">
            <i class="bi bi-trash"></i> Delete
          </button>
        </td>
      </tr>`,
    );
  });
}

window.deleteStudentPoint = async function (pointId, studentId, amount) {
  if (!requireAdminAction()) return;
  if (!pointId || !studentId) {
    showError('Point record is missing student information.');
    return;
  }

  if (!confirm(`Delete this ${amount}-point record from the student?`)) return;

  try {
    await deleteDoc(doc(db, 'points', pointId));
    await updateDoc(doc(db, 'users', studentId), {
      totalPoints: increment(-Math.abs(Number(amount || 0))),
      updatedAt: Timestamp.now(),
    });
    showSuccess('Point record deleted and student total updated.');
    if (viewedStudent?.id === studentId) await loadViewedStudentPointRecords();
  } catch (error) {
    console.error('Error deleting student point:', error);
    showError(getFriendlyFirebaseError(error));
  }
};

// ================= STUDENT =================

function initStudentDashboard() {
  if (!currentUserData) return;

  setText("welcomeName", currentUserData.name || "Student");
  setText("studentNameDisplay", currentUserData.name || "Student");

  loadStudentStats();
  loadRecentPoints();
}

async function loadStudentStats() {
  try {
    if (!currentUserData) return;

    setText("myPoints", currentUserData.totalPoints || 0);

    const usersSnapshot = await getDocs(collection(db, "users"));
    const students = sortStudentsByPoints(getSnapshotDocs(usersSnapshot));
    const rank =
      students.findIndex(
        (student) =>
          student.id === currentUserData.id || student.uid === currentUser?.uid,
      ) + 1;
    setText("myRank", rank > 0 ? `#${rank}` : "#-");

    const pointsSnapshot = await getDocs(
      query(
        collection(db, "points"),
        where("studentId", "==", currentUserData.id),
      ),
    );
    setText("recentActivity", pointsSnapshot.size);
  } catch (error) {
    console.error("Error loading student stats:", error);
  }
}

function loadRecentPoints() {
  if (!currentUserData) return;

  unsubscribePageListener = onSnapshot(
    query(
      collection(db, "points"),
      where("studentId", "==", currentUserData.id),
    ),
    (snapshot) => {
      const container = document.getElementById("recentPointsList");
      if (!container) return;

      const points = getSnapshotDocs(snapshot)
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        .slice(0, 10);
      container.innerHTML = "";

      if (!points.length) {
        container.innerHTML =
          '<p class="text-muted text-center py-4">No recent activities</p>';
        return;
      }

      points.forEach((point) => {
        container.insertAdjacentHTML(
          "beforeend",
          `<div class="mb-3 pb-3 border-bottom border-secondary">
            <h6 class="text-white mb-1">${escapeHtml(point.activityName || "Activity")}</h6>
            <small class="text-muted">${formatDate(point.createdAt)}</small>
            <span class="badge bg-success float-end">+${point.points || 0} pts</span>
          </div>`,
        );
      });
    },
    handleSnapshotError,
  );
}


// ================= STUDENT QR SCANNER =================

let qrScanner = null;
let qrScanBusy = false;

window.startQrScanner = async function () {
  if (!currentUserData || currentRole !== 'student') {
    showError('Only logged-in students can scan activity QR codes.');
    return;
  }

  const reader = document.getElementById('qrReader');
  if (!reader) return;

  if (!window.Html5Qrcode) {
    showError('QR scanner library did not load. Check internet connection and refresh the page.');
    return;
  }

  try {
    setText('qrScanResult', 'Camera starting...');
    reader.style.display = 'block';

    if (!qrScanner) qrScanner = new Html5Qrcode('qrReader');

    await qrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      handleActivityQrScan,
      () => {},
    );

    setText('qrScanResult', 'Camera is active. Point it at the activity QR code.');
    const startBtn = document.getElementById('startQrBtn');
    const stopBtn = document.getElementById('stopQrBtn');
    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'inline-block';
  } catch (error) {
    console.error('QR scanner error:', error);
    showError('Could not start camera. Allow camera permission and use HTTPS or localhost.');
    setText('qrScanResult', 'Camera could not start.');
  }
};

window.stopQrScanner = async function () {
  try {
    if (qrScanner?.isScanning) await qrScanner.stop();
  } catch (error) {
    console.warn('QR scanner stop warning:', error);
  }

  const reader = document.getElementById('qrReader');
  const startBtn = document.getElementById('startQrBtn');
  const stopBtn = document.getElementById('stopQrBtn');
  if (reader) reader.style.display = 'none';
  if (startBtn) startBtn.style.display = 'inline-block';
  if (stopBtn) stopBtn.style.display = 'none';
  setText('qrScanResult', 'Scanner stopped.');
};

async function handleActivityQrScan(decodedText) {
  if (qrScanBusy) return;
  qrScanBusy = true;

  const qrData = parseActivityQrPayload(decodedText);

  if (!qrData) {
    setText('qrScanResult', 'Invalid QR code. This is not an activity QR.');
    qrScanBusy = false;
    return;
  }

  try {
    await awardActivityPointsFromQr(qrData);
    await window.stopQrScanner();
  } catch (error) {
    console.error('QR award error:', error);
    showError(getFriendlyFirebaseError(error));
  } finally {
    setTimeout(() => {
      qrScanBusy = false;
    }, 1500);
  }
}

async function awardActivityPointsFromQr(qrData) {
  if (!qrData || qrData.version !== 2) {
    setText('qrScanResult', 'This QR code is old. Ask admin to show the live QR again.');
    showError('Expired QR. Please scan the current live QR code.');
    return;
  }

  const currentSlot = getCurrentQrSlot();
  if (qrData.slot !== currentSlot) {
    setText('qrScanResult', 'This QR code expired. Please scan the live QR again.');
    showError('This QR code expired. It changes every 30 seconds.');
    return;
  }

  const activityDocSnap = await getDoc(doc(db, 'activities', qrData.activityId));
  if (!activityDocSnap.exists()) {
    setText('qrScanResult', 'Activity not found for this QR code.');
    showError('Activity not found for this QR code.');
    return;
  }

  const activity = { id: activityDocSnap.id, ...activityDocSnap.data() };
  const expectedToken = activity.qrToken || activity.id;

  if (qrData.token !== expectedToken) {
    setText('qrScanResult', 'Invalid QR token for this activity.');
    showError('Invalid QR token for this activity.');
    return;
  }

  const pointsSnapshot = await getDocs(collection(db, 'points'));
  const alreadyAwarded = getSnapshotDocs(pointsSnapshot).some(
    (point) =>
      point.studentId === currentUserData.id &&
      point.activityId === activity.id,
  );

  if (alreadyAwarded) {
    setText('qrScanResult', `You already received points for ${activity.name || 'this activity'}.`);
    showError(`You already received points for ${activity.name || 'this activity'}.`);
    return;
  }

  const amount = Number(activity.defaultPoints || 0);
  if (!amount || amount <= 0) {
    showError('This activity has no valid points assigned.');
    return;
  }

  await addDoc(collection(db, 'points'), {
    studentId: currentUserData.id,
    studentUid: currentUser?.uid || currentUserData.uid || '',
    studentName: currentUserData.name || '',
    activityId: activity.id,
    activityName: activity.name || '',
    points: amount,
    source: 'qr',
    qrToken: qrData.token,
    qrSlot: qrData.slot,
    qrTtlSeconds: QR_TTL_SECONDS,
    givenByUid: currentUser?.uid || '',
    givenBy: currentUser?.email || currentUserData.email || 'student QR scan',
    createdAt: Timestamp.now(),
  });

  await updateDoc(doc(db, 'users', currentUserData.id), {
    totalPoints: increment(amount),
    updatedAt: Timestamp.now(),
  });

  currentUserData.totalPoints = Number(currentUserData.totalPoints || 0) + amount;
  setText('myPoints', currentUserData.totalPoints);
  setText('qrScanResult', `Success! You received ${amount} points for ${activity.name || 'activity'}.`);
  showSuccess(`Success! You received ${amount} points for ${activity.name || 'activity'}.`);
  loadStudentStats();
}


// ================= LEADERBOARD =================

function initLeaderboard() {
  setText("pageRole", currentRole === "admin" ? "Admin Panel" : "Student");
  setupLeaderboardNavigation();
  loadLeaderboard();
}

function setupLeaderboardNavigation() {
  const nav = document.getElementById("navMenu");
  if (!nav || currentRole === "admin") return;

  nav.innerHTML = `
    <li class="nav-item"><a class="nav-link" href="students.html"><i class="bi bi-speedometer2"></i> Dashboard</a></li>
    <li class="nav-item"><a class="nav-link active" href="leaderboard.html"><i class="bi bi-trophy"></i> Leaderboard</a></li>
    <li class="nav-item"><a class="nav-link" href="history.html"><i class="bi bi-clock-history"></i> Point History</a></li>
  `;
}

function loadLeaderboard() {
  unsubscribePageListener = onSnapshot(
    collection(db, "users"),
    async (snapshot) => {
      const tbody = document.getElementById("leaderboardBody");
      if (!tbody) return;

      const students = sortStudentsByPoints(getSnapshotDocs(snapshot));
      tbody.innerHTML = "";

      if (!students.length) {
        tbody.innerHTML =
          '<tr><td colspan="4" class="text-center text-muted">No students yet</td></tr>';
        return;
      }

      const activityCounts = await getActivityCounts();

      students.forEach((student, index) => {
        const rank = index + 1;
        const rankBadge = rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : `#${rank}`;

        tbody.insertAdjacentHTML(
          "beforeend",
          `<tr>
          <td>${rankBadge}</td>
          <td>${escapeHtml(student.name || "")}</td>
          <td><strong>${student.totalPoints || 0}</strong></td>
          <td>${activityCounts[student.id] || 0}</td>
        </tr>`,
        );
      });

      updateMyPositionCard(students);
    },
    handleSnapshotError,
  );
}

async function getActivityCounts() {
  const counts = {};
  const snapshot = await getDocs(collection(db, "points"));
  snapshot.forEach((pointDoc) => {
    const point = pointDoc.data();
    if (!point.studentId) return;
    counts[point.studentId] = (counts[point.studentId] || 0) + 1;
  });
  return counts;
}

function updateMyPositionCard(students) {
  if (!currentUserData || currentRole !== "student") return;

  const card = document.getElementById("myPositionCard");
  if (!card) return;

  const index = students.findIndex(
    (student) =>
      student.id === currentUserData.id || student.uid === currentUser?.uid,
  );
  if (index < 0) return;

  const student = students[index];
  const nextStudent = students[index - 1];
  const diff = nextStudent
    ? Math.max(0, (nextStudent.totalPoints || 0) - (student.totalPoints || 0))
    : 0;

  setText("myPositionRank", `#${index + 1}`);
  setText("myPositionPoints", student.totalPoints || 0);
  setText("myPositionDiff", index === 0 ? "Top" : diff);
  card.style.display = "block";
}

// ================= HISTORY =================

function initHistory() {
  if (!currentUserData) return;

  setText("studentNameDisplay", currentUserData.name || "Student");
  loadHistoryStatsAndTimeline();
}

function loadHistoryStatsAndTimeline() {
  if (!currentUserData) return;

  unsubscribePageListener = onSnapshot(
    query(
      collection(db, "points"),
      where("studentId", "==", currentUserData.id),
    ),
    async (snapshot) => {
      const points = getSnapshotDocs(snapshot).sort(
        (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt),
      );
      const total = points.reduce(
        (sum, item) => sum + Number(item.points || 0),
        0,
      );
      const now = new Date();
      const monthTotal = points
        .filter((item) => {
          const date = item.createdAt?.toDate?.();
          return (
            date &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear()
          );
        })
        .reduce((sum, item) => sum + Number(item.points || 0), 0);

      setText("totalPoints", currentUserData.totalPoints || total);
      setText("activitiesCount", points.length);
      setText("monthPoints", monthTotal);

      const usersSnapshot = await getDocs(collection(db, "users"));
      const students = sortStudentsByPoints(getSnapshotDocs(usersSnapshot));
      const rank =
        students.findIndex(
          (student) =>
            student.id === currentUserData.id ||
            student.uid === currentUser?.uid,
        ) + 1;
      setText("currentRank", rank > 0 ? `#${rank}` : "#-");

      renderHistoryTimeline(points);
    },
    handleSnapshotError,
  );
}

function renderHistoryTimeline(points) {
  const timeline = document.getElementById("historyTimeline");
  if (!timeline) return;

  timeline.innerHTML = "";

  if (!points.length) {
    timeline.innerHTML =
      '<p class="text-muted text-center py-4">No activities yet</p>';
    return;
  }

  points.forEach((point) => {
    timeline.insertAdjacentHTML(
      "beforeend",
      `<div class="timeline-item">
        <h6 class="text-white mb-1">${escapeHtml(point.activityName || "Activity")}</h6>
        <small class="text-muted">${formatDate(point.createdAt)}</small>
        <span class="badge bg-success float-end">+${point.points || 0}</span>
      </div>`,
    );
  });
}

// ================= UI UTILS =================

function showLoading() {
  const button = document.querySelector(
    '#loginForm button[type="submit"], #signupForm button[type="button"]',
  );
  if (button) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = "Loading...";
  }
}

function hideLoading() {
  document
    .querySelectorAll(
      '#loginForm button[type="submit"], #signupForm button[type="button"]',
    )
    .forEach((button) => {
      button.disabled = false;
      if (button.dataset.originalText)
        button.textContent = button.dataset.originalText;
    });
}

function hideAlerts() {
  const errorAlert = document.getElementById("errorAlert");
  const successAlert = document.getElementById("successAlert");
  if (errorAlert) errorAlert.style.display = "none";
  if (successAlert) successAlert.style.display = "none";
}

function showError(message) {
  const alertDiv = document.getElementById("errorAlert");
  const errorMessage = document.getElementById("errorMessage");

  if (!alertDiv || !errorMessage) {
    console.error(message);
    alert(message);
    return;
  }

  errorMessage.textContent = message;
  alertDiv.style.display = "block";

  setTimeout(() => {
    alertDiv.style.display = "none";
  }, 6000);
}

function showSuccess(message) {
  const alertDiv = document.getElementById("successAlert");
  const successMessage = document.getElementById("successMessage");

  if (!alertDiv || !successMessage) {
    console.log(message);
    return;
  }

  successMessage.textContent = message;
  alertDiv.style.display = "block";

  setTimeout(() => {
    alertDiv.style.display = "none";
  }, 5000);
}

function handleSnapshotError(error) {
  console.error("Firestore listener error:", error);
  showError(getFriendlyFirebaseError(error));
}

function getFriendlyFirebaseError(error) {
  const code = error?.code || "";
  const map = {
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/missing-password": "Please enter a password.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "permission-denied":
      "Firebase permission denied. Please check Firestore rules.",
    "failed-precondition":
      "Firestore needs an index or rule update. This version avoids most index issues, but please check the console details.",
  };

  return map[code] || error?.message || "Something went wrong.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

export { currentUser, currentRole, currentUserData };
