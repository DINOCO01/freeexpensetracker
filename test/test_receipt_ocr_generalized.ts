import {
  extractMerchantName,
  inferReceiptCategory,
  extractReceiptAmount,
  extractReceiptDate,
  detectTransactionType
} from '../src/utils/receiptScanner';

interface TestCase {
  name: string;
  lines: string[];
  expectedMerchant: string;
  expectedAmount: number;
  expectedDate?: string;
  expectedCategory: string;
  expectedType: 'expense' | 'income';
  forbiddenPrefix?: string;
  forbiddenMerchantSubstrings?: string[];
  forbiddenAmountValues?: number[];
  isIncome?: boolean;
}

const testCases: TestCase[] = [
  // 1. ₹291 Flipkart payment
  {
    name: 'Flipkart Payment (₹291 Expense, UPI ID & Ref Noise)',
    lines: [
      'Paytm Payments Bank',
      'Paid Successfully',
      '12:30 PM, 24 Sep 2026',
      '₹291',
      'To: Flipkart Payments',
      'UPI ID: flipkart@axl',
      'Bank Ref: 426819283746',
      'Debited from: SBI A/c No. ...7890',
      'Share receipt'
    ],
    expectedMerchant: 'Flipkart Payments',
    expectedAmount: 291,
    expectedDate: '2026-09-24',
    expectedCategory: 'Miscellany',
    expectedType: 'expense',
    forbiddenPrefix: 'To',
    forbiddenMerchantSubstrings: ['Paytm', 'Paid Successfully', 'Share receipt'],
    forbiddenAmountValues: [7, 7890, 426819283746, 2026]
  },

  // 2. ₹350 Money Received from Aditya
  {
    name: 'Money Received from Aditya (₹350 Income, Timestamp & User Recipient Rejection)',
    lines: [
      'Google Pay',
      'Money Received',
      '02:15 PM, 24 Sep 2026',
      '₹350',
      'From: Aditya Upadhyay',
      'UPI ID: aditya@okaxis',
      'Transaction ID: T260924153022',
      'Credited to: HDFC Bank - 0456',
      'To: My Account'
    ],
    expectedMerchant: 'Aditya Upadhyay',
    expectedAmount: 350,
    expectedDate: '2026-09-24',
    expectedCategory: 'Income',
    expectedType: 'income',
    isIncome: true,
    forbiddenPrefix: 'From',
    forbiddenMerchantSubstrings: ['Google Pay', 'Money Received', 'My Account', 'HDFC Bank'],
    forbiddenAmountValues: [2, 456, 2026]
  },

  // 3. ₹189 Jio recharge
  {
    name: 'Jio Recharge (₹189 Expense, Mobile Number & Account Suffix Noise)',
    lines: [
      'Paytm',
      'Bill Payment Successful',
      '₹189',
      'To: Jio Prepaid Recharges',
      'Mobile Number: 9811223344',
      'Txn ID: 429182746198',
      'Debited from A/c ...1092',
      'Date: 25-Sep-2026'
    ],
    expectedMerchant: 'Jio Prepaid Recharges',
    expectedAmount: 189,
    expectedDate: '2026-09-25',
    expectedCategory: 'Utilities',
    expectedType: 'expense',
    forbiddenPrefix: 'To',
    forbiddenAmountValues: [10, 1092, 9811223344, 2026]
  },

  // 4. ₹620.01 Tira Beauty
  {
    name: 'Tira Beauty (₹620.01 Exact Decimal, Order ID & UPI Ref Noise)',
    lines: [
      'Payment Successful',
      '05:40 PM, 23 Sep 2026',
      '₹620.01',
      'Paid to: Tira Beauty',
      'Order ID: TB-992182',
      'UPI Ref: 429182736152',
      'View history'
    ],
    expectedMerchant: 'Tira Beauty',
    expectedAmount: 620.01,
    expectedDate: '2026-09-23',
    expectedCategory: 'Miscellany',
    expectedType: 'expense',
    forbiddenPrefix: 'Paid to',
    forbiddenMerchantSubstrings: ['View history', 'Payment Successful'],
    forbiddenAmountValues: [6, 2026, 429182736152]
  },

  // 5. ₹9 One Delhi
  {
    name: 'One Delhi (₹9 Single-Digit Whole Number, Bus Route & Ticket ID Noise)',
    lines: [
      'Payment Successful',
      '₹9',
      'To: One Delhi',
      'Bus Route: 534',
      'Ticket ID: DL-2026-5',
      'Debited from Paytm Wallet',
      'Date: 26-Sep-2026'
    ],
    expectedMerchant: 'One Delhi',
    expectedAmount: 9,
    expectedDate: '2026-09-26',
    expectedCategory: 'Transport',
    expectedType: 'expense',
    forbiddenPrefix: 'To',
    forbiddenAmountValues: [5, 534, 2026]
  },

  // 6. ₹30 Indal
  {
    name: 'Indal (₹30 Small Amount, Masked Bank Account Suffix 8443 Rejection)',
    lines: [
      'PhonePe',
      'Paid Successfully',
      '09:15 AM, 25 Sep 2026',
      '₹30',
      'To: Indal',
      'UPI ID: indal@ybl',
      'Debited from: State Bank of India - 8443',
      'Txn ID: 429182746198'
    ],
    expectedMerchant: 'Indal',
    expectedAmount: 30,
    expectedDate: '2026-09-25',
    expectedCategory: 'Miscellany',
    expectedType: 'expense',
    forbiddenPrefix: 'To',
    forbiddenMerchantSubstrings: ['PhonePe', 'Paid Successfully', 'State Bank of India'],
    forbiddenAmountValues: [8443, 8, 443, 2026]
  },

  // 7. General Utility Bill (Tata Power Delhi)
  {
    name: 'Tata Power Delhi Utility Bill (₹780.00, CA & Consumer Number)',
    lines: [
      'Bill Payment Details',
      'Provider Name: Tata Power - Delhi (TP)',
      'Consumer Number: 10928374',
      'CA Number: 6001298471',
      'Bill Date: 12-Sep-2026',
      'Due Date: 28-Sep-2026',
      'Bill Amount: ₹780.00',
      'Transaction Status: Success'
    ],
    expectedMerchant: 'Tata Power - Delhi (TP)',
    expectedAmount: 780.00,
    expectedDate: '2026-09-12',
    expectedCategory: 'Utilities',
    expectedType: 'expense',
    forbiddenPrefix: 'Provider Name',
    forbiddenAmountValues: [10928374, 6001298471, 2026]
  },

  // 8. General Transport / Ride Receipt (Uber)
  {
    name: 'Uber Transport Receipt (₹392.50, Fare & Toll)',
    lines: [
      'Uber India Systems Pvt Ltd',
      'Trip Date: 18-Sep-2026',
      'Pick up: Terminal 3 Delhi Airport',
      'Drop off: Sector 62 Noida',
      'Ride Fare: ₹342.50',
      'Toll Charges: ₹50.00',
      'Total Amount: ₹392.50',
      'Payment Method: UPI',
      'Open maps',
      'Need help?'
    ],
    expectedMerchant: 'Uber India Systems Pvt Ltd',
    expectedAmount: 392.50,
    expectedDate: '2026-09-18',
    expectedCategory: 'Transport',
    expectedType: 'expense',
    forbiddenMerchantSubstrings: ['Open maps', 'Need help'],
    forbiddenAmountValues: [342.50, 50.00, 2026]
  },

  // 9. Indian Comma Formatting (₹1,20,000 Income)
  {
    name: 'Indian Comma Formatting (₹1,20,000 Money Received)',
    lines: [
      'PhonePe Business',
      'Money Received',
      '₹1,20,000',
      'Received from: Acme Tech Solutions Pvt Ltd',
      'Credited to: State Bank of India - 4321',
      'UTR: 991823746192',
      'Date: 24-Sep-2026'
    ],
    expectedMerchant: 'Acme Tech Solutions Pvt Ltd',
    expectedAmount: 120000,
    expectedDate: '2026-09-24',
    expectedCategory: 'Income',
    expectedType: 'income',
    isIncome: true,
    forbiddenPrefix: 'Received from',
    forbiddenMerchantSubstrings: ['State Bank of India', 'PhonePe Business', 'Money Received'],
    forbiddenAmountValues: [4321, 991823746192, 2026]
  },

  // 10. Large Amount with Comma (₹1,500 Fuel Station)
  {
    name: 'Fuel Filling Station (₹1,500, Pump & Nozzle Noise)',
    lines: [
      'Indian Oil Corporation Filling Station',
      'Pump No: 02',
      'Nozzle: 01',
      'Rate/Ltr: ₹94.50',
      'Volume: 15.87 L',
      'Amount Paid: ₹1,500',
      'Payment Method: UPI',
      'Txn ID: IOCL-20260918',
      'Date: 18-Sep-2026'
    ],
    expectedMerchant: 'Indian Oil Corporation Filling Station',
    expectedAmount: 1500,
    expectedDate: '2026-09-18',
    expectedCategory: 'Transport',
    expectedType: 'expense',
    forbiddenAmountValues: [2, 1, 94.50, 15.87, 2026]
  },

  // 11. Multi-number Grocery Receipt with Cashback Mention
  {
    name: 'Supermarket Header (₹140.00 with Cashback Mention)',
    lines: [
      'Reliance Fresh Groceries',
      'Cashier: 04',
      'Date: 10-Sep-2026',
      '1x Milk Packet      60.00',
      '2x Brown Bread     80.00',
      'Cashback Earned: ₹20.00',
      'Total Amount Paid: ₹140.00'
    ],
    expectedMerchant: 'Reliance Fresh Groceries',
    expectedAmount: 140.00,
    expectedDate: '2026-09-10',
    expectedCategory: 'Food',
    expectedType: 'expense',
    forbiddenAmountValues: [20.00, 60.00, 80.00, 4]
  },

  // 12. Corporate Payroll Direct Deposit (Income)
  {
    name: 'Corporate Payroll Direct Deposit (₹75,000 Income)',
    lines: [
      'Corporate Payroll Direct Deposit',
      'Employee ID: EMP9982',
      'Date: 30-Sep-2026',
      'Net Pay: 75,000.00'
    ],
    expectedMerchant: 'Corporate Payroll Direct Deposit',
    expectedAmount: 75000.00,
    expectedDate: '2026-09-30',
    expectedCategory: 'Income',
    expectedType: 'income',
    isIncome: true
  },

  // 13. Instamart Receipt ₹246
  {
    name: 'Instamart Receipt (₹246 Expense, Fees & Discount Breakdown)',
    lines: [
      'Swiggy Instamart',
      'Date: 26-Sep-2026',
      'Item Bill ₹234',
      'Delivery Fee ₹16',
      'Handling Fee ₹12',
      'Offer Discount -₹16',
      'Amount Paid ₹246'
    ],
    expectedMerchant: 'Swiggy Instamart',
    expectedAmount: 246,
    expectedDate: '2026-09-26',
    expectedCategory: 'Food',
    expectedType: 'expense',
    forbiddenMerchantSubstrings: ['Delivery Fee', 'Handling Fee', 'Offer Discount', 'Item Bill', 'Amount Paid']
  },

  // 14. Instamart Receipt with OCR Concatenation Error ₹3,246 -> ₹246
  {
    name: 'Instamart Receipt (₹246 Expense, OCR Concatenation Error ₹3,246 Protection)',
    lines: [
      'Swiggy Instamart',
      'Date: 26-Sep-2026',
      'Item Bill ₹234',
      'Delivery Fee ₹16',
      'Handling Fee ₹12',
      'Offer Discount -₹16',
      'Amount Paid ₹3,246'
    ],
    expectedMerchant: 'Swiggy Instamart',
    expectedAmount: 246,
    expectedDate: '2026-09-26',
    expectedCategory: 'Food',
    expectedType: 'expense',
    forbiddenMerchantSubstrings: ['Delivery Fee', 'Handling Fee', 'Offer Discount', 'Item Bill', 'Amount Paid']
  },

  // 15. Instamart Receipt ₹282
  {
    name: 'Instamart Receipt (₹282 Expense, Fees & Discount Breakdown)',
    lines: [
      'Swiggy Instamart',
      'Date: 26-Sep-2026',
      'Item Bill ₹270',
      'Delivery Fee ₹16',
      'Handling Fee ₹12',
      'Offer Discount -₹16',
      'Amount Paid ₹282'
    ],
    expectedMerchant: 'Swiggy Instamart',
    expectedAmount: 282,
    expectedDate: '2026-09-26',
    expectedCategory: 'Food',
    expectedType: 'expense',
    forbiddenMerchantSubstrings: ['Delivery Fee', 'Handling Fee', 'Offer Discount', 'Item Bill', 'Amount Paid']
  },

  // 16. Instamart Receipt with OCR Concatenation Error ₹3,282 -> ₹282
  {
    name: 'Instamart Receipt (₹282 Expense, OCR Concatenation Error ₹3,282 Protection)',
    lines: [
      'Swiggy Instamart',
      'Date: 26-Sep-2026',
      'Item Bill ₹270',
      'Delivery Fee ₹16',
      'Handling Fee ₹12',
      'Offer Discount -₹16',
      'Amount Paid ₹3,282'
    ],
    expectedMerchant: 'Swiggy Instamart',
    expectedAmount: 282,
    expectedDate: '2026-09-26',
    expectedCategory: 'Food',
    expectedType: 'expense',
    forbiddenMerchantSubstrings: ['Delivery Fee', 'Handling Fee', 'Offer Discount', 'Item Bill', 'Amount Paid']
  },

  // 17. Swiggy Receipt ₹271.36
  {
    name: 'Swiggy Receipt (₹271.36 Expense, Grand Total ₹492.16 with Coupons Precedence)',
    lines: [
      'Swiggy Order Receipt',
      'Order Date: 26-Sep-2026',
      'Grand total ₹492.16',
      'Coupon -₹120',
      'Coupon -₹100.80',
      'Paid ₹271.36'
    ],
    expectedMerchant: 'Swiggy Order Receipt',
    expectedAmount: 271.36,
    expectedDate: '2026-09-26',
    expectedCategory: 'Food',
    expectedType: 'expense',
    forbiddenMerchantSubstrings: ['Grand total', 'Coupon', 'Paid']
  },

  // 18. Swiggy Receipt ₹207.54
  {
    name: 'Swiggy Receipt (₹207.54 Expense, Grand Total ₹347.54 with Coupon Precedence)',
    lines: [
      'Swiggy Order Receipt',
      'Order Date: 26-Sep-2026',
      'Grand total ₹347.54',
      'Coupon -₹140',
      'Paid ₹207.54'
    ],
    expectedMerchant: 'Swiggy Order Receipt',
    expectedAmount: 207.54,
    expectedDate: '2026-09-26',
    expectedCategory: 'Food',
    expectedType: 'expense',
    forbiddenMerchantSubstrings: ['Grand total', 'Coupon', 'Paid']
  },

  // 19. Swiggy Receipt ₹208.99
  {
    name: 'Swiggy Receipt (₹208.99 Expense, Grand Total ₹233.99 with Discount Precedence)',
    lines: [
      'Swiggy Order Receipt',
      'Order Date: 26-Sep-2026',
      'Grand total ₹233.99',
      'Discount -₹25',
      'Paid ₹208.99'
    ],
    expectedMerchant: 'Swiggy Order Receipt',
    expectedAmount: 208.99,
    expectedDate: '2026-09-26',
    expectedCategory: 'Food',
    expectedType: 'expense',
    forbiddenMerchantSubstrings: ['Grand total', 'Discount', 'Paid']
  },

  // 20. Instamart Receipt ₹127
  {
    name: 'Instamart Receipt (₹127 Expense, Direct Final Payment)',
    lines: [
      'Instamart Groceries',
      'Date: 26-Sep-2026',
      'Amount Paid ₹127'
    ],
    expectedMerchant: 'Instamart Groceries',
    expectedAmount: 127,
    expectedDate: '2026-09-26',
    expectedCategory: 'Food',
    expectedType: 'expense',
    forbiddenMerchantSubstrings: ['Amount Paid']
  }
];

function runTests() {
  console.log('=== GENERALIZED RECEIPT OCR EXTRACTION REGRESSION TESTS ===\n');
  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const rawText = tc.lines.join('\n');
    const detectedType = detectTransactionType(rawText, tc.lines);
    const isIncome = tc.isIncome !== undefined ? tc.isIncome : detectedType === 'income';
    const merchant = extractMerchantName(tc.lines, rawText, isIncome);
    const amount = extractReceiptAmount(rawText, tc.lines);
    const date = extractReceiptDate(rawText, tc.lines);
    const category = inferReceiptCategory(merchant, rawText, isIncome);

    const typePass = tc.expectedType ? detectedType === tc.expectedType : true;
    const merchantPass = merchant.toLowerCase() === tc.expectedMerchant.toLowerCase();
    const amountPass = Math.abs(amount - tc.expectedAmount) < 0.01;
    const categoryPass = category === tc.expectedCategory;
    const datePass = tc.expectedDate ? date === tc.expectedDate : true;

    const prefixPass = tc.forbiddenPrefix
      ? !merchant.toLowerCase().startsWith(tc.forbiddenPrefix.toLowerCase())
      : true;

    const forbiddenMerchantPass = tc.forbiddenMerchantSubstrings
      ? !tc.forbiddenMerchantSubstrings.some((sub) =>
          merchant.toLowerCase().includes(sub.toLowerCase())
        )
      : true;

    const forbiddenAmountPass = tc.forbiddenAmountValues
      ? !tc.forbiddenAmountValues.some((v) => Math.abs(amount - v) < 0.01)
      : true;

    const allPassed =
      typePass &&
      merchantPass &&
      amountPass &&
      categoryPass &&
      datePass &&
      prefixPass &&
      forbiddenMerchantPass &&
      forbiddenAmountPass;

    if (allPassed) {
      console.log(`[PASS] ${tc.name}`);
      console.log(`       Type: ${detectedType} | Merchant: "${merchant}" | Amount: ₹${amount} | Date: ${date} | Category: ${category}`);
      passed++;
    } else {
      console.error(`[FAIL] ${tc.name}`);
      if (!typePass) {
        console.error(`       Expected Type: "${tc.expectedType}", Got: "${detectedType}"`);
      }
      if (!merchantPass) {
        console.error(`       Expected Merchant: "${tc.expectedMerchant}", Got: "${merchant}"`);
      }
      if (!amountPass) {
        console.error(`       Expected Amount: ₹${tc.expectedAmount}, Got: ₹${amount}`);
      }
      if (!datePass) {
        console.error(`       Expected Date: ${tc.expectedDate}, Got: ${date}`);
      }
      if (!categoryPass) {
        console.error(`       Expected Category: "${tc.expectedCategory}", Got: "${category}"`);
      }
      if (!prefixPass) {
        console.error(`       Failed: Merchant contained forbidden label prefix "${tc.forbiddenPrefix}"`);
      }
      if (!forbiddenMerchantPass) {
        console.error(`       Failed: Merchant contained forbidden substring from UI/Noise`);
      }
      if (!forbiddenAmountPass) {
        console.error(`       Failed: Amount selected was a forbidden ID/Date/Year/Number!`);
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
