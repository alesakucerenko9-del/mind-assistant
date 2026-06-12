// ========== ХРАНИЛИЩЕ ==========
let users = JSON.parse(localStorage.getItem('mind_users')) || [];
let currentUser = JSON.parse(localStorage.getItem('mind_currentUser')) || null;

function saveUsers() { localStorage.setItem('mind_users', JSON.stringify(users)); }
function saveCurrentUser() {
    localStorage.setItem('mind_currentUser', JSON.stringify(currentUser));
    // Синхронизируем обновлённого пользователя обратно в массив users
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx !== -1) { users[idx] = currentUser; saveUsers(); }
}

// ========== ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ ==========
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
}

// ========== ПЕРЕКЛЮЧЕНИЕ ВХОД / РЕГИСТРАЦИЯ ==========
function setupAuthTabs() {
    document.querySelectorAll('.nav-text-link').forEach(link => {
        link.addEventListener('click', () => {
            const tab = link.dataset.tab;
            document.querySelectorAll('.nav-text-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            const form = document.getElementById(tab + 'Form');
            if (form) form.classList.add('active');
        });
    });
}

// ========== РЕГИСТРАЦИЯ И ВХОД ==========
function register(username, email, password) {
    if (users.find(u => u.username === username)) {
        const el = document.getElementById('regError');
        if (el) el.textContent = 'Пользователь уже существует';
        return false;
    }
    users.push({
        id: Date.now(),
        username, email, password,
        name: '',
        isProfileSetup: false,
        notificationTimeMorning: '09:00',
        notificationTimeEvening: '20:00',
        tasks: [],
        claimedRewards: []
    });
    saveUsers();
    return true;
}

function login(username, password) {
    // Берём актуальные данные из массива users (не из кеша currentUser)
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

// ========== НАСТРОЙКА ПРОФИЛЯ ==========
function saveUserName(name) {
    if (!currentUser) return;
    currentUser.name = name;
    saveCurrentUser();
}

function saveNotificationTimes(morning, evening) {
    if (!currentUser) return;
    currentUser.notificationTimeMorning = morning;
    currentUser.notificationTimeEvening = evening;
    currentUser.isProfileSetup = true;
    saveCurrentUser();
    scheduleNotifications();
    startMainApp();
}

// ========== ОПРЕДЕЛЕНИЕ НУЖНОГО ЭКРАНА ПОСЛЕ ВХОДА ==========
function routeAfterLogin() {
    if (!currentUser.name || currentUser.name.trim() === '') {
        showScreen('nameSetupScreen');
    } else if (!currentUser.isProfileSetup) {
        showScreen('notificationsSetupScreen');
    } else {
        startMainApp();
    }
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
    function scheduleAt(targetTime, title, body) {
        const now = new Date();
        const [h, m] = targetTime.split(':').map(Number);
        let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
        let delay = target - now;
        if (delay < 0) {
            target.setDate(target.getDate() + 1);
            delay = target - now;
        }
        setTimeout(() => sendNotification(title, body), delay);
    }
    scheduleAt(currentUser.notificationTimeMorning, 'Доброе утро!', `${currentUser.name}, выбери три фокус-задачи на день.`);
    scheduleAt(currentUser.notificationTimeEvening, 'Время отдохнуть!', `${currentUser.name}, ты отлично поработала. Награди себя!`);
}

// ========== ЗАДАЧИ ==========
const MAX_TASKS = 3;
const REWARD_PLACEHOLDERS = [
    "Выпить горячий чай",
    "Почитать книгу 15 минут",
    "Послушать любимый плейлист",
    "Прогуляться на свежем воздухе",
    "Съесть что-то вкусное",
    "Написать три приятных события дня",
    "Сделать лёгкую растяжку",
    "Сделать самомассаж",
    "Посмотреть любимый сериал"
];

function addTask(title) {
    if (!title || !title.trim()) return;
    if (currentUser.tasks.length >= MAX_TASKS) {
        alert(`Максимум ${MAX_TASKS} задачи в день.\nСфокусируйся на главном!`);
        return;
    }
    const placeholder = REWARD_PLACEHOLDERS[Math.floor(Math.random() * REWARD_PLACEHOLDERS.length)];
    currentUser.tasks.push({ id: Date.now(), title: title.trim(), completed: false, reward: '' });
    saveCurrentUser();
    renderPlanner();
}

function toggleTask(taskId) {
    const task = currentUser.tasks.find(t => t.id === taskId);
    if (task) { task.completed = !task.completed; saveCurrentUser(); renderPlanner(); }
}

function updateTaskReward(taskId, val) {
    const task = currentUser.tasks.find(t => t.id === taskId);
    if (task) { task.reward = val; saveCurrentUser(); }
}

function deleteTask(taskId) {
    if (!confirm('Удалить задачу?')) return;
    currentUser.tasks = currentUser.tasks.filter(t => t.id !== taskId);
    if (currentUser.claimedRewards) {
        currentUser.claimedRewards = currentUser.claimedRewards.filter(id => id !== taskId);
    }
    saveCurrentUser();
    renderCurrentPage();
}

function toggleRewardClaim(taskId) {
    const task = currentUser.tasks.find(t => t.id === taskId);
    if (!task || !task.reward || !task.reward.trim()) {
        alert('Сначала пропишите награду в разделе "Планер"');
        return;
    }
    if (!currentUser.claimedRewards) currentUser.claimedRewards = [];
    if (currentUser.claimedRewards.includes(taskId)) {
        currentUser.claimedRewards = currentUser.claimedRewards.filter(id => id !== taskId);
    } else {
        currentUser.claimedRewards.push(taskId);
        alert(`Отлично! Ты заслужила: ${task.reward}`);
    }
    saveCurrentUser();
    renderRewards();
}

// ========== РЕНДЕРИНГ СТРАНИЦ ==========
function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function renderPlanner() {
    const container = document.getElementById('mainContent');
    if (!container) return;
    const completed = currentUser.tasks.filter(t => t.completed).length;
    const total = currentUser.tasks.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const hour = new Date().getHours();
    const greeting = hour < 12
        ? `Доброе утро, ${currentUser.name}. Выбери задачи на день.`
        : hour < 18
            ? `Хорошего дня, ${currentUser.name}. Держи фокус.`
            : `Вечер, ${currentUser.name}. Ты сделала достаточно.`;

    const tasksHtml = currentUser.tasks.length === 0
        ? `<p style="color:var(--gray);font-style:italic;padding:24px 0;">Добавь до трёх задач на сегодня</p>`
        : currentUser.tasks.map(task => {
            const placeholder = REWARD_PLACEHOLDERS[task.id % REWARD_PLACEHOLDERS.length] || 'Твоя награда';
            return `
            <div class="task-card ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <div class="task-header">
                    <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''}
                        onchange="toggleTask(${task.id})">
                    <span class="task-title">${escapeHtml(task.title)}</span>
                    <button class="task-delete-btn" onclick="deleteTask(${task.id})" aria-label="Удалить">×</button>
                </div>
                <input type="text" class="task-reward-input"
                    placeholder="Награда: например, ${escapeHtml(placeholder)}"
                    value="${escapeHtml(task.reward)}"
                    onchange="updateTaskReward(${task.id}, this.value)"
                    oninput="updateTaskReward(${task.id}, this.value)">
            </div>`;
        }).join('');

    container.innerHTML = `
        <div class="page-eyebrow">Сегодня</div>
        <h2 class="page-title">ПЛАНЕР</h2>
        <hr class="page-divider">
        <div class="greeting-bar">${greeting}</div>
        <div class="progress-wrap">
            <div class="progress-meta">
                <span>Выполнено</span>
                <span>${completed} / ${total}</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill" style="width:${pct}%"></div>
            </div>
        </div>
        <div class="tasks-list">${tasksHtml}</div>
        ${total < MAX_TASKS ? `
        <div class="add-task-form">
            <input type="text" id="newTaskInput" placeholder="Новая задача..." maxlength="120">
            <button type="button" onclick="addTaskFromInput()">Добавить</button>
        </div>` : `<p style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-dim);">Три задачи на сегодня — достаточно.</p>`}
    `;
}

function addTaskFromInput() {
    const inp = document.getElementById('newTaskInput');
    if (inp && inp.value.trim()) { addTask(inp.value); inp.value = ''; }
}

function renderProgress() {
    const container = document.getElementById('mainContent');
    if (!container) return;
    const total = currentUser.tasks.length;
    const completed = currentUser.tasks.filter(t => t.completed).length;
    const withRewards = currentUser.tasks.filter(t => t.reward && t.reward.trim()).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    container.innerHTML = `
        <div class="page-eyebrow">Статистика</div>
        <h2 class="page-title">ПРОГРЕСС</h2>
        <hr class="page-divider">
        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-number">${total}</span>
                <div class="stat-label">Задач добавлено</div>
            </div>
            <div class="stat-card">
                <span class="stat-number">${completed}</span>
                <div class="stat-label">Выполнено</div>
            </div>
            <div class="stat-card">
                <span class="stat-number">${pct}%</span>
                <div class="stat-label">Прогресс</div>
            </div>
            <div class="stat-card">
                <span class="stat-number">${withRewards}</span>
                <div class="stat-label">С наградой</div>
            </div>
        </div>
        <div class="progress-wrap">
            <div class="progress-meta">
                <span>Общий прогресс дня</span>
                <span>${pct}%</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill" style="width:${pct}%"></div>
            </div>
        </div>
    `;
}

function renderRewards() {
    const container = document.getElementById('mainContent');
    if (!container) return;
    if (!currentUser.claimedRewards) currentUser.claimedRewards = [];
    const tasksWithReward = currentUser.tasks.filter(t => t.reward && t.reward.trim());

    const listHtml = tasksWithReward.length === 0
        ? `<p style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-dim);padding:24px 0;">Пропиши награды за задачи в Планере</p>`
        : tasksWithReward.map(task => {
            const claimed = currentUser.claimedRewards.includes(task.id);
            return `
            <div class="reward-item">
                <span class="reward-status ${claimed ? 'claimed' : ''}">${claimed ? 'Получено' : 'Ожидает'}</span>
                <span class="reward-text">${escapeHtml(task.reward)}</span>
                <button type="button" class="reward-claim-btn ${claimed ? 'claimed' : ''}"
                    onclick="toggleRewardClaim(${task.id})">
                    ${claimed ? 'Отменить' : 'Забрать'}
                </button>
            </div>`;
        }).join('');

    container.innerHTML = `
        <div class="page-eyebrow">Заслуженный отдых</div>
        <h2 class="page-title">НАГРАДЫ</h2>
        <hr class="page-divider">
        <div class="rewards-list">${listHtml}</div>
    `;
}

const restTips = [
    "Подыши свежим воздухом 5 минут",
    "Выпей чай без телефона",
    "Сделай лёгкую растяжку",
    "Послушай любимую музыку",
    "Ничего не делай — это тоже отдых",
    "Почитай книгу 15 минут",
    "Прогуляйся вокруг дома",
    "Сделай самомассаж лица",
    "Посмотри на звёзды или облака",
    "Зажги ароматическую свечу",
    "Нарисуй что-нибудь просто так",
    "Напиши три приятных события дня"
];

function renderRest() {
    const container = document.getElementById('mainContent');
    if (!container) return;
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const tip = restTips[dayOfYear % restTips.length];

    container.innerHTML = `
        <div class="page-eyebrow">Каждый день</div>
        <h2 class="page-title">ОТДЫХ</h2>
        <hr class="page-divider">
        <div class="rest-section">
            <div class="rest-tip">"${tip}"</div>
            <p style="font-size:14px;color:var(--gray);margin-bottom:16px;">Ты сделала достаточно за сегодня.<br>Отдыхай без чувства вины.</p>
            <div class="rest-note">— Новый совет каждый день</div>
        </div>
    `;
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
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            renderCurrentPage();
            // Закрыть мобильный сайдбар после перехода
            closeMobileSidebar();
        });
    });
}

// ========== МОБИЛЬНЫЙ САЙДБАР ==========
function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.add('hidden');
}

function setupMobileSidebar() {
    const burger = document.getElementById('burgerBtn');
    const overlay = document.getElementById('sidebarOverlay');
    const sidebar = document.getElementById('sidebar');
    if (burger) {
        burger.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('hidden');
        });
    }
    if (overlay) {
        overlay.addEventListener('click', closeMobileSidebar);
    }
}

// ========== ЗАПУСК ОСНОВНОГО ПРИЛОЖЕНИЯ ==========
function startMainApp() {
    showScreen('mainApp');
    setupNavigation();
    setupMobileSidebar();
    renderCurrentPage();

    const userNameEl = document.getElementById('userNameDisplay');
    if (userNameEl) userNameEl.textContent = currentUser.name || currentUser.username;

    const reminderEl = document.getElementById('dailyReminder');
    if (reminderEl) {
        const h = new Date().getHours();
        reminderEl.textContent = h < 12
            ? 'Доброе утро. Выбери три задачи.'
            : h < 18
                ? 'Держи фокус.'
                : 'Время отдохнуть и наградить себя.';
    }

    if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'default') {
            const panel = document.getElementById('notificationPermission');
            if (panel) panel.classList.remove('hidden');
        } else if (Notification.permission === 'granted') {
            scheduleNotifications();
        }
    }
}

// ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========
function initEventHandlers() {
    // --- Вход ---
    const loginBtn = document.getElementById('doLoginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const username = document.getElementById('loginUsername')?.value?.trim() || '';
            const password = document.getElementById('loginPassword')?.value || '';
            if (login(username, password)) routeAfterLogin();
        });
    }

    // --- Регистрация ---
    const registerBtn = document.getElementById('doRegisterBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            const username = document.getElementById('regUsername')?.value?.trim() || '';
            const email = document.getElementById('regEmail')?.value?.trim() || '';
            const password = document.getElementById('regPassword')?.value || '';
            if (register(username, email, password)) {
                // Переключить на вкладку входа
                document.querySelectorAll('.nav-text-link').forEach(l => l.classList.remove('active'));
                const loginLink = document.querySelector('.nav-text-link[data-tab="login"]');
                if (loginLink) loginLink.classList.add('active');
                document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                const loginForm = document.getElementById('loginForm');
                if (loginForm) loginForm.classList.add('active');
                // Предзаполнить логин
                const loginUsernameEl = document.getElementById('loginUsername');
                if (loginUsernameEl) loginUsernameEl.value = username;
                // Очистить форму регистрации
                ['regUsername', 'regEmail', 'regPassword'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                document.getElementById('regError').textContent = '';
            }
        });
    }

    // --- Сохранить имя ---
    const saveNameBtn = document.getElementById('saveNameBtn');
    if (saveNameBtn) {
        saveNameBtn.addEventListener('click', () => {
            const name = document.getElementById('userNameInput')?.value?.trim() || '';
            if (name) {
                saveUserName(name);
                showScreen('notificationsSetupScreen');
            } else {
                alert('Пожалуйста, введите ваше имя');
            }
        });
    }

    // --- Сохранить уведомления ---
    // ИСПРАВЛЕНИЕ: убран touchend, используется только click с type="button"
    const saveNotifBtn = document.getElementById('saveNotificationsBtn');
    if (saveNotifBtn) {
        saveNotifBtn.addEventListener('click', () => {
            const morning = document.getElementById('morningTime')?.value || '09:00';
            const evening = document.getElementById('eveningTime')?.value || '20:00';
            saveNotificationTimes(morning, evening);
        });
    }

    // --- Выйти ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            currentUser = null;
            localStorage.removeItem('mind_currentUser');
            showScreen('authScreen');
        });
    }

    // --- Уведомления ---
    const allowBtn = document.getElementById('allowNotificationsBtn');
    if (allowBtn) allowBtn.addEventListener('click', requestNotifications);

    const denyBtn = document.getElementById('denyNotificationsBtn');
    if (denyBtn) {
        denyBtn.addEventListener('click', () => {
            const panel = document.getElementById('notificationPermission');
            if (panel) panel.classList.add('hidden');
        });
    }

    // --- Enter в полях ---
    document.getElementById('loginPassword')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('doLoginBtn')?.click();
    });
    document.getElementById('loginUsername')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('loginPassword')?.focus();
    });
    document.getElementById('userNameInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('saveNameBtn')?.click();
    });
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function init() {
    setupAuthTabs();
    initEventHandlers();
    if (currentUser) {
        routeAfterLogin();
    } else {
        showScreen('authScreen');
    }
}

init();