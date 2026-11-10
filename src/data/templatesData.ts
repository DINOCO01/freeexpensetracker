export interface TemplateData {
  id: string;
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  category: 'Budgeting' | 'Debt Management' | 'Investing & Retirement' | 'Savings' | 'Audits & Tracking';
  categoryIcon: string;
  fileName: string;
  fileSize: string;
  sheetNames: string[];
  keyFormulas: string[];
  purpose: string;
  overview: string;
  howToUse: string[];
  whoBenefits: string[];
  faq: { question: string; answer: string }[];
}

export const TEMPLATES_DATA: TemplateData[] = [
  {
    id: 'paycheck-budget',
    slug: 'paycheck-budget',
    title: 'Free Paycheck Budget Spreadsheet (Excel .xlsx) | Free Expense Tracker',
    metaDescription: 'Download our free Paycheck Budget spreadsheet for Excel (.xlsx). Plan every dollar per pay cycle with take-home pay, fixed bills, variable spending, and debt payoff.',
    h1: 'Free Paycheck Budget Spreadsheet Template',
    category: 'Budgeting',
    categoryIcon: '💰',
    fileName: '01_US_Paycheck_Budget.xlsx',
    fileSize: '7.5 KB',
    sheetNames: ['Paycheck Budget'],
    keyFormulas: [
      'Remaining Surplus = Take-Home Pay - (Bills & Fixed + Variable Spending + Savings + Debt Payment)',
      'Total Category Spending = SUM of respective allocations'
    ],
    purpose: 'Designed for paycheck-to-paycheck budgeting and zero-based budgeting, this spreadsheet lets you allocate every dollar of your net paycheck before spending occurs.',
    overview: 'The Paycheck Budget Spreadsheet is built for individuals and households who prefer managing money according to their actual pay frequency (bi-weekly, weekly, or semi-monthly) rather than relying on monthly averages. By linking each expense directly to the specific paycheck that funds it, you eliminate timing gaps where bills come due before your account is replenished.',
    howToUse: [
      'Enter your paycheck date, employer/income source name, and exact net take-home pay in the top income row.',
      'Record all recurring fixed bills due during this pay cycle (such as rent, mortgage, utilities, and insurance).',
      'Allocate planned variable allowances for groceries, transportation, dining, and daily personal spending.',
      'Designate specific amounts toward emergency savings or dedicated sinking funds.',
      'Enter targeted debt principal contributions to verify your unallocated surplus reaches zero.'
    ],
    whoBenefits: [
      'Bi-weekly and weekly wage earners who find traditional monthly calendar budgets difficult to align with pay dates.',
      'Households transitioning to a zero-based budgeting framework where every dollar is assigned a job.',
      'Anyone struggling with overdraft fees caused by mismatched bill due dates and paycheck deposits.'
    ],
    faq: [
      {
        question: 'Does this template work with bi-weekly and semi-monthly pay cycles?',
        answer: 'Yes. Each row in the Paycheck Budget sheet represents an individual pay cycle. You can log bi-weekly, weekly, or twice-monthly deposits independently.'
      },
      {
        question: 'Can I customize the expense categories?',
        answer: 'Yes. You can edit the column headers or insert rows in Excel or Google Sheets to fit your specific household expenses.'
      }
    ]
  },
  {
    id: 'debt-snowball',
    slug: 'debt-snowball',
    title: 'Free Debt Snowball Spreadsheet (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Download our free debt snowball spreadsheet for Excel & Google Sheets. Pay off debt faster with no sign-up required. Free, private, and easy to use.',
    h1: 'Free Debt Snowball Spreadsheet',
    category: 'Debt Management',
    categoryIcon: '💳',
    fileName: '02_US_Debt_Snowball.xlsx',
    fileSize: '7.0 KB',
    sheetNames: ['Debt Snowball'],
    keyFormulas: [
      'Total Payment = Minimum Payment + Extra Monthly Payment',
      'Remaining Balance = Current Balance - Principal Paid'
    ],
    purpose: 'Accelerate debt payoff using the psychological debt snowball method, targeting your smallest balances first while paying minimums on everything else.',
    overview: 'The Debt Snowball strategy prioritizes behavioral momentum. By organizing debts from smallest remaining balance to largest, you score quick emotional victories as smaller accounts reach zero. As each balance is eliminated, its former minimum payment is "snowballed" into the next smallest account, accelerating repayment velocity without increasing your overall monthly out-of-pocket budget.',
    howToUse: [
      'Enter all non-mortgage debts sorted in ascending order by current balance (smallest balance first).',
      'Input the exact balance, interest rate (APR), and required monthly minimum payment for each creditor.',
      'Enter your available extra monthly debt payoff contribution in the acceleration field.',
      'Apply all extra funds toward Debt #1 while continuing minimum payments on the others, rolling each eliminated payment forward until you are debt-free.'
    ],
    whoBenefits: [
      'Individuals with multiple small consumer debts seeking fast, visible progress to stay motivated.',
      'Borrowers overwhelmed by having numerous monthly payments who want to simplify their creditors quickly.',
      'Anyone who responds better to behavioral encouragement than pure mathematical interest optimization.'
    ],
    faq: [
      {
        question: 'What is the debt snowball method and why does it work?',
        answer: 'The debt snowball is a debt payoff strategy where you list your debts from smallest balance to largest balance, regardless of interest rates. You make minimum payments on all accounts while putting every extra dollar toward the smallest debt. Eliminating smaller balances early provides immediate psychological wins and builds unstoppable motivation to pay off larger debts.'
      },
      {
        question: 'What is the difference between the debt snowball and debt avalanche?',
        answer: 'The debt snowball prioritizes psychological momentum by paying off your smallest account balances first, while the debt avalanche attacks your highest-interest debts first to save the maximum amount on interest charges. If your primary goal is minimizing lifetime interest rather than quick motivational wins, check out our free debt avalanche spreadsheet.'
      },
      {
        question: 'Can I use this debt snowball spreadsheet in Google Sheets and Microsoft Excel?',
        answer: 'Yes. The download is an unlocked .xlsx file that opens natively in Microsoft Excel, Apple Numbers, and LibreOffice, and imports seamlessly into Google Sheets with all formulas intact and zero signup required.'
      },
      {
        question: 'What happens to my payment when a debt is fully paid off?',
        answer: 'When an account reaches zero, you roll its entire monthly payment (its minimum payment plus whatever extra money you were adding) directly into the next smallest debt on your list. This creates a growing snowball payment that accelerates repayment without increasing your overall monthly budget.'
      }
    ]
  },
  {
    id: 'debt-avalanche',
    slug: 'debt-avalanche',
    title: 'Free Debt Avalanche Calculator Spreadsheet (.xlsx) | Free Expense Tracker',
    metaDescription: 'Download our free Debt Avalanche spreadsheet for Excel (.xlsx). Minimize interest charges by prioritizing highest APR debts first for maximum financial savings.',
    h1: 'Free Debt Avalanche Spreadsheet Calculator',
    category: 'Debt Management',
    categoryIcon: '💳',
    fileName: '03_US_Debt_Avalanche.xlsx',
    fileSize: '7.0 KB',
    sheetNames: ['Debt Avalanche'],
    keyFormulas: [
      'Total Payment = Minimum Payment + Extra Monthly Payment',
      'Interest Saved Calculation = Total Interest (Avalanche) vs Total Interest (Baseline Minimums)'
    ],
    purpose: 'Mathematically optimize your debt payoff journey by prioritizing the accounts with the highest annual percentage rates (APR) to save the most money on interest.',
    overview: 'The Debt Avalanche method is the mathematically optimal debt repayment strategy. By ordering your debts from highest interest rate to lowest interest rate, you eliminate the most expensive loans first. This minimizes the compounding interest charges that keep borrowers trapped in high-interest consumer debt, resulting in thousands of dollars in interest savings and a faster debt-free date.',
    howToUse: [
      'List all current debts sorted from highest interest rate (APR) at the top to lowest interest rate at the bottom.',
      'Enter the starting balance, APR percentage, and required minimum monthly payment for each balance.',
      'Determine your total monthly debt payoff budget and allocate any excess funds above minimums to the top loan.',
      'Maintain contractual minimum payments on all lower-interest balances to protect your credit score.',
      'When the highest-APR debt is fully paid, roll its entire payment into the next highest APR account.'
    ],
    whoBenefits: [
      'Analytical borrowers who want to minimize total interest fees and prioritize mathematical efficiency.',
      'Cardholders with high-APR credit card balances (e.g. 20% to 29.99%) where interest charges compound aggressively.',
      'Anyone with the discipline to stay on track even if the first loan takes longer to eliminate.'
    ],
    faq: [
      {
        question: 'How much money does the debt avalanche save compared to the snowball?',
        answer: 'Depending on the spread between your highest interest rate (such as a 26% APR credit card) and lowest rate (such as a 5% student loan), the avalanche can save hundreds to thousands of dollars in lifetime interest charges.'
      },
      {
        question: 'Is my credit score affected by choosing avalanche over snowball?',
        answer: 'Both strategies improve your credit score over time by lowering your credit utilization ratio. The avalanche also reduces the total amount of interest capitalizing into your balances.'
      }
    ]
  },
  {
    id: 'debt-to-income',
    slug: 'debt-to-income-calculator',
    title: 'Free Debt-to-Income (DTI) Calculator Spreadsheet (.xlsx) | Free Expense Tracker',
    metaDescription: 'Calculate your front-end and back-end DTI ratio with our free Excel (.xlsx) Debt-to-Income calculator. Prepare for mortgage, auto, or personal loan applications.',
    h1: 'Free Debt-to-Income (DTI) Ratio Calculator',
    category: 'Debt Management',
    categoryIcon: '💳',
    fileName: '04_US_Debt_to_Income_Calculator.xlsx',
    fileSize: '6.4 KB',
    sheetNames: ['DTI Calculator'],
    keyFormulas: [
      'Total Monthly Debt = Housing Payment + Auto Loans + Student Loans + Credit Card Minimums + Other Debt',
      'Back-End DTI Ratio = (Total Monthly Debt Payments / Monthly Gross Income) * 100',
      'Front-End DTI Ratio = (Housing Payment / Monthly Gross Income) * 100'
    ],
    purpose: 'Measure your borrowing health by calculating the exact debt-to-income percentages that mortgage underwriters and commercial lenders use to evaluate loan approvals.',
    overview: 'Your Debt-to-Income (DTI) ratio is one of the most critical metrics in personal lending. Lenders look at two ratios: Front-End DTI (housing expenses divided by gross monthly income) and Back-End DTI (all recurring monthly debt payments divided by gross monthly income). This spreadsheet helps you accurately project your ratios prior to applying for a conventional mortgage, FHA loan, VA loan, or auto financing.',
    howToUse: [
      'Input your total gross monthly income (pre-tax salary, wages, and verified steady bonus or side income).',
      'Enter your anticipated or current monthly housing payment (including mortgage principal, interest, taxes, and homeowner insurance).',
      'Record all regular installment and revolving minimum debt payments: auto loans, student loans, and credit card minimums.',
      'Review the calculated Back-End DTI percentage against conventional underwriting thresholds (typically 36% to 43%).',
      'Adjust loan balances or debt payments to see how paying off specific debts improves your borrowing power.'
    ],
    whoBenefits: [
      'Prospective homebuyers preparing to apply for pre-approval on a mortgage.',
      'Consumers planning auto purchases who want to ensure financing terms remain comfortably affordable.',
      'Individuals seeking a comprehensive health check on their recurring monthly debt obligations.'
    ],
    faq: [
      {
        question: 'What is a good DTI ratio for a mortgage approval?',
        answer: 'Most conventional mortgage lenders prefer a back-end DTI of 36% or lower, though many loan programs permit DTIs up to 43%, and certain FHA or VA programs allow higher ratios with compensating factors.'
      },
      {
        question: 'Do living expenses like groceries and utilities count toward DTI?',
        answer: 'No. Lenders only count contractual debt obligations reported on your credit bureau files (credit cards, loans, mortgages) and child support/alimony. Groceries, utilities, and subscriptions are not included in official DTI math.'
      }
    ]
  },
  {
    id: 'student-loan',
    slug: 'student-loan-planner',
    title: 'Free Student Loan Planner (Spreadsheet + Calculator) | Free Expense Tracker',
    metaDescription: 'Download our free student loan planner spreadsheet and calculator. Model payoff timelines, interest savings, and extra payments with no sign-up.',
    h1: 'Free Student Loan Planner',
    category: 'Debt Management',
    categoryIcon: '💳',
    fileName: '05_US_Student_Loan_Planner.xlsx',
    fileSize: '6.5 KB',
    sheetNames: ['Student Loan'],
    keyFormulas: [
      'Total Monthly Payment = Monthly Payment + Extra Monthly Payment',
      'Estimated Months to Payoff = NPER formula based on balance, rate, and total payment',
      'Total Interest Paid = (Total Monthly Payment * Estimated Months) - Loan Balance'
    ],
    purpose: 'Take control of federal and private student loans by calculating realistic payoff timelines and modeling the direct impact of extra monthly principal payments.',
    overview: 'Student loan debt can span decades if borrowers pay only the standard minimum amounts. This spreadsheet calculates your exact repayment timeline and total interest burden based on your current balance and interest rate. By testing varying extra monthly payments, you can visualize how even modest extra contributions ($50 to $200 per month) shave years off your repayment timeline.',
    howToUse: [
      'Enter your current student loan principal balance and nominal annual interest rate.',
      'Specify your baseline contractual monthly minimum payment.',
      'Enter an optional extra monthly payment to simulate accelerated principal payoff.',
      'Review your updated estimated debt-free date and total lifetime interest savings.'
    ],
    whoBenefits: [
      'College graduates with federal or private student loans seeking a clear roadmap to becoming debt-free.',
      'Professionals comparing whether to refinance loans or pay extra principal on existing balances.',
      'Parents co-signing or managing educational debt looking for structured amortization visibility.'
    ],
    faq: [
      {
        question: 'How does making extra payments change my student loan payoff timeline?',
        answer: 'Any payment made above your contractual monthly minimum goes directly toward reducing the loan principal. Lowering the principal balance immediately decreases the daily interest accrual, shortening your overall repayment period by months or years and saving thousands of dollars in interest.'
      },
      {
        question: 'Should I pay off federal student loans early or pursue forgiveness?',
        answer: 'If you qualify for Public Service Loan Forgiveness (PSLF) or substantial forgiveness through an income-driven repayment plan, paying the minimum may be the optimal strategy. However, if you work in the private sector or carry private student loans ineligible for forgiveness, accelerating payoff saves substantial interest.'
      },
      {
        question: 'When does refinancing student loans make financial sense?',
        answer: 'Refinancing is advantageous if you hold high-interest private student loans and have built strong credit or income to qualify for a lower interest rate. Exercise caution before refinancing federal loans into private debt, as you permanently surrender federal protections like income-driven plans and deferment.'
      },
      {
        question: 'Can I use this student loan planner for multiple student loans?',
        answer: 'Yes. You can enter your combined weighted average balance and interest rate to see overall timelines, or evaluate each loan account individually to prioritize extra principal toward your highest-interest loans first.'
      }
    ]
  },
  {
    id: 'auto-loan',
    slug: 'auto-loan-calculator',
    title: 'Free Auto Loan Calculator Spreadsheet (.xlsx) | Free Expense Tracker',
    metaDescription: 'Download our free Auto Loan Calculator in Excel (.xlsx). Calculate monthly car payments, total interest, sales tax, trade-in credit, and loan amortization.',
    h1: 'Free Auto Loan Calculator Spreadsheet',
    category: 'Debt Management',
    categoryIcon: '💳',
    fileName: '06_US_Auto_Loan_Calculator.xlsx',
    fileSize: '6.4 KB',
    sheetNames: ['Auto Loan'],
    keyFormulas: [
      'Amount Financed = (Vehicle Price * (1 + Sales Tax %)) - Down Payment - Trade-in Credit',
      'Monthly Payment = PMT formula based on interest rate, term in months, and financed amount',
      'Total Interest = (Monthly Payment * Term Months) - Amount Financed'
    ],
    purpose: 'Calculate your true monthly car payment and total cost of financing before stepping into an auto dealership or signing a vehicle financing agreement.',
    overview: 'Car dealerships often negotiate on monthly payment amounts rather than the total purchase price, leading buyers to agree to extended loan terms (72 or 84 months) that accumulate excessive interest. This spreadsheet computes the exact mathematical financing cost including vehicle price, down payment, trade-in value, sales tax, APR, and term length, giving you leverage during purchase negotiations.',
    howToUse: [
      'Enter the negotiated vehicle purchase price.',
      'Input your planned cash down payment and dealer trade-in credit allowance.',
      'Set your state and local sales tax percentage (e.g. 0.06 for 6%).',
      'Input the lender loan interest rate (APR) and financing term length in months (e.g. 36, 48, 60).',
      'Analyze the resulting monthly payment and total finance charges over the life of the loan.'
    ],
    whoBenefits: [
      'Car buyers evaluating new or used vehicles who want an unbiased financial breakdown.',
      'Borrowers deciding between taking dealer rebates versus manufacturer low-interest APR incentives.',
      'Car owners planning to refinance their existing auto loans to secure lower monthly payments.'
    ],
    faq: [
      {
        question: 'What is the recommended car financing term?',
        answer: 'Financial planners generally recommend limiting auto financing to 48 or 60 months and putting at least 10% to 20% down to avoid becoming "underwater" (owing more than the car is worth).'
      },
      {
        question: 'Does this calculator include dealer doc fees or licensing?',
        answer: 'You can add dealer document fees and registration costs directly into the vehicle price cell for a comprehensive out-the-door total.'
      }
    ]
  },
  {
    id: 'mortgage-planner',
    slug: 'mortgage-planner',
    title: 'Free Mortgage Planner & Payment Calculator (.xlsx) | Free Expense Tracker',
    metaDescription: 'Download our free Mortgage Planner Excel (.xlsx) spreadsheet. Estimate monthly P&I, property taxes, homeowner insurance, and total borrowing costs.',
    h1: 'Free Mortgage Planner Spreadsheet Template',
    category: 'Debt Management',
    categoryIcon: '💳',
    fileName: '07_US_Mortgage_Planner.xlsx',
    fileSize: '6.5 KB',
    sheetNames: ['Mortgage Planner'],
    keyFormulas: [
      'Loan Amount = Home Price - Down Payment',
      'Monthly Principal & Interest = PMT(Rate/12, Term*12, -Loan Amount)',
      'Total Monthly Payment = Monthly P&I + (Annual Property Tax / 12) + (Annual Home Insurance / 12)'
    ],
    purpose: 'Model realistic homeownership costs including principal, interest, local property taxes, and hazard insurance (PITI) across 15-year and 30-year amortization periods.',
    overview: 'Buying a home involves much more than just calculating loan principal and interest. Escrow items like property taxes and homeowners insurance can easily add $400 to $1,000+ to your monthly housing outflow. This workbook provides an all-inclusive projection of your true monthly mortgage obligation so you can buy with total financial confidence.',
    howToUse: [
      'Enter the target home purchase price and your planned down payment amount.',
      'Input the quoted annual mortgage interest rate and loan term in years (e.g., 30 or 15).',
      'Enter estimated annual property taxes based on county property records.',
      'Enter estimated annual homeowners insurance premiums.',
      'Review the itemized breakdown of monthly Principal & Interest alongside the full PITI payment.'
    ],
    whoBenefits: [
      'First-time homebuyers determining an affordable maximum home price before touring houses.',
      'Homeowners weighing whether refinancing from a 30-year to a 15-year fixed mortgage is cost-effective.',
      'Real estate investors running fast acquisition cash flow feasibility checks on properties.'
    ],
    faq: [
      {
        question: 'Does this spreadsheet include Private Mortgage Insurance (PMI)?',
        answer: 'If you put down less than 20%, PMI is typically required on conventional loans. You can include your annual PMI estimate in the insurance field for an exact escrow figure.'
      },
      {
        question: 'Should I choose a 15-year or 30-year mortgage?',
        answer: 'A 15-year mortgage comes with lower interest rates and saves substantial lifetime interest, but requires higher monthly payments. Use this sheet to test both terms side-by-side.'
      }
    ]
  },
  {
    id: '401k-retirement',
    slug: '401k-retirement-planner',
    title: 'Free 401(k) Retirement Planner Spreadsheet (.xlsx) | Free Expense Tracker',
    metaDescription: 'Download our free 401(k) Retirement Planner Excel (.xlsx) template. Project account growth, employer match contributions, salary increases, and compound interest.',
    h1: 'Free 401(k) Retirement Planner Spreadsheet',
    category: 'Investing & Retirement',
    categoryIcon: '📈',
    fileName: '08_US_401k_Retirement_Planner.xlsx',
    fileSize: '6.5 KB',
    sheetNames: ['401k Planner'],
    keyFormulas: [
      'Total Annual Contribution = (Salary * Employee Contribution %) + (Salary * Employer Match %)',
      'Compounded Future Value = FV formula accounting for annual salary growth and compound investment returns'
    ],
    purpose: 'Simulate long-term retirement wealth accumulation in your company-sponsored 401(k) by combining employee salary deferrals, employer matching, and compound market growth.',
    overview: 'A 401(k) plan is the cornerstone of retirement planning for millions of workers. Because contributions are made with pre-tax income and employer matching represents an immediate 100% return on matched funds, compounding builds immense long-term wealth over 20 to 30 years. This template lets you visualize exactly how increasing your savings rate by 1% or 2% compounds into hundreds of thousands of extra retirement dollars.',
    howToUse: [
      'Enter your current annual gross salary and anticipated annual merit salary growth rate (e.g., 3%).',
      'Input your employee deferral contribution percentage (e.g., 10% or 15%).',
      'Enter your employer match formula percentage (e.g., 50% match up to 6% of salary).',
      'Set your investment time horizon in years until planned retirement.',
      'Set a conservative expected annual market return rate (e.g., 7% inflation-adjusted or 8% nominal).',
      'Review the projected terminal 401(k) balance at retirement.'
    ],
    whoBenefits: [
      'Employees deciding how much to contribute to their company 401(k) plan.',
      'Workers seeking to ensure they are contributing enough to capture the full employer matching dollar.',
      'Mid-career professionals forecasting their retirement readiness across multiple savings scenarios.'
    ],
    faq: [
      {
        question: 'What is a reasonable expected annual return to use?',
        answer: 'Historically, the broad US stock market (S&P 500) has returned roughly 10% nominal and 7% after inflation over multi-decade periods. Using 6% to 7% provides a realistic, conservative estimate.'
      },
      {
        question: 'Does this account for IRS annual 401(k) contribution limits?',
        answer: 'You should ensure your total employee contribution does not exceed the annual elective deferral limit set by the IRS ($23,000 for 2024, plus catch-up if age 50+).'
      }
    ]
  },
  {
    id: 'roth-ira',
    slug: 'roth-ira-planner',
    title: 'Free Roth IRA Growth Planner Spreadsheet (.xlsx) | Free Expense Tracker',
    metaDescription: 'Download our free Roth IRA Planner in Excel (.xlsx). Project tax-free compound growth, annual contributions, investment returns, and retirement wealth.',
    h1: 'Free Roth IRA Growth Planner Spreadsheet',
    category: 'Investing & Retirement',
    categoryIcon: '📈',
    fileName: '09_US_Roth_IRA_Planner.xlsx',
    fileSize: '6.3 KB',
    sheetNames: ['Roth IRA'],
    keyFormulas: [
      'Projected Balance = FV(Expected Return, Years, -Annual Contribution, -Starting Balance)',
      'Total Contributions = Starting Balance + (Annual Contribution * Years)',
      'Total Tax-Free Growth = Projected Balance - Total Contributions'
    ],
    purpose: 'Calculate tax-free wealth accumulation in a Roth IRA, illustrating the dramatic compounding advantages of after-tax investing over long time horizons.',
    overview: 'Unlike traditional retirement accounts where distributions are taxed as ordinary income, Roth IRA contributions grow completely tax-free, and qualified withdrawals in retirement are 100% tax-exempt. This spreadsheet demonstrates how steady annual contributions into broad low-cost index funds can turn disciplined annual savings into a multi-million-dollar tax-free retirement nest egg.',
    howToUse: [
      'Input your current starting Roth IRA balance (or $0 if opening a new account).',
      'Enter your planned annual contribution amount up to the statutory IRS limit.',
      'Set the number of investing years remaining until retirement.',
      'Enter your anticipated average annual compound rate of return (e.g., 7% to 8%).',
      'View the total projected balance, total principal deposited, and pure tax-free investment earnings.'
    ],
    whoBenefits: [
      'Young professionals and early-career savers leveraging decades of tax-free compound growth.',
      'Investors seeking tax diversification alongside taxable brokerage accounts or traditional 401(k)s.',
      'Anyone eager to see the mathematical reward of maximizing annual IRA contributions.'
    ],
    faq: [
      {
        question: 'What is the annual contribution limit for a Roth IRA?',
        answer: 'For 2024, the IRS annual contribution limit is $7,000 (or $8,000 if you are age 50 or older), subject to modified adjusted gross income (MAGI) phase-out limits.'
      },
      {
        question: 'Are withdrawals really 100% tax-free in retirement?',
        answer: 'Yes. Qualified distributions after age 59½ from a Roth IRA open for at least 5 years are completely free from federal and state income taxes.'
      }
    ]
  },
  {
    id: 'emergency-fund',
    slug: 'emergency-fund-planner',
    title: 'Free Emergency Fund Planner Spreadsheet (.xlsx) | Free Expense Tracker',
    metaDescription: 'Download our free Emergency Fund Planner Excel (.xlsx) template. Calculate your essential monthly baseline, target fund size, funding percentage, and goal date.',
    h1: 'Free Emergency Fund Planner Spreadsheet',
    category: 'Savings',
    categoryIcon: '🛡️',
    fileName: '10_US_Emergency_Fund_Planner.xlsx',
    fileSize: '6.4 KB',
    sheetNames: ['Emergency Fund'],
    keyFormulas: [
      'Target Emergency Fund = Monthly Essential Expenses * Target Months',
      'Current Funding % = (Current Emergency Savings / Target Emergency Fund) * 100',
      'Months to Reach Goal = (Target Emergency Fund - Current Emergency Savings) / Monthly Contribution'
    ],
    purpose: 'Determine your exact emergency savings safety net and calculate the months required to fully fund a 3 to 6-month buffer of essential living expenses.',
    overview: 'An emergency fund is the fundamental foundation of personal financial stability. It protects you from high-interest credit card debt or forced 401(k) withdrawals when unexpected life events occur—such as job loss, major vehicle repairs, or medical bills. This spreadsheet strips away non-essential spending to determine your true survival baseline and maps out a realistic monthly savings timeline.',
    howToUse: [
      'Enter your bare-bones essential monthly living expenses (housing, utilities, groceries, medicines, minimum debt payments).',
      'Select your target safety buffer in months (typically 3 to 6 months for wage earners, or 9 to 12 months for freelancers).',
      'Enter your current cash savings designated for emergencies.',
      'Enter your planned monthly savings contribution into a high-yield savings account (HYSA).',
      'Track your progress toward 100% funding and observe the calculated completion date.'
    ],
    whoBenefits: [
      'Households building their very first cash reserve to stop relying on credit cards for emergencies.',
      'Freelancers, self-employed contractors, and commission earners needing a customized emergency cushion.',
      'Families adjusting their emergency fund target after major life events like having a child or buying a home.'
    ],
    faq: [
      {
        question: 'How many months of expenses should I keep in an emergency fund?',
        answer: 'Most financial advisors recommend 3 months of essential expenses for dual-income households with steady jobs, and 6 months for single-income households or individuals with variable incomes.'
      },
      {
        question: 'Where should I keep my emergency fund money?',
        answer: 'Emergency funds should be kept in a liquid, FDIC-insured High-Yield Savings Account (HYSA) or money market fund, ensuring immediate access while earning competitive interest.'
      }
    ]
  },
  {
    id: 'subscription-audit',
    slug: 'subscription-audit',
    title: 'Free Subscription Audit Spreadsheet (Excel .xlsx) | Free Expense Tracker',
    metaDescription: 'Audit recurring subscriptions and memberships with our free Excel (.xlsx) template. Track renewal dates, eliminate forgotten fees, and calculate annual savings.',
    h1: 'Free Subscription Audit Spreadsheet Template',
    category: 'Audits & Tracking',
    categoryIcon: '🧾',
    fileName: '11_US_Subscription_Audit.xlsx',
    fileSize: '9.5 KB',
    sheetNames: ['Subscriptions', 'Summary'],
    keyFormulas: [
      'Annual Cost = Monthly Cost * 12',
      'Summary Monthly Total = SUM of all active monthly subscription fees',
      'Potential Annual Savings = SUM of annual costs where Keep? equals "No"'
    ],
    purpose: 'Catalog, audit, and cancel recurring monthly and annual subscriptions to recover hundreds of dollars in wasted cash flow every year.',
    overview: 'Subscription creep is one of the most insidious drains on modern personal finances. Streaming services, software licenses, gym memberships, delivery apps, and cloud storage subscriptions quietly bill credit cards every month, often long after you have stopped using them. This two-sheet workbook organizes all recurring memberships and instantly computes how much money you save by canceling unwanted services.',
    howToUse: [
      'Review the last 60–90 days of bank and credit card statements to identify every recurring charge.',
      'Enter each service name, category (Streaming, Fitness, Software, Utilities), and monthly billing charge.',
      'The spreadsheet automatically computes the full annual cost of each service.',
      'Record upcoming renewal dates to avoid surprise automatic renewals.',
      'Mark the "Keep?" column with Yes or No for each subscription.',
      'Switch to the Summary tab to view your total monthly subscription outlay and immediate annual savings from cancellations.'
    ],
    whoBenefits: [
      'Anyone looking to quickly cut $50 to $200+ from their monthly spending without drastically changing their lifestyle.',
      'Households managing multiple streaming, software, gaming, and subscription box memberships.',
      'Consumers preparing a tighter budget to boost savings or accelerate debt payoff.'
    ],
    faq: [
      {
        question: 'How often should I conduct a subscription audit?',
        answer: 'Conducting a subscription audit every 3 to 6 months helps identify free trials that converted to paid plans and eliminates unused services before annual renewals hit.'
      },
      {
        question: 'Can I track annual billing plans alongside monthly subscriptions?',
        answer: 'Yes. If a subscription bills annually, simply enter the annual cost divided by 12 into the monthly column, or note the full billing cycle in the notes column.'
      }
    ]
  },
  {
    id: 'sinking-fund',
    slug: 'sinking-fund-planner',
    title: 'Free Sinking Fund Planner Spreadsheet (.xlsx) | Free Expense Tracker',
    metaDescription: 'Plan for irregular expenses with our free Sinking Fund Planner Excel (.xlsx) spreadsheet. Smooth your budget for car maintenance, holidays, taxes, and travel.',
    h1: 'Free Sinking Fund Planner Spreadsheet',
    category: 'Savings',
    categoryIcon: '🛡️',
    fileName: '12_US_Sinking_Fund_Planner.xlsx',
    fileSize: '8.0 KB',
    sheetNames: ['Sinking Funds'],
    keyFormulas: [
      'Remaining Amount = Target Amount - Current Saved',
      'Months Left = (Target Date - TODAY()) / 30.4',
      'Monthly Contribution Needed = Remaining Amount / Months Left'
    ],
    purpose: 'Smooth out predictable non-monthly expenses (like vehicle insurance, holiday gifts, vacation travel, and home repairs) by saving small monthly installments in advance.',
    overview: 'Expenses that occur irregularly—such as annual car registration, semi-annual auto insurance premiums, holiday gifts, or quarterly estimated taxes—often derail monthly budgets and end up on credit cards. Sinking funds solve this by breaking large future costs into predictable, manageable monthly savings contributions, ensuring money is already waiting when the bill arrives.',
    howToUse: [
      'List your upcoming target financial goals or irregular bills in the Goal column (e.g., Vacation, Property Tax, Car Tires).',
      'Enter the target total dollar amount needed and your target deadline date.',
      'Input the current dollar amount already saved in that dedicated fund.',
      'The formula automatically calculates the remaining dollar balance and exact months left until the target date.',
      'Review the "Monthly Contribution Needed" column to see exactly how much cash to set aside each month.'
    ],
    whoBenefits: [
      'Budgeters who find their monthly cash flow disrupted by predictable quarterly or annual expenses.',
      'Individuals saving toward specific near-term goals like vacations, weddings, or holiday shopping.',
      'Homeowners and car owners planning ahead for routine maintenance without tapping their emergency fund.'
    ],
    faq: [
      {
        question: 'What is the difference between an emergency fund and a sinking fund?',
        answer: 'An emergency fund is reserved exclusively for unforeseen, sudden emergencies (like sudden job loss or medical emergencies). Sinking funds are designated for expected, predictable future costs (like auto maintenance or insurance premiums).'
      },
      {
        question: 'Should I open separate bank accounts for each sinking fund?',
        answer: 'Many modern online banks offer sub-accounts or "savings buckets" under one login. Alternatively, keep the funds in a single high-yield savings account and use this spreadsheet as your tracking ledger.'
      }
    ]
  },
  {
    id: 'net-worth',
    slug: 'net-worth-tracker',
    title: 'Free Net Worth Tracker Spreadsheet (.xlsx) | Free Expense Tracker',
    metaDescription: 'Track total assets, liabilities, and true financial net worth with our free Excel (.xlsx) Net Worth Tracker spreadsheet. Monitor your financial health over time.',
    h1: 'Free Net Worth Tracker Spreadsheet Template',
    category: 'Investing & Retirement',
    categoryIcon: '📈',
    fileName: '13_US_Net_Worth_Tracker.xlsx',
    fileSize: '8.5 KB',
    sheetNames: ['Net Worth', 'Summary'],
    keyFormulas: [
      'Total Assets = SUM of all Cash, Investments, Real Estate, and Personal Property items',
      'Total Liabilities = SUM of all Mortgages, Student Loans, Auto Loans, and Credit Balances',
      'Net Worth = Total Assets - Total Liabilities'
    ],
    purpose: 'Measure your true financial health by aggregating all assets and subtracting all liabilities to calculate and track your net worth over time.',
    overview: 'Income alone does not reflect true wealth; how much of that income you convert into accumulating assets and eliminating debt determines your long-term financial security. Your net worth is the single most comprehensive scorecard of your financial trajectory. This two-sheet workbook categorizes all accounts and produces an executive summary of your balance sheet.',
    howToUse: [
      'Open the "Net Worth" sheet to inventory all of your financial assets and debts.',
      'Enter Asset accounts: checking, savings, retirement accounts (401k, IRA), brokerage funds, home market value, and vehicles.',
      'Enter Liability accounts: primary mortgage, vehicle loans, student debt, credit card balances, and personal loans.',
      'Update account balances periodically (monthly or quarterly) for a consistent historical snapshot.',
      'Switch to the "Summary" sheet to view your aggregated Total Assets, Total Liabilities, and computed Net Worth.'
    ],
    whoBenefits: [
      'Individuals and families monitoring long-term progress toward financial independence and retirement.',
      'Borrowers focused on debt elimination who want to see their net worth climb as liabilities shrink.',
      'Investors tracking asset allocation across multiple retirement, brokerage, and real estate holdings.'
    ],
    faq: [
      {
        question: 'Should I include my primary home and vehicle in my net worth?',
        answer: 'Yes, as long as you value them conservatively. Record the realistic market value under Assets and the outstanding loan balance under Liabilities.'
      },
      {
        question: 'How often should I update my net worth spreadsheet?',
        answer: 'Updating once a month or once a quarter is ideal. Updating too frequently (daily) introduces noise from normal market volatility without adding strategic insight.'
      }
    ]
  },
  {
    id: 'financial-dashboard',
    slug: 'financial-dashboard',
    title: 'Free Financial Dashboard Spreadsheet (Excel .xlsx) | Free Expense Tracker',
    metaDescription: 'Download our comprehensive Financial Dashboard spreadsheet for Excel (.xlsx). Track income, living expenses, net cash flow, and monthly savings rate in one workbook.',
    h1: 'Free Financial Dashboard Spreadsheet Template',
    category: 'Budgeting',
    categoryIcon: '💰',
    fileName: '14_US_Financial_Dashboard.xlsx',
    fileSize: '12.5 KB',
    sheetNames: ['Transactions', 'Dashboard'],
    keyFormulas: [
      'Net Cash Flow = Total Income - Total Expenses',
      'Savings Rate % = (Net Cash Flow / Total Income) * 100',
      'Total Income & Total Expenses = Dynamic SUMIF formulas referencing the transaction ledger'
    ],
    purpose: 'Combine transactional ledger logging with high-level executive financial metrics to monitor monthly income, expense totals, cash flow surplus, and savings rates.',
    overview: 'The Financial Dashboard is a full-featured personal finance hub. By pairing a 500-row transaction ledger with an automated summary dashboard, this workbook calculates your total earnings, total living costs, net cash flow, and savings percentage automatically. It bridges the gap between detailed line-item expense logging and strategic financial oversight.',
    howToUse: [
      'Navigate to the "Transactions" sheet to record daily transactions (Date, Description, Category, Type: Income/Expense, Amount).',
      'Use standard categories such as Housing, Groceries, Utilities, Transportation, Dining, and Healthcare.',
      'Navigate to the "Dashboard" sheet to review automatically calculated financial totals.',
      'Monitor your Net Cash Flow to verify your spending leaves a positive surplus each month.',
      'Track your Savings Rate percentage to assess progress toward long-term wealth building goals.'
    ],
    whoBenefits: [
      'Users looking for an all-in-one spreadsheet that handles both daily expense logging and executive-level summaries.',
      'Households managing variable income who need clear visibility into their monthly net cash flow.',
      'Spreadsheet enthusiasts who want an offline, formula-driven alternative to cloud budgeting apps.'
    ],
    faq: [
      {
        question: 'Do I need advanced Excel skills to use the dashboard?',
        answer: 'Not at all. You only need to type your expenses and income into the Transactions sheet. All totals, cash flow formulas, and savings rates update automatically.'
      },
      {
        question: 'Can I export transactions from my online bank into this sheet?',
        answer: 'Yes. Most banks allow downloading a CSV file of transactions, which you can easily copy and paste into the Transactions sheet columns.'
      }
    ]
  },
  {
    id: 'monthly-spending',
    slug: 'monthly-spending-analyzer',
    title: 'Free Monthly Spending Analyzer Spreadsheet (.xlsx) | Free Expense Tracker',
    metaDescription: 'Download our free Monthly Spending Analyzer in Excel (.xlsx). Categorize spending by merchant, analyze category totals, and find spending leaks fast.',
    h1: 'Free Monthly Spending Analyzer Spreadsheet',
    category: 'Budgeting',
    categoryIcon: '💰',
    fileName: '15_US_Monthly_Spending_Analyzer.xlsx',
    fileSize: '12.8 KB',
    sheetNames: ['Spending Log', 'Analysis'],
    keyFormulas: [
      'Total Monthly Spending = SUM of all amounts in Spending Log',
      'Category Totals = SUMIF(Spending_Log_Category, Category_Name, Spending_Log_Amount)'
    ],
    purpose: 'Analyze historical monthly expenditures, break down costs by merchant and spending category, and pinpoint spending leaks across your household budget.',
    overview: 'Where does your money really go each month? Many people guess at their spending categories, severely underestimating food, dining, and discretionary purchases. The Monthly Spending Analyzer pairs an intuitive 500-row spending log with a category analysis sheet that aggregates your expenses into clear categories (Housing, Food, Transportation, Utilities, Entertainment, Healthcare), making it easy to identify where to trim costs.',
    howToUse: [
      'Input every expenditure into the "Spending Log" sheet (Date, Merchant, Category, Amount, Payment Method).',
      'Assign each transaction to an appropriate category (Housing, Food, Transportation, etc.).',
      'Switch to the "Analysis" tab to inspect aggregated category totals and see the percentage breakdown of your budget.',
      'Identify top spending categories that exceed planned budget benchmarks.',
      'Use findings to adjust spending habits or set targeted reduction goals for the following month.'
    ],
    whoBenefits: [
      'Anyone shocked by credit card bills who wants to uncover where their money is actually going.',
      'Couples analyzing shared monthly spending to agree on category budget caps.',
      'Budgeters conducting a one-month financial audit to establish baseline spending data.'
    ],
    faq: [
      {
        question: 'How many transactions does this sheet support?',
        answer: 'The workbook comes pre-configured with 500 transaction rows and dynamic SUMIF formulas that can easily be extended if you have higher transaction volume.'
      },
      {
        question: 'Can I add custom categories to the analysis tab?',
        answer: 'Yes. You can add new category rows in the Analysis sheet using the SUMIF formula format provided in the workbook.'
      }
    ]
  },
  {
    id: 'monthly-bill-tracker',
    slug: 'monthly-bill-tracker',
    title: 'Free Monthly Bill Tracker Spreadsheet (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Download our free monthly bill tracker spreadsheet for Excel and Google Sheets. Organize recurring bills, due dates, autopay, and payments with no sign-up.',
    h1: 'Free Monthly Bill Tracker Spreadsheet',
    category: 'Budgeting',
    categoryIcon: '📅',
    fileName: '16_US_Monthly_Bill_Tracker.xlsx',
    fileSize: '31.5 KB',
    sheetNames: ['Monthly Bill Tracker', 'Annual Bill Calendar'],
    keyFormulas: [
      'Total Monthly Bills = SUM(Bill_Amounts)',
      'Autopay Total = SUMIF(Autopay_Range, "Yes", Bill_Amounts)',
      'Unpaid Amount = SUMIF(Status_Range, "Pending", Bill_Amounts)',
      'Annualized Cost = Monthly_Amount * 12'
    ],
    purpose: 'Keep track of every recurring monthly expense, payment due dates, autopay status, and confirmation numbers to eliminate late fees and stay ahead of bill cycles.',
    overview: 'Managing dozens of scattered utility, rent, subscription, and loan payments every month often leads to missed due dates and costly late penalties. The Monthly Bill Tracker Spreadsheet provides an organized, centralized command center for your recurring obligations. Log bill names, payment amounts, due dates, payment methods, and autopay indicators across all 12 calendar months with instant summary calculations.',
    howToUse: [
      'List all recurring monthly expenses including rent/mortgage, utilities, insurance, subscriptions, and debt minimums.',
      'Enter the calendar due date, expected bill amount, and whether the account is enrolled in automatic bank debit.',
      'Mark each bill as paid as you complete payments during the month and record confirmation numbers.',
      'Review your total monthly fixed obligations against your take-home income to keep essential bills within sustainable budget limits.'
    ],
    whoBenefits: [
      'Households balancing multiple utility, credit card, and housing due dates across different paycheck cycles.',
      'Individuals who want to verify that automated recurring subscriptions and bill debits do not cause account overdrafts.',
      'Anyone transitioning from disorganized paper bills to a clean, reliable digital checklist.'
    ],
    faq: [
      {
        question: 'How does a monthly bill tracker spreadsheet prevent late fees and penalties?',
        answer: 'By listing all your recurring bills in chronological order by due date and noting whether each is on autopay or manual payment, you can see upcoming obligations at a glance. Marking bills as paid as they clear prevents oversight and ensures your account always has sufficient funds on debit days.'
      },
      {
        question: 'Can I track variable bills like electric, heating, or water in this spreadsheet?',
        answer: 'Yes. For utilities that fluctuate with seasons, enter an estimated monthly average or update the expected amount when your monthly statement arrives. The sheet dynamically recalculates your overall monthly total.'
      },
      {
        question: 'How does this bill tracker differ from the paycheck budget spreadsheet?',
        answer: 'The monthly bill tracker focuses specifically on recurring obligations, due dates, and payment confirmations across the calendar month. The paycheck budget spreadsheet aligns all spending and savings categories directly to individual paycheck deposits.'
      },
      {
        question: 'Is this bill tracker compatible with both Microsoft Excel and Google Sheets?',
        answer: 'Yes. The workbook is provided in standard .xlsx format without macros or password protection. You can open and edit it offline in Microsoft Excel or import it into Google Drive to update on your phone or desktop.'
      }
    ]
  },
  {
    id: '52-week-savings-challenge',
    slug: '52-week-savings-challenge',
    title: 'Free 52-Week Savings Challenge (Excel, Google Sheets & Printable) | Free Expense Tracker',
    metaDescription: 'Download our free 52-week savings challenge spreadsheet for Excel & Google Sheets or printable PDF. Save $1,378 in a year with no sign-up.',
    h1: 'Free 52-Week Savings Challenge',
    category: 'Savings',
    categoryIcon: '💰',
    fileName: '17_US_52_Week_Savings_Challenge.xlsx',
    fileSize: '47.0 KB',
    sheetNames: ['Challenge', 'Reverse', 'Printable'],
    keyFormulas: [
      'Total Target = SUM(Deposit_Range)',
      'Total Saved = SUMIF(Done_Range, TRUE, Deposit_Range)',
      'Weeks Completed = COUNTIF(Done_Range, TRUE)',
      'Running Balance = Previous_Balance + Weekly_Deposit'
    ],
    purpose: 'Systematically build a $1,378 cash cushion in one year by saving small, progressive weekly deposits using a classic or reverse 52-week money schedule.',
    overview: 'The 52-Week Savings Challenge is a proven behavioral finance strategy to automate consistent savings without shocking your monthly cash flow. Starting with just $1 on week 1 and building to $52 in week 52, you painlessly accumulate $1,378 over 12 months. This free spreadsheet and printable tracker provides standard progressive, reverse, and biweekly models with dynamic progress formulas and checkbox accountability.',
    howToUse: [
      'Choose your preferred savings direction: the classic progressive ladder ($1 to $52) or the reverse challenge ($52 down to $1).',
      'Set your challenge start date to automatically generate dates for all 52 weeks of the calendar year.',
      'Transfer the scheduled weekly amount into a dedicated savings or high-yield bank account each week.',
      'Check off the Done box in the spreadsheet or mark your printable tracker to watch your total saved climb toward $1,378.'
    ],
    whoBenefits: [
      'Beginner savers establishing their first $1,000+ emergency starter fund or cash reserve.',
      'Budgeters wanting a clear visual tracker to prepare for holiday gifts, vacation expenses, or sinking fund goals.',
      'Households looking for a fun, achievable financial habit to build lasting money discipline.'
    ],
    faq: [
      {
        question: 'How much money do you save in the 52-week savings challenge?',
        answer: 'By depositing an amount matching each week\'s number ($1 in week 1 up to $52 in week 52), you accumulate exactly $1,378.00 at the end of 52 weeks. If you double the challenge ($2 to $104), you will save $2,756.00.'
      },
      {
        question: 'Is it better to do the regular or reverse 52-week challenge?',
        answer: 'The reverse challenge (starting at $52 and ending at $1) is recommended for most people because it places the largest deposits in January when resolution motivation is high, and leaves the smallest $1 to $4 deposits for December when holiday expenses are heaviest.'
      },
      {
        question: 'How do I do the 52-week challenge if I get paid bi-weekly?',
        answer: 'If you are paid every two weeks (26 paychecks per year), simply combine two weeks of deposits per paycheck (e.g., Paycheck 1 = $1 + $2 = $3, Paycheck 2 = $3 + $4 = $7), or deposit an even $53 every payday to hit the exact same $1,378 goal.'
      },
      {
        question: 'Can I use this spreadsheet in Google Sheets or print it out?',
        answer: 'Yes. The workbook is 100% compatible with Microsoft Excel and Google Sheets with no macros. It also includes a pre-formatted \'Printable\' sheet formatted to fit standard A4 or US Letter paper for offline tracking.'
      }
    ]
  }
];

export function getTemplateBySlug(slug: string): TemplateData | undefined {
  return TEMPLATES_DATA.find((t) => t.slug === slug);
}
