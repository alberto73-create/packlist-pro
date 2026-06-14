import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
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

function previewUrl(port) {
    const sharedState = {
        v: 1,
        c: { nights: 3, gender: 'U', transport: 'auto', weather: [], activities: [], laundry: false, laundryFreq: 3, laundryBuffer: 1 },
        l: [
            ['Abbigliamento', [['Magliette tecniche', 4, 180, 0, 0, 0, 0], ['Giacca impermeabile', 1, 650, 0, 1, 1, 0], ['Calze', 4, 60, 1, 0, 0, 0]]],
            ['Elettronica', [['Caricabatterie USB-C', 1, 120, 0, 0, 0, 0]]]
        ]
    };
    const encoded = Buffer.from(JSON.stringify(sharedState)).toString('base64url');
    return `http://127.0.0.1:${port}/?list=b.${encoded}`;
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
const profileDirectory = mkdtempSync(join(tmpdir(), 'packlist-screenshot-'));
let child;
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

try {
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
        '--disable-background-networking',
        '--hide-scrollbars',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=4000',
        '--window-size=1440,1800',
        `--user-data-dir=${profileDirectory}`,
        `--screenshot=${output}`,
        previewUrl(port)
    ];
    child = spawn(browser, args, { stdio: ['ignore', 'inherit', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    const timeout = setTimeout(() => child.kill('SIGKILL'), 30000);
    const exitCode = await new Promise(resolveExit => child.once('exit', resolveExit));
    clearTimeout(timeout);

    const relevantErrors = stderr.split('\n').filter(line => line && !/dbus|UPower|DEPRECATED_ENDPOINT/i.test(line));
    if (relevantErrors.length) console.error(relevantErrors.join('\n'));
    if (exitCode !== 0 || !existsSync(output) || statSync(output).size === 0) {
        throw new Error(`Acquisizione screenshot fallita (exit code: ${exitCode}).`);
    }

    console.log(`Screenshot salvato in ${output}`);
} finally {
    if (child && child.exitCode === null) child.kill('SIGKILL');
    await new Promise(resolveClose => server.close(resolveClose));
    // Chrome può continuare a scrivere nel profilo per qualche istante dopo
    // l'uscita del processo principale. I retry evitano ENOTEMPTY intermittenti
    // sui runner GitHub Actions senza nascondere errori persistenti.
    await rm(profileDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}
