// ========== ХРАНИЛИЩЕ ==========
let users = JSON.parse(localStorage.getItem('mind_users')) || [];
let currentUser = JSON.parse(localStorage.getItem('mind_currentUser')) || null;

function saveUsers() { localStorage.setItem('mind_users', JSON.stringify(users)); }
function saveCurrentUser() { localStorage.setItem('mind_currentUser', JSON.stringify(currentUser)); }

// ========== ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ ==========
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
}

// ========== ПЕРЕКЛЮЧЕНИЕ ВХОд / РЕГИСТРАЦИЯ ==========
function setupAuthTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = {
        login: document.getElementById('loginForm'),
        register: document.getElementById('registerForm')
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const name = tab.getAttribute('data-tab');
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            Object.values(forms).forEach(f => f && f.classList.remove('active'));
            if (forms[name]) forms[name].classList.add('active');
        });
    });
}

// ========== РЕГИСТРАЦИЯ ==========
function register(username, email, password) {
    if (users.find(u => u.username === username)) {
        const el = document.getElementById('regError');
        if (el) el.textContent = 'Пользователь уже существует';
        return false;
    }
    const newUser = {
        id: Date.now(),
        username,
        email,
        password,
        name: '',
        isProfileSetup: false,          // FIX #2: флаг первого входа
        notificationTimeMorning: '09:00',
        notificationTimeEvening: '20:00',
        tasks: [],
        claimedRewards: []
    };
    users.push(newUser);
    saveUsers();
    return true;
}

// ========== ВХОД ==========
function login(username, password) {
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        const el = document.getElementById('loginError');
        if (el) el.textContent = 'Неверный логин или пароль';
        return false;
    }
    currentUser = user;
    saveCurrentUser();
    return true;
}

// ========== FIX #2: маршрут после входа — смотрим isProfileSetup ==========
function routeAfterAuth() {
    if (!currentUser) { showScreen('authScreen'); return; }
    if (!currentUser.name) {
        showScreen('nameSetupScreen');
    } else if (!currentUser.isProfileSetup) {
        showScreen('notificationsSetupScreen');
    } else {
        // Пользователь уже настроен — сразу в приложение
        startMainApp();
    }
}

// ========== НАСТРОЙКА ПРОФИЛЯ ==========
function saveUserName(name) {
    if (!currentUser) return;
    currentUser.name = name;
    // Синхронизируем с массивом users
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx !== -1) users[idx] = currentUser;
    saveUsers();
    saveCurrentUser();
}

function saveNotificationTimes(morning, evening) {
    if (!currentUser) return;
    currentUser.notificationTimeMorning = morning;
    currentUser.notificationTimeEvening = evening;
    currentUser.isProfileSetup = true;          // FIX #2: помечаем как настроенного
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx !== -1) users[idx] = currentUser;
    saveUsers();
    saveCurrentUser();
    scheduleNotifications();
    startMainApp();
}

// ========== УВЕДОМЛЕНИЯ ==========
function requestNotifications() {
    Notification.requestPermission().then(perm => {
        if (perm === 'granted') scheduleNotifications();
        const panel = document.getElementById('notificationPermission');
        if (panel) panel.classList.add('hidden');
    });
}

function sendNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, { body });
    }
}

function scheduleNotifications() {
    if (!currentUser || Notification.permission !== 'granted') return;

    function scheduleAt(timeStr, title, body) {
        const now = new Date();
        const [h, m] = timeStr.split(':').map(Number);
        let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
        if (target <= now) target.setDate(target.getDate() + 1);
        setTimeout(() => sendNotification(title, body), target - now);
    }

    scheduleAt(currentUser.notificationTimeMorning, 'Доброе утро!',
        `${currentUser.name}, выбери три фокус-задачи на день.`);
    scheduleAt(currentUser.notificationTimeEvening, 'Время отдохнуть!',
        `${currentUser.name}, ты отлично поработала. Награди себя и отдохни.`);
}

// ========== ЗАДАЧИ ==========
const MAX_TASKS_PER_DAY = 3;
const REWARD_PLACEHOLDERS = [
    "Выпить горячий чай", "Почитать любимую книгу 15 минут",
    "Послушать любимый плейлист", "Прогуляться на свежем воздухе",
    "Съесть что-нибудь вкусное", "Написать три приятных события дня",
    "Сделать лёгкую растяжку", "Сделать самомассаж", "Посмотреть любимый сериал"
];

function addTask(title) {
    if (!title || !title.trim()) return;
    if (currentUser.tasks.length >= MAX_TASKS_PER_DAY) {
        alert(`Максимум ${MAX_TASKS_PER_DAY} задачи в день. Сфокусируйся на главном!`);
        return;
    }
    currentUser.tasks.push({ id: Date.now(), title: title.trim(), completed: false, reward: '' });
    syncAndSave();
    renderPlanner();
}

function toggleTask(taskId) {
    const task = currentUser.tasks.find(t => t.id === taskId);
    if (task) { task.completed = !task.completed; syncAndSave(); renderPlanner(); }
}

function updateTaskReward(taskId, text) {
    const task = currentUser.tasks.find(t => t.id === taskId);
    if (task) { task.reward = text; syncAndSave(); }
}

function deleteTask(taskId) {
    if (confirm('Удалить эту задачу?')) {
        currentUser.tasks = currentUser.tasks.filter(t => t.id !== taskId);
        currentUser.claimedRewards = (currentUser.claimedRewards || []).filter(id => id !== taskId);
        syncAndSave();
        renderCurrentPage();
    }
}

function toggleRewardClaim(taskId) {
    const task = currentUser.tasks.find(t => t.id === taskId);
    if (!task || !task.reward?.trim()) {
        alert('Сначала пропишите награду за эту задачу в Планере');
        return;
    }
    if (!currentUser.claimedRewards) currentUser.claimedRewards = [];
    if (currentUser.claimedRewards.includes(taskId)) {
        currentUser.claimedRewards = currentUser.claimedRewards.filter(id => id !== taskId);
    } else {
        currentUser.claimedRewards.push(taskId);
        alert(`Поздравляю! Ты забрала награду: ${task.reward}`);
    }
    syncAndSave();
    renderRewards();
}

// Синхронизация currentUser → users при каждом изменении данных
function syncAndSave() {
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx !== -1) users[idx] = currentUser;
    saveUsers();
    saveCurrentUser();
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

// ========== РЕНДЕР СТРАНИЦ ==========

function renderPlanner() {
    const container = document.getElementById('mainContent');
    if (!container) return;
    const completed = currentUser.tasks.filter(t => t.completed).length;
    const total = currentUser.tasks.length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    const remaining = MAX_TASKS_PER_DAY - total;
    const name = currentUser.name || currentUser.username;

    let tasksHtml = '';
    if (total === 0) {
        tasksHtml = `
            <div class="empty-state">
                <span class="empty-state-icon">📝</span>
                <p>Нет задач на сегодня</p>
                <p class="empty-sub">Добавьте первую задачу ниже — максимум ${MAX_TASKS_PER_DAY}</p>
            </div>`;
    } else {
        tasksHtml = `<div class="tasks-list">` +
            currentUser.tasks.map(task => `
                <div class="task-card ${task.completed ? 'completed' : ''}">
                    <div class="task-header">
                        <input type="checkbox" class="task-check" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
                        <span class="task-title">${escapeHtml(task.title)}</span>
                        <button class="delete-task-btn" data-id="${task.id}" title="Удалить">✕</button>
                    </div>
                    <div class="reward-input-wrapper">
                        <input type="text" class="task-reward-input" placeholder="Моя награда за эту задачу…"
                            value="${escapeHtml(task.reward)}" data-id="${task.id}"
                            style="${task.reward?.trim() ? 'border-color:var(--gold);background:var(--warm-white);' : ''}">
                    </div>
                </div>`).join('') +
            `</div>`;
    }

    container.innerHTML = `
        <div class="content-inner">
            <div class="page-header">
                <div class="page-eyebrow">Сегодня</div>
                <h2>Планер дня</h2>
                <p class="greeting">Привет, <strong>${escapeHtml(name)}</strong> — сфокусируйся на самом важном</p>
            </div>
            <div class="progress-block">
                <div class="progress-label">
                    <span>Прогресс дня</span>
                    <span>${percent}%</span>
                </div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${percent}%"></div></div>
            </div>
            ${tasksHtml}
            <div class="add-task-form">
                <input type="text" id="newTaskTitle" placeholder="Новая задача…" ${remaining <= 0 ? 'disabled' : ''}>
                <button id="addTaskBtn" type="button" ${remaining <= 0 ? 'disabled' : ''}>+ Добавить</button>
            </div>
            <p class="tasks-limit-note">
                ${remaining <= 0
                    ? 'Лимит на сегодня достигнут — сфокусируйся на трёх задачах'
                    : `Осталось слотов: ${remaining} из ${MAX_TASKS_PER_DAY}`}
            </p>
        </div>`;

    // Навешиваем обработчики
    container.querySelectorAll('.task-check').forEach(cb =>
        cb.addEventListener('change', e => toggleTask(parseInt(e.target.dataset.id))));
    container.querySelectorAll('.task-reward-input').forEach(inp => {
        inp.addEventListener('change', e => updateTaskReward(parseInt(e.target.dataset.id), e.target.value));
        inp.addEventListener('input', e => {
            e.target.style.borderColor = e.target.value.trim() ? 'var(--gold)' : '';
            e.target.style.background = e.target.value.trim() ? 'var(--warm-white)' : '';
        });
    });
    container.querySelectorAll('.delete-task-btn').forEach(btn =>
        btn.addEventListener('click', e => deleteTask(parseInt(e.target.dataset.id))));
    const addBtn = document.getElementById('addTaskBtn');
    const taskInput = document.getElementById('newTaskTitle');
    if (addBtn && taskInput) {
        addBtn.addEventListener('click', () => { addTask(taskInput.value); taskInput.value = ''; });
        taskInput.addEventListener('keydown', e => { if (e.key === 'Enter') { addTask(taskInput.value); taskInput.value = ''; } });
    }
}

function renderProgress() {
    const container = document.getElementById('mainContent');
    if (!container) return;
    const total = currentUser.tasks.length;
    const completed = currentUser.tasks.filter(t => t.completed).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    const rewardsFilled = currentUser.tasks.filter(t => t.reward?.trim()).length;
    const claimedCount = (currentUser.claimedRewards || []).length;

    container.innerHTML = `
        <div class="content-inner">
            <div class="page-header">
                <div class="page-eyebrow">Аналитика</div>
                <h2>Прогресс</h2>
            </div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${total}<span style="font-size:18px;color:var(--sand)">/${MAX_TASKS_PER_DAY}</span></div>
                    <div class="stat-label">Задач сегодня</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${completed}</div>
                    <div class="stat-label">Выполнено</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${percent}%</div>
                    <div class="stat-label">Эффективность</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${rewardsFilled}</div>
                    <div class="stat-label">Наград назначено</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${claimedCount}</div>
                    <div class="stat-label">Наград получено</div>
                </div>
            </div>
            <div class="progress-block">
                <div class="progress-label"><span>Общий прогресс дня</span><span>${percent}%</span></div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${percent}%"></div></div>
            </div>
        </div>`;
}

function renderRewards() {
    const container = document.getElementById('mainContent');
    if (!container) return;
    const tasksWithRewards = currentUser.tasks.filter(t => t.reward?.trim());

    if (!tasksWithRewards.length) {
        container.innerHTML = `
            <div class="content-inner">
                <div class="page-header">
                    <div class="page-eyebrow">Мотивация</div>
                    <h2>Награды</h2>
                </div>
                <div class="empty-state">
                    <span class="empty-state-icon">🎁</span>
                    <p>Наград пока нет</p>
                    <p class="empty-sub">Добавьте награду к задаче в Планере</p>
                </div>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="content-inner">
            <div class="page-header">
                <div class="page-eyebrow">Мотивация</div>
                <h2>Награды</h2>
            </div>
            <div class="rewards-list">
                ${tasksWithRewards.map(task => {
                    const claimed = (currentUser.claimedRewards || []).includes(task.id);
                    return `
                        <div class="reward-item ${claimed ? 'claimed' : ''}">
                            <div class="reward-item-header">
                                <div class="reward-item-title">${escapeHtml(task.title)}</div>
                                <span class="reward-status-tag ${task.completed ? 'done' : 'pending'}">
                                    ${task.completed ? 'Выполнено' : 'В процессе'}
                                </span>
                            </div>
                            <div class="reward-content">Награда: ${escapeHtml(task.reward)}</div>
                            <label class="reward-check-label">
                                <input type="checkbox" class="reward-claim-check" data-id="${task.id}"
                                    ${claimed ? 'checked' : ''} ${!task.completed ? 'disabled' : ''}>
                                <span>${claimed ? 'Награда получена!' : 'Забрать награду'}</span>
                            </label>
                            ${!task.completed ? '<p class="reward-warning">Сначала выполните задачу</p>' : ''}
                        </div>`;
                }).join('')}
            </div>
        </div>`;

    container.querySelectorAll('.reward-claim-check').forEach(cb => {
        cb.addEventListener('change', e => {
            if (!cb.disabled) toggleRewardClaim(parseInt(e.target.dataset.id));
        });
    });
}

const restTips = [
    "Подыши свежим воздухом 5 минут", "Выпей чай без телефона",
    "Сделай лёгкую растяжку", "Послушай любимую музыку",
    "Ничего не делай — это тоже отдых", "Почитай книгу 15 минут",
    "Прогуляйся вокруг дома", "Сделай самомассаж лица",
    "Посмотри на звёзды или облака", "Зажги ароматическую свечу",
    "Нарисуй что-нибудь просто так", "Напиши три приятных события дня"
];

function renderRest() {
    const container = document.getElementById('mainContent');
    if (!container) return;
    const now = new Date();
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    const tip = restTips[dayOfYear % restTips.length];

    container.innerHTML = `
        <div class="content-inner">
            <div class="page-header">
                <div class="page-eyebrow">Практика</div>
                <h2>Отдых</h2>
            </div>
            <div class="rest-card">
                <div class="rest-card-eyebrow">Совет дня</div>
                <div class="rest-tip">${tip}</div>
                <p class="rest-sub">Ты сделала достаточно за сегодня.<br>Отдыхай без чувства вины.</p>
                <div class="rest-meta">Новый совет каждый день</div>
            </div>
        </div>`;
}

function renderCurrentPage() {
    const active = document.querySelector('.nav-link.active');
    const page = active?.dataset.page || 'planner';
    if (page === 'planner') renderPlanner();
    else if (page === 'progress') renderProgress();
    else if (page === 'rewards') renderRewards();
    else if (page === 'rest') renderRest();
}

// ========== НАВИГАЦИЯ ==========
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            renderCurrentPage();
            // На мобильном закрываем меню после выбора
            closeMobileNav();
        });
    });
}

function setupMobileNav() {
    const toggle = document.getElementById('mobileNavToggle');
    const nav = document.getElementById('sidebarNav');
    const bottom = document.getElementById('sidebarBottom');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
        const isOpen = nav.classList.contains('open');
        if (isOpen) {
            closeMobileNav();
        } else {
            nav.classList.add('open');
            if (bottom) bottom.classList.add('open');
        }
    });
}

function closeMobileNav() {
    const nav = document.getElementById('sidebarNav');
    const bottom = document.getElementById('sidebarBottom');
    if (nav) nav.classList.remove('open');
    if (bottom) bottom.classList.remove('open');
}

// ========== ЗАПУСК ПРИЛОЖЕНИЯ ==========
function startMainApp() {
    showScreen('mainApp');
    setupNavigation();
    setupMobileNav();
    renderCurrentPage();

    const nameEl = document.getElementById('userNameDisplay');
    if (nameEl) nameEl.textContent = currentUser.name || currentUser.username;

    const hour = new Date().getHours();
    const reminderEl = document.getElementById('dailyReminder');
    if (reminderEl) {
        if (hour < 12) reminderEl.innerHTML = '☀️ Доброе утро! Выбери три задачи на день';
        else if (hour < 18) reminderEl.innerHTML = '🌤 Хорошего дня — держи фокус';
        else reminderEl.innerHTML = '🌙 Отличная работа. Пора отдохнуть';
    }

    if (Notification.permission === 'default') {
        const panel = document.getElementById('notificationPermission');
        if (panel) panel.classList.remove('hidden');
    } else if (Notification.permission === 'granted') {
        scheduleNotifications();
    }
}

// ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========
// FIX #1: используем touchend + click без дублирования через passive listener pattern
function bindButton(id, handler) {
    const btn = document.getElementById(id);
    if (!btn) return;
    let tapped = false;

    btn.addEventListener('touchend', e => {
        e.preventDefault();
        if (tapped) return;
        tapped = true;
        handler(e);
        setTimeout(() => { tapped = false; }, 400);
    }, { passive: false });

    btn.addEventListener('click', e => {
        e.preventDefault();
        if (tapped) return;   // уже отработал touchend
        handler(e);
    });
}

function initEventHandlers() {
    // --- Вход ---
    bindButton('doLoginBtn', () => {
        const username = document.getElementById('loginUsername')?.value || '';
        const password = document.getElementById('loginPassword')?.value || '';
        if (login(username, password)) routeAfterAuth();
    });

    // --- Регистрация ---
    bindButton('doRegisterBtn', () => {
        const username = document.getElementById('regUsername')?.value || '';
        const email    = document.getElementById('regEmail')?.value || '';
        const password = document.getElementById('regPassword')?.value || '';
        if (register(username, email, password)) {
            document.getElementById('regError').textContent = '';
            document.querySelector('.auth-tab[data-tab="login"]')?.click();
            ['regUsername','regEmail','regPassword'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }
    });

    // --- FIX #1 + #2: кнопка "Продолжить" (имя) ---
    bindButton('saveNameBtn', () => {
        const val = document.getElementById('userNameInput')?.value?.trim();
        if (val) {
            saveUserName(val);
            showScreen('notificationsSetupScreen');
        } else {
            alert('Пожалуйста, введите ваше имя');
        }
    });

    // --- FIX #1: кнопка "Сохранить" (уведомления) — главная проблема мобильного ---
    bindButton('saveNotificationsBtn', () => {
        const morning = document.getElementById('morningTime')?.value || '09:00';
        const evening = document.getElementById('eveningTime')?.value || '20:00';
        saveNotificationTimes(morning, evening);
    });

    // --- Выход ---
    bindButton('logoutBtn', () => {
        currentUser = null;
        localStorage.removeItem('mind_currentUser');
        showScreen('authScreen');
    });

    // --- Уведомления ---
    bindButton('allowNotificationsBtn', () => requestNotifications());
    bindButton('denyNotificationsBtn', () => {
        document.getElementById('notificationPermission')?.classList.add('hidden');
    });
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function init() {
    setupAuthTabs();
    initEventHandlers();

    // FIX #2: если пользователь уже авторизован и полностью настроен — сразу в приложение
    if (currentUser) {
        routeAfterAuth();
    } else {
        showScreen('authScreen');
    }
}

init();
