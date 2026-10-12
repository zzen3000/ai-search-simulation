/**
 * Local Development Server
 * Serves static web studio assets and routes /api/gemini requests to the serverless handler.
 * Automatically loads GEMINI_API_KEY from .env file if present.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple .env parser (no external dependencies required)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
      console.log(' Loaded configuration from .env');
    } catch (e) {
      console.warn('Could not read .env file:', e.message);
    }
  }
}

loadEnv();

const geminiHandler = require('./api/gemini.js');
const PORT = process.env.PORT || 5173;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Route: /api/gemini
  if (pathname === '/api/gemini') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch (e) {
        req.body = {};
      }

      // Shim for Express/Vercel res.status().json()
      const vercelRes = {
        setHeader: (k, v) => res.setHeader(k, v),
        status: (statusCode) => {
          res.statusCode = statusCode;
          return {
            json: (data) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            },
            end: () => res.end()
          };
        }
      };

      try {
        loadEnv();
        delete require.cache[require.resolve('./api/gemini.js')];
        const handler = require('./api/gemini.js');
        await handler(req, vercelRes);
      } catch (err) {
        console.error('Server error handling /api/gemini:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n AI Search Simulation Studio server is running!`);
  console.log(` Web App:   http://localhost:${PORT}`);
  console.log(` Gemini API: http://localhost:${PORT}/api/gemini`);
  if (!process.env.GEMINI_API_KEY) {
    console.log(`  Note: GEMINI_API_KEY is not set. Add it in .env to enable AI Copilot features.`);
  } else {
    console.log(` Gemini API Key detected and active.\n`);
  }
});

module.exports = server;
