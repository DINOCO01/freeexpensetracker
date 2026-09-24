# Free Expense Tracker Architecture & Design System

## 1. Palette Specification: Clean Modern FinTech
- **Primary Background**: `#F8FAFC` (Cool subtle grey - light, clean, airy)
- **Card & Surface Background**: `#FFFFFF` (Pure crisp white)
- **Elevated Hover / Secondary Surface**: `#F1F5F9`
- **Borders & Dividers**: `#E2E8F0` (Crisp light slate)
- **Primary Text**: `#0F172A` (Deep charcoal / slate-900, ultra readable)
- **Secondary Text**: `#475569` (Slate-600)
- **Muted Text**: `#94A3B8` (Slate-400)
- **Accent Brand Primary**: `#059669` (Sophisticated Emerald Green)
- **Accent Brand Hover**: `#047857`
- **Accent Brand Soft**: `#ECFDF5` (Emerald-50 for badges, pills, subtle highlights)
- **Accent Secondary (Action/Info)**: `#0284C7` (Sky Blue)
- **Warning / Caution**: `#D97706` (Warm Amber)
- **Danger / Wipe**: `#DC2626` (Clean Crimson)

## 2. Typography
- **Headings & Brand**: `Outfit`, sans-serif (Geometric, modern, friendly)
- **Body & Financial Figures**: `Inter`, sans-serif (Tabular numbers, supreme clarity)

## 3. Dedicated Modules & Navigation Tabs
1. **Live Expense Tracker & Smart Suggestions**:
   - Monthly/Bi-Weekly/Weekly income normalizer with interactive simulation slider.
   - 0-100 Financial Health Indicator Dial with real-time scoring.
   - **Smart Spending Suggestions & Alternatives**: Algorithmic advisor analyzing food, utility, entertainment, and transportation outflows to propose concrete alternatives with estimated monthly savings.
   - Quick expense logger with 1-click preset chips.
   - Searchable transaction ledger with category pills and manual/imported indicators.
2. **Debt Management & Payoff Planner**:
   - Comprehensive debt payoff simulator supporting both **Debt Avalanche** (highest APR first) and **Debt Snowball** (lowest balance first).
   - Extra monthly contribution acceleration slider ($0 - $1,000/mo).
   - Debt-to-Income (DTI) ratio indicator.
   - Real-time projected debt-free month/year and lifetime interest savings calculation.
3. **Target & Budget Goal Planning**:
   - Target milestones tracker (Emergency cushion, down payment, vacation fund) with progress bars and months-to-completion calculations.
   - Automated Emergency Reserve benchmark computing exact 3-month and 6-month safety nets from actual monthly expenses.
   - Inline form to create and track custom savings goals.
4. **Basic Financial Knowledge Center**:
   - Educational modules: The Rule of 72 & Compounding, Good Debt vs. Toxic Debt, Credit Score Anatomy (FICO), Emergency Funds & High-Yield Savings Accounts (HYSA), The 50/30/20 Rule, and Inflation Protection.
   - Interactive financial glossary defining APR vs APY, DTI, Net Worth, Sinking Funds, and Index Funds.
5. **Financial Blogs Hub**:
   - Curated in-depth articles on money habits, debt payoff strategies, emergency fund acceleration, and impulse spending control.
   - Category filtering (All, Debt Payoff, Budgeting, Saving Hacks).
   - Clean, distraction-free in-app reading modal.
6. **Smart File & Receipt Importer**:
   - Parses Receipt Photos (`.png`, `.jpg`, `.jpeg`, `.webp`) via in-browser **Tesseract.js AI OCR**.
   - Extracts merchant name, grand total bill amount, date, and auto-classifies category.
   - Parses `.pdf` digital bank statements, `.xlsx`, `.xls`, and `.csv`.
   - Text coordinate clustering and regex extraction for date, description, and debit amounts.
   - 1-click Quick Expense Logger photo scanning and batch modal upload.
7. **Privacy & Offline**:
   - 100% client-side `localStorage`. Zero login, zero tracking.
