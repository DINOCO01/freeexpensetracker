export type Frequency = 'monthly' | 'bi-weekly' | 'weekly';
export type BudgetModel = '50-30-20' | '70-20-10' | '80-20' | 'zero-based';
export type ExpenseCategory =
  | 'Housing'
  | 'Food'
  | 'Transport'
  | 'Utilities'
  | 'Entertainment'
  | 'Savings'
  | 'Miscellany';

export type CategoryType = 'need' | 'want' | 'savings';

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CA$)' },
  AUD: { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar (AU$)' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)' },
  CHF: { code: 'CHF', symbol: 'CHF ', name: 'Swiss Franc (CHF)' },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan (¥)' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar (S$)' },
  NZD: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar (NZ$)' },
  AED: { code: 'AED', symbol: 'AED ', name: 'UAE Dirham (AED)' },
  SAR: { code: 'SAR', symbol: 'SAR ', name: 'Saudi Riyal (SAR)' },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real (R$)' },
  MXN: { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso (Mex$)' },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand (R)' },
  SEK: { code: 'SEK', symbol: 'kr ', name: 'Swedish Krona (kr)' },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won (₩)' },
  PHP: { code: 'PHP', symbol: '₱', name: 'Philippine Peso (₱)' },
  MYR: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit (RM)' },
  IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah (Rp)' },
  TRY: { code: 'TRY', symbol: '₺', name: 'Turkish Lira (₺)' },
  PKR: { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee (Rs)' },
  BDT: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka (৳)' },
  NGN: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira (₦)' }
};

export interface Transaction {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  source?: 'manual' | 'imported';
}

export const CATEGORY_TYPES: Record<ExpenseCategory, CategoryType> = {
  Housing: 'need',
  Food: 'need',
  Transport: 'need',
  Utilities: 'need',
  Entertainment: 'want',
  Miscellany: 'want',
  Savings: 'savings'
};

export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  Housing: '🏠',
  Food: '🥗',
  Transport: '🚗',
  Utilities: '⚡',
  Entertainment: '🎟️',
  Savings: '🏦',
  Miscellany: '📦'
};

export function normalizeToMonthly(amount: number, frequency: Frequency): number {
  if (isNaN(amount) || amount <= 0) return 0;
  switch (frequency) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'bi-weekly':
      return (amount * 26) / 12;
    case 'monthly':
    default:
      return amount;
  }
}

export function formatCurrency(amount: number, currencyCode: string = 'INR'): string {
  const curr = SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES.INR;
  const isWhole = Math.round(amount) === amount;
  const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US';
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
    case '70-20-10':
      return {
        model,
        name: '70 / 20 / 10 Framework',
        description: '70% Living Essentials, 20% Savings & Debt, 10% Discretionary',
        needsPct: 70,
        wantsPct: 10,
        savingsPct: 20,
        needsTarget: income * 0.7,
        wantsTarget: income * 0.1,
        savingsTarget: income * 0.2
      };
    case '80-20':
      return {
        model,
        name: '80 / 20 Simplified Rule',
        description: '80% Living & Spending, 20% Direct Wealth Building',
        needsPct: 80,
        wantsPct: 0,
        savingsPct: 20,
        needsTarget: income * 0.8,
        wantsTarget: 0,
        savingsTarget: income * 0.2
      };
    case 'zero-based':
      return {
        model,
        name: 'Zero-Based Budgeting',
        description: 'Every single dollar is assigned a specific job (Income - Expenses = 0)',
        needsPct: 50,
        wantsPct: 30,
        savingsPct: 20,
        needsTarget: income * 0.5,
        wantsTarget: income * 0.3,
        savingsTarget: income * 0.2
      };
    case '50-30-20':
    default:
      return {
        model: '50-30-20',
        name: '50 / 30 / 20 Balanced Model',
        description: '50% Needs, 30% Wants, 20% Savings & Debt Acceleration',
        needsPct: 50,
        wantsPct: 30,
        savingsPct: 20,
        needsTarget: income * 0.5,
        wantsTarget: income * 0.3,
        savingsTarget: income * 0.2
      };
  }
}

export interface FinancialHealthResult {
  score: number; // 0 - 100
  tier: 'Excellent' | 'Good' | 'Caution' | 'Financial Stress';
  tierColor: string;
  tierBg: string;
  tierBorder: string;
  savingsRateScore: number; // 0 - 40
  fixedCostScore: number;   // 0 - 40
  bufferScore: number;      // 0 - 20
  savingsRatePct: number;
  fixedCostPct: number;
  bufferPct: number;
  recommendations: string[];
}

export function calculateFinancialHealthScore(
  monthlyIncome: number,
  transactions: Transaction[]
): FinancialHealthResult {
  if (monthlyIncome <= 0 || transactions.length === 0) {
    return {
      score: 50,
      tier: 'Caution',
      tierColor: '#D97706',
      tierBg: '#FFFBEB',
      tierBorder: '#FDE68A',
      savingsRateScore: 20,
      fixedCostScore: 20,
      bufferScore: 10,
      savingsRatePct: 0,
      fixedCostPct: 0,
      bufferPct: 0,
      recommendations: [
        'Set your monthly take-home income above to activate accurate financial health scoring.',
        'Log recurring expenses (rent, groceries, transit) to analyze your essential cost burden.'
      ]
    };
  }

  let totalSpent = 0;
  let totalNeeds = 0;
  let totalSavings = 0;

  for (const t of transactions) {
    totalSpent += t.amount;
    const type = CATEGORY_TYPES[t.category] || 'want';
    if (type === 'need') totalNeeds += t.amount;
    if (type === 'savings') totalSavings += t.amount;
  }

  const netCashflow = monthlyIncome - totalSpent;
  const effectiveSavings = totalSavings + Math.max(0, netCashflow);

  // 1. Savings Rate Metric (40% weight) -> 20%+ target
  const savingsRatePct = (effectiveSavings / monthlyIncome) * 100;
  let savingsRateScore = 0;
  if (savingsRatePct >= 20) {
    savingsRateScore = 40;
  } else if (savingsRatePct >= 10) {
    savingsRateScore = 20 + ((savingsRatePct - 10) / 10) * 20;
  } else if (savingsRatePct > 0) {
    savingsRateScore = (savingsRatePct / 10) * 20;
  } else {
    savingsRateScore = 0;
  }

  // 2. Fixed Cost Burden (40% weight) -> Target <= 50%
  const fixedCostPct = (totalNeeds / monthlyIncome) * 100;
  let fixedCostScore = 0;
  if (fixedCostPct <= 50) {
    fixedCostScore = 40;
  } else if (fixedCostPct <= 70) {
    fixedCostScore = 40 - ((fixedCostPct - 50) / 20) * 25;
  } else if (fixedCostPct <= 90) {
    fixedCostScore = 15 - ((fixedCostPct - 70) / 20) * 15;
  } else {
    fixedCostScore = 0;
  }

  // 3. Discretionary Cashflow Buffer (20% weight) -> Target >= 10% uncommitted
  const bufferPct = (netCashflow / monthlyIncome) * 100;
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

  let tier: FinancialHealthResult['tier'] = 'Good';
  let tierColor = '#059669';
  let tierBg = '#ECFDF5';
  let tierBorder = '#A7F3D0';

  if (score >= 85) {
    tier = 'Excellent';
    tierColor = '#059669';
    tierBg = '#ECFDF5';
    tierBorder = '#A7F3D0';
  } else if (score >= 70) {
    tier = 'Good';
    tierColor = '#0D9488';
    tierBg = '#F0FDFA';
    tierBorder = '#99F6E4';
  } else if (score >= 50) {
    tier = 'Caution';
    tierColor = '#D97706';
    tierBg = '#FFFBEB';
    tierBorder = '#FDE68A';
  } else {
    tier = 'Financial Stress';
    tierColor = '#DC2626';
    tierBg = '#FEF2F2';
    tierBorder = '#FECACA';
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
    recommendations
  };
}
