const WebSocket = require('ws');
const http = require('http');
let setupWSConnection = null;

try {
  setupWSConnection = require('y-websocket/bin/utils').setupWSConnection;
} catch (error) {
  console.warn(
    '[collaboration] y-websocket server utils are unavailable in y-websocket@3. ' +
    'Install @y/websocket-server (or pin y-websocket@1.x) to enable real-time collaboration.'
  );
}

const port = process.env.PORT || 1234;

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Teach Bound Collaboration Server');
});

const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws, req) => {
  if (!setupWSConnection) {
    ws.close(1011, 'Collaboration backend unavailable');
    return;
  }
  setupWSConnection(ws, req);
});

server.on('upgrade', (request, socket, head) => {
  if (!setupWSConnection) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    socket.destroy();
    return;
  }
  // You can perform authentication here
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

server.listen(port, () => {
  console.log(`Collaboration server running on port ${port}`);
});
