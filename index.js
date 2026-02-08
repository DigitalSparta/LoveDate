const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// Хранилище игроков
let players = [];

io.on('connection', (socket) => {
    socket.on('join_game', (data) => {
        // data = { name: "Abylay", look: {...} }
        socket.userData = data; 
        players.push(data);

        // Сообщаем всем о новом игроке
        io.emit('player_joined', data);

        // Отправляем новому игроку список тех, кто УЖЕ здесь
        players.forEach(p => {
            if(p.name !== data.name) {
                socket.emit('player_joined', p);
            }
        });
    });

    socket.on('chat_message', (msg) => {
        // Если пришел текст (старый вариант) или объект
        let text = typeof msg === 'string' ? msg : msg.text;
        let user = socket.userData ? socket.userData.name : 'Anon';
        io.emit('chat_message', { user: user, text: text });
    });

    // Очистка при выходе (простая версия)
    socket.on('disconnect', () => {
         players = players.filter(p => p !== socket.userData);
    });
});

const port = process.env.PORT || 3000;
http.listen(port, () => {
    console.log('Server running on port ' + port);
});
