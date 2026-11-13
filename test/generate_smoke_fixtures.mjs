import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const fixturesDir = path.resolve('test/fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// 1. Copy PDF statement
const sourcePdf = path.resolve('test/test_statement_7_rows.pdf');
const targetPdf = path.join(fixturesDir, 'bank_statement_1.pdf');
const targetPdf2 = path.join(fixturesDir, 'bank_statement_2.pdf');
fs.copyFileSync(sourcePdf, targetPdf);
fs.copyFileSync(path.resolve('test/user_test_statement.pdf'), targetPdf2);
console.log('PDF fixtures created.');

// 2. Generate CSV statements
const csv1 = `Date,Description,Withdrawal,Deposit,Balance
2026-10-01,Salary Payroll,,3500.00,5000.00
2026-10-02,Grocery Supermarket,85.50,,4914.50
2026-10-05,City Power Utility,120.00,,4794.50
2026-10-10,Coffee Shop,4.75,,4789.75`;

const csv2 = `Date,Description,Withdrawal,Deposit,Balance
2026-10-15,Freelance Client Inflow,,850.00,5639.75
2026-10-18,Pharmacy Rx,32.40,,5607.35
2026-10-22,Gas Station Fuel,45.00,,5562.35`;

fs.writeFileSync(path.join(fixturesDir, 'bank_statement_1.csv'), csv1, 'utf8');
fs.writeFileSync(path.join(fixturesDir, 'bank_statement_2.csv'), csv2, 'utf8');
console.log('CSV fixtures created.');

// 3. Generate XLSX statements using dynamicParsers getXLSX
const { getXLSX } = await import('../src/utils/dynamicParsers.ts');
const XLSX = await getXLSX();

const wb1 = XLSX.utils.book_new();
const ws1Data = [
  ['Date', 'Description', 'Withdrawals', 'Deposits', 'Balance'],
  ['2026-10-01', 'Direct Deposit Payroll', '', 4200.00, 5200.00],
  ['2026-10-03', 'Whole Foods Market', 142.50, '', 5057.50],
  ['2026-10-07', 'Metro Transit Card', 45.00, '', 5012.50],
  ['2026-10-12', 'Internet Service Provider', 65.00, '', 4947.50]
];
const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
XLSX.utils.book_append_sheet(wb1, ws1, 'Account Statement');
XLSX.writeFile(wb1, path.join(fixturesDir, 'bank_statement_1.xlsx'));

const wb2 = XLSX.utils.book_new();
const ws2Data = [
  ['Date', 'Description', 'Withdrawals', 'Deposits', 'Balance'],
  ['2026-10-15', 'Client Consulting Fee', '', 1500.00, 6447.50],
  ['2026-10-19', 'Home Depot Hardware', 88.25, '', 6359.25],
  ['2026-10-25', 'Restaurant Dinner', 62.00, '', 6297.25]
];
const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
XLSX.utils.book_append_sheet(wb2, ws2, 'Account Statement');
XLSX.writeFile(wb2, path.join(fixturesDir, 'bank_statement_2.xlsx'));
console.log('XLSX fixtures created.');

// 4. Generate PNG Receipts using headless Chromium canvas
const edgePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];
const browserPath = edgePaths.find((p) => fs.existsSync(p));

const cdpPort = 9245;
const proc = spawn(browserPath, [
  `--remote-debugging-port=${cdpPort}`,
  '--headless=new',
  '--disable-gpu',
  'about:blank'
]);

for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try {
    const resp = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
    if (resp.ok) break;
  } catch {}
}

const listResp = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
const listData = await listResp.json();
const tab = listData[0];

const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));

let msgId = 1;
const send = (method, params = {}) => {
  return new Promise((resolve) => {
    const id = msgId++;
    const handler = (evt) => {
      const msg = JSON.parse(evt.data.toString());
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        resolve(msg);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
};

await send('Page.enable');

async function renderReceiptToPng(merchant, date, items, totalPaid, filename) {
  const expr = `
    (() => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 350;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 350);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('${merchant}', 30, 45);

      ctx.font = '14px monospace';
      ctx.fillText('Date: ${date}', 30, 80);
      ctx.fillText('--------------------------------', 30, 105);

      let y = 135;
      ${JSON.stringify(items)}.forEach(([item, price]) => {
        ctx.fillText(item.padEnd(20, ' ') + ' $' + price.toFixed(2), 30, y);
        y += 30;
      });

      ctx.fillText('--------------------------------', 30, y);
      y += 35;
      ctx.font = 'bold 16px monospace';
      ctx.fillText('Total Paid: $' + Number(${totalPaid}).toFixed(2), 30, y);

      return canvas.toDataURL('image/png').split(',')[1];
    })()
  `;
  const res = await send('Runtime.evaluate', { expression: expr });
  const b64 = res.result?.result?.value;
  fs.writeFileSync(path.join(fixturesDir, filename), Buffer.from(b64, 'base64'));
}

await renderReceiptToPng('STARBUCKS COFFEE', '2026-10-15', [['Caffe Latte', 4.75], ['Blueberry Muffin', 3.50]], 8.25, 'receipt_1_starbucks.png');
await renderReceiptToPng('TARGET STORES', '2026-10-18', [['Household Supplies', 18.20], ['Snack Pack', 6.30]], 24.50, 'receipt_2_target.png');
console.log('PNG receipt fixtures created.');

ws.close();
proc.kill();
console.log('All smoke test fixtures ready in test/fixtures/');

