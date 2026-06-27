const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
};

const server = http.createServer((req, res) => {
    // API Proxy routing to FastAPI backend
    if (req.url.startsWith('/api/')) {
        const options = {
            hostname: '127.0.0.1',
            port: 8000,
            path: req.url,
            method: req.method,
            headers: req.headers
        };

        const proxyReq = http.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
        });

        proxyReq.on('error', (e) => {
            console.error(`Proxy error: ${e.message}`);
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end(`Bad Gateway: FastAPI backend might not be running on port 8000.`);
        });

        req.pipe(proxyReq, { end: true });
        return;
    }

    let safeUrl = decodeURIComponent(req.url);
    let pathname = safeUrl.split('?')[0];
    let filePath = '.' + (pathname === '/' ? '/original.html' : pathname);

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`SnowPulse UI Server is running!`);
    console.log(`Open in browser: http://localhost:${PORT}/`);
    console.log(`==================================================\n`);
});
