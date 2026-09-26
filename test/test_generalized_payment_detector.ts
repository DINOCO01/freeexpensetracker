import {
  extractReceiptAmount,
  extractReceiptDate,
  extractMerchantName,
  detectTransactionType,
  inferReceiptCategory,
  detectPaymentMethod,
  extractPaymentMetadata,
  calculateFieldConfidenceScores,
  type PaymentMethodType
} from '../src/utils/receiptScanner';

interface TestCase {
  id: number;
  testType: string;
  rawText: string;
  expectedMerchant: string;
  expectedAmount: number;
  expectedDate: string;
  expectedDirection: 'expense' | 'income';
  expectedMethod: PaymentMethodType;
  expectedCategory: string;
}

const testCases: TestCase[] = [
  {
    id: 1,
    testType: '1. UPI person-to-person expense',
    rawText: `
      Payment Successful
      Paid to
      Rohan Sharma
      rohansharma@oksbi
      ₹500
      Date: 2026-08-15
      UPI Transaction ID: 623456789012
    `,
    expectedMerchant: 'Rohan Sharma',
    expectedAmount: 500,
    expectedDate: '2026-08-15',
    expectedDirection: 'expense',
    expectedMethod: 'UPI',
    expectedCategory: 'Miscellany'
  },
  {
    id: 2,
    testType: '2. UPI merchant expense',
    rawText: `
      Paid to
      Starbucks Coffee India
      starbucks@icici
      ₹350.50
      Payment Successful
      Order Date: 2026-08-16
      UPI Ref No: 623456789013
    `,
    expectedMerchant: 'Starbucks Coffee India',
    expectedAmount: 350.50,
    expectedDate: '2026-08-16',
    expectedDirection: 'expense',
    expectedMethod: 'UPI',
    expectedCategory: 'Food'
  },
  {
    id: 3,
    testType: '3. UPI income/received payment',
    rawText: `
      Money Received
      Received from
      Vikram Malhotra
      ₹2,000
      Payment Received
      Transaction Date: 2026-08-17
      Credited to Bank Account **1234
      UPI ID: vikram@ybl
    `,
    expectedMerchant: 'Vikram Malhotra',
    expectedAmount: 2000,
    expectedDate: '2026-08-17',
    expectedDirection: 'income',
    expectedMethod: 'UPI',
    expectedCategory: 'Income'
  },
  {
    id: 4,
    testType: '4. PhonePe-style payment',
    rawText: `
      Transfer to
      Gyanender Upadhyay
      ₹1,500
      Debited from State Bank of India
      ₹1,500
      UTR: 423456789012
      T2608181230459876543210
      Payment Successful
    `,
    expectedMerchant: 'Gyanender Upadhyay',
    expectedAmount: 1500,
    expectedDate: '2026-08-18',
    expectedDirection: 'expense',
    expectedMethod: 'UPI',
    expectedCategory: 'Savings'
  },
  {
    id: 5,
    testType: '5. Google Pay-style payment',
    rawText: `
      GPay
      Paid to
      Airtel Broadband Solutions
      ₹1,178.82
      Payment Date: 2026-08-19
      UPI Transaction ID 619283746501
      Paid via airtel@hdfcbank
    `,
    expectedMerchant: 'Airtel Broadband Solutions',
    expectedAmount: 1178.82,
    expectedDate: '2026-08-19',
    expectedDirection: 'expense',
    expectedMethod: 'UPI',
    expectedCategory: 'Utilities'
  },
  {
    id: 6,
    testType: '6. Paytm-style payment',
    rawText: `
      Paytm Payments
      Paid successfully to
      Burger King India Ltd
      ₹420
      20 Aug 2026, 01:15 PM
      UPI Ref ID: 628371940562
    `,
    expectedMerchant: 'Burger King India Ltd',
    expectedAmount: 420,
    expectedDate: '2026-08-20',
    expectedDirection: 'expense',
    expectedMethod: 'UPI',
    expectedCategory: 'Food'
  },
  {
    id: 7,
    testType: '7. Groww-style payment',
    rawText: `
      Groww Pay
      to Groww Invest Tech Private Limited
      ₹1,680
      UPI Transaction ID 602217952477
      Transaction time 11 AM, 22 Jan '26
      From EQUITAS SMALL ****0000
    `,
    expectedMerchant: 'Groww Invest Tech Private Limited',
    expectedAmount: 1680,
    expectedDate: '2026-01-22',
    expectedDirection: 'expense',
    expectedMethod: 'UPI',
    expectedCategory: 'Savings'
  },
  {
    id: 8,
    testType: '8. Generic bank UPI payment',
    rawText: `
      BHIM SBI Pay
      Paid to: Quick Mart Groceries
      Amount: ₹850.00
      Txn Date: 2026-08-22
      VPA: quickmart@sbi
      UPI Ref: 692837461520
    `,
    expectedMerchant: 'Quick Mart Groceries',
    expectedAmount: 850,
    expectedDate: '2026-08-22',
    expectedDirection: 'expense',
    expectedMethod: 'UPI',
    expectedCategory: 'Food'
  },
  {
    id: 9,
    testType: '9. IMPS transfer',
    rawText: `
      IMPS Fund Transfer Confirmation
      Beneficiary: Sharma Enterprises Pvt Ltd
      Amount Transferred: ₹4,500
      IMPS Ref No: 628374615283
      Date: 2026-08-23
      Debited from Account: ****4321
    `,
    expectedMerchant: 'Sharma Enterprises Pvt Ltd',
    expectedAmount: 4500,
    expectedDate: '2026-08-23',
    expectedDirection: 'expense',
    expectedMethod: 'Bank Transfer',
    expectedCategory: 'Savings'
  },
  {
    id: 10,
    testType: '10. NEFT transfer',
    rawText: `
      NEFT Outward Remittance Receipt
      Beneficiary Name: Landlord Housing Society
      Amount: ₹28,000
      NEFT UTR: HDFCN26082412345
      Payment Date: 2026-08-24
      Status: Transferred Successfully
    `,
    expectedMerchant: 'Landlord Housing Society',
    expectedAmount: 28000,
    expectedDate: '2026-08-24',
    expectedDirection: 'expense',
    expectedMethod: 'Bank Transfer',
    expectedCategory: 'Housing'
  },
  {
    id: 11,
    testType: '11. RTGS transfer',
    rawText: `
      RTGS Payment Advice
      Credit to: Apex Commercial Holdings
      Amount: ₹2,50,000
      RTGS UTR: SBINR26082598765
      Transaction Date: 2026-08-25
      Debited from A/C: 00987654321
    `,
    expectedMerchant: 'Apex Commercial Holdings',
    expectedAmount: 250000,
    expectedDate: '2026-08-25',
    expectedDirection: 'expense',
    expectedMethod: 'Bank Transfer',
    expectedCategory: 'Miscellany'
  },
  {
    id: 12,
    testType: '12. Debit-card payment',
    rawText: `
      HDFC Bank Debit Card Alert
      Card Ending in 4102 swiped at
      Indian Oil Petroleum Station
      Amount: ₹2,100.00
      Txn Date: 2026-08-26
      Auth Code: 839201
    `,
    expectedMerchant: 'Indian Oil Petroleum Station',
    expectedAmount: 2100,
    expectedDate: '2026-08-26',
    expectedDirection: 'expense',
    expectedMethod: 'Card',
    expectedCategory: 'Transport'
  },
  {
    id: 13,
    testType: '13. Credit-card payment',
    rawText: `
      ICICI Bank Credit Card Transaction
      Purchase at
      PVR Cinemas Multiplex
      Amount: ₹780.00
      Date: 2026-08-27
      Card No: ****9012
    `,
    expectedMerchant: 'PVR Cinemas Multiplex',
    expectedAmount: 780,
    expectedDate: '2026-08-27',
    expectedDirection: 'expense',
    expectedMethod: 'Card',
    expectedCategory: 'Entertainment'
  },
  {
    id: 14,
    testType: '14. Wallet/payment gateway transaction',
    rawText: `
      Razorpay Payment Receipt
      Merchant: Coursera Education Inc
      Amount Paid: ₹3,200
      Payment Gateway ID: pay_2837461528
      Paid via Wallet
      Date: 2026-08-28
    `,
    expectedMerchant: 'Coursera Education Inc',
    expectedAmount: 3200,
    expectedDate: '2026-08-28',
    expectedDirection: 'expense',
    expectedMethod: 'Wallet',
    expectedCategory: 'Miscellany'
  },
  {
    id: 15,
    testType: '15. Mobile recharge',
    rawText: `
      Mobile Recharge Successful
      Paid to: Jio Prepaid Recharges
      Mobile Number: 9876543210
      Plan Amount: ₹299
      Date: 2026-08-29
      Txn ID: JIO9283716253
    `,
    expectedMerchant: 'Jio Prepaid Recharges',
    expectedAmount: 299,
    expectedDate: '2026-08-29',
    expectedDirection: 'expense',
    expectedMethod: 'Recharge',
    expectedCategory: 'Utilities'
  },
  {
    id: 16,
    testType: '16. Electricity bill',
    rawText: `
      Electricity Bill Payment Receipt
      Biller: Tata Power Delhi Distribution
      CA No: 60012345678
      Total Bill Amount: ₹1,450.00
      Payment Date: 2026-08-30
      Status: Paid Successfully
    `,
    expectedMerchant: 'Tata Power Delhi Distribution',
    expectedAmount: 1450,
    expectedDate: '2026-08-30',
    expectedDirection: 'expense',
    expectedMethod: 'Bill Payment',
    expectedCategory: 'Utilities'
  },
  {
    id: 17,
    testType: '17. Gas bill',
    rawText: `
      Piped Gas Bill Payment
      Merchant: INDRAPRASTHA GAS LIMITED
      Consumer ID: 10098765
      Total Amount Paid: ₹586.77
      Bill Date: 2026-08-31
      Receipt No: IGL9283716
    `,
    expectedMerchant: 'INDRAPRASTHA GAS LIMITED',
    expectedAmount: 586.77,
    expectedDate: '2026-08-31',
    expectedDirection: 'expense',
    expectedMethod: 'Bill Payment',
    expectedCategory: 'Utilities'
  },
  {
    id: 18,
    testType: '18. Internet/broadband bill',
    rawText: `
      Broadband Bill Confirmation
      Service Provider: ACT Fibernet Internet
      Account ID: 29384756
      Amount: ₹943.00
      Payment Date: 2026-09-01
      Status: Paid
    `,
    expectedMerchant: 'ACT Fibernet Internet',
    expectedAmount: 943,
    expectedDate: '2026-09-01',
    expectedDirection: 'expense',
    expectedMethod: 'Bill Payment',
    expectedCategory: 'Utilities'
  },
  {
    id: 19,
    testType: '19. DTH recharge',
    rawText: `
      DTH Recharge Successful
      Paid to: Tata Play DTH Services
      Subscriber ID: 1029384756
      Recharge Amount: ₹450
      Date: 2026-09-02
    `,
    expectedMerchant: 'Tata Play DTH Services',
    expectedAmount: 450,
    expectedDate: '2026-09-02',
    expectedDirection: 'expense',
    expectedMethod: 'Recharge',
    expectedCategory: 'Utilities'
  },
  {
    id: 20,
    testType: '20. Transaction containing multiple numeric IDs',
    rawText: `
      Payment Successful
      Paid to: Urban Ladder Home Decor
      Customer ID: 987654321
      Order ID: 123456789
      UTR: 876543210987
      UPI Ref: 987612345678
      Total Amount: ₹12,500
      Txn Date: 2026-09-03
    `,
    expectedMerchant: 'Urban Ladder Home Decor',
    expectedAmount: 12500,
    expectedDate: '2026-09-03',
    expectedDirection: 'expense',
    expectedMethod: 'UPI',
    expectedCategory: 'Miscellany'
  },
  {
    id: 21,
    testType: '21. Transaction with multiple currency values',
    rawText: `
      Retail Payment
      Paid to: Fresh Bazaar Supermarket
      Subtotal: ₹800.00
      CGST: ₹24.00
      SGST: ₹24.00
      Discount Saved: ₹50.00
      Total Amount Paid: ₹848.00
      Date: 2026-09-04
    `,
    expectedMerchant: 'Fresh Bazaar Supermarket',
    expectedAmount: 848,
    expectedDate: '2026-09-04',
    expectedDirection: 'expense',
    expectedMethod: 'Other',
    expectedCategory: 'Food'
  },
  {
    id: 22,
    testType: '22. Transaction with decimal amount',
    rawText: `
      Paid to: Tira Beauty Cosmetics
      Amount Paid: ₹620.01
      Payment Date: 2026-09-05
      UPI ID: tirabeauty@hdfc
      Payment Successful
    `,
    expectedMerchant: 'Tira Beauty Cosmetics',
    expectedAmount: 620.01,
    expectedDate: '2026-09-05',
    expectedDirection: 'expense',
    expectedMethod: 'UPI',
    expectedCategory: 'Miscellany'
  },
  {
    id: 23,
    testType: '23. Transaction with Indian comma formatting',
    rawText: `
      Received from: Tech Mahindra Solutions Ltd
      Amount Credited: ₹1,20,000
      Salary Credit
      Txn Date: 2026-09-06
    `,
    expectedMerchant: 'Tech Mahindra Solutions Ltd',
    expectedAmount: 120000,
    expectedDate: '2026-09-06',
    expectedDirection: 'income',
    expectedMethod: 'Other',
    expectedCategory: 'Income'
  },
  {
    id: 24,
    testType: '24. Transaction where current date differs from transaction date',
    rawText: `
      Old Receipt Record
      Paid to: Metro Railway Transit
      Fare Amount: ₹40
      Dated: 14 Feb 2025
      Ticket No: 82716
    `,
    expectedMerchant: 'Metro Railway Transit',
    expectedAmount: 40,
    expectedDate: '2025-02-14',
    expectedDirection: 'expense',
    expectedMethod: 'Other',
    expectedCategory: 'Transport'
  }
];

async function runTestSuite() {
  console.log('========================================================================================');
  console.log('RUNNING GENERALIZED PAYMENT TRANSACTION DETECTOR TEST SUITE (24 REPRESENTATIVE CASES)');
  console.log('========================================================================================\n');

  const verificationRows: any[] = [];
  let passedCount = 0;

  for (const tc of testCases) {
    const lines = tc.rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const type = detectTransactionType(tc.rawText, lines);
    const isIncome = type === 'income';
    const merchant = extractMerchantName(lines, tc.rawText, isIncome);
    const amount = extractReceiptAmount(tc.rawText, lines);
    const date = extractReceiptDate(tc.rawText, lines);
    const category = inferReceiptCategory(merchant, tc.rawText, isIncome);
    const paymentMethod = detectPaymentMethod(tc.rawText, lines);
    const metadata = extractPaymentMetadata(tc.rawText, lines);
    const confidence = calculateFieldConfidenceScores(
      merchant,
      amount,
      date,
      type,
      category,
      tc.rawText,
      lines
    );

    // Verifications
    const merchantPass = merchant.toLowerCase().includes(tc.expectedMerchant.toLowerCase()) ||
      tc.expectedMerchant.toLowerCase().includes(merchant.toLowerCase());
    const amountPass = Math.abs(amount - tc.expectedAmount) < 0.001;
    const datePass = date === tc.expectedDate;
    const directionPass = type === tc.expectedDirection;
    const methodPass = paymentMethod === tc.expectedMethod;
    const categoryPass = category === tc.expectedCategory;

    const allPass = merchantPass && amountPass && datePass && directionPass && methodPass && categoryPass;

    if (allPass) passedCount++;

    verificationRows.push({
      'TEST TYPE': tc.testType,
      'MERCHANT': merchant,
      'AMOUNT': `₹${amount}`,
      'DATE': date,
      'DIRECTION': type,
      'PAYMENT METHOD': paymentMethod,
      'CATEGORY': category,
      'RESULT': allPass ? 'PASS' : 'FAIL'
    });

    console.log(`[TEST CASE ${tc.id}] ${tc.testType}`);
    console.log(`  Merchant: "${merchant}" (Expected: "${tc.expectedMerchant}") -> ${merchantPass ? 'OK' : 'MISMATCH'}`);
    console.log(`  Amount: ₹${amount} (Expected: ₹${tc.expectedAmount}) -> ${amountPass ? 'OK' : 'MISMATCH'}`);
    console.log(`  Date: ${date} (Expected: ${tc.expectedDate}) -> ${datePass ? 'OK' : 'MISMATCH'}`);
    console.log(`  Direction: ${type} (Expected: ${tc.expectedDirection}) -> ${directionPass ? 'OK' : 'MISMATCH'}`);
    console.log(`  Payment Method: ${paymentMethod} (Expected: ${tc.expectedMethod}) -> ${methodPass ? 'OK' : 'MISMATCH'}`);
    console.log(`  Category: ${category} (Expected: ${tc.expectedCategory}) -> ${categoryPass ? 'OK' : 'MISMATCH'}`);
    console.log(`  Confidence: Overall ${confidence.overall}% (Merchant ${confidence.merchant}%, Amount ${confidence.amount}%, Date ${confidence.date}%)`);
    console.log(`  --> Status: ${allPass ? 'PASS' : 'FAIL'}\n`);
  }

  console.log('========================================================================================');
  console.log(`FINAL VERIFICATION TABLE FOR ALL ${passedCount}/${testCases.length} GENERALIZED PAYMENT TESTS:`);
  console.log('========================================================================================');
  console.table(verificationRows);

  if (passedCount !== testCases.length) {
    throw new Error(`Only ${passedCount}/${testCases.length} tests passed!`);
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err.message);
  process.exit(1);
});
