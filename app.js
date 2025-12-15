import { db } from "./firebase.js";
import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { auth } from "./firebase.js";

import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   GLOBAL APP STATE
   ========================= */
const AppState = {
    user: null,
    goals: [],          // [{id, ...}]
    tasksByGoal: {},    // goalId -> [tasks]
    lastFetched: 0
};

let editingTask = {
    goalId: null,
    taskId: null
};

let editingNoteId = null;

/* =========================
   DOM HELPERS
   ========================= */
const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

/* =========================
   DATA CACHE FETCH
   ========================= */
async function fetchAllGoalsAndTasks(force = false) {
    const now = Date.now();

    if (!force && AppState.goals.length && now - AppState.lastFetched < 30000) {
        return;
    }

    AppState.goals = [];
    AppState.tasksByGoal = {};

    const goalsSnap = await getDocs(collection(db, "goals"));
    AppState.goals = goalsSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
    }));

    await Promise.all(
        AppState.goals.map(async (goal) => {
            const tasksSnap = await getDocs(
                collection(db, "goals", goal.id, "tasks")
            );
            AppState.tasksByGoal[goal.id] =
                tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        })
    );

    AppState.lastFetched = now;
}
/* =========================
   Notes Attach
   ========================= */
function attachNoteActions() {
    document.querySelectorAll(".btn-delete-note").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const noteEl = e.target.closest(".note-item");
            const noteId = noteEl.dataset.id;

            if (!confirm("Delete this note?")) return;

            await deleteDoc(doc(db, "notes", noteId));
            loadNotes(document.getElementById("notesFilter").value);
        });
    });

    document.querySelectorAll(".btn-edit-note").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const noteEl = e.target.closest(".note-item");
            const noteId = noteEl.dataset.id;
            const text = noteEl.querySelector(".note-text").textContent;

            document.getElementById("noteText").value = text;
            editingNoteId = noteId;
        });
    });
}


/* =========================
   AUTH (FIREBASE SIGN IN)
   ========================= */

const authPage = document.getElementById("authPage");
const appRoot = document.getElementById("app");

// Hide app by default
if (appRoot) appRoot.style.display = "none";

// Handle sign in
document.getElementById("signInForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("signInEmail").value.trim();
    const password = document.getElementById("signInPassword").value.trim();

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert("Invalid email or password");
    }
});

// Watch auth state
onAuthStateChanged(auth, (user) => {
    if (user) {
        authPage.style.display = "none";
        appRoot.style.display = "flex";

        const nameEl = document.getElementById("userName");
        const emailEl = document.getElementById("userEmail");

        if (nameEl) nameEl.textContent = user.email.split("@")[0];
        if (emailEl) emailEl.textContent = user.email;
    } else {
        authPage.style.display = "flex";
        appRoot.style.display = "none";
    }
});


/* =========================
   INITIALIZE APP
   ========================= */
document.addEventListener("DOMContentLoaded", async () => {
    setupNavigation();
    setupModals();
    setupSidebarToggle();
    setupForms();
    initTheme();

    await fetchAllGoalsAndTasks(true);
    await recalculateAllGoalsProgress();
    await fetchAllGoalsAndTasks(true);

    renderGoals();
    populateGoalDropdown();
    updateDashboardStatsFromCache();
    renderTodayTasks();
    // ✅ show first quote
    showQuote(currentQuoteIndex);
});



/* =========================
   NAVIGATION (SPA STYLE)
   ========================= */
function setupNavigation() {
    const navItems = $$(".nav__item");
    const views = $$(".view");

    navItems.forEach(btn => {
        btn.addEventListener("click", () => {
            // Active nav
            navItems.forEach(b => b.classList.remove("is-active"));
            btn.classList.add("is-active");

            // Switch view
            const target = btn.dataset.view;
            views.forEach(v => v.classList.remove("is-active"));
            // $(target).classList.add("is-active");
            const viewEl = document.getElementById(target);
            if (viewEl) {
                viewEl.classList.add("is-active");
            }

            updatePageHeader(target);
            if (target === "view-tasks") {
                loadAllTasks();
            };
            if (target === "view-reminders") {
                loadUpcomingTasks();
            };
            if (target === "viewNotes") {
                loadNotes();
            }
        });
    });
}

function updatePageHeader(viewId) {
    const titleMap = {
        "view-dashboard": ["Dashboard", "Overview of your goals and progress"],
        "view-goals": ["Goals", "Create and manage your goals"],
        "view-tasks": ["Tasks", "Manage all tasks in one place"],
        "view-reminders": ["Reminders", "Set task reminders"],
        "viewNotes": ["Notes", "Track your reflections"],
        "view-settings": ["Settings", "Customize your preferences"]
    };

    const [title, subtitle] = titleMap[viewId] || ["Dashboard", ""];
    $("pageTitle").textContent = title;
    $("pageSubtitle").textContent = subtitle;
}

/* =========================
   SIDEBAR TOGGLE (MOBILE)
   ========================= */
function setupSidebarToggle() {
    const sidebar = document.querySelector(".sidebar");
    const toggleBtn = $("btnToggleSidebar");

    toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("is-open");
    });
}

/* =========================
   MODALS
   ========================= */
function setupModals() {
    // Open modals
    $("btnOpenGoalModal")?.addEventListener("click", () => openModal("goalModal"));
    $("btnOpenGoalModalFromDashboard")?.addEventListener("click", () => openModal("goalModal"));
    $("btnOpenTaskModalGlobal")?.addEventListener("click", () => openModal("taskModal"));

    // Close modals
    $$("[data-close-modal]").forEach(el => {
        el.addEventListener("click", () => {
            closeModal(el.dataset.closeModal);
        });
    });
}

function openModal(id) {
    $(id).hidden = false;
}

function closeModal(id) {
    $(id).hidden = true;
    resetForm(id);
}

function resetForm(modalId) {
    const modal = $(modalId);
    const form = modal.querySelector("form");
    if (form) form.reset();
}

/* =========================
   FORMS (SAFE HANDLING)
   ========================= */
function setupForms() {
    // Goal form
    $("goalForm")?.addEventListener("submit", (e) => {
        e.preventDefault();
        handleSaveGoal();
    });

    // Task form
    $("taskForm")?.addEventListener("submit", (e) => {
        e.preventDefault();
        handleSaveTask();
    });

    // Reminder form
    $("reminderForm")?.addEventListener("submit", (e) => {
        e.preventDefault();
        saveReminderPreferences();
    });

}

/* =========================
   GOALS 
   ========================= */
async function handleSaveGoal() {
    try {
        const goalId = document.getElementById("goalId")?.value || "";

        const goalData = {
            title: $("goalTitle").value.trim(),
            description: $("goalDescription").value.trim(),
            deadline: $("goalDeadline").value,
            priority: $("goalPriority").value,
            status: document.getElementById("goalStatus")?.value || "active",
        };

        if (goalId) {
            // ✅ UPDATE
            await updateDoc(doc(db, "goals", goalId), goalData);
        } else {
            // ✅ CREATE
            await addDoc(collection(db, "goals"), {
                ...goalData,
                createdAt: serverTimestamp()
            });
        }

        document.getElementById("goalId").value = "";
        closeModal("goalModal");

        await fetchAllGoalsAndTasks(true);
        renderGoals();
        populateGoalDropdown();
        updateDashboardStatsFromCache();
    } catch (error) {
        console.error("Error saving goal:", error);
        alert("Failed to save goal.");
    }
}


function renderGoals() {
    const goalsList = document.getElementById("goalsList");
    const dashboardGoalsList = document.getElementById("dashboardGoalsList");

    if (goalsList) goalsList.innerHTML = "";
    if (dashboardGoalsList) dashboardGoalsList.innerHTML = "";

    if (AppState.goals.length === 0) {
        document.getElementById("goalsEmpty")?.removeAttribute("hidden");
        document.getElementById("dashboardGoalsEmpty")?.removeAttribute("hidden");
        return;
    }

    document.getElementById("goalsEmpty")?.setAttribute("hidden", true);
    document.getElementById("dashboardGoalsEmpty")?.setAttribute("hidden", true);

    AppState.goals
        .filter(goal => goal.status !== "archived")
        .forEach(goal => {
            const progress = goal.progress || 0;

            const card = document.createElement("div");
            card.className = "goal-card";
            card.dataset.title = goal.title;
            card.dataset.priority = goal.priority;
            card.dataset.progress = progress;
            card.dataset.deadline = goal.deadline;

            card.innerHTML = `
                <div class="goal-card-header">
                <h3 class="goal-title">${goal.title}</h3>

                <div class="goal-actions">
                    <span class="goal-badge badge-${goal.priority}">${goal.priority}</span>
                    <span class="goal-status status-${goal.status}">${goal.status}</span>

                    <button class="iconbtn btn-edit-goal" data-id="${goal.id}" title="Edit">✏️</button>
                    <button class="iconbtn btn-delete-goal" data-id="${goal.id}" title="Delete">🗑</button>
                </div>
                </div>

                <p class="goal-desc">${goal.description || "No description"}</p>

                <div class="goal-progress">
                    <div class="goal-progress-label">
                    <span>Progress</span>
                    <span>${progress}%</span>
                    </div>
                    <div class="progress-bar">
                    <div class="progress-fill" style="width:${progress}%"></div>
                    </div>
                </div>
                `;

            goalsList?.appendChild(card);
            dashboardGoalsList?.appendChild(card.cloneNode(true));
        });


    // re-apply filters & sorting
    if (typeof applyGoalFilters === "function") {
        applyGoalFilters();
    }
    attachGoalActions();
}



function attachGoalActions() {
    document.querySelectorAll(".btn-edit-goal").forEach(btn => {
        btn.addEventListener("click", () => openEditGoal(btn.dataset.id));
    });

    document.querySelectorAll(".btn-delete-goal").forEach(btn => {
        btn.addEventListener("click", () => deleteGoal(btn.dataset.id));
    });
}

function openEditGoal(goalId) {
    const goal = AppState.goals.find(g => g.id === goalId);
    if (!goal) return;

    document.getElementById("goalId").value = goal.id;
    document.getElementById("goalTitle").value = goal.title || "";
    document.getElementById("goalDescription").value = goal.description || "";
    document.getElementById("goalDeadline").value = goal.deadline || "";
    document.getElementById("goalPriority").value = goal.priority || "medium";
    document.getElementById("goalStatus").value = goal.status || "active";

    openModal("goalModal");
}

async function deleteGoal(goalId) {
    if (!confirm("Delete this goal and its tasks?")) return;

    // delete tasks under this goal
    const tasks = AppState.tasksByGoal[goalId] || [];
    for (const t of tasks) {
        await deleteDoc(doc(db, "goals", goalId, "tasks", t.id));
    }

    // delete the goal doc
    await deleteDoc(doc(db, "goals", goalId));

    await fetchAllGoalsAndTasks(true);
    renderGoals();
    populateGoalDropdown();
    updateDashboardStatsFromCache();
}

function populateGoalDropdown() {
    const select = document.getElementById("taskGoalId");
    if (!select) return;

    // Reset options
    select.innerHTML = `<option value="">Choose a goal...</option>`;

    AppState.goals.forEach(goal => {
        const option = document.createElement("option");
        option.value = goal.id;
        option.textContent = goal.title;
        select.appendChild(option);
    });
}



async function loadGoalsFromFirestore() {
    try {
        const snapshot = await getDocs(collection(db, "goals"));
        AppState.goals = [];

        snapshot.forEach(docSnap => {
            AppState.goals.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        renderGoals();
        populateGoalDropdown();
        updateDashboardStats();

    } catch (error) {
        console.error("Error loading goals:", error);
    }
}

/* =========================
   TASKS 
   ========================= */
async function handleSaveTask() {
    try {
        const goalId = document.getElementById("taskGoalId").value;

        const taskData = {
            title: document.getElementById("taskTitle").value.trim(),
            description: document.getElementById("taskDescription").value.trim(),
            dueDate: document.getElementById("taskDueDate").value,
            status: document.getElementById("taskStatus").value,
            createdAt: new Date()
        };

        if (editingTask.taskId) {
            // UPDATE
            await updateDoc(
                doc(db, "goals", goalId, "tasks", editingTask.taskId),
                taskData
            );
        } else {
            // CREATE
            await addDoc(
                collection(db, "goals", goalId, "tasks"),
                taskData
            );
        }

        // Reset state
        editingTask.goalId = null;
        editingTask.taskId = null;
        document.getElementById("taskGoalId").disabled = false;


        await loadTasksForGoal(goalId);
        await fetchAllGoalsAndTasks(true);

        closeModal("taskModal");
        loadAllTasks();
        applyTaskFilters();
        loadUpcomingTasks();
        renderGoals();
        updateDashboardStatsFromCache();
        renderTodayTasks();

    } catch (error) {
        console.error("Error saving task:", error);
    }
}

async function loadTasksForGoal(goalId) {
    try {
        const tasksSnapshot = await getDocs(
            collection(db, "goals", goalId, "tasks")
        );

        let total = tasksSnapshot.size;
        let completed = 0;

        tasksSnapshot.forEach(docSnap => {
            if (docSnap.data().status === "completed") {
                completed++;
            }
        });

        const progress = total === 0
            ? 0
            : Math.round((completed / total) * 100);

        await updateDoc(doc(db, "goals", goalId), {
            progress
        });

    } catch (error) {
        console.error("Error updating goal progress:", error);
    }
}


function loadAllTasks() {
    const tableBody = $("tasksTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    AppState.goals.forEach(goal => {
        const tasks = AppState.tasksByGoal[goal.id] || [];

        tasks.forEach(task => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${task.status}</td>
                <td>${task.title}</td>
                <td>${goal.title}</td>
                <td>${task.dueDate || ""}</td>
                <td>
                    <button 
                      class="btn btn--ghost btn-edit-task"
                      data-goal-id="${goal.id}"
                      data-task-id="${task.id}"
                      data-title="${task.title}"
                      data-description="${task.description}"
                      data-due-date="${task.dueDate}"
                      data-status="${task.status}"
                    >
                      Edit
                    </button>

                    <button 
                      class="btn btn--danger btn-delete-task"
                      data-goal-id="${goal.id}"
                      data-task-id="${task.id}"
                    >
                      Delete
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });
    });

    attachTaskActionEvents();
}

async function deleteTask(goalId, taskId) {
    const confirmDelete = confirm("Are you sure you want to delete this task?");
    if (!confirmDelete) return;

    try {
        await deleteDoc(
            doc(db, "goals", goalId, "tasks", taskId)
        );

        await loadTasksForGoal(goalId);
        loadAllTasks();
        loadUpcomingTasks();
        await fetchAllGoalsAndTasks(true);
        renderGoals();
        populateGoalDropdown();
        updateDashboardStatsFromCache();
        renderTodayTasks();

    } catch (error) {
        console.error("Error deleting task:", error);
    }
}

async function recalculateAllGoalsProgress() {
    try {
        const goalsSnapshot = await getDocs(collection(db, "goals"));

        for (const goalDoc of goalsSnapshot.docs) {
            const goalId = goalDoc.id;

            const tasksSnapshot = await getDocs(
                collection(db, "goals", goalId, "tasks")
            );

            let total = tasksSnapshot.size;
            let completed = 0;

            tasksSnapshot.forEach(taskDoc => {
                if (taskDoc.data().status === "completed") {
                    completed++;
                }
            });

            const progress = total === 0
                ? 0
                : Math.round((completed / total) * 100);

            await updateDoc(doc(db, "goals", goalId), { progress });
        }
    } catch (error) {
        console.error("Error recalculating goal progress:", error);
    }
}


function openEditTask(goalId, taskId, title, description, dueDate, status) {
    editingTask.goalId = goalId;
    editingTask.taskId = taskId;

    document.getElementById("taskTitle").value = title;
    document.getElementById("taskDescription").value = description;
    document.getElementById("taskDueDate").value = dueDate;
    document.getElementById("taskStatus").value = status;

    document.getElementById("taskGoalId").value = goalId;
    document.getElementById("taskGoalId").disabled = true;

    openModal("taskModal");
}
/* =========================
   Upcomming Task
   ========================= */

async function loadUpcomingTasks(filter = "today") {
    const list = $("remindersUpcomingList");
    const empty = $("remindersUpcomingEmpty");

    list.innerHTML = "";
    empty.hidden = true;

    let hasItems = false;

    AppState.goals.forEach(goal => {
        const tasks = AppState.tasksByGoal[goal.id] || [];

        tasks.forEach(task => {
            if (task.status !== "pending" || !task.dueDate) return;

            const due = new Date(task.dueDate);

            if (filter === "today" && !isToday(due)) return;
            if (filter === "tomorrow" && !isTomorrow(due)) return;
            if (filter === "week" && !isThisWeek(due)) return;

            hasItems = true;

            const item = document.createElement("div");
            item.className = "upcoming-item";
            item.innerHTML = `
                <div class="upcoming-title">${task.title}</div>
                <div class="upcoming-meta">
                    ${goal.title} · ${due.toDateString()}
                </div>
            `;

            list.appendChild(item);
        });
    });

    if (!hasItems) empty.hidden = false;
}

document
    .getElementById("remindersUpcomingFilter")
    ?.addEventListener("change", (e) => {
        loadUpcomingTasks(e.target.value);
    });


/* =========================
   NOTES
   ========================= */
async function saveDailyNote() {
    const text = document.getElementById("noteText")?.value.trim();
    if (!text) return;

    try {
        if (editingNoteId) {
            // UPDATE
            await updateDoc(doc(db, "notes", editingNoteId), {
                text,
                updatedAt: serverTimestamp()
            });
        } else {
            // CREATE
            await addDoc(collection(db, "notes"), {
                text,
                createdAt: serverTimestamp()
            });
        }

        editingNoteId = null;
        document.getElementById("noteText").value = "";

        loadNotes(document.getElementById("notesFilter").value);
    } catch (error) {
        console.error("Error saving note:", error);
    }
}

async function loadNotes(filter = "today") {
    const notesList = document.getElementById("notesList");
    if (!notesList) return;

    notesList.innerHTML = "";

    const q = query(
        collection(db, "notes"),
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    const now = new Date();

    snapshot.forEach(docSnap => {
        const note = docSnap.data();
        if (!note.createdAt) return;

        const noteDate = note.createdAt.toDate();

        // FILTER CONDITIONS
        if (filter === "all") {
            // show everything
        } else if (filter === "today" && !isToday(noteDate)) return;
        else if (filter === "yesterday" && !isYesterday(noteDate)) return;
        else if (filter === "month" && noteDate.getMonth() !== now.getMonth()) return;
        else if (filter === "year" && noteDate.getFullYear() !== now.getFullYear()) return;


        // 👇 👇 👇 THIS IS THE CODE YOU ASKED ABOUT
        const noteEl = document.createElement("div");
        noteEl.className = "note-item";
        noteEl.dataset.id = docSnap.id;

        noteEl.innerHTML = `
        <div class="note-text">${note.text}</div>
        <div class="note-date">${noteDate.toDateString()}</div>

        <div class="note-actions">
            <button class="btn btn--ghost btn-edit-note">Edit</button>
            <button class="btn btn--danger btn-delete-note">Delete</button>
        </div>
        `;


        notesList.appendChild(noteEl);
    });
    attachNoteActions();
}

function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

function isYesterday(date) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
}

function isTomorrow(date) {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return date.toDateString() === t.toDateString();
}

function isThisWeek(date) {
    const now = new Date();
    const weekEnd = new Date();
    weekEnd.setDate(now.getDate() + 7);
    return date >= now && date <= weekEnd;
}

function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
}

function renderTodayTasks() {
    const list = document.getElementById("todayTasksList");
    const empty = document.getElementById("todayTasksEmpty");

    if (!list || !empty) return;

    list.innerHTML = "";
    empty.hidden = true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let items = [];

    AppState.goals.forEach(goal => {
        // ❌ skip non-active goals
        if (goal.status !== "active") return;

        const tasks = AppState.tasksByGoal[goal.id] || [];

        tasks.forEach(task => {
            if (task.status !== "pending" || !task.dueDate) return;

            const due = new Date(task.dueDate);
            if (!isSameDay(due, today)) return;

            items.push({
                task,
                goalTitle: goal.title
            });
        });
    });

    // Limit to 5 tasks
    items = items.slice(0, 5);

    if (items.length === 0) {
        empty.hidden = false;
        return;
    }

    items.forEach(item => {
        const el = document.createElement("div");
        el.className = "upcoming-item";
        el.innerHTML = `
            <div class="upcoming-title">${item.task.title}</div>
            <div class="upcoming-meta">
                ${item.goalTitle} · Due Today
            </div>
        `;
        list.appendChild(el);
    });
}


document.getElementById("btnSaveNote")?.addEventListener("click", () => {
    saveDailyNote();
});
document.getElementById("notesFilter")?.addEventListener("change", (e) => {
    loadNotes(e.target.value);
});
document.getElementById("btnSaveNote").textContent = "Update Note";
document.getElementById("btnSaveNote").textContent = "Save Note";

/* =========================
   REMINDERS
   ========================= */
async function saveReminderPreferences() {
    try {
        await addDoc(collection(db, "reminders"), {
            enabled: $("reminderEnabled").checked,
            frequency: $("reminderFrequency").value,
            time: $("reminderTime").value,
            channel: $("reminderChannel").value,
            updatedAt: serverTimestamp()
        });

        alert("Reminder settings saved.");
    } catch (error) {
        console.error("Error saving reminders:", error);
    }
}

/* =========================
   DASHBOARD STATS
   ========================= */
async function updateDashboardStats() {
    const goalsSnap = await getDocs(collection(db, "goals"));

    let totalGoals = goalsSnap.size;
    let totalTasks = 0;
    let completedTasks = 0;

    for (const goal of goalsSnap.docs) {
        const tasksSnap = await getDocs(
            collection(db, "goals", goal.id, "tasks")
        );

        totalTasks += tasksSnap.size;

        tasksSnap.forEach(t => {
            if (t.data().status === "completed") completedTasks++;
        });
    }

    $("statTotalGoals").textContent = totalGoals;
    $("statTotalTasks").textContent = totalTasks;
    $("statCompletedTasks").textContent = completedTasks;

    const progress = totalTasks
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

    $("statOverallProgress").textContent = `${progress}%`;
}

/* =========================
     DASHBOARD STATS
   ========================= */

function updateDashboardStatsFromCache() {
    let totalGoals = AppState.goals.filter(g => g.status === "active").length;

    let totalTasks = 0;
    let completedTasks = 0;
    let pendingTasks = 0;
    let todayTasks = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    AppState.goals.forEach(goal => {
        if (goal.status !== "active") return;

        const tasks = AppState.tasksByGoal[goal.id] || [];

        tasks.forEach(task => {
            totalTasks++;

            if (task.status === "completed") {
                completedTasks++;
            } else {
                pendingTasks++;
            }

            if (task.dueDate && task.status === "pending") {
                const [y, m, d] = task.dueDate.split("-").map(Number);
                const due = new Date(y, m - 1, d);

                if (
                    due.getFullYear() === today.getFullYear() &&
                    due.getMonth() === today.getMonth() &&
                    due.getDate() === today.getDate()
                ) {
                    todayTasks++;
                }
            }
        });
    });

    // EXISTING STATS
    document.getElementById("statTotalGoals").textContent = totalGoals;
    document.getElementById("statTotalTasks").textContent = totalTasks;
    document.getElementById("statCompletedTasks").textContent = completedTasks;

    const progress = totalTasks
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;
    document.getElementById("statOverallProgress").textContent = `${progress}%`;

    // ✅ NEW STATS
    document.getElementById("statTodayTasks").textContent = todayTasks;
    document.getElementById("statPendingTasks").textContent = pendingTasks;
}



/* =========================
   THEME SETTINGS
   ========================= */

function applyTheme(theme) {
    document.body.classList.remove("theme-light", "theme-dark");

    if (theme === "dark") {
        document.body.classList.add("theme-dark");
    } else if (theme === "light") {
        document.body.classList.add("theme-light");
    } else {
        // system
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.body.classList.add(prefersDark ? "theme-dark" : "theme-light");
    }

    localStorage.setItem("appTheme", theme);
}

function initTheme() {
    const savedTheme = localStorage.getItem("appTheme") || "system";
    const select = document.getElementById("themeMode");

    if (select) {
        select.value = savedTheme;
        select.addEventListener("change", () => {
            applyTheme(select.value);
        });
    }

    applyTheme(savedTheme);
}

/* =========================
   event action
   ========================= */

function attachTaskActionEvents() {
    document.querySelectorAll(".btn-delete-task").forEach(btn => {
        btn.addEventListener("click", () => {
            const goalId = btn.dataset.goalId;
            const taskId = btn.dataset.taskId;
            deleteTask(goalId, taskId);
        });
    });

    document.querySelectorAll(".btn-edit-task").forEach(btn => {
        btn.addEventListener("click", () => {
            openEditTask(
                btn.dataset.goalId,
                btn.dataset.taskId,
                btn.dataset.title,
                btn.dataset.description,
                btn.dataset.dueDate,
                btn.dataset.status
            );
        });
    });
}

/* =========================
   TASK FILTERS & SORT
   ========================= */

let activeTaskFilter = "all";

document.querySelectorAll("[data-task-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll("[data-task-filter]")
            .forEach(b => b.classList.remove("is-active"));

        btn.classList.add("is-active");
        activeTaskFilter = btn.dataset.taskFilter;
        applyTaskFilters();
    });
});

document.getElementById("tasksSort")?.addEventListener("change", applyTaskFilters);

function applyTaskFilters() {
    const rows = document.querySelectorAll("#tasksTableBody tr");
    const sortBy = document.getElementById("tasksSort").value;
    const today = new Date();

    let visibleRows = [];

    rows.forEach(row => {
        const status = row.children[0].textContent.toLowerCase();
        const dueDate = new Date(row.children[3].textContent);

        let show = true;

        if (activeTaskFilter === "pending" && status !== "pending") show = false;
        if (activeTaskFilter === "completed" && status !== "completed") show = false;
        if (activeTaskFilter === "overdue" && dueDate >= today) show = false;

        row.style.display = show ? "" : "none";
        if (show) visibleRows.push(row);
    });

    visibleRows.sort((a, b) => {
        if (sortBy === "due_date") return new Date(a.children[3].textContent) - new Date(b.children[3].textContent);
        if (sortBy === "status") return a.children[0].textContent.localeCompare(b.children[0].textContent);
        if (sortBy === "title") return a.children[1].textContent.localeCompare(b.children[1].textContent);
    });

    visibleRows.forEach(r => r.parentElement.appendChild(r));
}


/* =========================
   GOAL FILTERS & SORT
   ========================= */

let activeGoalFilter = "all";

document.querySelectorAll("[data-goal-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll("[data-goal-filter]")
            .forEach(b => b.classList.remove("is-active"));

        btn.classList.add("is-active");
        activeGoalFilter = btn.dataset.goalFilter;
        applyGoalFilters();
    });
});

document.getElementById("goalsSort")?.addEventListener("change", applyGoalFilters);

function applyGoalFilters() {
    const cards = document.querySelectorAll(".goal-card");
    const sortBy = document.getElementById("goalsSort").value;

    let visibleCards = [];

    cards.forEach(card => {
        const priority = card.dataset.priority;
        const show = activeGoalFilter === "all" || priority === activeGoalFilter;
        card.style.display = show ? "" : "none";
        if (show) visibleCards.push(card);
    });

    visibleCards.sort((a, b) => {
        if (sortBy === "title") return a.dataset.title.localeCompare(b.dataset.title);
        if (sortBy === "priority") return a.dataset.priority.localeCompare(b.dataset.priority);
        if (sortBy === "progress") return Number(b.dataset.progress) - Number(a.dataset.progress);
        if (sortBy === "deadline") return new Date(a.dataset.deadline) - new Date(b.dataset.deadline);
    });

    visibleCards.forEach(c => c.parentElement.appendChild(c));
}

/* =========================
   MOTIVATIONAL QUOTES
   ========================= */

const quotes = [
    {
        text: "Small steps every day lead to big results.",
        author: "Goal Tracker"
    },
    {
        text: "Discipline beats motivation when motivation fades.",
        author: "Unknown"
    },
    {
        text: "Start where you are. Use what you have. Do what you can.",
        author: "Arthur Ashe"
    },
    {
        text: "Success is the sum of small efforts repeated daily.",
        author: "Robert Collier"
    },
    {
        text: "Focus on progress, not perfection.",
        author: "Unknown"
    }
];

let currentQuoteIndex = 0;

function showQuote(index) {
    const quoteText = document.getElementById("quoteText");
    const quoteAuthor = document.getElementById("quoteAuthor");

    if (!quoteText || !quoteAuthor) return;

    quoteText.textContent = quotes[index].text;
    quoteAuthor.textContent = `— ${quotes[index].author}`;
}

function showNextQuote() {
    currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
    showQuote(currentQuoteIndex);
}

setInterval(() => {
    showNextQuote();
}, 30000); // 30 seconds

document.getElementById("btnNewQuote")?.addEventListener("click", () => {
    showNextQuote();
});

// =========================
// LOGOUT
// =========================
document.getElementById("btnLogout")?.addEventListener("click", async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout failed:", error);
    }
});

// =========================
// Global search bar
// =========================
function applyGlobalSearch(query) {
    // 1️⃣ Search Goals cards
    document.querySelectorAll(".goal-card").forEach(card => {
        const title = card.dataset.title?.toLowerCase() || "";
        const show = !query || title.includes(query);
        card.style.display = show ? "" : "none";
    });

    // 2️⃣ Search Tasks table
    document.querySelectorAll("#tasksTableBody tr").forEach(row => {
        const taskTitle = row.children[1]?.textContent.toLowerCase() || "";
        const goalTitle = row.children[2]?.textContent.toLowerCase() || "";

        const show =
            !query ||
            taskTitle.includes(query) ||
            goalTitle.includes(query);

        row.style.display = show ? "" : "none";
    });
}


async function completeGoal(goalId) {
    await updateDoc(doc(db, "goals", goalId), {
        status: "completed"
    });

    await fetchAllGoalsAndTasks(true);
    renderGoals();
    updateDashboardStatsFromCache();
}


document.getElementById("globalSearch")?.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    applyGlobalSearch(query);
});

document.getElementById("btnQuickAdd")?.addEventListener("click", () => {
    openModal("goalModal");
});