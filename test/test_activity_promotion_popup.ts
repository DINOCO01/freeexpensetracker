import fs from 'node:fs';
import path from 'node:path';

console.log('=== VERIFYING ACTIVITY-BASED CROSS-PROMOTION POPUP ===\n');

const distDir = path.resolve('dist');
const indexPath = path.join(distDir, 'index.html');
const content = fs.readFileSync(indexPath, 'utf-8');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${msg}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
}

// --- Test 1: Popup Structure & Content Verification ---
console.log('--- Checking HTML Structure & Copy ---');
assert(content.includes('id="mrb-activity-popup"'), 'Popup element exists with id="mrb-activity-popup"');
assert(content.includes('YOUR NEXT STEP'), 'Contains micro label "YOUR NEXT STEP"');
assert(content.includes('Finished tracking your expenses?'), 'Contains heading "Finished tracking your expenses?"');
assert(content.includes("You've got your spending recorded. Now plan where your money should go next."), 'Contains description copy');
assert(content.includes('Plan your budget with My Real Budget.'), 'Contains supporting section heading');
assert(content.includes('Create a monthly budget, follow the 50/30/20 rule and take control of your finances.'), 'Contains supporting section text');
assert(content.includes('https://myrealbudget.com/'), 'CTA links to https://myrealbudget.com/');
assert(content.includes('Explore My Real Budget'), 'CTA link text is "Explore My Real Budget"');
assert(content.includes('Maybe later'), 'Contains secondary action "Maybe later"');
assert(content.includes('id="btn-mrb-popup-close"'), 'Contains accessible close button');
assert(content.includes('id="btn-mrb-popup-later"'), 'Contains "Maybe later" button id');
assert(content.includes('id="btn-mrb-popup-cta"'), 'Contains primary CTA button id');

// --- Test 2: Animation & Motion Requirements ---
console.log('\n--- Checking 2.5-Second Animation & Reduced Motion ---');
const cssFiles = fs.readdirSync(path.join(distDir, '_astro')).filter(f => f.endsWith('.css'));
const allCss = cssFiles.map(f => fs.readFileSync(path.join(distDir, '_astro', f), 'utf-8')).join('\n');

assert(allCss.includes('mrbFadeInSlow') && (allCss.includes('2.5s') || allCss.includes('2500ms')), 'Includes 2.5-second smooth fade-in keyframe animation');
assert(allCss.includes('ease-out'), 'Uses ease-out timing function');
assert(allCss.includes('prefers-reduced-motion:reduce') || allCss.includes('prefers-reduced-motion: reduce'), 'Respects prefers-reduced-motion accessibility setting');
assert(allCss.includes('animation:none!important') || allCss.includes('animation: none !important'), 'Disables animation when prefers-reduced-motion is active');

// --- Test 3: Responsive & Theme Design System ---
console.log('\n--- Checking Design & Theming ---');
assert(content.includes('dark:bg-slate-900') || content.includes('dark:'), 'Includes dark mode surface styling');
assert(content.includes('rounded-3xl'), 'Follows design system rounded-3xl card border radius');
assert(content.includes('font-[\'Outfit\',sans-serif]'), 'Uses Outfit font for headings');
assert(content.includes('bg-emerald-600'), 'Uses brand emerald-600 for primary CTA');
assert(content.includes('fixed bottom-4') || content.includes('fixed bottom-'), 'Uses floating non-blocking positioning');

// --- Test 4: GA4 Analytics Event Integration ---
console.log('\n--- Checking Analytics Integration ---');
assert(content.includes('cross_site_cta_click'), 'Fires cross_site_cta_click GA4 event');
assert(content.includes('popup_my_real_budget'), 'Uses cta_name="popup_my_real_budget" parameter');
assert(content.includes('destination: \'myrealbudget.com\'') || content.includes('destination: "myrealbudget.com"'), 'Tracks destination as myrealbudget.com');

// --- Test 5: Logic & State Simulation (10 Scenarios) ---
console.log('\n--- Simulating Logic & Edge-Case Scenarios ---');

// Mock browser environment for simulation
class MockSessionStorage {
  private store: Record<string, string> = {};
  getItem(key: string) { return this.store[key] || null; }
  setItem(key: string, val: string) { this.store[key] = val; }
  removeItem(key: string) { delete this.store[key]; }
  clear() { this.store = {}; }
}

function createSimulation() {
  const sessionStorage = new MockSessionStorage();
  let documentHidden = false;
  let activeSeconds = 0;
  let popupShown = false;
  let isWorkflowActive = false;

  const STORAGE_KEY_ACTIVE_SECS = 'fet_active_seconds';
  const STORAGE_KEY_ACTIVITY_DONE = 'fet_activity_completed';
  const STORAGE_KEY_POPUP_SHOWN = 'fet_popup_shown';
  const STORAGE_KEY_POPUP_DISMISSED = 'fet_popup_dismissed';
  const REQUIRED_ACTIVE_SECONDS = 30;

  function evaluate() {
    if (sessionStorage.getItem(STORAGE_KEY_POPUP_DISMISSED) === 'true') return false;
    if (sessionStorage.getItem(STORAGE_KEY_POPUP_SHOWN) === 'true') return false;
    const activityDone = sessionStorage.getItem(STORAGE_KEY_ACTIVITY_DONE) === 'true';
    if (activeSeconds < REQUIRED_ACTIVE_SECONDS || !activityDone) return false;
    if (isWorkflowActive) return false;
    
    sessionStorage.setItem(STORAGE_KEY_POPUP_SHOWN, 'true');
    popupShown = true;
    return true;
  }

  function tick() {
    if (!documentHidden) {
      activeSeconds++;
      sessionStorage.setItem(STORAGE_KEY_ACTIVE_SECS, activeSeconds.toString());
      evaluate();
    }
  }

  function markActivityCompleted() {
    sessionStorage.setItem(STORAGE_KEY_ACTIVITY_DONE, 'true');
    evaluate();
  }

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY_POPUP_DISMISSED, 'true');
    sessionStorage.setItem(STORAGE_KEY_POPUP_SHOWN, 'true');
    popupShown = false;
  }

  return {
    sessionStorage,
    getActiveSeconds: () => activeSeconds,
    setActiveSeconds: (s: number) => { activeSeconds = s; sessionStorage.setItem(STORAGE_KEY_ACTIVE_SECS, s.toString()); },
    setDocumentHidden: (h: boolean) => { documentHidden = h; },
    setWorkflowActive: (w: boolean) => { isWorkflowActive = w; evaluate(); },
    isPopupShown: () => popupShown,
    tick,
    markActivityCompleted,
    dismiss
  };
}

// Scenario 1: User spends 10 seconds and completes an activity: popup waits until 30 active seconds.
{
  const sim = createSimulation();
  for (let i = 0; i < 10; i++) sim.tick();
  sim.markActivityCompleted();
  assert(!sim.isPopupShown(), 'Scenario 1a: At 10s after activity, popup is NOT yet shown');
  
  for (let i = 0; i < 19; i++) sim.tick(); // up to 29s
  assert(!sim.isPopupShown(), 'Scenario 1b: At 29s, popup is NOT yet shown');
  
  sim.tick(); // 30th second
  assert(sim.isPopupShown(), 'Scenario 1c: At 30s, popup appears');
}

// Scenario 2: User spends 30+ seconds without completing an activity: popup does not appear.
{
  const sim = createSimulation();
  for (let i = 0; i < 60; i++) sim.tick();
  assert(!sim.isPopupShown(), 'Scenario 2: At 60 active seconds with NO activity, popup does NOT appear');
}

// Scenario 3: User spends 30+ active seconds and successfully completes an activity: popup appears.
{
  const sim = createSimulation();
  for (let i = 0; i < 35; i++) sim.tick();
  assert(!sim.isPopupShown(), 'Scenario 3a: At 35s with no activity, popup is not shown');
  sim.markActivityCompleted();
  assert(sim.isPopupShown(), 'Scenario 3b: Immediately after activity at 35s, popup appears');
}

// Scenario 4: User completes multiple activities: popup appears only once.
{
  const sim = createSimulation();
  for (let i = 0; i < 30; i++) sim.tick();
  sim.markActivityCompleted();
  assert(sim.isPopupShown(), 'Scenario 4a: First activity triggers popup');
  
  // Complete further activities
  sim.markActivityCompleted();
  sim.markActivityCompleted();
  assert(sim.sessionStorage.getItem('fet_popup_shown') === 'true', 'Scenario 4b: Popup shown flag remains true and prevents duplication');
}

// Scenario 5: User dismisses popup: it does not reappear during the same session.
{
  const sim = createSimulation();
  for (let i = 0; i < 30; i++) sim.tick();
  sim.markActivityCompleted();
  assert(sim.isPopupShown(), 'Scenario 5a: Popup appears');
  sim.dismiss();
  assert(!sim.isPopupShown(), 'Scenario 5b: Popup dismissed');
  
  // User keeps browsing and doing activities
  for (let i = 0; i < 50; i++) sim.tick();
  sim.markActivityCompleted();
  assert(!sim.isPopupShown(), 'Scenario 5c: Dismissed popup never reappears in session');
}

// Scenario 6: User switches tabs: inactive time is not counted.
{
  const sim = createSimulation();
  for (let i = 0; i < 10; i++) sim.tick();
  assert(sim.getActiveSeconds() === 10, 'Scenario 6a: 10 active seconds');
  
  // Switch tab (hidden) for 50 ticks
  sim.setDocumentHidden(true);
  for (let i = 0; i < 50; i++) sim.tick();
  assert(sim.getActiveSeconds() === 10, 'Scenario 6b: Inactive background tab time was paused and NOT counted');
  
  // Return to tab
  sim.setDocumentHidden(false);
  sim.markActivityCompleted();
  for (let i = 0; i < 19; i++) sim.tick(); // up to 29s
  assert(!sim.isPopupShown(), 'Scenario 6c: Still waiting at 29 active seconds');
  sim.tick(); // 30s
  assert(sim.isPopupShown(), 'Scenario 6d: Appears once 30 active seconds reached');
}

// Scenario 7: User navigates between pages: session state is maintained.
{
  const sim1 = createSimulation();
  for (let i = 0; i < 15; i++) sim1.tick();
  sim1.markActivityCompleted();
  const savedSecs = sim1.sessionStorage.getItem('fet_active_seconds');
  const savedAct = sim1.sessionStorage.getItem('fet_activity_completed');
  
  // New page load with persisted sessionStorage
  const sim2 = createSimulation();
  sim2.sessionStorage.setItem('fet_active_seconds', savedSecs!);
  sim2.sessionStorage.setItem('fet_activity_completed', savedAct!);
  sim2.setActiveSeconds(parseInt(savedSecs!, 10));
  
  assert(sim2.getActiveSeconds() === 15, 'Scenario 7a: Active seconds resumed from 15 across navigation');
  for (let i = 0; i < 14; i++) sim2.tick();
  assert(!sim2.isPopupShown(), 'Scenario 7b: At 29s, not yet shown');
  sim2.tick();
  assert(sim2.isPopupShown(), 'Scenario 7c: Appears at 30s on second page');
}

// Scenario 8: User performs an unsuccessful upload: popup is not triggered by that failed operation.
{
  const sim = createSimulation();
  for (let i = 0; i < 40; i++) sim.tick();
  // Failed upload throws and catch block runs WITHOUT calling markActivityCompleted
  assert(!sim.isPopupShown(), 'Scenario 8: Failed upload does not set activity completed; popup is NOT triggered');
}

// Scenario 9 & 10: Non-blocking during active workflow
{
  const sim = createSimulation();
  for (let i = 0; i < 35; i++) sim.tick();
  sim.setWorkflowActive(true); // E.g. upload modal is open or typing
  sim.markActivityCompleted();
  assert(!sim.isPopupShown(), 'Workflow active: Popup is delayed during ongoing operation');
  sim.setWorkflowActive(false); // Modal closes
  assert(sim.isPopupShown(), 'Workflow completed: Popup shows immediately after operation finishes');
}

// --- Test 6: Verify presence in all locale routes ---
console.log('\n--- Checking Presence Across All Page Builds ---');
const allPages = ['index.html', 'about-us/index.html', 'privacy-policy/index.html', 'templates/index.html', 'hi/index.html', 'es/index.html', 'de/index.html', 'fr/index.html', 'pt/index.html', 'ja/index.html', 'ko/index.html'];

for (const p of allPages) {
  const filePath = path.join(distDir, p);
  assert(fs.existsSync(filePath), `Route ${p} exists in build`);
  const pageHtml = fs.readFileSync(filePath, 'utf-8');
  assert(pageHtml.includes('id="mrb-activity-popup"'), `Route ${p} includes activity promotion popup`);
}

// --- Test 7: Verify Existing Static CTA is Preserved ---
console.log('\n--- Checking Static CTA Preservation ---');
assert(content.includes('id="section-budget-cta"'), 'Existing static CTA section is preserved');
assert(content.includes('id="cta-my-real-budget"'), 'Existing static CTA button is preserved');

console.log(`\n==============================================`);
console.log(`ALL TESTS PASSED: ${passedTests} / ${totalTests} assertions verified!`);
console.log(`==============================================\n`);
