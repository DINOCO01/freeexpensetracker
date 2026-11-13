import fs from 'fs';
import path from 'path';

const updates = {
  en: {
    tabs: {
      import: '3. Statement Importer',
      debt: '4. Debt Planner',
      budget: '5. Budget & Goals'
    },
    debt: {
      addDebtSubtitle: 'Enter your loan balance, interest rate (APR), and minimum monthly EMI to include it in your payoff simulation.',
      debtListSubtitle: 'Review your active balances, compare total interest costs, and track your projected debt-free date across each payoff strategy.'
    }
  },
  hi: {
    tabs: {
      import: '3. स्टेटमेंट आयातक',
      debt: '4. ऋण योजनाकार',
      budget: '5. बजट व लक्ष्य'
    },
    debt: {
      addDebtSubtitle: 'अपनी ऋण राशि, ब्याज दर (APR), और न्यूनतम मासिक EMI दर्ज करें ताकि इसे आपके भुगतान सिमुलेशन में शामिल किया जा सके।',
      debtListSubtitle: 'अपने सक्रिय ऋण शेष की समीक्षा करें, कुल ब्याज लागत की तुलना करें, और प्रत्येक रणनीति के अनुसार अपनी ऋण-मुक्त तिथि ट्रैक करें।'
    }
  },
  es: {
    tabs: {
      import: '3. Importador de Extractos',
      debt: '4. Planificador de Deudas',
      budget: '5. Presupuesto y Metas'
    },
    debt: {
      addDebtSubtitle: 'Ingrese el saldo de su préstamo, tasa de interés (TAE) y pago mínimo mensual para incluirlo en la simulación de amortización.',
      debtListSubtitle: 'Revise sus saldos activos, compare los costos totales por intereses y consulte su fecha estimada libre de deudas en cada estrategia.'
    }
  },
  de: {
    tabs: {
      import: '3. Kontoauszug-Import',
      debt: '4. Schuldenplaner',
      budget: '5. Budget & Ziele'
    },
    debt: {
      addDebtSubtitle: 'Geben Sie Ihren Kreditsaldo, Zinssatz (eff. Jahreszins) und die monatliche Mindestrate ein, um ihn in Ihre Tilgungssimulation aufzunehmen.',
      debtListSubtitle: 'Überprüfen Sie Ihre offenen Salden, vergleichen Sie die Gesamtzinskosten und verfolgen Sie Ihr voraussichtliches schuldenfreies Datum je Strategie.'
    }
  },
  fr: {
    tabs: {
      import: '3. Importateur de Relevés',
      debt: '4. Gestion des Dettes',
      budget: '5. Budget & Objectifs'
    },
    debt: {
      addDebtSubtitle: "Saisissez le solde de votre prêt, le taux d'intérêt (TAEG) et votre mensualité minimale pour l'intégrer à votre simulation de remboursement.",
      debtListSubtitle: 'Consultez vos soldes actifs, comparez le coût total des intérêts et suivez la date estimée de libération de vos dettes selon chaque stratégie.'
    }
  },
  pt: {
    tabs: {
      import: '3. Importador de Extratos',
      debt: '4. Gestão de Dívidas',
      budget: '5. Orçamento & Metas'
    },
    debt: {
      addDebtSubtitle: 'Insira o saldo do seu empréstimo, taxa de juros (APR) e pagamento mínimo mensal para incluí-lo na simulação de quitação.',
      debtListSubtitle: 'Revise seus saldos ativos, compare os custos totais com juros e acompanhe a data estimada de quitação total em cada estratégia.'
    }
  },
  ja: {
    tabs: {
      import: '3. 明細インポーター',
      debt: '4. 負債返済プラン',
      budget: '5. 予算＆貯蓄目標'
    },
    debt: {
      addDebtSubtitle: 'ローン残高、年利（APR）、毎月の最低返済額を入力して、返済シミュレーションに追加します。',
      debtListSubtitle: '現在の負債残高を確認し、総利息額を比較しながら、各返済戦略による完済予定日を把握できます。'
    }
  },
  ko: {
    tabs: {
      import: '3. 내역서 가져오기',
      debt: '4. 부채 상환 계획',
      budget: '5. 예산 및 목표'
    },
    debt: {
      addDebtSubtitle: '대출 잔액, 이자율(연이율) 및 최소 월 납입액을 입력하여 부채 상환 시뮬레이션에 포함하세요.',
      debtListSubtitle: '현재 부채 잔액을 확인하고, 총이자 비용을 비교하며, 상환 전략별 예상 부채 청산일을 추적하세요.'
    }
  }
};

const localesDir = path.resolve('src/locales');

for (const [lang, data] of Object.entries(updates)) {
  const filePath = path.join(localesDir, `${lang}.ts`);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Update tabs
  content = content.replace(
    /(import:\s*)"[^"]*"/,
    `$1"${data.tabs.import}"`
  );
  content = content.replace(
    /(debt:\s*)"[^"]*"/,
    `$1"${data.tabs.debt}"`
  );
  content = content.replace(
    /(budget:\s*)"[^"]*"/,
    `$1"${data.tabs.budget}"`
  );

  // 2. Add addDebtSubtitle right after addDebtTitle (if not already present)
  if (!content.includes('addDebtSubtitle:')) {
    const escapedSubtitle = data.debt.addDebtSubtitle.replace(/"/g, '\\"');
    content = content.replace(
      /(addDebtTitle:\s*"[^"]*",)/,
      `$1\n    addDebtSubtitle: "${escapedSubtitle}",`
    );
  }

  // 3. Add debtListSubtitle right after debtListTitle (if not already present)
  if (!content.includes('debtListSubtitle:')) {
    const escapedSubtitle = data.debt.debtListSubtitle.replace(/"/g, '\\"');
    content = content.replace(
      /(debtListTitle:\s*"[^"]*",)/,
      `$1\n    debtListSubtitle: "${escapedSubtitle}",`
    );
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${lang}.ts successfully.`);
}

