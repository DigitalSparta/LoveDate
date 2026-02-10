const socket = io();

// --- КОНФИГУРАЦИЯ ---
const wardrobe = {
    male: ['boy_style_1.png', 'boy_style_2.png'], // Твои файлы
    female: ['girl_style_1.png', 'girl_style_2.png']
};

// --- СОСТОЯНИЕ ИГРОКА ---
let myState = {
    name: "Anon",
    gender: "male",
    lookIndex: 0,
    money: 50,
    x: 50,         // 0..100%
    isSitting: false,
    direction: 'right'
};

// ==========================
// 1. НАСТРОЙКА ПЕРСОНАЖА
// ==========================

function updatePreview() {
    const arr = wardrobe[myState.gender];
    // Защита от выхода за пределы массива
    if (myState.lookIndex >= arr.length) myState.lookIndex = 0;
    
    const fileName = arr[myState.lookIndex];
    document.getElementById('preview-img').src = 'assets/' + fileName;
}

function toggleGender() {
    myState.gender = myState.gender === 'male' ? 'female' : 'male';
    myState.lookIndex = 0;
    updatePreview();
}

function nextStyle() {
    myState.lookIndex++;
    updatePreview();
}

// Запуск превью при загрузке
updatePreview();

function startGame() {
    const name = document.getElementById('username-input').value;
    if (!name.trim()) return alert("Напиши имя!");

    myState.name = name.trim();
    // Формируем финальное имя файла картинки
    const finalLook = wardrobe[myState.gender][myState.lookIndex];

    // Отправляем на сервер
    socket.emit('join_game', {
        name: myState.name,
        gender: myState.gender,
        look: finalLook
    });

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    // Начинаем отправлять координаты
    setInterval(sendState, 100);
}

// ==========================
// 2. ДВИЖЕНИЕ И УПРАВЛЕНИЕ
// ==========================

let moveInterval = null;

function startMove(dir) {
    if (myState.isSitting) return; // Сидя не ходим
    myState.direction = dir;
    
    if (moveInterval) clearInterval(moveInterval);
    moveInterval = setInterval(() => {
        if (dir === 'left' && myState.x > 5) myState.x -= 1;
        if (dir === 'right' && myState.x < 95) myState.x += 1;
        // Локальное обновление (чтобы было плавно у себя)
        // updateLocalVisuals(); // Можно добавить, но socket обновит всех
    }, 20);
}

function stopMove() {
    clearInterval(moveInterval);
}

function toggleSit() {
    // Стол находится примерно в центре (30% - 70%)
    const nearTable = myState.x > 30 && myState.x < 70;

    if (myState.isSitting) {
        // Встаем
        myState.isSitting = false;
        document.getElementById('sit-btn').innerText = "🪑 Сесть";
    } else {
        // Садимся
        if (nearTable) {
            myState.isSitting = true;
            // Садимся красиво к столу
            if (myState.x < 50) { myState.x = 38; myState.direction = 'right'; }
            else { myState.x = 62; myState.direction = 'left'; }
            
            document.getElementById('sit-btn').innerText = "🏃 Встать";
        } else {
            alert("Подойди ближе к столу!");
        }
    }
    sendState(); // Мгновенно обновить статус
}

function sendState() {
    socket.emit('state_update', {
        x: myState.x,
        isSitting: myState.isSitting,
        direction: myState.direction
    });
}

// Управление клавиатурой (ПК)
document.addEventListener('keydown', (e) => {
    if(myState.isSitting) return;
    if(e.key === 'ArrowLeft' || e.key === 'a') startMove('left');
    if(e.key === 'ArrowRight' || e.key === 'd') startMove('right');
});
document.addEventListener('keyup', stopMove);

// ==========================
// 3. СЕТЬ И ОТРИСОВКА
// ==========================

socket.on('update_players', (players) => {
    // players - это массив всех игроков
    players.forEach(p => {
        let el = document.getElementById('player-' + p.id);
        
        // Если игрока нет в HTML, создаем
        if (!el) {
            el = document.createElement('div');
            el.id = 'player-' + p.id;
            el.className = 'player-char';
            el.innerHTML = `
                <div class="nickname">${p.name}</div>
                <img class="player-img" src="assets/${p.look}">
            `;
            document.getElementById('game-world').appendChild(el);
        }

        // Обновляем позицию и классы
        el.style.left = p.x + '%';

        // Сидит?
        if (p.isSitting) el.classList.add('sitting');
        else el.classList.remove('sitting');

        // Поворот
        if (p.direction === 'left') el.classList.add('flip');
        else el.classList.remove('flip');
    });

    // (Дополнительно можно добавить удаление вышедших игроков)
});

// ==========================
// 4. МЕНЮ, ЕДА, РАБОТА
// ==========================

function toggleMenu() {
    const el = document.getElementById('food-menu');
    el.classList.toggle('hidden');
}

function orderFood(name, price, imgFile) {
    if (myState.money < price) return alert("Не хватает денег! Поработай немного.");
    
    myState.money -= price;
    document.getElementById('money-display').innerText = myState.money;
    toggleMenu(); // Закрыть меню

    // Отправляем заказ
    socket.emit('order_food', { items: [{ img: imgFile }] });
}

// Приход официанта
socket.on('waiter_service', (data) => {
    const w = document.getElementById('waiter');
    w.classList.add('active'); // Выезд

    setTimeout(() => {
        // Спавн еды
        data.items.forEach(item => spawnFood(item.img));
        
        // Уход официанта
        setTimeout(() => {
            w.classList.remove('active');
        }, 2000);
    }, 1500);
});

function spawnFood(imgSrc) {
    const img = document.createElement('img');
    img.src = 'assets/' + imgSrc;
    img.className = 'food-item';
    // Клик по еде -> Кусь
    img.onclick = function() {
        this.style.animation = "eatAnim 1s forwards";
        setTimeout(() => this.remove(), 1000); // Удалить после анимации
    };
    document.getElementById('table-area').appendChild(img);
}

// Счет
function askBill() {
    if (myState.gender === 'male') {
        alert(`Официант: "С вас ${200 - myState.money}$. Оплата картой или натурой?"`);
    } else {
        alert("Официант принес счет мужчине... Как и положено.");
    }
}

// ==========================
// 5. МИНИ-ИГРА (РАБОТА)
// ==========================
let workInterval = null;

function toggleWork() {
    const overlay = document.getElementById('work-overlay');
    if (overlay.classList.contains('hidden')) {
        // Начало работы
        overlay.classList.remove('hidden');
        workInterval = setInterval(spawnHeart, 700);
    } else {
        // Конец работы
        overlay.classList.add('hidden');
        clearInterval(workInterval);
        // Удалить оставшиеся сердечки
        document.querySelectorAll('.heart-item').forEach(h => h.remove());
    }
}

function spawnHeart() {
    const h = document.createElement('div');
    h.innerText = "💖";
    h.className = "heart-item";
    h.style.left = Math.random() * 90 + "%";
    
    h.onmousedown = function() {
        myState.money += 10;
        document.getElementById('money-display').innerText = myState.money;
        this.remove();
    };
    
    document.getElementById('work-overlay').appendChild(h);
}

// ==========================
// 6. ЧАТ
// ==========================
function sendMessage() {
    const inp = document.getElementById('chat-input');
    const txt = inp.value.trim();
    if (txt) {
        socket.emit('chat_message', txt);
        inp.value = '';
    }
}

socket.on('chat_message', (data) => {
    const div = document.getElementById('chat-messages');
    div.innerHTML += `<div><b>${data.user}:</b> ${data.text}</div>`;
    div.scrollTop = div.scrollHeight;
});
