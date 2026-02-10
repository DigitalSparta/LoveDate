const socket = io();

// --- ПРЕЛОАДЕР (Загрузка картинок) ---
window.onload = function() {
    // Имитация загрузки, чтобы фон и картинки успели прогрузиться
    setTimeout(() => {
        const preloader = document.getElementById('preloader');
        preloader.style.opacity = '0';
        setTimeout(() => { preloader.style.display = 'none'; }, 500);
    }, 1500); // 1.5 секунды показываем сердечко
};

const wardrobe = {
    male: ['boy_style_1.png', 'boy_style_2.png', 'boy_style_3.png', 'boy_style_4.png', 'boy_style_5.png', 'suit1.png'],
    female: ['girl_style_1.png', 'girl_style_2.png', 'girl_style_3.png', 'girl_style_4.png', 'girl_style_5.png', 'girl_style_6.png']
};

let myState = {
    name: "Anon",
    gender: "male",
    lookIndex: 0,
    money: 100,
    x: 50,
    isSitting: false,
    direction: 'right'
};

// --- ВНЕШНОСТЬ ---
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

updatePreview(); 

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
    const nearTable = myState.x > 20 && myState.x < 80; // Расширил зону стола
    if (myState.isSitting) {
        myState.isSitting = false;
        document.getElementById('sit-btn').innerText = "🪑 Сесть";
    } else {
        if (nearTable) {
            myState.isSitting = true;
            // Сажаем жестко на стулья
            if (myState.x < 50) { 
                myState.x = 28; // Левый стул
                myState.direction = 'right'; 
            } else { 
                myState.x = 72; // Правый стул
                myState.direction = 'left'; 
            }
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

document.addEventListener('keydown', (e) => {
    if(myState.isSitting) return;
    if(e.key === 'ArrowLeft' || e.key === 'a') startMove('left');
    if(e.key === 'ArrowRight' || e.key === 'd') startMove('right');
});
document.addEventListener('keyup', stopMove);

// --- ОТРИСОВКА ИГРОКОВ ---
// Мы храним локально координаты других, чтобы знать, куда ставить еду
let otherPlayers = {}; 

socket.on('update_players', (players) => {
    players.forEach(p => {
        otherPlayers[p.id] = p; // Сохраняем инфу о игроке

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

// --- ЕДА И ЗАКАЗ ---
function toggleMenu() { document.getElementById('food-menu').classList.toggle('hidden'); }

function orderFood(name, price, imgFile) {
    if (myState.gender === 'male' && myState.money < price) return alert("Денег нет!");
    toggleMenu(); 
    // Отправляем ID заказчика, чтобы сервер знал, кто заказал
    socket.emit('order_food', { items: [{ img: imgFile }], price: price });
}

socket.on('waiter_service', (data) => {
    // data = { targetId (кто заказал), items, price }

    const w = document.getElementById('waiter');
    w.classList.add('active');

    // Списание денег
    if (myState.gender === 'male') {
        myState.money -= data.price;
        if (myState.money < 0) myState.money = 0;
        document.getElementById('money-display').innerText = myState.money;
    }

    setTimeout(() => {
        // ОПРЕДЕЛЯЕМ, КУДА СТАВИТЬ ЕДУ
        // Находим игрока, который заказал
        let targetPlayer = otherPlayers[data.targetId];
        
        // Если инфы нет (глюк), или это я сам
        if (!targetPlayer && data.targetId === socket.id) targetPlayer = myState;

        if (targetPlayer) {
            let plateId = 'plate-left'; // По умолчанию слева
            if (targetPlayer.x > 50) plateId = 'plate-right'; // Если игрок справа (>50%), еда справа

            // Ставим еду на нужную тарелку
            data.items.forEach(item => spawnFood(item.img, plateId));
        }

        setTimeout(() => { w.classList.remove('active'); }, 2000);
    }, 1500);
});

function spawnFood(imgSrc, plateId) {
    const img = document.createElement('img');
    img.src = 'assets/' + imgSrc;
    img.className = 'food-item';
    img.onclick = function() {
        this.style.animation = "eatAnim 1s forwards";
        setTimeout(() => this.remove(), 1000);
    };
    // Добавляем в конкретную тарелку
    const plate = document.getElementById(plateId);
    if(plate) plate.appendChild(img);
}

// --- ОСТАЛЬНОЕ ---
function askBill() {
    if (myState.gender === 'male') alert(`Ваш остаток: ${myState.money}$`);
    else alert("Платит мужчина.");
}

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
