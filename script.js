// ========== ХРАНИЛИЩЕ ==========
let users = JSON.parse(localStorage.getItem('mind_users')) || [];
let currentUser = JSON.parse(localStorage.getItem('mind_currentUser')) || null;

function saveUsers() { localStorage.setItem('mind_users', JSON.stringify(users)); }
function saveCurrentUser() { localStorage.setItem('mind_currentUser', JSON.stringify(currentUser)); }

// ========== ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ ==========
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

// ========== ПЕРЕКЛЮЧЕНИЕ МЕЖДУ ВХОДОМ И РЕГИСТРАЦИЕЙ ==========
function setupAuthTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = {
        login: document.getElementById('loginForm'),
        register: document.getElementById('registerForm')
    };
    
    tabs.forEach(tab => {
        tab.removeEventListener('click', handleTabClick);
        tab.addEventListener('click', handleTabClick);
    });
    
    function handleTabClick(e) {
        const tab = e.currentTarget;
        const tabName = tab.getAttribute('data-tab');
        
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        Object.values(forms).forEach(form => {
            if (form) form.classList.remove('active');
        });
        if (forms[tabName]) {
            forms[tabName].classList.add('active');
        }
    }
}

// ========== РЕГИСТРАЦИЯ И ВХОД ==========
function register(username, email, password) {
    if (users.find(u => u.username === username)) {
        document.getElementById('regError').textContent = 'Пользователь уже существует';
        return false;
    }
    const newUser = {
        id: Date.now(),
        username,
        email,
        password,
        name: '',
        isProfileSetup: false,
        notificationTimeMorning: '09:00',
        notificationTimeEvening: '20:00',
        tasks: [],
        claimedRewards: []
    };
    users.push(newUser);
    saveUsers();
    return true;
}

function login(username, password) {
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        document.getElementById('loginError').textContent = 'Неверный логин или пароль';
        return false;
    }
    currentUser = user;
    saveCurrentUser();
    return true;
}

// ========== НАСТРОЙКА ПРОФИЛЯ ==========
function saveUserName(name) {
    currentUser.name = name;
    saveCurrentUser();
}

function saveNotificationTimes(morning, evening) {
    currentUser.notificationTimeMorning = morning;
    currentUser.notificationTimeEvening = evening;
    currentUser.isProfileSetup = true;
    saveCurrentUser();
    scheduleNotifications();
    // Принудительно переходим в приложение после сохранения
    startMainApp();
}

// ========== УВЕДОМЛЕНИЯ ==========
function requestNotifications() {
    Notification.requestPermission().then(perm => {
        if (perm === 'granted') scheduleNotifications();
        document.getElementById('notificationPermission').classList.add('hidden');
    });
}

function sendNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '🧠' });
    }
}

function scheduleNotifications() {
    if (!currentUser || Notification.permission !== 'granted') return;
    
    function scheduleAt(targetTime, title, body) {
        const now = new Date();
        const [targetHour, targetMin] = targetTime.split(':').map(Number);
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, targetMin);
        const delay = target - now;
        
        if (delay > 0) {
            setTimeout(() => sendNotification(title, body), delay);
        } else {
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, targetHour, targetMin);
            setTimeout(() => sendNotification(title, body), tomorrow - now);
        }
    }
    
    scheduleAt(currentUser.notificationTimeMorning, 'Доброе утро!', `${currentUser.name}, выбери три фокус-задачи на день.`);
    scheduleAt(currentUser.notificationTimeEvening, 'Время отдохнуть!', `${currentUser.name}, ты отлично поработала. Награди себя и отдохни.`);
}

// ========== ЗАДАЧИ ==========
const MAX_TASKS_PER_DAY = 3;
const REWARD_PLACEHOLDERS = [
    "🍵 Выпить горячий чай",
    "📖 Почитать любимую книгу 15 минут",
    "🎵 Послушать любимый плейлист",
    "🚶‍♀️ Прогуляться на свежем воздухе",
    "🍫 Съесть что-то вкусное",
    "📝 Написать три приятных события дня",
    "🧘‍♀️ Сделать лёгкую растяжку",
    "💆‍♀️ Сделать самомассаж",
    "🎬 Посмотреть любимый сериал"
];

function addTask(title) {
    if (!title.trim()) return;
    
    if (currentUser.tasks.length >= MAX_TASKS_PER_DAY) {
        alert(`Ты можешь добавить максимум ${MAX_TASKS_PER_DAY} задачи в день.\n\nСфокусируйся на главном!`);
        return;
    }
    
    currentUser.tasks.push({
        id: Date.now(),
        title: title.trim(),
        completed: false,
        reward: ''
    });
    saveCurrentUser();
    renderPlanner();
}

function toggleTask(taskId) {
    const task = currentUser.tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        saveCurrentUser();
        renderPlanner();
    }
}

function updateTaskReward(taskId, rewardText) {
    const task = currentUser.tasks.find(t => t.id === taskId);
    if (task) {
        task.reward = rewardText;
        saveCurrentUser();
    }
}

function deleteTask(taskId) {
    if (confirm('Удалить эту задачу?')) {
        currentUser.tasks = currentUser.tasks.filter(t => t.id !== taskId);
        if (currentUser.claimedRewards) {
            currentUser.claimedRewards = currentUser.claimedRewards.filter(id => id !== taskId);
        }
        saveCurrentUser();
        // ОСТАЁМСЯ НА СТРАНИЦЕ ПЛАНЕРА
        const plannerLink = document.querySelector('.nav-link[data-page="planner"]');
        if (plannerLink) {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            plannerLink.classList.add('active');
        }
        renderPlanner();
        renderRewards(); // обновляем награды в фоне
    }
}

// ========== НАГРАДЫ ==========
function toggleRewardClaim(taskId) {
    const task = currentUser.tasks.find(t => t.id === taskId);
    if (!task || !task.reward || task.reward.trim() === '') {
        alert('Сначала пропишите награду за эту задачу в разделе "Планер"');
        return;
    }
    
    if (!currentUser.claimedRewards) currentUser.claimedRewards = [];
    
    if (currentUser.claimedRewards.includes(taskId)) {
        currentUser.claimedRewards = currentUser.claimedRewards.filter(id => id !== taskId);
    } else {
        currentUser.claimedRewards.push(taskId);
        alert(`Поздравляю! Ты забрала награду: ${task.reward}`);
    }
    saveCurrentUser();
    renderRewards();
}

// ========== ОТРИСОВКА СТРАНИЦ ==========
function renderPlanner() {
    const container = document.getElementById('mainContent');
    const completedCount = currentUser.tasks.filter(t => t.completed).length;
    const percent = currentUser.tasks.length ? Math.round((completedCount / currentUser.tasks.length) * 100) : 0;
    const remainingSlots = MAX_TASKS_PER_DAY - currentUser.tasks.length;
    
    if (currentUser.tasks.length === 0) {
        container.innerHTML = `
            <div class="page-header">
                <h2>Планер дня</h2>
                <div class="greeting">${currentUser.name || currentUser.username}, добавь свои первые задачи!<br><span style="font-size: 14px; color: #ff9800;">Сфокусируйся на 3 сегодня</span></div>
            </div>
            <div class="progress-block">
                <div class="progress-label"><span>Прогресс дня</span><span>0%</span></div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: 0%;"></div></div>
            </div>
            <div class="empty-state" style="text-align: center; padding: 60px; background: #f8fafc; border-radius: 24px;">
                <div style="font-size: 64px; margin-bottom: 16px;">📝</div>
                <p style="color: #6b6b6b;">У вас пока нет задач</p>
                <p style="color: #9e9e9e; font-size: 14px;">Добавьте первую задачу ниже</p>
                <p style="color: #ff9800; font-size: 13px; margin-top: 16px;">Можно добавить до ${MAX_TASKS_PER_DAY} задач в день</p>
            </div>
            <div class="add-task-form">
                <input type="text" id="newTaskTitle" placeholder="Новая задача...">
                <button id="addTaskBtn">Добавить</button>
            </div>
        `;
        document.getElementById('addTaskBtn')?.addEventListener('click', () => {
            const input = document.getElementById('newTaskTitle');
            addTask(input.value);
            input.value = '';
        });
        return;
    }
    
    container.innerHTML = `
        <div class="page-header">
            <h2>Планер дня</h2>
            <div class="greeting">${currentUser.name || currentUser.username}, вот твои задачи на сегодня<br><span style="font-size: 14px; color: #ff9800;">Сфокусируйся на ${remainingSlots > 0 ? `ещё ${remainingSlots}` : 'всех'} задачах</span></div>
        </div>
        <div class="progress-block">
            <div class="progress-label"><span>Прогресс дня</span><span>${percent}%</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percent}%;"></div></div>
        </div>
        <div class="tasks-list">
            ${currentUser.tasks.map(task => `
                <div class="task-card ${task.completed ? 'completed' : ''}" style="${task.completed ? 'background: #e8f5e9; border-color: #4caf50; box-shadow: 0 2px 8px rgba(76,175,80,0.2);' : ''}">
                    <div class="task-header">
                        <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''} data-id="${task.id}">
                        <span class="task-title">${escapeHtml(task.title)}</span>
                        <button class="delete-task-btn" data-id="${task.id}" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #e53935;">🗑️</button>
                    </div>
                    <div class="reward-input-wrapper" style="position: relative;">
                        <input type="text" class="task-reward-input" placeholder="Моя награда за эту задачу..." value="${escapeHtml(task.reward)}" data-id="${task.id}" style="${task.reward && task.reward.trim() ? 'background: #fff8e1; border-color: #ffb74d;' : ''}">
                        <div class="reward-placeholder-tooltip" style="display: none; position: absolute; top: -40px; left: 0; background: #333; color: #ccc; font-size: 12px; font-style: italic; padding: 6px 12px; border-radius: 8px; white-space: nowrap; z-index: 100;">
                            💡 Например: ${REWARD_PLACEHOLDERS.slice(0, 3).join(', ')}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="add-task-form">
            <input type="text" id="newTaskTitle" placeholder="Новая задача..." ${remainingSlots <= 0 ? 'disabled style="opacity: 0.5;"' : ''}>
            <button id="addTaskBtn" ${remainingSlots <= 0 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>Добавить</button>
        </div>
        ${remainingSlots <= 0 ? '<p style="text-align: center; margin-top: 16px; color: #ff9800; font-size: 14px;">Ты достигла лимита на сегодня (3 задачи). Завтра будет новый день!</p>' : `<p style="text-align: center; margin-top: 16px; color: #9e9e9e; font-size: 13px;">Можно добавить ещё ${remainingSlots} задачу(и) из ${MAX_TASKS_PER_DAY}</p>`}
    `;
    
    document.querySelectorAll('.task-check').forEach(cb => {
        cb.addEventListener('change', (e) => toggleTask(parseInt(e.target.dataset.id)));
    });
    document.querySelectorAll('.task-reward-input').forEach(inp => {
        inp.addEventListener('change', (e) => updateTaskReward(parseInt(e.target.dataset.id), e.target.value));
        inp.addEventListener('input', (e) => {
            if (e.target.value.trim()) {
                e.target.style.background = '#fff8e1';
                e.target.style.borderColor = '#ffb74d';
            } else {
                e.target.style.background = '';
                e.target.style.borderColor = '';
            }
        });
        // Подсказка при наведении
        const wrapper = inp.closest('.reward-input-wrapper');
        const tooltip = wrapper?.querySelector('.reward-placeholder-tooltip');
        if (tooltip) {
            inp.addEventListener('mouseenter', () => { tooltip.style.display = 'block'; });
            inp.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
        }
    });
    document.querySelectorAll('.delete-task-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteTask(parseInt(e.target.dataset.id)));
    });
    document.getElementById('addTaskBtn')?.addEventListener('click', () => {
        const input = document.getElementById('newTaskTitle');
        if (currentUser.tasks.length >= MAX_TASKS_PER_DAY) {
            alert(`Ты можешь добавить максимум ${MAX_TASKS_PER_DAY} задачи в день.\n\nСфокусируйся на главном!`);
            return;
        }
        addTask(input.value);
        input.value = '';
    });
}

function renderProgress() {
    const container = document.getElementById('mainContent');
    const total = currentUser.tasks.length;
    const completed = currentUser.tasks.filter(t => t.completed).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    const rewardsFilled = currentUser.tasks.filter(t => t.reward && t.reward.trim()).length;
    const claimedCount = currentUser.claimedRewards ? currentUser.claimedRewards.length : 0;
    
    container.innerHTML = `
        <div class="page-header"><h2>Твой прогресс</h2></div>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-number">${total} / ${MAX_TASKS_PER_DAY}</div><div>Задач на сегодня</div></div>
            <div class="stat-card"><div class="stat-number">${completed}</div><div>Выполнено</div></div>
            <div class="stat-card"><div class="stat-number">${percent}%</div><div>Эффективность</div></div>
            <div class="stat-card"><div class="stat-number">${rewardsFilled}</div><div>Наград назначено</div></div>
            <div class="stat-card"><div class="stat-number">${claimedCount}</div><div>Наград получено</div></div>
        </div>
        <div class="progress-block">
            <div class="progress-label"><span>Общий прогресс</span><span>${percent}%</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percent}%;"></div></div>
        </div>
    `;
}

function renderRewards() {
    const container = document.getElementById('mainContent');
    const tasksWithRewards = currentUser.tasks.filter(t => t.reward && t.reward.trim() !== '');
    
    if (tasksWithRewards.length === 0) {
        container.innerHTML = `
            <div class="page-header"><h2>Мои награды</h2></div>
            <div style="text-align: center; padding: 60px; background: #f8fafc; border-radius: 24px;">
                <div style="font-size: 64px; margin-bottom: 16px;">🎁</div>
                <p style="color: #6b6b6b;">Пока нет наград</p>
                <p style="color: #9e9e9e; font-size: 14px;">Добавь награду к каждой задаче в разделе "Планер"</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="page-header"><h2>Мои награды</h2></div>
        <div class="rewards-list">
            ${tasksWithRewards.map(task => {
                const isClaimed = currentUser.claimedRewards && currentUser.claimedRewards.includes(task.id);
                return `
                    <div class="reward-item ${isClaimed ? 'claimed' : ''}" style="${isClaimed ? 'background: #e8f5e9; border-color: #4caf50;' : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                            <strong>${escapeHtml(task.title)}</strong>
                            <span style="font-size: 12px; padding: 4px 12px; border-radius: 20px; background: ${task.completed ? '#c8e6c9' : '#fff3e0'};">
                                ${task.completed ? 'Выполнено' : 'В процессе'}
                            </span>
                        </div>
                        <div style="margin-top: 12px; padding: 12px; background: #f5f5f5; border-radius: 16px;">
                            Награда: ${escapeHtml(task.reward)}
                        </div>
                        <div style="margin-top: 12px;">
                            <label class="reward-check-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" class="reward-claim-check" data-id="${task.id}" ${isClaimed ? 'checked' : ''} ${!task.completed ? 'disabled' : ''}>
                                <span>${isClaimed ? 'Награда получена!' : 'Забрать награду'}</span>
                            </label>
                            ${!task.completed ? '<p style="font-size: 12px; color: #ff9800; margin-top: 8px;">Сначала выполните задачу</p>' : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    document.querySelectorAll('.reward-claim-check').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (cb.disabled) return;
            toggleRewardClaim(parseInt(e.target.dataset.id));
        });
    });
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
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    const tipIndex = dayOfYear % restTips.length;
    const todayTip = restTips[tipIndex];
    
    container.innerHTML = `
        <div class="page-header"><h2>Практика отдыха</h2></div>
        <div class="rest-card" style="text-align: center; padding: 40px 20px;">
            <div class="rest-tip" style="font-size: 20px; font-style: italic; color: #2e7d32; margin: 20px 0;">${todayTip}</div>
            <p>Ты сделала достаточно за сегодня.<br>Отдыхай без чувства вины.</p>
            <div style="margin-top: 32px; font-size: 14px; color: #9e9e9e;">Новый совет каждый день</div>
        </div>
    `;
}

function renderCurrentPage() {
    const activeLink = document.querySelector('.nav-link.active');
    const page = activeLink?.dataset.page || 'planner';
    if (page === 'planner') renderPlanner();
    else if (page === 'progress') renderProgress();
    else if (page === 'rewards') renderRewards();
    else if (page === 'rest') renderRest();
}

function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            renderCurrentPage();
        });
    });
}

// ========== ЗАПУСК ПРИЛОЖЕНИЯ ==========
function startMainApp() {
    showScreen('mainApp');
    setupNavigation();
    renderCurrentPage();
    document.getElementById('userNameDisplay').textContent = currentUser.name || currentUser.username;
    const hour = new Date().getHours();
    const reminderEl = document.getElementById('dailyReminder');
    if (hour < 12) reminderEl.innerHTML = 'Доброе утро! Выбери три задачи на день';
    else if (hour < 18) reminderEl.innerHTML = 'Хорошего дня! Держи фокус';
    else reminderEl.innerHTML = 'Отличная работа! Пора отдохнуть и наградить себя';
    if (Notification.permission === 'default') {
        document.getElementById('notificationPermission').classList.remove('hidden');
    } else if (Notification.permission === 'granted') {
        scheduleNotifications();
    }
}

// ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========
function initEventHandlers() {
    document.getElementById('doLoginBtn').addEventListener('click', () => {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        if (login(username, password)) {
            if (!currentUser.name) {
                showScreen('nameSetupScreen');
            } else if (!currentUser.isProfileSetup) {
                showScreen('notificationsSetupScreen');
            } else {
                startMainApp();
            }
        }
    });
    
    document.getElementById('doRegisterBtn').addEventListener('click', () => {
        const username = document.getElementById('regUsername').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        if (register(username, email, password)) {
            document.getElementById('regError').textContent = '';
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.auth-tab[data-tab="login"]').classList.add('active');
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            document.getElementById('loginForm').classList.add('active');
            document.getElementById('regUsername').value = '';
            document.getElementById('regEmail').value = '';
            document.getElementById('regPassword').value = '';
        }
    });
    
    document.getElementById('saveNameBtn').addEventListener('click', () => {
        const name = document.getElementById('userNameInput').value;
        if (name.trim()) {
            saveUserName(name.trim());
            showScreen('notificationsSetupScreen');
        }
    });
    
    const saveNotificationsBtn = document.getElementById('saveNotificationsBtn');
    if (saveNotificationsBtn) {
        // Удаляем старые обработчики, чтобы избежать дублирования
        const newBtn = saveNotificationsBtn.cloneNode(true);
        saveNotificationsBtn.parentNode.replaceChild(newBtn, saveNotificationsBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const morning = document.getElementById('morningTime').value;
            const evening = document.getElementById('eveningTime').value;
            saveNotificationTimes(morning, evening);
        });
    }
    
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        currentUser = null;
        localStorage.removeItem('mind_currentUser');
        showScreen('authScreen');
    });
    
    document.getElementById('allowNotificationsBtn')?.addEventListener('click', requestNotifications);
    document.getElementById('denyNotificationsBtn')?.addEventListener('click', () => {
        document.getElementById('notificationPermission').classList.add('hidden');
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== СТАРТ ==========
function init() {
    setupAuthTabs();
    initEventHandlers();
    
    if (currentUser) {
        if (!currentUser.name) {
            showScreen('nameSetupScreen');
        } else if (!currentUser.isProfileSetup) {
            showScreen('notificationsSetupScreen');
        } else {
            startMainApp();
        }
    } else {
        showScreen('authScreen');
    }
}

init();