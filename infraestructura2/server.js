const http = require('http');
const os = require('os');

const PORT = process.env.PORT || 3000;
const SERVICE_NAME = process.env.SERVICE_NAME || 'multistage-api';
const APP_VERSION = process.env.APP_VERSION || '1.0.0';

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200);
    return res.end(JSON.stringify({
      service: SERVICE_NAME,
      version: APP_VERSION,
      hostname: os.hostname(),
      uptime: `${process.uptime().toFixed(2)}s`
    }));
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
});

server.listen(PORT, () => {
  console.log(`${SERVICE_NAME} v${APP_VERSION} escuchando en puerto ${PORT}`);
});

// Apagado limpio cuando Docker detiene el contenedor
process.on('SIGTERM', () => server.close(() => process.exit(0)));