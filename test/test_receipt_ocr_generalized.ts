import { extractMerchantName, inferReceiptCategory } from '../src/utils/receiptScanner';

interface TestCase {
  name: string;
  lines: string[];
  expectedMerchant: string;
  expectedCategory: string;
  forbiddenPrefix?: string;
  isIncome?: boolean;
}

const testCases: TestCase[] = [
  {
    name: 'Provider Name Labeled Field - Must return ONLY value, never label',
    lines: [
      'Bill Payment Details',
      'Provider Name: Tata Power - Delhi (TP)',
      'Consumer Number: 10928374',
      'Amount Due: ₹780.00',
      'Transaction Status: Success'
    ],
    expectedMerchant: 'Tata Power - Delhi (TP)',
    expectedCategory: 'Utilities',
    forbiddenPrefix: 'Provider Name'
  },
  {
    name: 'Merchant Name Labeled Field',
    lines: [
      'Order Confirmation',
      'Merchant Name: Big Bazaar Supermarket',
      'Order ID: OD-8823',
      'Grand Total: 1,450.00'
    ],
    expectedMerchant: 'Big Bazaar Supermarket',
    expectedCategory: 'Food',
    forbiddenPrefix: 'Merchant Name'
  },
  {
    name: 'Seller Labeled Field',
    lines: [
      'Tax Invoice',
      'Seller: CloudTail India Pvt Ltd',
      'Invoice No: INV-9912',
      'Final Amount: 620.00'
    ],
    expectedMerchant: 'CloudTail India Pvt Ltd',
    expectedCategory: 'Miscellany',
    forbiddenPrefix: 'Seller'
  },
  {
    name: 'Store Labeled Field',
    lines: [
      'Receipt Slip',
      'Store: Reliance Fresh Groceries',
      'Cashier: 04',
      'Total: 340.00'
    ],
    expectedMerchant: 'Reliance Fresh Groceries',
    expectedCategory: 'Food',
    forbiddenPrefix: 'Store'
  },
  {
    name: 'Vendor Labeled Field',
    lines: [
      'Utility Bill Receipt',
      'Vendor: Metro Water Board',
      'Connection ID: W-99128',
      'Amount Payable: 450.00'
    ],
    expectedMerchant: 'Metro Water Board',
    expectedCategory: 'Utilities',
    forbiddenPrefix: 'Vendor'
  },
  {
    name: 'Biller Labeled Field',
    lines: [
      'Bill Payment Confirmation',
      'Biller: Apex Energy Ltd',
      'Consumer ID: 10928374',
      'Amount Due: ₹3,800.00'
    ],
    expectedMerchant: 'Apex Energy Ltd',
    expectedCategory: 'Utilities',
    forbiddenPrefix: 'Biller'
  },
  {
    name: 'Payee Labeled Field',
    lines: [
      'Payment Details',
      'Payee: Dr. Sharma Dental Clinic',
      'Txn ID: TXN443322',
      'Total Amount: 500.00'
    ],
    expectedMerchant: 'Dr. Sharma Dental Clinic',
    expectedCategory: 'Miscellany',
    forbiddenPrefix: 'Payee'
  },
  {
    name: 'Supplier Labeled Field',
    lines: [
      'Commercial Invoice',
      'Supplier: ABC Pharma Supplies',
      'PO Number: PO-1029',
      'Net Total: 2,100.00'
    ],
    expectedMerchant: 'ABC Pharma Supplies',
    expectedCategory: 'Miscellany',
    forbiddenPrefix: 'Supplier'
  },
  {
    name: 'Paid To Labeled Field',
    lines: [
      'Payment Receipt',
      'Paid To: Green Grocers Mart',
      'Payment Mode: UPI',
      'Amount: 180.00'
    ],
    expectedMerchant: 'Green Grocers Mart',
    expectedCategory: 'Food',
    forbiddenPrefix: 'Paid To'
  },
  {
    name: 'Payment Receipt with Multiline Label and Status Header',
    lines: [
      'Payment Successful',
      '04:15 PM, 24 Sep 2026',
      '₹780',
      'Paid to',
      'Tata Power - Mumbai',
      'Txn ID: T260924161599882233',
      'UTR: 426819283746',
      'Debited from: HDFC Bank'
    ],
    expectedMerchant: 'Tata Power - Mumbai',
    expectedCategory: 'Utilities',
    forbiddenPrefix: 'Paid to'
  },
  {
    name: 'Restaurant / Cafe Header Receipt',
    lines: [
      'THE BLUE BISTRO & KITCHEN',
      'Plot 45, Sector 18, Commercial Belt',
      'TAX INVOICE',
      '1x Pasta Arbiata    250.00',
      '1x Peach Ice Tea    150.00',
      'Subtotal            400.00',
      'Grand Total:        400.00'
    ],
    expectedMerchant: 'THE BLUE BISTRO & KITCHEN',
    expectedCategory: 'Food'
  },
  {
    name: 'Fuel / Gas Station Receipt',
    lines: [
      'Shell Petroleum Filling Station',
      'Highway NH-48',
      'Fuel: Power Petrol',
      'Total Amount Payable: 1,500.00'
    ],
    expectedMerchant: 'Shell Petroleum Filling Station',
    expectedCategory: 'Transport'
  },
  {
    name: 'Payment App Slip - Should Not Select Payment Platform as Merchant',
    lines: [
      'PhonePe',
      'Payment Successful',
      'Paid to: Dr. Sharma Dental Clinic',
      'Txn ID: 98127391823719',
      'UTR: 426819283746',
      'Total Amount: 500.00'
    ],
    expectedMerchant: 'Dr. Sharma Dental Clinic',
    expectedCategory: 'Miscellany'
  },
  {
    name: 'Housing Society Maintenance Receipt',
    lines: [
      'Sunrise Apartments Housing Society',
      'Society Maintenance - September 2026',
      'Flat No: A-402',
      'Total Payable: 4,500.00'
    ],
    expectedMerchant: 'Sunrise Apartments Housing Society',
    expectedCategory: 'Housing'
  },
  {
    name: 'Cinema / Entertainment Ticket Slip',
    lines: [
      'PVR Cinemas Multiplex',
      'Screen 3 - Audi 2',
      'Tickets: 2',
      'Final Total: 650.00'
    ],
    expectedMerchant: 'PVR Cinemas Multiplex',
    expectedCategory: 'Entertainment'
  },
  {
    name: 'Income Deposit Slip',
    lines: [
      'Corporate Payroll Direct Deposit',
      'Employee ID: EMP9982',
      'Net Pay: 75,000.00'
    ],
    expectedMerchant: 'Corporate Payroll Direct Deposit',
    expectedCategory: 'Income',
    isIncome: true
  }
];

function runTests() {
  console.log('--- GENERALIZED RECEIPT OCR EXTRACTION REGRESSION TESTS ---\n');
  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const rawText = tc.lines.join('\n');
    const merchant = extractMerchantName(tc.lines, rawText, !!tc.isIncome);
    const category = inferReceiptCategory(merchant, rawText, !!tc.isIncome);

    const merchantPass = merchant.toLowerCase() === tc.expectedMerchant.toLowerCase();
    const categoryPass = category === tc.expectedCategory;
    const prefixPass = tc.forbiddenPrefix
      ? !merchant.toLowerCase().startsWith(tc.forbiddenPrefix.toLowerCase())
      : true;

    if (merchantPass && categoryPass && prefixPass) {
      console.log(`[PASS] ${tc.name}`);
      console.log(`       Merchant: "${merchant}" | Category: ${category}`);
      passed++;
    } else {
      console.error(`[FAIL] ${tc.name}`);
      console.error(`       Expected Merchant: "${tc.expectedMerchant}", Got: "${merchant}"`);
      console.error(`       Expected Category: "${tc.expectedCategory}", Got: "${category}"`);
      if (!prefixPass) {
        console.error(`       Failed: Merchant contained forbidden label prefix "${tc.forbiddenPrefix}"`);
      }
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length} tests.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
