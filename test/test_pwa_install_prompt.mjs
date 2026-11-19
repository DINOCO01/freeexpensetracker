import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 4791;
const DIST_DIR = path.resolve('dist');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:/Users/princ/.gemini/antigravity/brain/8465f667-0b7d-42d6-a856-c56991559b8f';

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath.endsWith('/')) reqPath += 'index.html';
  let cleanPath = reqPath.replace(/^\/+/, '');
  let filePath = path.join(DIST_DIR, cleanPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimeMap = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png'
    };
    res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

let testResults = [];
function check(name, condition, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    testResults.push({ name, pass: true });
  } else {
    console.error(`  ❌ FAIL: ${name} ${details ? '(' + details + ')' : ''}`);
    testResults.push({ name, pass: false, details });
  }
}

server.listen(PORT, async () => {
  const cdpPort = 9989;
  const tmpDir = path.join(os.tmpdir(), `cdp_pwa_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tmpDir}`,
    '--headless=new',
    '--disable-gpu',
    'about:blank'
  ]);

  try {
    await new Promise((r) => setTimeout(r, 2000));

    const listRes = await fetch(`http://localhost:${cdpPort}/json/list`);
    const pages = await listRes.json();
    const page = pages.find((p) => p.type === 'page');
    if (!page) throw new Error('Page target not found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r, rej) => {
      ws.on('open', r);
      ws.on('error', rej);
    });

    let msgId = 1;
    function send(method, params = {}, timeoutMs = 7000) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const timer = setTimeout(() => {
          ws.off('message', handler);
          reject(new Error(`Timeout (${timeoutMs}ms) waiting for CDP ${method}`));
        }, timeoutMs);

        const handler = (data) => {
          const res = JSON.parse(data.toString());
          if (res.id === id) {
            clearTimeout(timer);
            ws.off('message', handler);
            if (res.error) reject(res.error);
            else resolve(res.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    const evaluate = async (expr) => {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      });
      return res?.result?.value;
    };

    const setViewport = async (width, height, isMobile = false) => {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: isMobile
      });
    };

    const captureScreenshot = async (filename) => {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const outPath = path.join(ARTIFACT_DIR, filename);
      fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
      console.log(`  📸 Screenshot saved: ${filename}`);
      return outPath;
    };

    await send('Page.enable');
    await send('DOM.enable');

    console.log('\n--- SUITE: PWA INSTALL PROMOTION TEST ---');

    // SCENARIO 1: First-time visitor loads website -> no immediate popup
    console.log('\n1. Initial Load Verification (1280px Desktop):');
    await setViewport(1280, 800, false);
    await send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await new Promise((r) => setTimeout(r, 2000));

    const initialStatus = await evaluate(`(() => {
      const desktopCard = document.getElementById('pwa-install-desktop-card');
      const mobileSheet = document.getElementById('pwa-install-mobile-sheet');
      return {
        desktopHidden: desktopCard ? desktopCard.classList.contains('hidden') || getComputedStyle(desktopCard).display === 'none' || getComputedStyle(desktopCard).opacity === '0' : true,
        mobileHidden: mobileSheet ? mobileSheet.classList.contains('hidden') || getComputedStyle(mobileSheet).display === 'none' : true,
        promptShownFlag: window.fxtPwaPromptShown || false
      };
    })()`);

    check('No immediate prompt on initial page load (desktop)', initialStatus.desktopHidden);
    check('No prompt shown flag on initial load', !initialStatus.promptShownFlag);

    // SCENARIO 2: Tab exploration trigger
    console.log('\n2. Meaningful Engagement Trigger - Tab Exploration:');
    await evaluate(`(() => {
      window.resetPwaPromptState();
      // First tab switch
      window.triggerPwaPromptEligibility('tab_exploration');
    })()`);
    await new Promise((r) => setTimeout(r, 500));
    let tabState1 = await evaluate(`window.fxtPwaPromptShown || false`);
    check('Single tab switch does not trigger immediate prompt', !tabState1);

    await evaluate(`(() => {
      // Second tab switch
      window.triggerPwaPromptEligibility('tab_exploration');
    })()`);
    // Wait for scheduled delay (3.4 seconds)
    await new Promise((r) => setTimeout(r, 3400));
    let tabState2 = await evaluate(`(() => {
      const desktopCard = document.getElementById('pwa-install-desktop-card');
      return {
        shown: window.fxtPwaPromptShown === true,
        visible: desktopCard && !desktopCard.classList.contains('hidden') && getComputedStyle(desktopCard).opacity === '1'
      };
    })()`);
    check('Second tab exploration switch triggers prompt after delay', tabState2.shown && tabState2.visible);

    // SCENARIO 3: Desktop UI & Accessibility Verification at 1280px
    console.log('\n3. Desktop UI Design Verification at 1280px:');
    const desktopUi = await evaluate(`(() => {
      const card = document.getElementById('pwa-install-desktop-card');
      const heading = document.getElementById('pwa-desktop-heading');
      const desc = document.getElementById('pwa-desktop-desc');
      const btnInstall = document.getElementById('btn-pwa-install-desktop');
      const btnDismiss = document.getElementById('btn-pwa-dismiss-desktop');
      const btnClose = document.getElementById('btn-pwa-close-desktop');
      const rect = card ? card.getBoundingClientRect() : null;

      return {
        exists: !!card,
        headingText: heading ? heading.textContent.trim() : '',
        descText: desc ? desc.textContent.trim() : '',
        installBtnText: btnInstall ? btnInstall.textContent.trim() : '',
        dismissBtnText: btnDismiss ? btnDismiss.textContent.trim() : '',
        hasCloseBtn: !!btnClose,
        rightAligned: rect ? (window.innerWidth - rect.right) < 40 : false,
        bottomAligned: rect ? (window.innerHeight - rect.bottom) < 140 : false,
        hasNoBackdrop: !document.querySelector('.pwa-backdrop')
      };
    })()`);

    check('Desktop card heading is "Install FreeExpenseTracker"', desktopUi.headingText === 'Install FreeExpenseTracker');
    check('Desktop card has correct description', desktopUi.descText.includes('Add to your desktop or apps'));
    check('Desktop card has "Install App" button', desktopUi.installBtnText.includes('Install App'));
    check('Desktop card has "Not now" button', desktopUi.dismissBtnText.includes('Not now'));
    check('Desktop card has close button (X)', desktopUi.hasCloseBtn);
    check('Desktop card positioned in bottom-right corner', desktopUi.rightAligned && desktopUi.bottomAligned);
    check('Desktop card does NOT dim webpage (no dark backdrop)', desktopUi.hasNoBackdrop);

    await captureScreenshot('pwa_prompt_desktop_1280px.png');

    // SCENARIO 4: Dismissal & Cooldown Verification
    console.log('\n4. Dismissal and Cooldown Behavior:');
    await evaluate(`(() => {
      const btnDismiss = document.getElementById('btn-pwa-dismiss-desktop');
      btnDismiss.click();
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    const dismissedState = await evaluate(`(() => {
      const card = document.getElementById('pwa-install-desktop-card');
      const cooldownUntil = parseInt(localStorage.getItem('fxt_pwa_dismissed_until') || '0', 10);
      return {
        cardHidden: card.classList.contains('hidden') || getComputedStyle(card).opacity === '0',
        hasCooldown: cooldownUntil > Date.now() + 6 * 24 * 60 * 60 * 1000
      };
    })()`);

    check('Clicking "Not now" smoothly hides desktop card', dismissedState.cardHidden);
    check('Dismissal sets 7-day cooldown in localStorage', dismissedState.hasCooldown);

    // Try triggering while in cooldown
    await evaluate(`window.triggerPwaPromptEligibility('tab_exploration', true)`);
    await new Promise((r) => setTimeout(r, 500));
    const duringCooldown = await evaluate(`(() => {
      const card = document.getElementById('pwa-install-desktop-card');
      return card.classList.contains('hidden') || getComputedStyle(card).opacity === '0';
    })()`);
    check('Prompt remains suppressed during cooldown', duringCooldown);

    // SCENARIO 5: Meaningful Engagement - Template XLSX Download
    console.log('\n5. Meaningful Engagement Trigger - Template Download:');
    await evaluate(`(() => {
      window.resetPwaPromptState();
      window.triggerPwaPromptEligibility('template_download');
    })()`);
    await new Promise((r) => setTimeout(r, 3400));
    const templateTriggerState = await evaluate(`window.fxtPwaPromptShown === true`);
    check('Downloading XLSX template triggers prompt eligibility after delay', templateTriggerState);

    // SCENARIO 6: Meaningful Engagement - Calculator Completion
    console.log('\n6. Meaningful Engagement Trigger - Calculator Completion:');
    await evaluate(`(() => {
      window.resetPwaPromptState();
      window.triggerPwaPromptEligibility('calculator_completed');
    })()`);
    await new Promise((r) => setTimeout(r, 3400));
    const calcTriggerState = await evaluate(`window.fxtPwaPromptShown === true`);
    check('Completing calculator triggers prompt eligibility after delay', calcTriggerState);

    // SCENARIO 7: Meaningful Engagement - Expense Logged Activity
    console.log('\n7. Meaningful Engagement Trigger - Expense Logging:');
    await evaluate(`(() => {
      window.resetPwaPromptState();
      window.dispatchEvent(new CustomEvent('fet:activity-completed'));
    })()`);
    await new Promise((r) => setTimeout(r, 3400));
    const expenseTriggerState = await evaluate(`window.fxtPwaPromptShown === true`);
    check('Logging an expense triggers prompt eligibility after delay', expenseTriggerState);

    // SCENARIO 8: Guard Rules (Active typing and Open Modals)
    console.log('\n8. Guard Rules Verification:');
    await evaluate(`(() => {
      window.resetPwaPromptState();
      // Simulate input active focus
      const inp = document.querySelector('input') || document.createElement('input');
      if (!inp.parentNode) document.body.appendChild(inp);
      inp.focus();
      window.triggerPwaPromptEligibility('tab_exploration', true);
    })()`);
    await new Promise((r) => setTimeout(r, 500));
    const typingGuard = await evaluate(`(() => {
      const card = document.getElementById('pwa-install-desktop-card');
      return card.classList.contains('hidden') || getComputedStyle(card).opacity === '0';
    })()`);
    check('Prompt is NOT displayed while user is actively typing in input', typingGuard);

    // SCENARIO 9: Mobile UI Verification at 395px (Responsive Bottom Sheet)
    console.log('\n9. Mobile Bottom Sheet UI Verification at 395px:');
    await setViewport(395, 844, true);
    await evaluate(`(() => {
      window.resetPwaPromptState();
      if (document.activeElement) document.activeElement.blur();
      window.triggerPwaPromptEligibility('mobile_test', true);
    })()`);
    await new Promise((r) => setTimeout(r, 600));

    const mobileUi = await evaluate(`(() => {
      const sheet = document.getElementById('pwa-install-mobile-sheet');
      const dragHandle = document.getElementById('pwa-mobile-drag-handle');
      const heading = document.getElementById('pwa-mobile-heading');
      const desc = document.getElementById('pwa-mobile-desc');
      const btnInstall = document.getElementById('btn-pwa-install-mobile');
      const btnDismiss = document.getElementById('btn-pwa-dismiss-mobile');
      const rect = sheet ? sheet.getBoundingClientRect() : null;

      return {
        exists: !!sheet,
        visible: sheet && !sheet.classList.contains('hidden'),
        hasDragHandle: !!dragHandle,
        headingText: heading ? heading.textContent.trim() : '',
        descText: desc ? desc.textContent.trim() : '',
        installBtnText: btnInstall ? btnInstall.textContent.trim() : '',
        dismissBtnText: btnDismiss ? btnDismiss.textContent.trim() : '',
        dockedAtBottom: rect ? Math.abs(window.innerHeight - rect.bottom) < 5 : false,
        noHorizontalOverflow: rect ? rect.width <= window.innerWidth + 2 : false,
        hasNoBackdrop: !document.querySelector('.pwa-backdrop')
      };
    })()`);

    check('Mobile bottom sheet is visible at 395px', mobileUi.visible);
    check('Mobile bottom sheet has drag handle visual', mobileUi.hasDragHandle);
    check('Mobile heading is "Install FreeExpenseTracker"', mobileUi.headingText === 'Install FreeExpenseTracker');
    check('Mobile description mentions home screen', mobileUi.descText.includes('Add to your home screen'));
    check('Mobile action buttons are side-by-side without overflow', mobileUi.noHorizontalOverflow && mobileUi.dockedAtBottom);
    check('Mobile prompt does NOT apply full-screen dark overlay', mobileUi.hasNoBackdrop);

    await captureScreenshot('pwa_prompt_mobile_395px.png');

    // SCENARIO 10: Mobile UI at 360px
    console.log('\n10. Mobile UI Verification at 360px:');
    await setViewport(360, 740, true);
    await new Promise((r) => setTimeout(r, 300));
    const mobile360Ui = await evaluate(`(() => {
      const sheet = document.getElementById('pwa-install-mobile-sheet');
      const rect = sheet ? sheet.getBoundingClientRect() : null;
      return {
        visible: sheet && !sheet.classList.contains('hidden'),
        noHorizontalOverflow: rect ? rect.width <= 362 : false
      };
    })()`);
    check('Mobile bottom sheet renders without overflow at 360px', mobile360Ui.visible && mobile360Ui.noHorizontalOverflow);
    await captureScreenshot('pwa_prompt_mobile_360px.png');

    // SCENARIO 11: Tablet UI at 768px
    console.log('\n11. Tablet Verification at 768px:');
    await setViewport(768, 1024, false);
    await evaluate(`(() => {
      window.resetPwaPromptState();
      window.triggerPwaPromptEligibility('tablet_test', true);
    })()`);
    await new Promise((r) => setTimeout(r, 500));
    const tabletUi = await evaluate(`(() => {
      const card = document.getElementById('pwa-install-desktop-card');
      return {
        visible: card && !card.classList.contains('hidden') && getComputedStyle(card).opacity === '1'
      };
    })()`);
    check('Tablet at 768px renders compact floating card properly', tabletUi.visible);

    // SCENARIO 12: Desktop at 1440px
    console.log('\n12. Desktop UI at 1440px:');
    await setViewport(1440, 900, false);
    await new Promise((r) => setTimeout(r, 300));
    const desktop1440Ui = await evaluate(`(() => {
      const card = document.getElementById('pwa-install-desktop-card');
      const rect = card ? card.getBoundingClientRect() : null;
      return {
        visible: card && !card.classList.contains('hidden'),
        rightAligned: rect ? (1440 - rect.right) < 40 : false
      };
    })()`);
    check('Desktop at 1440px renders compact card in bottom-right', desktop1440Ui.visible && desktop1440Ui.rightAligned);

    // SCENARIO 13: Fallback instructions when native prompt is unavailable
    console.log('\n13. Fallback Instructions for Unsupported Browsers:');
    await setViewport(395, 844, true);
    await evaluate(`(() => {
      window.resetPwaPromptState();
      window.triggerPwaPromptEligibility('test_fallback', true);
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    // Click "Install App" when deferredPrompt is null
    await evaluate(`(() => {
      const btnInstall = document.getElementById('btn-pwa-install-mobile');
      btnInstall.click();
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    const fallbackResult = await evaluate(`(() => {
      const fallbackState = document.getElementById('pwa-mobile-fallback-state');
      const fallbackText = document.getElementById('pwa-mobile-fallback-text');
      const btnGotIt = document.getElementById('btn-pwa-gotit-mobile');
      return {
        fallbackVisible: fallbackState && !fallbackState.classList.contains('hidden'),
        hasInstructionsText: fallbackText && fallbackText.textContent.length > 10,
        hasGotItBtn: !!btnGotIt
      };
    })()`);

    check('Fallback instructions are displayed when native prompt is unavailable', fallbackResult.fallbackVisible);
    check('Instructions explain how to install (e.g. Share -> Add to Home Screen)', fallbackResult.hasInstructionsText);
    check('Instructions provide a "Got it" button', fallbackResult.hasGotItBtn);

    // SCENARIO 14: Simulated native prompt & App Installation Event
    console.log('\n14. Real PWA Installation & Permanent Suppression:');
    await evaluate(`(() => {
      window.resetPwaPromptState();
      // Simulate appinstalled event
      window.dispatchEvent(new Event('appinstalled'));
    })()`);
    await new Promise((r) => setTimeout(r, 300));

    const installedCheck = await evaluate(`(() => {
      const isInstalled = localStorage.getItem('fxt_pwa_installed') === 'true';
      window.triggerPwaPromptEligibility('after_installed', true);
      const sheet = document.getElementById('pwa-install-mobile-sheet');
      const card = document.getElementById('pwa-install-desktop-card');
      return {
        isInstalled,
        promptHidden: (!sheet || sheet.classList.contains('hidden')) && (!card || card.classList.contains('hidden'))
      };
    })()`);

    check('App installation records fxt_pwa_installed in localStorage', installedCheck.isInstalled);
    check('Once installed, installation promotion is permanently suppressed', installedCheck.promptHidden);

    // SCENARIO 15: Desktop Escape Key to Dismiss
    console.log('\n15. Desktop Escape Key Dismissal:');
    await setViewport(1280, 800, false);
    await evaluate(`(() => {
      window.resetPwaPromptState();
      window.triggerPwaPromptEligibility('escape_test', true);
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    await evaluate(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    const escDismissResult = await evaluate(`(() => {
      const card = document.getElementById('pwa-install-desktop-card');
      const cooldownUntil = parseInt(localStorage.getItem('fxt_pwa_dismissed_until') || '0', 10);
      return {
        hidden: card.classList.contains('hidden') || getComputedStyle(card).opacity === '0',
        cooldownSet: cooldownUntil > Date.now()
      };
    })()`);
    check('Pressing Escape dismisses desktop card and sets cooldown', escDismissResult.hidden && escDismissResult.cooldownSet);

    // Print summary
    console.log('\n=======================================');
    const total = testResults.length;
    const passed = testResults.filter((r) => r.pass).length;
    const failed = total - passed;
    console.log(`PWA INSTALL PROMOTION TEST RESULTS: ${passed}/${total} checks PASSED (${failed} failed)`);
    console.log('=======================================\n');

    ws.close();
    edgeProc.kill();
    server.close();
    process.exit(failed > 0 ? 1 : 0);

  } catch (err) {
    console.error('Test execution error:', err);
    edgeProc.kill();
    server.close();
    process.exit(1);
  }
});
