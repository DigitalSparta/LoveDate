const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let players = {};

io.on('connection', (socket) => {
    
    // Вход
    socket.on('join_game', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name,
            gender: data.gender,
            look: data.look,
            x: 50,
            y: 0,
            isSitting: false,
            direction: 'right'
        };
        io.emit('update_players', Object.values(players));
        io.emit('chat_message', { user: 'System', text: `${data.name} присоединился!` });
    });

    // Движение
    socket.on('state_update', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].isSitting = data.isSitting;
            players[socket.id].direction = data.direction;
            io.emit('update_players', Object.values(players));
        }
    });

    // ЗАКАЗ ЕДЫ (Исправлено)
    socket.on('order_food', (order) => {
        // order = { items: [...], price: 50 }
        
        // Отправляем всем команду "Официант, неси еду!"
        // И передаем цену, чтобы у парней списались деньги
        io.emit('waiter_service', { 
            targetId: socket.id, 
            items: order.items,
            price: order.price 
        });
    });

    // Чат
    socket.on('chat_message', (msg) => {
        let name = players[socket.id] ? players[socket.id].name : 'Анон';
        io.emit('chat_message', { user: name, text: msg });
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('update_players', Object.values(players));
    });
});

const port = process.env.PORT || 3000;
http.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
