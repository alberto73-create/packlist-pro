import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, process.argv[2] || 'artifacts/packlist-home.png');
const browserCandidates = [
    process.env.CHROME_PATH,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser'
].filter(Boolean);

function findBrowser() {
    for (const candidate of browserCandidates) {
        const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
        if (result.status === 0) return candidate;
    }
    throw new Error('Chrome/Chromium non trovato. Imposta CHROME_PATH o installa Google Chrome/Chromium.');
}

const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

const browser = findBrowser();

const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = normalize(join(root, relativePath));

    if (!filePath.startsWith(`${root}/`) || !existsSync(filePath) || !statSync(filePath).isFile()) {
        response.writeHead(404).end('Not found');
        return;
    }

    response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
});

await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
});

const { port } = server.address();
mkdirSync(resolve(output, '..'), { recursive: true });
const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=3000',
    '--window-size=1440,1200',
    `--screenshot=${output}`,
    `http://127.0.0.1:${port}/`
];
const child = spawn(browser, args, { stdio: 'inherit' });
const exitCode = await new Promise(resolveExit => child.once('exit', resolveExit));
server.close();

if (exitCode !== 0 || !existsSync(output) || statSync(output).size === 0) {
    throw new Error(`Acquisizione screenshot fallita (exit code: ${exitCode}).`);
}

console.log(`Screenshot salvato in ${output}`);
