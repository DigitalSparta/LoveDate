const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// Хранилище игроков: { socketId: { x, y, name, look, ... } }
let players = {};

io.on('connection', (socket) => {
    
    // Вход в игру
    socket.on('join_game', (data) => {
        // Создаем профиль игрока на сервере
        players[socket.id] = {
            id: socket.id,
            name: data.name,
            gender: data.gender,
            look: data.look, // Имя файла картинки (boy_style_1.png)
            x: 50,           // Центр экрана
            y: 0,
            isSitting: false,
            direction: 'right'
        };

        // Отправляем всем обновленный список
        io.emit('update_players', Object.values(players));
        io.emit('chat_message', { user: 'System', text: `${data.name} в здании! 👋` });
    });

    // Движение и действия
    socket.on('state_update', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].isSitting = data.isSitting;
            players[socket.id].direction = data.direction;
            // Рассылаем всем новые координаты
            io.emit('update_players', Object.values(players));
        }
    });

    // Заказ еды (Официант)
    socket.on('order_food', (order) => {
        // Рассылаем всем анимацию официанта
        io.emit('waiter_service', { 
            targetId: socket.id, 
            items: order.items 
        });
    });

    // Чат
    socket.on('chat_message', (msg) => {
        let name = players[socket.id] ? players[socket.id].name : 'Анон';
        io.emit('chat_message', { user: name, text: msg });
    });

    // Отключение
    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('update_players', Object.values(players));
    });
});

const port = process.env.PORT || 3000;
http.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
