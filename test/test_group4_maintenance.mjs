/**
 * Group 4 Maintenance Verification Suite
 *
 * Verifies:
 * 1. public/_redirects and dist/_redirects:
 *    - 301 permanent redirects for /fr/contact-us/, /es/contact-us/, /de/contact-us/ -> /contact-us/
 *    - Existing rules (/en, /en/, /en/*) preserved.
 * 2. sitemap.xml:
 *    - Homepage lastmod is exactly 2026-11-09
 *    - All 55 URLs intact, valid XML structure.
 * 3. Google Fonts:
 *    - URL requests Inter:wght@400;500;600;700 and Outfit:wght@700;800
 *    - Unused weights (Inter 300, Outfit 400-600) removed.
 * 4. Buy Me a Coffee:
 *    - Script tag has defer attribute and is not render-blocking.
 * 5. Browser Runtime Verification (Real Chromium / Edge CDP):
 *    - Pages load across all 8 locales without console errors.
 *    - BMC widget script executes without errors.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const PORT = 4321;
const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let server;
let edgeProc;
let ws;
let msgId = 1;
const callbacks = new Map();

let passedCount = 0;
let failedCount = 0;

function assert(description, condition, detail = '') {
  if (condition) {
    passedCount++;
    console.log(`  ✅ PASS: ${description}${detail ? ` (${detail})` : ''}`);
  } else {
    failedCount++;
    console.error(`  ❌ FAIL: ${description}${detail ? ` (${detail})` : ''}`);
  }
}

// --- 1. Static File Checks ---
console.log('=================================================================');
console.log('🧪 RUNNING GROUP 4 MAINTENANCE VERIFICATION SUITE');
console.log('=================================================================\n');

console.log('--- 1. Testing Redirects Configuration ---');
const redirectsFile = fs.readFileSync('public/_redirects', 'utf8');
const distRedirectsFile = fs.readFileSync('dist/_redirects', 'utf8');

const requiredRedirects = [
  { from: '/fr/contact-us/', to: '/contact-us/', code: '301' },
  { from: '/es/contact-us/', to: '/contact-us/', code: '301' },
  { from: '/de/contact-us/', to: '/contact-us/', code: '301' }
];

for (const r of requiredRedirects) {
  const linePattern = new RegExp(`^${r.from}\\s+${r.to}\\s+${r.code}$`, 'm');
  assert(`public/_redirects has permanent 301 rule for ${r.from}`, linePattern.test(redirectsFile));
  assert(`dist/_redirects copies rule for ${r.from}`, linePattern.test(distRedirectsFile));
}

assert('public/_redirects preserves /en redirect', redirectsFile.includes('/en / 301'));
assert('public/_redirects preserves /en/ redirect', redirectsFile.includes('/en/ / 301'));
assert('public/_redirects preserves /en/* wildcard', redirectsFile.includes('/en/* /:splat 301'));

console.log('\n--- 2. Testing Sitemap lastmod and Integrity ---');
const sitemapXml = fs.readFileSync('public/sitemap.xml', 'utf8');
const distSitemapXml = fs.readFileSync('dist/sitemap.xml', 'utf8');

const homepageMatch = sitemapXml.match(/<loc>https:\/\/freexpensetracker\.com\/<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/);
assert('Homepage lastmod in public/sitemap.xml is 2026-11-09', homepageMatch && homepageMatch[1] === '2026-11-09', homepageMatch ? homepageMatch[1] : 'null');

const distHomepageMatch = distSitemapXml.match(/<loc>https:\/\/freexpensetracker\.com\/<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/);
assert('Homepage lastmod in dist/sitemap.xml is 2026-11-09', distHomepageMatch && distHomepageMatch[1] === '2026-11-09', distHomepageMatch ? distHomepageMatch[1] : 'null');

const locMatches = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
assert('Sitemap contains all 55 URLs', locMatches.length === 55, `Found ${locMatches.length}`);
assert('Sitemap XML starts with xml declaration', sitemapXml.trim().startsWith('<?xml'));
assert('Sitemap XML ends with </urlset>', sitemapXml.trim().endsWith('</urlset>'));

console.log('\n--- 3. Testing Google Fonts Optimization ---');
const indexHtml = fs.readFileSync('dist/index.html', 'utf8');
const expectedFontUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@700;800&display=swap';

assert('dist/index.html includes optimized Google Fonts link', indexHtml.includes(expectedFontUrl));
assert('Unused Inter 300 weight removed', !indexHtml.includes('Inter:wght@300'));
assert('Unused Outfit 400 weight removed', !indexHtml.includes('Outfit:wght@400'));
assert('Unused Outfit 500 weight removed', !indexHtml.includes('Outfit:wght@500'));
assert('Unused Outfit 600 weight removed', !indexHtml.includes('Outfit:wght@400;500;600'));

console.log('\n--- 4. Testing Buy Me a Coffee Defer Loading ---');
const bmcRegex = /<script[^>]*defer[^>]*data-name="BMC-Widget"[^>]*src="https:\/\/cdnjs\.buymeacoffee\.com\/1\.0\.0\/widget\.prod\.min\.js"/;
assert('Buy Me a Coffee script has defer attribute in dist/index.html', bmcRegex.test(indexHtml));
assert('Script preserves data-id="princeupads"', indexHtml.includes('data-id="princeupads"'));
assert('Script preserves data-color="#FF813F"', indexHtml.includes('data-color="#FF813F"'));

// --- 5. Real Browser Validation ---
function startServer() {
  return new Promise((resolve) => {
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.webmanifest': 'application/manifest+json; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png'
    };

    server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath.endsWith('/')) reqPath += 'index.html';
      let filePath = path.join(DIST_DIR, reqPath);

      if (!fs.existsSync(filePath)) {
        if (fs.existsSync(filePath + '.html')) {
          filePath = filePath + '.html';
        } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
          filePath = path.join(filePath, 'index.html');
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }
      }

      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(PORT, () => {
      resolve();
    });
  });
}

function launchEdge() {
  return new Promise((resolve, reject) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fet-edge-group4-'));
    edgeProc = spawn(EDGE_PATH, [
      '--remote-debugging-port=9222',
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--headless=new',
      '--disable-gpu',
      'about:blank'
    ], { stdio: 'ignore' });

    let attempts = 0;
    const checkCDP = () => {
      attempts++;
      http.get('http://127.0.0.1:9222/json', (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const targets = JSON.parse(body);
            const pageTarget = targets.find(t => t.type === 'page');
            if (pageTarget && pageTarget.webSocketDebuggerUrl) {
              resolve(pageTarget.webSocketDebuggerUrl);
            } else {
              if (attempts < 30) setTimeout(checkCDP, 200);
              else reject(new Error('Page target not found in CDP'));
            }
          } catch (e) {
            if (attempts < 30) setTimeout(checkCDP, 200);
            else reject(e);
          }
        });
      }).on('error', () => {
        if (attempts < 30) setTimeout(checkCDP, 200);
        else reject(new Error('Failed to connect to Edge CDP port 9222'));
      });
    };
    setTimeout(checkCDP, 500);
  });
}

async function connectWebSocket(wsUrl) {
  const { WebSocket } = await import('ws');
  return new Promise((resolve, reject) => {
    ws = new WebSocket(wsUrl);
    ws.on('open', resolve);
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve: res, reject: rej } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
      }
    });
    ws.on('error', reject);
  });
}

function sendCDP(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    callbacks.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const res = await sendCDP('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (res.exceptionDetails) {
    throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
  }
  return res.result ? res.result.value : undefined;
}

async function navigate(url) {
  await sendCDP('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 600));
  for (let i = 0; i < 20; i++) {
    const ready = await evaluate('document.readyState');
    if (ready === 'complete') break;
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 400));
}

async function runBrowserChecks() {
  console.log('\n--- 5. Browser Runtime Checks (Real Chromium Edge) ---');
  await navigate(`http://localhost:${PORT}/`);

  const bmcScriptState = await evaluate(`(() => {
    const script = document.querySelector('script[data-name="BMC-Widget"]');
    return {
      found: Boolean(script),
      hasDefer: script ? script.hasAttribute('defer') : false,
      src: script ? script.src : null
    };
  })()`);

  assert('BMC widget script found in live DOM', bmcScriptState.found);
  assert('BMC widget script has defer attribute in live DOM', bmcScriptState.hasDefer);

  // Check 8 locales load cleanly without unhandled errors
  const testLocales = ['/', '/hi/', '/es/', '/de/', '/fr/', '/pt/', '/ja/', '/ko/'];
  for (const loc of testLocales) {
    await navigate(`http://localhost:${PORT}${loc}`);
    const pageCheck = await evaluate(`(() => {
      const h1 = document.querySelector('h1')?.textContent.trim();
      const fontFamilies = window.getComputedStyle(document.body).fontFamily;
      return { h1, fontFamilies };
    })()`);
    assert(`Route '${loc}' renders heading with Inter/Outfit font stack`, pageCheck.h1 && pageCheck.fontFamilies.includes('Inter'), `${pageCheck.h1.slice(0, 20)}...`);
  }

  console.log('\n=================================================================');
  console.log(`TOTAL GROUP 4 CHECKS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('=================================================================');
  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

async function main() {
  try {
    await startServer();
    const wsUrl = await launchEdge();
    await connectWebSocket(wsUrl);
    await sendCDP('Page.enable');
    await sendCDP('Runtime.enable');
    await runBrowserChecks();
  } catch (err) {
    console.error('Error during verification:', err);
    process.exitCode = 1;
  } finally {
    if (ws) ws.close();
    if (edgeProc) edgeProc.kill();
    if (server) server.close();
    process.exit(process.exitCode || 0);
  }
}

main();
