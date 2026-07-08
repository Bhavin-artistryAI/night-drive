const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;
const rootDir = __dirname;
const MESH_API_KEY = process.env.MESH_API_KEY || 'rsk_01KX02VF3BV88S6QH6W6HWRZ3F';

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/coach') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const meshResponse = await fetch('https://api.meshapi.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${MESH_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: payload.model || 'ai21/jamba-1-5-large-v1',
            messages: payload.messages || [],
            max_tokens: payload.max_tokens || 60,
          }),
        });

        const data = await meshResponse.json();
        sendJson(res, meshResponse.status, data);
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
    });
    return;
  }

  const normalizedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.join(rootDir, normalizedPath);
  if (filePath.startsWith(rootDir)) {
    serveStaticFile(res, filePath);
  } else {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});
