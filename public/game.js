const socket = io();

// --- КОНФИГ ---
const wardrobe = {
    male: ['boy_style_1.png', 'boy_style_2.png', 'boy_style_3.png', 'boy_style_4.png', 'boy_style_5.png', 'suit1.png'],
    female: ['girl_style_1.png', 'girl_style_2.png', 'girl_style_3.png', 'girl_style_4.png', 'girl_style_5.png', 'girl_style_6.png']
};

let myState = {
    name: "Anon",
    gender: "male",
    lookIndex: 0,
    money: 100, // Начальный капитал
    x: 50,
    isSitting: false,
    direction: 'right'
};

// --- НАСТРОЙКИ ВНЕШНОСТИ ---
function updatePreview() {
    const arr = wardrobe[myState.gender];
    if (myState.lookIndex >= arr.length) myState.lookIndex = 0;
    document.getElementById('preview-img').src = 'assets/' + arr[myState.lookIndex];
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

updatePreview(); // старт

function startGame() {
    const name = document.getElementById('username-input').value;
    if (!name.trim()) return alert("Имя введи!");

    myState.name = name.trim();
    const finalLook = wardrobe[myState.gender][myState.lookIndex];

    socket.emit('join_game', {
        name: myState.name,
        gender: myState.gender,
        look: finalLook
    });

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    // Показываем баланс сразу
    document.getElementById('money-display').innerText = myState.money;

    setInterval(sendState, 100);
}

// --- ДВИЖЕНИЕ ---
let moveInterval = null;

function startMove(dir) {
    if (myState.isSitting) return;
    myState.direction = dir;
    if (moveInterval) clearInterval(moveInterval);
    moveInterval = setInterval(() => {
        if (dir === 'left' && myState.x > 5) myState.x -= 1;
        if (dir === 'right' && myState.x < 95) myState.x += 1;
    }, 20);
}

function stopMove() { clearInterval(moveInterval); }

function toggleSit() {
    const nearTable = myState.x > 30 && myState.x < 70;
    if (myState.isSitting) {
        myState.isSitting = false;
        document.getElementById('sit-btn').innerText = "🪑 Сесть";
    } else {
        if (nearTable) {
            myState.isSitting = true;
            if (myState.x < 50) { myState.x = 35; myState.direction = 'right'; }
            else { myState.x = 65; myState.direction = 'left'; }
            document.getElementById('sit-btn').innerText = "🏃 Встать";
        } else {
            alert("Подойди к столу!");
        }
    }
    sendState();
}

function sendState() {
    socket.emit('state_update', {
        x: myState.x, isSitting: myState.isSitting, direction: myState.direction
    });
}

// Управление клавиатурой
document.addEventListener('keydown', (e) => {
    if(myState.isSitting) return;
    if(e.key === 'ArrowLeft' || e.key === 'a') startMove('left');
    if(e.key === 'ArrowRight' || e.key === 'd') startMove('right');
});
document.addEventListener('keyup', stopMove);

// --- ОТРИСОВКА ИГРОКОВ ---
socket.on('update_players', (players) => {
    players.forEach(p => {
        let el = document.getElementById('player-' + p.id);
        if (!el) {
            el = document.createElement('div');
            el.id = 'player-' + p.id;
            el.className = 'player-char';
            el.innerHTML = `<div class="nickname">${p.name}</div><img class="player-img" src="assets/${p.look}">`;
            document.getElementById('game-world').appendChild(el);
        }
        el.style.left = p.x + '%';
        
        if (p.isSitting) el.classList.add('sitting');
        else el.classList.remove('sitting');

        if (p.direction === 'left') el.classList.add('flip');
        else el.classList.remove('flip');
    });
});

// --- МЕНЮ И ЗАКАЗ ---
function toggleMenu() {
    document.getElementById('food-menu').classList.toggle('hidden');
}

function orderFood(name, price, imgFile) {
    // 1. ЕСЛИ Я ПАРЕНЬ - Проверяем деньги
    if (myState.gender === 'male') {
        if (myState.money < price) return alert("Брат, денег нет! Иди работай.");
    }
    // 2. ЕСЛИ Я ДЕВУШКА - Заказываем без проверки (платит парень)
    
    // Закрываем меню
    toggleMenu(); 

    // Отправляем заказ на сервер (БЕЗ списания денег локально пока что)
    socket.emit('order_food', { items: [{ img: imgFile }], price: price });
}

// ОБРАБОТКА ЗАКАЗА (СЕРВЕР ПРИСЛАЛ ОФИЦИАНТА)
socket.on('waiter_service', (data) => {
    // data = { targetId, items, price }

    // Анимация официанта
    const w = document.getElementById('waiter');
    w.classList.add('active');

    // СПИСАНИЕ ДЕНЕГ (Только у мужчин)
    if (myState.gender === 'male') {
        // Списываем, даже если это заказала девушка!
        // "Рыцарский долг"
        myState.money -= data.price;
        if (myState.money < 0) myState.money = 0; // В минус не уходим визуально
        document.getElementById('money-display').innerText = myState.money;
        
        // Можно добавить уведомление
        if (data.price > 0) {
            spawnFloatingText(`-${data.price}$`, 'red');
        }
    }

    setTimeout(() => {
        data.items.forEach(item => spawnFood(item.img));
        setTimeout(() => { w.classList.remove('active'); }, 2000);
    }, 1500);
});

function spawnFood(imgSrc) {
    const img = document.createElement('img');
    img.src = 'assets/' + imgSrc;
    img.className = 'food-item';
    img.onclick = function() {
        this.style.animation = "eatAnim 1s forwards";
        setTimeout(() => this.remove(), 1000);
    };
    document.getElementById('table-area').appendChild(img);
}

function spawnFloatingText(text, color) {
    // Простая всплывашка при трате денег
    const el = document.createElement('div');
    el.innerText = text;
    el.style.position = 'absolute';
    el.style.top = '10%';
    el.style.left = '50%';
    el.style.color = color;
    el.style.fontSize = '24px';
    el.style.fontWeight = 'bold';
    el.style.transition = 'top 1s, opacity 1s';
    el.style.zIndex = 100;
    document.body.appendChild(el);
    setTimeout(() => { el.style.top = '5%'; el.style.opacity = 0; }, 50);
    setTimeout(() => el.remove(), 1000);
}

// --- СЧЕТ ---
function askBill() {
    if (myState.gender === 'male') {
        alert(`Официант косится на вас...\nВаш остаток: ${myState.money}$`);
    } else {
        alert("Вы красиво улыбаетесь. Платить будет он.");
    }
}

// --- РАБОТА ---
let workInterval = null;
function toggleWork() {
    const overlay = document.getElementById('work-overlay');
    if (overlay.classList.contains('hidden')) {
        overlay.classList.remove('hidden');
        workInterval = setInterval(spawnHeart, 700);
    } else {
        overlay.classList.add('hidden');
        clearInterval(workInterval);
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

// --- ЧАТ ---
function sendMessage() {
    const inp = document.getElementById('chat-input');
    if (inp.value.trim()) {
        socket.emit('chat_message', inp.value.trim());
        inp.value = '';
    }
}
socket.on('chat_message', (data) => {
    const div = document.getElementById('chat-messages');
    div.innerHTML += `<div><b>${data.user}:</b> ${data.text}</div>`;
    div.scrollTop = div.scrollHeight;
});
