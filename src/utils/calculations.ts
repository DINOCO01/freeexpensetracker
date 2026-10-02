export type Frequency = "monthly" | "bi-weekly" | "weekly";
export type BudgetModel = "50-30-20" | "70-20-10" | "80-20" | "zero-based";
export type StandardExpenseCategory =
  | "Housing"
  | "Food"
  | "Transport"
  | "Utilities"
  | "Entertainment"
  | "Savings"
  | "Miscellany"
  | "Income";

export type ExpenseCategory = StandardExpenseCategory | (string & {});

export type CategoryType = "need" | "want" | "savings";

/**
 * Economic classification of a transaction for Savings Rate computation.
 *
 * INCOME            - Salary, business receipts, freelance, interest credits, dividends,
 *                     cashback credits. Contributes to total income.
 *
 * CONSUMPTION       - Food, groceries, housing/rent, utilities, transport, shopping,
 *                     entertainment, bills, and other genuine personal-consumption outflows.
 *                     Reduces savings.
 *
 * SAVINGS_INVESTMENT - Explicit savings deposits, SIP / mutual-fund contributions, FD
 *                      investments, brokerage purchases. Money being set aside, NOT
 *                      consumed. Excluded from consumption; not double-counted.
 *
 * INTERNAL_TRANSFER - Movement between the user own accounts (e.g. current to savings).
 *                     Neither income nor consumption. Excluded from both sides.
 *
 * DEBT_PAYMENT      - Loan principal repayment or credit-card payment where underlying
 *                     purchases are already recorded. Excluded from consumption.
 *
 * REFUND_REVERSAL   - Reversal or return credit that offsets a prior consumption outflow.
 *                     Treated as income for savings rate purposes.
 *
 * UNKNOWN           - Cannot be reliably classified. Excluded from savings rate.
 */
export type TxEconomicClass =
  | "INCOME"
  | "CONSUMPTION"
  | "SAVINGS_INVESTMENT"
  | "INTERNAL_TRANSFER"
  | "DEBT_PAYMENT"
  | "REFUND_REVERSAL"
  | "UNKNOWN";

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar ($)" },
  EUR: { code: "EUR", symbol: "\u20ac", name: "Euro (\u20ac)" },
  GBP: { code: "GBP", symbol: "\u00a3", name: "British Pound (\u00a3)" },
  CAD: { code: "CAD", symbol: "CA$", name: "Canadian Dollar (CA$)" },
  AUD: { code: "AUD", symbol: "AU$", name: "Australian Dollar (AU$)" },
  INR: { code: "INR", symbol: "\u20b9", name: "Indian Rupee (\u20b9)" },
  JPY: { code: "JPY", symbol: "\u00a5", name: "Japanese Yen (\u00a5)" },
  CHF: { code: "CHF", symbol: "CHF ", name: "Swiss Franc (CHF)" },
  CNY: { code: "CNY", symbol: "\u00a5", name: "Chinese Yuan (\u00a5)" },
  SGD: { code: "SGD", symbol: "S$", name: "Singapore Dollar (S$)" },
  NZD: { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar (NZ$)" },
  AED: { code: "AED", symbol: "AED ", name: "UAE Dirham (AED)" },
  SAR: { code: "SAR", symbol: "SAR ", name: "Saudi Riyal (SAR)" },
  BRL: { code: "BRL", symbol: "R$", name: "Brazilian Real (R$)" },
  MXN: { code: "MXN", symbol: "Mex$", name: "Mexican Peso (Mex$)" },
  ZAR: { code: "ZAR", symbol: "R", name: "South African Rand (R)" },
  SEK: { code: "SEK", symbol: "kr ", name: "Swedish Krona (kr)" },
  KRW: { code: "KRW", symbol: "\u20a9", name: "South Korean Won (\u20a9)" },
  PHP: { code: "PHP", symbol: "\u20b1", name: "Philippine Peso (\u20b1)" },
  MYR: { code: "MYR", symbol: "RM", name: "Malaysian Ringgit (RM)" },
  IDR: { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah (Rp)" },
  TRY: { code: "TRY", symbol: "\u20ba", name: "Turkish Lira (\u20ba)" },
  PKR: { code: "PKR", symbol: "Rs", name: "Pakistani Rupee (Rs)" },
  BDT: { code: "BDT", symbol: "\u09f3", name: "Bangladeshi Taka (\u09f3)" },
  NGN: { code: "NGN", symbol: "\u20a6", name: "Nigerian Naira (\u20a6)" }
};

export interface Transaction {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  source?: "manual" | "imported";
  type?: "expense" | "income";
  currency?: string;
  sourceFile?: string;
  sourceType?: "pdf" | "excel" | "csv" | "image" | "sheets";
  confidence?: number;
  needsReview?: boolean;
  warningReason?: string;
}

export const CATEGORY_TYPES: Record<string, CategoryType> = {
  Housing: "need",
  Food: "need",
  Transport: "need",
  Utilities: "need",
  Entertainment: "want",
  Miscellany: "want",
  Savings: "savings",
  Income: "savings",
  "Health & Fitness": "want"
};

export const CATEGORY_ICONS: Record<string, string> = {
  Housing: "\ud83c\udfe0",
  Food: "\ud83e\udd57",
  Transport: "\ud83d\ude97",
  Utilities: "\u26a1",
  Entertainment: "\ud83c\udf9f\ufe0f",
  Savings: "\ud83c\udfe6",
  Miscellany: "\ud83d\udce6",
  Income: "\ud83d\udcb5",
  "Health & Fitness": "\ud83c\udfcb\ufe0f"
};

// ---------------------------------------------------------------------------
// Economic Classification
// ---------------------------------------------------------------------------

/**
 * Patterns for own-account / between-own-account movements.
 * Covers standard descriptions AND real Indian bank narration formats:
 *   - SBI: "INB Transfer to SBI A/c", "NEFT-To Savings Account", "Transfer to SBI Savings"
 *   - UPI: "UPI/P2A/...", "UPI Transfer to Savings"
 *   - IMPS/NEFT/RTGS: "IMPS to Current Account", "NEFT to Savings Account"
 *   - Generic: "Transfer to Account XXXXXXXXXX", "Transfer to A/c"
 */
const INTERNAL_TRANSFER_PATTERNS =
  /\b(self\s*transfer|own\s*account|inter[\s-]?account|neft\s*own|imps\s*own|transfer\s*to\s*(own|self|savings|current|sbi|a\/c|account)|sweep\s*out|sweep\s*in|balance\s*transfer\s*to\s*own|inb\s*transfer|p2a|imps\s*to\s*(savings|current|own)|neft[\s-]*to\s*(savings|current|own)|rtgs\s*to\s*(savings|current|own)|upi[\s-]*lite[\s-]*top[\s-]*up)\b/i;

const REFUND_PATTERNS =
  /\b(refund|reversal|chargeback|cashback|return\s*credit|reimbursement|rebate|credit\s*note)\b/i;

const DEBT_PAYMENT_PATTERNS =
  /\b(loan\s*(emi|repayment|payment)|emi\s*(payment|debit|auto)?|credit[\s-]?card\s*(payment|bill|due|outstanding|autopay)|cc\s*(payment|bill|autopay)|home\s*loan|auto\s*loan|personal\s*loan\s*emi|mortgage\s*payment|nach\d+|ach\s+finance|bajaj\s+finance|upi\s+mandate)\b/i;

const SAVINGS_INVESTMENT_PATTERNS =
  /\b(sip|mutual\s*fund|mf\s*(purchase|redemption)?|lump\s*sum\s*invest|ppf(\s*contribution)?|nps(\s*contribution)?|fd\s*(creation|deposit|booking)|fixed\s*deposit|recurring\s*deposit|rd\s*(installment|credit|payment)?|ira|401k|brokerage|zerodha|groww|smallcase|etf\s*purchase|investment\s*(transfer|deposit))\b/i;

/**
 * Derive the economic purpose of a transaction from its normalized fields.
 *
 * Priority order:
 *  1. t.type === "income" (or legacy category="Income") -> INCOME / REFUND_REVERSAL
 *  2. Outflow: category === "Savings" -> SAVINGS_INVESTMENT
 *  3. Outflow: description keywords -> SAVINGS_INVESTMENT / INTERNAL_TRANSFER / DEBT_PAYMENT
 *  4. Everything else -> CONSUMPTION
 */
export function classifyTransactionEconomics(t: Transaction): TxEconomicClass {
  const isIncomeTx = t.type === "income" || (!t.type && t.category === "Income");
  const desc = (t.name || "").toLowerCase();

  if (isIncomeTx) {
    if (REFUND_PATTERNS.test(desc)) return "REFUND_REVERSAL";
    return "INCOME";
  }

  // Outflow classification
  if (t.category === "Savings") return "SAVINGS_INVESTMENT";
  if (SAVINGS_INVESTMENT_PATTERNS.test(desc)) return "SAVINGS_INVESTMENT";
  if (INTERNAL_TRANSFER_PATTERNS.test(desc)) return "INTERNAL_TRANSFER";
  if (DEBT_PAYMENT_PATTERNS.test(desc)) return "DEBT_PAYMENT";

  return "CONSUMPTION";
}

// ---------------------------------------------------------------------------
// Savings Metrics - single source of truth
// ---------------------------------------------------------------------------

/**
 * Aggregated savings metrics derived entirely from transaction data.
 *
 * FORMULA
 *   Tracker Savings = Total Income - Eligible Consumption Spending
 *   Savings Rate    = (Tracker Savings / Total Income) x 100
 *
 * Eligible Consumption excludes: savings/investment outflows, internal
 * transfers, debt payments, and unknown transactions.
 *
 * Net Cashflow (separate concept):
 *   Net Cashflow = Total Income - All Outflows
 *
 * No transaction is counted in more than one category.
 */
export interface SavingsMetrics {
  totalIncome: number;
  consumptionSpending: number;
  savingsAmount: number;
  internalTransferAmount: number;
  debtPaymentAmount: number;
  trackerSavings: number;
  savingsRatePct: number;
  netCashflow: number;
  netCashflowRatePct: number;
}

export function calculateSavingsMetrics(
  transactions: Transaction[],
  manualIncome: number = 0
): SavingsMetrics {
  let incomeFromTransactions = 0;
  let consumptionSpending = 0;
  let savingsAmount = 0;
  let internalTransferAmount = 0;
  let debtPaymentAmount = 0;

  for (const t of transactions) {
    const ec = classifyTransactionEconomics(t);
    switch (ec) {
      case "INCOME":
      case "REFUND_REVERSAL":
        incomeFromTransactions += t.amount;
        break;
      case "CONSUMPTION":
        consumptionSpending += t.amount;
        break;
      case "SAVINGS_INVESTMENT":
        savingsAmount += t.amount;
        break;
      case "INTERNAL_TRANSFER":
        internalTransferAmount += t.amount;
        break;
      case "DEBT_PAYMENT":
        debtPaymentAmount += t.amount;
        break;
      case "UNKNOWN":
        break;
    }
  }

  const totalIncome = Math.max(0, manualIncome) + incomeFromTransactions;
  const trackerSavings = totalIncome - consumptionSpending;
  const savingsRatePct = totalIncome > 0 ? (trackerSavings / totalIncome) * 100 : 0;
  const allOutflows = consumptionSpending + savingsAmount + internalTransferAmount + debtPaymentAmount;
  const netCashflow = totalIncome - allOutflows;
  const netCashflowRatePct = totalIncome > 0 ? (netCashflow / totalIncome) * 100 : 0;

  return {
    totalIncome,
    consumptionSpending,
    savingsAmount,
    internalTransferAmount,
    debtPaymentAmount,
    trackerSavings,
    savingsRatePct,
    netCashflow,
    netCashflowRatePct
  };
}

// ---------------------------------------------------------------------------
// Existing helpers (unchanged API)
// ---------------------------------------------------------------------------

export function normalizeToMonthly(amount: number, frequency: Frequency): number {
  if (isNaN(amount) || amount <= 0) return 0;
  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "bi-weekly":
      return (amount * 26) / 12;
    case "monthly":
    default:
      return amount;
  }
}

export function formatCurrency(
  amount: number,
  currencyCode: string = "USD",
  localeCode?: string
): string {
  const curr = SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES.USD;
  const isWhole = Math.round(amount) === amount;
  
  let activeLocale = localeCode;
  if (!activeLocale && typeof document !== 'undefined') {
    activeLocale = document.documentElement.dataset.locale || document.documentElement.lang || 'en';
  }

  let locale = "en-US";
  if (currencyCode === "INR" || activeLocale === "hi") {
    locale = "en-IN"; // Preserves Indian lakh/crore formatting
  } else if (activeLocale) {
    const localeMap: Record<string, string> = {
      de: "de-DE",
      fr: "fr-FR",
      es: "es-ES",
      pt: "pt-PT",
      ja: "ja-JP",
      ko: "ko-KR",
      en: "en-US"
    };
    locale = localeMap[activeLocale] || "en-US";
  }

  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);

  return `${curr.symbol}${formattedNumber}`;
}

export interface ModelTargetBreakdown {
  model: BudgetModel;
  name: string;
  description: string;
  needsTarget: number;
  wantsTarget: number;
  savingsTarget: number;
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
}

export function calculateModelTargets(monthlyIncome: number, model: BudgetModel): ModelTargetBreakdown {
  const income = Math.max(0, monthlyIncome);
  switch (model) {
    case "70-20-10":
      return {
        model,
        name: "70 / 20 / 10 Framework",
        description: "70% Living Essentials, 20% Savings & Debt, 10% Discretionary",
        needsPct: 70,
        wantsPct: 10,
        savingsPct: 20,
        needsTarget: income * 0.7,
        wantsTarget: income * 0.1,
        savingsTarget: income * 0.2
      };
    case "80-20":
      return {
        model,
        name: "80 / 20 Simplified Rule",
        description: "80% Living & Spending, 20% Direct Wealth Building",
        needsPct: 80,
        wantsPct: 0,
        savingsPct: 20,
        needsTarget: income * 0.8,
        wantsTarget: 0,
        savingsTarget: income * 0.2
      };
    case "zero-based":
      return {
        model,
        name: "Zero-Based Budgeting",
        description: "Every single dollar is assigned a specific job (Income - Expenses = 0)",
        needsPct: 50,
        wantsPct: 30,
        savingsPct: 20,
        needsTarget: income * 0.5,
        wantsTarget: income * 0.3,
        savingsTarget: income * 0.2
      };
    case "50-30-20":
    default:
      return {
        model: "50-30-20",
        name: "50 / 30 / 20 Balanced Model",
        description: "50% Needs, 30% Wants, 20% Savings & Debt Acceleration",
        needsPct: 50,
        wantsPct: 30,
        savingsPct: 20,
        needsTarget: income * 0.5,
        wantsTarget: income * 0.3,
        savingsTarget: income * 0.2
      };
  }
}

// ---------------------------------------------------------------------------
// Financial Health Score
// ---------------------------------------------------------------------------

export interface FinancialHealthResult {
  score: number;
  tier: "Excellent" | "Good" | "Caution" | "Financial Stress";
  tierColor: string;
  tierBg: string;
  tierBorder: string;
  savingsRateScore: number;
  fixedCostScore: number;
  bufferScore: number;
  /**
   * Tracker Savings Rate (%) - the SINGLE source of truth shared between
   * the dashboard Savings Rate card and the Financial Health Indicator.
   * Formula: (TotalIncome - ConsumptionSpending) / TotalIncome x 100
   */
  savingsRatePct: number;
  fixedCostPct: number;
  bufferPct: number;
  recommendations: string[];
  /** Full savings breakdown for transparency. */
  metrics: SavingsMetrics;
}

export function calculateFinancialHealthScore(
  totalIncome: number,
  transactions: Transaction[]
): FinancialHealthResult {
  const emptyMetrics: SavingsMetrics = {
    totalIncome: 0,
    consumptionSpending: 0,
    savingsAmount: 0,
    internalTransferAmount: 0,
    debtPaymentAmount: 0,
    trackerSavings: 0,
    savingsRatePct: 0,
    netCashflow: 0,
    netCashflowRatePct: 0
  };

  if (totalIncome <= 0 || transactions.length === 0) {
    return {
      score: 50,
      tier: "Caution",
      tierColor: "#D97706",
      tierBg: "#FFFBEB",
      tierBorder: "#FDE68A",
      savingsRateScore: 20,
      fixedCostScore: 20,
      bufferScore: 10,
      savingsRatePct: 0,
      fixedCostPct: 0,
      bufferPct: 0,
      recommendations: [
        "Set your monthly take-home income above to activate accurate financial health scoring.",
        "Log recurring expenses (rent, groceries, transit) to analyze your essential cost burden."
      ],
      metrics: emptyMetrics
    };
  }

  // Use calculateSavingsMetrics as the single source of truth.
  // totalIncome is already the effective total (manual + tx income) from the caller,
  // so we pass manualIncome=0 to avoid double-counting, then override totalIncome.
  const rawMetrics = calculateSavingsMetrics(transactions, 0);

  const allOutflows =
    rawMetrics.consumptionSpending +
    rawMetrics.savingsAmount +
    rawMetrics.internalTransferAmount +
    rawMetrics.debtPaymentAmount;

  const metrics: SavingsMetrics = {
    ...rawMetrics,
    totalIncome,
    trackerSavings: totalIncome - rawMetrics.consumptionSpending,
    savingsRatePct:
      totalIncome > 0
        ? ((totalIncome - rawMetrics.consumptionSpending) / totalIncome) * 100
        : 0,
    netCashflow: totalIncome - allOutflows,
    netCashflowRatePct:
      totalIncome > 0 ? ((totalIncome - allOutflows) / totalIncome) * 100 : 0
  };

  // 1. Savings Rate (40 pts)
  const savingsRatePct = metrics.savingsRatePct;
  let savingsRateScore = 0;
  if (savingsRatePct >= 20) {
    savingsRateScore = 40;
  } else if (savingsRatePct >= 10) {
    savingsRateScore = 20 + ((savingsRatePct - 10) / 10) * 20;
  } else if (savingsRatePct > 0) {
    savingsRateScore = (savingsRatePct / 10) * 20;
  }

  // 2. Fixed Cost Burden (40 pts) - need-category consumption only
  let totalNeeds = 0;
  for (const t of transactions) {
    const ec = classifyTransactionEconomics(t);
    if (ec === "CONSUMPTION") {
      const catType = CATEGORY_TYPES[t.category] || "want";
      if (catType === "need") totalNeeds += t.amount;
    }
  }
  const fixedCostPct = (totalNeeds / totalIncome) * 100;
  let fixedCostScore = 0;
  if (fixedCostPct <= 50) {
    fixedCostScore = 40;
  } else if (fixedCostPct <= 70) {
    fixedCostScore = 40 - ((fixedCostPct - 50) / 20) * 25;
  } else if (fixedCostPct <= 90) {
    fixedCostScore = 15 - ((fixedCostPct - 70) / 20) * 15;
  }

  // 3. Cash Buffer (20 pts) - net cashflow %
  const bufferPct = metrics.netCashflowRatePct;
  let bufferScore = 0;
  if (bufferPct >= 15) {
    bufferScore = 20;
  } else if (bufferPct >= 0) {
    bufferScore = (bufferPct / 15) * 20;
  } else {
    bufferScore = Math.max(0, 10 + bufferPct);
  }

  const rawScore = Math.round(savingsRateScore + fixedCostScore + bufferScore);
  const score = Math.max(5, Math.min(100, rawScore));

  let tier: FinancialHealthResult["tier"] = "Good";
  let tierColor = "#059669";
  let tierBg = "#ECFDF5";
  let tierBorder = "#A7F3D0";

  if (score >= 85) {
    tier = "Excellent";
  } else if (score >= 70) {
    tier = "Good";
    tierColor = "#0D9488";
    tierBg = "#F0FDFA";
    tierBorder = "#99F6E4";
  } else if (score >= 50) {
    tier = "Caution";
    tierColor = "#D97706";
    tierBg = "#FFFBEB";
    tierBorder = "#FDE68A";
  } else {
    tier = "Financial Stress";
    tierColor = "#DC2626";
    tierBg = "#FEF2F2";
    tierBorder = "#FECACA";
  }

  const recommendations: string[] = [];
  if (fixedCostPct > 65) {
    recommendations.push(
      `Fixed obligations take up ${Math.round(fixedCostPct)}% of your income. Look into lowering utilities, reviewing insurance policies, or renegotiating recurring subscriptions.`
    );
  } else if (fixedCostPct <= 50) {
    recommendations.push(
      `Outstanding fixed cost discipline! Essentials only consume ${Math.round(fixedCostPct)}% of your income, well within standard healthy limits.`
    );
  }

  if (savingsRatePct < 15) {
    recommendations.push(
      `Your current savings rate is ${Math.round(Math.max(0, savingsRatePct))}%. Aiming for 20% provides strong protection against unexpected events.`
    );
  } else {
    recommendations.push(
      `Solid savings momentum at ${Math.round(savingsRatePct)}%. Consider automating transfers on payday to keep this habit consistent.`
    );
  }

  if (bufferPct < 0) {
    recommendations.push(
      `Monthly expenses exceed income by ${Math.abs(Math.round(bufferPct))}%. Trim flexible spending immediately to prevent debt accumulation.`
    );
  } else if (bufferPct > 20) {
    recommendations.push(
      `You have a comfortable ${Math.round(bufferPct)}% uncommitted cash surplus this month. Direct this into high-yield savings or retirement investing.`
    );
  }

  return {
    score,
    tier,
    tierColor,
    tierBg,
    tierBorder,
    savingsRateScore: Math.round(savingsRateScore),
    fixedCostScore: Math.round(fixedCostScore),
    bufferScore: Math.round(bufferScore),
    savingsRatePct: Math.round(savingsRatePct),
    fixedCostPct: Math.round(fixedCostPct),
    bufferPct: Math.round(bufferPct),
    recommendations,
    metrics
  };
}
