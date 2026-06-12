// Базовые задачи
let tasks = [
    { id: 1, title: "Сформулировать 3 главные задачи на день", completed: false, emoji: "🎯" },
    { id: 2, title: "Выполнить первую задачу до обеда", completed: false, emoji: "☀️" },
    { id: 3, title: "Завершить день практикой отдыха", completed: false, emoji: "🌙" }
];

let rewards = [
    "Посмотреть любимый сериал 30 минут",
    "Съесть что-то вкусное",
    "Прогулка на свежем воздухе",
    "Час без телефона",
    "Купить маленький приятный сувенир"
];

let currentReward = rewards[Math.floor(Math.random() * rewards.length)];
let nextTaskId = 4;

// Элементы DOM
const tasksGrid = document.getElementById('tasksGrid');
const globalPercentSpan = document.getElementById('globalPercent');
const globalProgressFill = document.getElementById('globalProgressFill');
const rewardText = document.getElementById('rewardText');
const claimBtn = document.getElementById('claimRewardBtn');

// Обновление прогресса
function updateGlobalProgress() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    
    globalPercentSpan.textContent = `${percent}%`;
    globalProgressFill.style.width = `${percent}%`;
    
    const allCompleted = completed === total && total > 0;
    if (allCompleted) {
        rewardText.textContent = currentReward;
        claimBtn.disabled = false;
    } else {
        claimBtn.disabled = true;
        rewardText.textContent = "Выполни все задачи дня";
    }
    
    return percent;
}

// Рендер карточек задач
function renderTasks() {
    if (!tasksGrid) return;
    
    tasksGrid.innerHTML = tasks.map(task => `
        <div class="task-card ${task.completed ? 'completed' : ''}" data-id="${task.id}">
            <div class="task-header">
                <div class="task-emoji">${task.emoji}</div>
                <div class="task-title">${escapeHtml(task.title)}</div>
            </div>
            <label class="task-check">
                <input type="checkbox" ${task.completed ? 'checked' : ''}>
                <span>${task.completed ? 'Выполнено' : 'Отметить выполненной'}</span>
            </label>
        </div>
    `).join('');
    
    // Навешиваем обработчики
    document.querySelectorAll('.task-card').forEach(card => {
        const checkbox = card.querySelector('input');
        const taskId = parseInt(card.dataset.id);
        
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            toggleTask(taskId);
        });
    });
    
    updateGlobalProgress();
}

// Переключение задачи
function toggleTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        renderTasks();
    }
}

// Добавление задачи
function addTask(title) {
    if (!title.trim()) return;
    tasks.push({
        id: nextTaskId++,
        title: title.trim(),
        completed: false,
        emoji: "📌"
    });
    renderTasks();
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Обработчик награды
if (claimBtn) {
    claimBtn.addEventListener('click', () => {
        if (claimBtn.disabled) return;
        alert(`🎉 Поздравляю! Твоя награда: ${currentReward} 🎉\n\nТы сегодня молодец! Отдыхай с чистой совестью.`);
        // Генерируем новую награду на завтра
        currentReward = rewards[Math.floor(Math.random() * rewards.length)];
        claimBtn.disabled = true;
        rewardText.textContent = "Выполни все задачи дня";
        // Не сбрасываем задачи, чтобы сохранить чувство завершённости
    });
}

// Инициализация
renderTasks();

// Для демо: добавим возможность добавлять задачи через консоль (можно убрать)
window.addTask = addTask;