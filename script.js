// ========== ХРАНИЛИЩЕ ПОЛЬЗОВАТЕЛЕЙ ==========
let users = JSON.parse(localStorage.getItem('mind_users')) || [];
let currentUser = JSON.parse(localStorage.getItem('mind_currentUser')) || null;

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function saveUsers() {
    localStorage.setItem('mind_users', JSON.stringify(users));
}

function saveCurrentUser() {
    localStorage.setItem('mind_currentUser', JSON.stringify(currentUser));
}

// ========== АВТОРИЗАЦИЯ ==========
function showAuthScreen() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
}

function showMainApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    renderCurrentPage();
    updateUserDisplay();
    checkAndAskNotifications();
}

function updateUserDisplay() {
    if (currentUser) {
        document.getElementById('userNameDisplay').textContent = currentUser.name || currentUser.username;
        // Утреннее/вечернее приветствие
        const reminderEl = document.getElementById('dailyReminder');
        if (reminderEl) {
            const hour = new Date().getHours();
            if (hour < 12) reminderEl.innerHTML = '☀️ Доброе утро! Выбери три задачи на день';
            else if (hour < 18) reminderEl.innerHTML = '🌤️ Хорошего дня! Держи фокус';
            else reminderEl.innerHTML = '🌙 Отличная работа! Пора отдохнуть и наградить себя';
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
        notificationTimeMorning: '09:00',
        notificationTimeEvening: '20:00',
        tasks: [
            { id: 1, title: 'Сформулировать 3 главные задачи на день', completed: false, reward: '' },
            { id: 2, title: 'Выполнить первую задачу до обеда', completed: false, reward: '' },
            { id: 3, title: 'Завершить день практикой отдыха', completed: false, reward: '' }
        ],
        rewardsHistory: [],
        completedHistory: []
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

// ========== НАСТРОЙКА ИМЕНИ И УВЕДОМЛЕНИЙ ==========
function askUserNameAndNotifications() {
    if (currentUser.name && currentUser.name !== '') return;
    
    const name = prompt('Добро пожаловать! Как вас зовут?', currentUser.username);
    if (name && name.trim()) {
        currentUser.name = name.trim();
        saveCurrentUser();
    }
    
    const morningTime = prompt('Введите время для утреннего напоминания (например, 09:00):', currentUser.notificationTimeMorning || '09:00');
    if (morningTime && morningTime.match(/^\d{2}:\d{2}$/)) {
        currentUser.notificationTimeMorning = morningTime;
    }
    
    const eveningTime = prompt('Введите время для вечернего напоминания (например, 20:00):', currentUser.notificationTimeEvening || '20:00');
    if (eveningTime && eveningTime.match(/^\d{2}:\d{2}$/)) {
        currentUser.notificationTimeEvening = eveningTime;
    }
    
    saveCurrentUser();
    scheduleNotifications();
}

// ========== УВЕДОМЛЕНИЯ ==========
function checkAndAskNotifications() {
    if (Notification.permission === 'default') {
        document.getElementById('notificationPermission').classList.remove('hidden');
    } else if (Notification.permission === 'granted') {
        scheduleNotifications();
    }
}

function requestNotifications() {
    Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
            scheduleNotifications();
        }
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
    
    function checkAndSend(targetTime, title, body) {
        const now = new Date();
        const [targetHour, targetMin] = targetTime.split(':').map(Number);
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, targetMin);
        
        if (now >= target) {
            sendNotification(title, body);
            return true;
        }
        return false;
    }
    
    const morningSent = checkAndSend(currentUser.notificationTimeMorning, '🌅 Доброе утро!', `${currentUser.name}, выбери три фокус-задачи на день.`);
    const eveningSent = checkAndSend(currentUser.notificationTimeEvening, '🌙 Время отдохнуть!', `${currentUser.name}, ты отлично поработала. Награди себя и отдохни.`);
    
    // Запланировать на завтра, если сегодня уже поздно
    if (!morningSent) setTimeout(() => scheduleNotifications(), 60000);
    if (!eveningSent) setTimeout(() => scheduleNotifications(), 60000);
}

// ========== УПРАВЛЕНИЕ ЗАДАЧАМИ ==========
function addTask(title) {
    if (!title.trim()) return;
    const newTask = {
        id: Date.now(),
        title: title.trim(),
        completed: false,
        reward: ''
    };
    currentUser.tasks.push(newTask);
    saveCurrentUser();
    renderPlanner();
}

function toggleTask(taskId) {
    const task = currentUser.tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        saveCurrentUser();
        renderPlanner();
        updateProgressPage();
    }
}

function updateTaskReward(taskId, rewardText) {
    const task = currentUser.tasks.find(t => t.id === taskId);
    if (task) {
        task.reward = rewardText;
        saveCurrentUser();
    }
}

// ========== ОТРИСОВКА СТРАНИЦ ==========
function renderPlanner() {
    const container = document.getElementById('mainContent');
    const completedCount = currentUser.tasks.filter(t => t.completed).length;
    const percent = currentUser.tasks.length ? Math.round((completedCount / currentUser.tasks.length) * 100) : 0;
    
    container.innerHTML = `
        <div class="page-header">
            <h2>📋 Планер дня</h2>
            <div class="greeting">🍃 ${currentUser.name || currentUser.username}, вот твои задачи на сегодня</div>
        </div>
        <div class="progress-block">
            <div class="progress-label">
                <span>Прогресс дня</span>
                <span>${percent}%</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${percent}%;"></div>
            </div>
        </div>
        <div class="tasks-list">
            ${currentUser.tasks.map(task => `
                <div class="task-card ${task.completed ? 'completed' : ''}">
                    <div class="task-header">
                        <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''} data-id="${task.id}">
                        <span class="task-title">${escapeHtml(task.title)}</span>
                    </div>
                    <input type="text" class="task-reward-input" placeholder="Моя награда за эту задачу..." value="${escapeHtml(task.reward)}" data-id="${task.id}">
                </div>
            `).join('')}
        </div>
        <div class="add-task-form">
            <input type="text" id="newTaskTitle" placeholder="➕ Новая задача...">
            <button id="addTaskBtn">Добавить</button>
        </div>
    `;
    
    document.querySelectorAll('.task-check').forEach(cb => {
        cb.addEventListener('change', (e) => toggleTask(parseInt(e.target.dataset.id)));
    });
    document.querySelectorAll('.task-reward-input').forEach(inp => {
        inp.addEventListener('change', (e) => updateTaskReward(parseInt(e.target.dataset.id), e.target.value));
    });
    document.getElementById('addTaskBtn')?.addEventListener('click', () => {
        const input = document.getElementById('newTaskTitle');
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
    
    container.innerHTML = `
        <div class="page-header"><h2>📊 Твой прогресс</h2></div>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-number">${total}</div><div>Всего задач</div></div>
            <div class="stat-card"><div class="stat-number">${completed}</div><div>Выполнено</div></div>
            <div class="stat-card"><div class="stat-number">${percent}%</div><div>Эффективность</div></div>
            <div class="stat-card"><div class="stat-number">${rewardsFilled}</div><div>Наград назначено</div></div>
        </div>
        <div class="progress-block">
            <div class="progress-label"><span>Общий прогресс</span><span>${percent}%</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percent}%;"></div></div>
        </div>
    `;
}

function renderRewards() {
    const container = document.getElementById('mainContent');
    const completedTasks = currentUser.tasks.filter(t => t.completed && t.reward);
    container.innerHTML = `
        <div class="page-header"><h2>🏆 Мои награды</h2></div>
        <div class="rewards-list">
            ${completedTasks.length ? completedTasks.map(t => `
                <div class="reward-item">🎁 За задачу «${escapeHtml(t.title)}» — ${escapeHtml(t.reward)}</div>
            `).join('') : '<p>Пока нет наград. Выполняй задачи и назначай себе награды!</p>'}
        </div>
    `;
}

function renderRest() {
    const container = document.getElementById('mainContent');
    const tips = [
        'Подыши свежим воздухом 5 минут',
        'Выпей чай без телефона',
        'Сделай лёгкую растяжку',
        'Послушай любимую музыку',
        'Ничего не делай — это тоже отдых'
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    
    container.innerHTML = `
        <div class="page-header"><h2>🌿 Практика отдыха</h2></div>
        <div class="rest-card">
            <div class="rest-tip">✨ ${randomTip} ✨</div>
            <p>Ты сделала достаточно за сегодня.<br>Отдыхай без чувства вины.</p>
            <button id="refreshTipBtn" class="btn-add" style="margin-top: 24px;">Другой совет</button>
        </div>
    `;
    document.getElementById('refreshTipBtn')?.addEventListener('click', renderRest);
}

function renderCurrentPage() {
    if (!currentUser) return;
    const activeLink = document.querySelector('.nav-link.active');
    const page = activeLink?.dataset.page || 'planner';
    if (page === 'planner') renderPlanner();
    else if (page === 'progress') renderProgress();
    else if (page === 'rewards') renderRewards();
    else if (page === 'rest') renderRest();
}

// ========== ОБРАБОТЧИКИ НАВИГАЦИИ ==========
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

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function init() {
    // Вкладки авторизации
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            document.getElementById(tab.dataset.tab + 'Form').classList.add('active');
        });
    });
    
    document.getElementById('doLoginBtn').addEventListener('click', () => {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        if (login(username, password)) {
            askUserNameAndNotifications();
            showMainApp();
            setupNavigation();
            renderCurrentPage();
        }
    });
    
    document.getElementById('doRegisterBtn').addEventListener('click', () => {
        const username = document.getElementById('regUsername').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        if (register(username, email, password)) {
            document.getElementById('regError').textContent = '';
            document.querySelector('.auth-tab[data-tab="login"]').click();
        }
    });
    
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        currentUser = null;
        localStorage.removeItem('mind_currentUser');
        showAuthScreen();
    });
    
    document.getElementById('allowNotificationsBtn')?.addEventListener('click', requestNotifications);
    document.getElementById('denyNotificationsBtn')?.addEventListener('click', () => {
        document.getElementById('notificationPermission').classList.add('hidden');
    });
    
    if (currentUser) {
        showMainApp();
        setupNavigation();
        renderCurrentPage();
        updateUserDisplay();
        checkAndAskNotifications();
    } else {
        showAuthScreen();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

init();