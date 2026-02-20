import { io } from 'socket.io-client';

// Use environment variable for URL in production, localhost for dev
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
});
