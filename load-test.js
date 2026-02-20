const { io } = require('socket.io-client');

const URL = 'http://localhost:3001';
const CLIENT_COUNT = 50;
const ROOM_ID = 'load-test-room';

const clients = [];

console.log(`Starting load test with ${CLIENT_COUNT} clients...`);

for (let i = 0; i < CLIENT_COUNT; i++) {
    const socket = io(URL);

    socket.on('connect', () => {
        // console.log(`Client ${i} connected: ${socket.id}`);
        socket.emit('join-room', ROOM_ID);

        // Simulate activity
        setInterval(() => {
            // Random move
            socket.emit('cursor-move', {
                roomId: ROOM_ID,
                x: Math.random() * 800,
                y: Math.random() * 600,
                userColor: '#' + Math.floor(Math.random() * 16777215).toString(16)
            });
        }, 2000 + Math.random() * 1000); // Every 2-3 seconds
    });

    socket.on('disconnect', () => {
        // console.log(`Client ${i} disconnected`);
    });

    clients.push(socket);
}

console.log(`Simulated ${CLIENT_COUNT} clients connecting to room: ${ROOM_ID}`);

// Keep alive for 30 seconds then exit
setTimeout(() => {
    console.log('Load test finished. Closing connections...');
    clients.forEach(s => s.disconnect());
    process.exit(0);
}, 30000);
