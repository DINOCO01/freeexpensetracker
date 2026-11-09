export interface TemplateDataFr {
  id: string;
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  category: 'Gestion de budget' | 'Gestion des dettes' | 'Investissement & Retraite' | 'Épargne' | 'Audits & Suivi';
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

export const TEMPLATES_DATA_FR: TemplateDataFr[] = [
  {
    id: 'paycheck-budget',
    slug: 'paycheck-budget',
    title: 'Modèle de Budget par Salaire Gratuit (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Modèle gratuit de budget par salaire pour Excel et Google Sheets. Planifiez chaque euro par cycle de paie : charges fixes, dépenses et épargne sans inscription.',
    h1: 'Modèle de Budget par Salaire Gratuit',
    category: 'Gestion de budget',
    categoryIcon: '💰',
    fileName: '01_US_Paycheck_Budget.xlsx',
    fileSize: '7.5 Ko',
    sheetNames: ['Budget par Salaire'],
    keyFormulas: [
      'Surplus Restant = Revenu Net - (Factures Fixes + Dépenses Variables + Épargne + Dettes)',
      'Total des Dépenses par Catégorie = SOMME des affectations respectives'
    ],
    purpose: 'Conçu pour le budget base zéro et la gestion de paie à paie, ce modèle vous permet d\'attribuer une mission à chaque euro de votre salaire net avant toute dépense.',
    overview: 'Le modèle de budget par salaire s\'adresse aux particuliers et foyers souhaitant caler leurs dépenses sur leurs dates réelles de versement de salaire (mensuel, bimensuel ou bimensuel décalé). En reliant chaque charge à la paie précise qui la finance, vous évitez les découverts et les décalages de trésorerie.',
    howToUse: [
      'Indiquez la date de paie, l\'employeur et votre salaire net exact sur la première ligne.',
      'Enregistrez toutes les charges fixes dues pendant ce cycle (loyer, crédit, énergie, assurances).',
      'Fixez une enveloppe pour les dépenses variables (alimentation, carburant, loisirs quotidiens).',
      'Allouez un montant fixe vers votre fonds de précaution ou vos projets d\'épargne.',
      'Ajustez le remboursement de dettes pour vous assurer que le solde restant non alloué atteint zéro.'
    ],
    whoBenefits: [
      'Salariés payés au mois ou par quinzaine cherchant une visibilité exacte entre deux paies.',
      'Foyers adoptant la méthode du budget base zéro pour stopper le gaspillage d\'argent.',
      'Toute personne souhaitant éliminer les frais de découvert causés par le décalage des prélèvements.'
    ],
    faq: [
      {
        question: 'Ce modèle fonctionne-t-il pour un salaire mensuel ou bimensuel ?',
        answer: 'Oui. Chaque bloc du modèle représente un cycle de paie individuel. Vous pouvez l\'utiliser pour des versements mensuels, aux 15 jours ou hebdomadaires.'
      },
      {
        question: 'Puis-je personnaliser les catégories de dépenses ?',
        answer: 'Oui. Vous pouvez modifier les intitulés ou insérer de nouvelles lignes dans Excel ou Google Sheets selon vos besoins.'
      },
      {
        question: 'Ce modèle est-il compatible avec LibreOffice et Numbers ?',
        answer: 'Oui. Le format .xlsx standard s\'ouvre parfaitement dans Microsoft Excel, Google Sheets, Apple Numbers et LibreOffice Calc.'
      },
      {
        question: 'Mes données personnelles restent-elles privées ?',
        answer: 'Oui. Le fichier fonctionne entièrement hors ligne sur votre ordinateur ou dans votre compte privé Google Drive.'
      }
    ]
  },
  {
    id: 'debt-snowball',
    slug: 'debt-snowball',
    title: 'Feuille de Calcul Remboursement Boule de Neige Gratuite (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Feuille de calcul gratuite pour le remboursement de dette en boule de neige (Excel et Google Sheets). Éliminez vos dettes pas à pas sans inscription.',
    h1: 'Feuille de Calcul Remboursement Boule de Neige Gratuite',
    category: 'Gestion des dettes',
    categoryIcon: '💳',
    fileName: '02_US_Debt_Snowball.xlsx',
    fileSize: '7.0 Ko',
    sheetNames: ['Méthode Boule de Neige'],
    keyFormulas: [
      'Mensualité Totale Cible = Mensualité Minimale Obligatoire + Extra Mensuel Boule de Neige',
      'Capital Restant = Capital Précédent + Intérêts Courus - Mensualité Appliquée'
    ],
    purpose: 'Éliminez vos emprunts et crédits à la consommation grâce à la méthode éprouvée de la boule de neige (Debt Snowball), en remboursant les plus petits capitaux d\'abord.',
    overview: 'La méthode boule de neige priorise le remboursement de vos emprunts du plus faible capital restant au plus élevé, indépendamment des taux d\'intérêt. En soldant rapidement votre plus petite dette, vous libérez immédiatement sa mensualité pour l\'ajouter au remboursement de la suivante. Ce roulement crée un effet d\'accélération continu et un puissant déclic psychologique.',
    howToUse: [
      'Listez l\'ensemble de vos emprunts (cartes de crédit, prêt auto, prêt personnel) du plus petit montant au plus grand.',
      'Indiquez le capital restant exact, le taux d\'intérêt annuel (TAEG) et la mensualité minimale obligatoire.',
      'Définissez votre apport mensuel supplémentaire (l\'extra boule de neige) alloué au premier crédit.',
      'Appliquez les mensualités minimales sur toutes les autres dettes et concentrez l\'excédent sur la plus petite.',
      'Une fois la première dette soldée, basculez l\'intégralité de sa mensualité sur la dette suivante.'
    ],
    whoBenefits: [
      'Emprunteurs ayant plusieurs crédits et ayant besoin de victoires rapides pour rester motivés.',
      'Personnes souhaitant réduire rapidement le nombre de créanciers et de prélèvements mensuels.',
      'Foyers recherchant un plan d\'action méthodique pour sortir définitivement de l\'endettement.'
    ],
    faq: [
      {
        question: 'Quelle est la différence entre la méthode Boule de Neige et la méthode Avalanche ?',
        answer: 'La méthode Boule de Neige rembourse les plus petits soldes d\'abord pour stimuler la motivation, tandis que la méthode Avalanche attaque les taux d\'intérêt les plus élevés en premier pour minimiser le coût total.'
      },
      {
        question: 'Puis-je ajuster l\'apport mensuel supplémentaire en cours de route ?',
        answer: 'Oui. Le tableau recalcule automatiquement le calendrier de libération dès que vous augmentez ou réduisez votre extra mensuel.'
      },
      {
        question: 'Faut-il continuer à payer les mensualités minimales des autres crédits ?',
        answer: 'Absolument. Vous devez toujours payer le minimum légal sur chaque contrat pour éviter pénalités et incidents bancaires.'
      },
      {
        question: 'Le fichier Excel est-il verrouillé par mot de passe ?',
        answer: 'Non. Le classeur est entièrement ouvert et sans macro, vous pouvez l\'adapter en toute liberté.'
      }
    ]
  },
  {
    id: 'debt-avalanche',
    slug: 'debt-avalanche',
    title: 'Feuille de Calcul Dette Avalanche Gratuite (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Feuille de calcul gratuite pour la méthode de dette avalanche (Excel et Google Sheets). Réduisez les intérêts bancaires et soldez vos prêts sans inscription.',
    h1: 'Feuille de Calcul Dette Avalanche Gratuite',
    category: 'Gestion des dettes',
    categoryIcon: '💳',
    fileName: '03_US_Debt_Avalanche.xlsx',
    fileSize: '7.0 Ko',
    sheetNames: ['Méthode Avalanche'],
    keyFormulas: [
      'Tri par Taux Décroissant = RANG(TAEG)',
      'Intérêts Économisés = Coût Total Base - Coût Total Accéléré'
    ],
    purpose: 'Optimisez mathématiquement le remboursement de vos emprunts en ciblant en priorité le taux d\'intérêt annuel le plus élevé pour économiser un maximum d\'argent.',
    overview: 'La méthode avalanche est la stratégie d\'amortissement de dette la plus économique sur le plan financier. En consacrant votre capacité de remboursement excédentaire au prêt dont le taux d\'intérêt (TAEG) est le plus fort tout en maintenant les minimums sur les autres, vous minimisez le coût total des intérêts et réduisez le délai global de remboursement.',
    howToUse: [
      'Renseignez tous vos crédits avec leur capital restant, leur taux annuel et leur mensualité minimale.',
      'Triez automatiquement vos dettes du taux le plus élevé au plus faible.',
      'Saisissez l\'apport supplémentaire mensuel disponible pour accélérer l\'amortissement.',
      'Vérifiez le montant total d\'intérêts économisés par rapport à un remboursement classique.',
      'Une fois le crédit le plus cher remboursé, reportez la mensualité totale sur le taux suivant.'
    ],
    whoBenefits: [
      'Emprunteurs ayant des crédits renouvelables ou des dettes de cartes à taux d\'intérêt très élevés.',
      'Personnes axées sur l\'optimisation mathématique souhaitant payer le strict minimum d\'agios.',
      'Toute personne ayant une bonne discipline financière pour suivre un plan sur plusieurs années.'
    ],
    faq: [
      {
        question: 'Combien d\'argent puis-je économiser avec la méthode avalanche ?',
        answer: 'L\'économie dépend de l\'écart de taux entre vos dettes. Sur des crédits revolving à plus de 15% d\'intérêts, l\'économie atteint fréquemment des milliers d\'euros.'
      },
      {
        question: 'Comment choisir entre boule de neige et avalanche ?',
        answer: 'Choisissez l\'avalanche si votre priorité est d\'économiser le maximum d\'intérêts. Choisissez la boule de neige si vous avez besoin de victoires psychologiques rapides.'
      },
      {
        question: 'Le modèle gère-t-il les remboursements anticipés ponctuels ?',
        answer: 'Oui. Vous pouvez ajouter une somme exceptionnelle sur n\'importe quel mois pour recalculer immédiatement l\'échéancier.'
      },
      {
        question: 'Dois-je créer un compte pour télécharger le modèle ?',
        answer: 'Non. Le téléchargement au format .xlsx est direct, sans inscription et sans publicité intrusive.'
      }
    ]
  },
  {
    id: 'debt-to-income-calculator',
    slug: 'debt-to-income-calculator',
    title: 'Calculateur du Taux d\'Endettement Gratuit (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Calculateur gratuit de taux d\'endettement pour Excel et Google Sheets. Évaluez votre capacité d\'emprunt et vos charges mensuelles sans inscription.',
    h1: 'Calculateur du Taux d\'Endettement Gratuit',
    category: 'Gestion des dettes',
    categoryIcon: '💳',
    fileName: '04_US_Debt_to_Income_Calculator.xlsx',
    fileSize: '6.4 Ko',
    sheetNames: ['Taux d\'Endettement'],
    keyFormulas: [
      'Taux d\'Endettement Logement = Mensualité Logement / Revenu Brut Mensuel',
      'Taux d\'Endettement Global = Total des Charges de Crédit / Revenu Brut Mensuel'
    ],
    purpose: 'Évaluez la solidité de votre situation financière et votre capacité d\'emprunt en calculant vos ratios d\'endettement avant une demande de prêt immobilier ou personnel.',
    overview: 'Les banques et organismes de crédit analysent attentivement votre taux d\'endettement (Debt-to-Income / DTI) pour juger de votre solvabilité. Ce tableur vous permet d\'anticiper leur diagnostic en calculant à la fois votre taux d\'endettement logement (front-end) et votre taux d\'endettement total (back-end).',
    howToUse: [
      'Indiquez vos revenus professionnels bruts et autres sources régulières vérifiables.',
      'Renseignez votre loyer actuel ou la mensualité de crédit immobilier projetée.',
      'Ajoutez vos autres charges financières : prêt auto, crédits conso, pensions et prêts étudiants.',
      'Consultez vos ratios calculés et comparez-les aux seuils bancaires usuels (33% à 35%).',
      'Simulez l\'impact du remboursement d\'un prêt sur votre capacité d\'emprunt future.'
    ],
    whoBenefits: [
      'Futurs acquéreurs préparant un dossier de prêt immobilier auprès d\'un courtier ou d\'une banque.',
      'Particuliers voulant savoir si leurs remboursements mensuels représentent une charge excessive.',
      'Personnes souhaitant optimiser leurs finances avant de souscrire un nouvel emprunt.'
    ],
    faq: [
      {
        question: 'Quel est le taux d\'endettement maximal accepté par les banques ?',
        answer: 'En France et en Europe, le seuil usuel recommandé par le HCSF est de 35% assurance comprise, calculé sur les revenus nets avant impôt.'
      },
      {
        question: 'Les primes et heures supplémentaires comptent-elles dans les revenus ?',
        answer: 'Généralement, les banques ne retiennent les primes variables que si elles sont récurrentes sur les 2 ou 3 dernières années.'
      },
      {
        question: 'Le reste à vivre est-il pris en compte ?',
        answer: 'Oui. Le tableau calcule également le reste à vivre disponible une fois toutes les mensualités déduites.'
      },
      {
        question: 'Puis-je utiliser ce simulateur sur smartphone ?',
        answer: 'Oui. Le fichier s\'ouvre directement sur l\'application Google Sheets ou Microsoft Excel pour mobile.'
      }
    ]
  },
  {
    id: 'student-loan-planner',
    slug: 'student-loan-planner',
    title: 'Planificateur de Prêt Étudiant Gratuit (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Planificateur gratuit de remboursement de prêt étudiant pour Excel et Google Sheets. Simulez versements supplémentaires et échéanciers sans inscription.',
    h1: 'Planificateur de Prêt Étudiant Gratuit',
    category: 'Gestion des dettes',
    categoryIcon: '💳',
    fileName: '05_US_Student_Loan_Planner.xlsx',
    fileSize: '6.5 Ko',
    sheetNames: ['Prêt Étudiant'],
    keyFormulas: [
      'Mensualité Amortissement = VPM(Taux/12; DuréeMois; -Capital)',
      'Intérêts Courus Mensuels = Capital Restant * (Taux / 12)'
    ],
    purpose: 'Simulez l\'échéancier complet de vos prêts étudiants, l\'impact des différés d\'amortissement et l\'effet d\'accélération des remboursements anticipés de capital.',
    overview: 'Le remboursement d\'un prêt étudiant s\'étale souvent sur 5 à 10 ans après l\'entrée dans la vie active. Ce planificateur vous permet de modéliser avec précision l\'impact de petits versements supplémentaires mensuels sur votre date de fin de prêt et sur le coût global du crédit.',
    howToUse: [
      'Renseignez le montant emprunté, la durée d\'amortissement en années et le taux d\'intérêt fixé.',
      'Indiquez si vous bénéficiez d\'une période de différé (franchise totale ou partielle).',
      'Saisissez un versement supplémentaire mensuel (ex. 50 € ou 100 € par mois).',
      'Observez le nombre de mois et le montant d\'intérêts économisés sur la durée totale.',
      'Comparez les avantages d\'un rachat ou refinancement de crédit à taux réduit.'
    ],
    whoBenefits: [
      'Jeunes diplômés commençant leur vie active avec des mensualités de crédit étudiant.',
      'Parents accompagnant leurs enfants dans le plan de financement de leurs études supérieures.',
      'Emprunteurs envisageant de renégocier leur prêt étudiant pour réduire la durée d\'emprunt.'
    ],
    faq: [
      {
        question: 'Un apport supplémentaire de 50 € par mois fait-il une réelle différence ?',
        answer: 'Oui. Sur un prêt de 25 000 € sur 10 ans, un surplus régulier de 50 € peut raccourcir la durée de plus d\'un an et économiser des centaines d\'euros d\'intérêts.'
      },
      {
        question: 'Y a-t-il des pénalités de remboursement anticipé sur les prêts étudiants ?',
        answer: 'Dans la plupart des pays européens, les prêts étudiants peuvent être remboursés par anticipation sans frais ou avec des indemnités très encadrées.'
      },
      {
        question: 'Ce modèle prend-il en compte l\'assurance emprunteur ?',
        answer: 'Oui. Une colonne dédiée permet d\'ajouter la cotisation d\'assurance mensuelle obligatoire.'
      },
      {
        question: 'Puis-je l\'utiliser pour plusieurs prêts étudiants simultanés ?',
        answer: 'Oui. Vous pouvez dupliquer les onglets pour chaque emprunt contracté et obtenir une synthèse globale.'
      }
    ]
  },
  {
    id: 'auto-loan-calculator',
    slug: 'auto-loan-calculator',
    title: 'Calculateur de Prêt Auto Gratuit (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Calculateur de prêt automobile gratuit pour Excel et Google Sheets. Simulez mensualités, apport personnel, durée et coût total sans inscription.',
    h1: 'Calculateur de Prêt Automobile Gratuit',
    category: 'Gestion des dettes',
    categoryIcon: '💳',
    fileName: '06_US_Auto_Loan_Calculator.xlsx',
    fileSize: '6.4 Ko',
    sheetNames: ['Financement Auto'],
    keyFormulas: [
      'Montant Financé = Prix du Véhicule - Apport Personnel - Reprise',
      'Mensualité Estimée = VPM(Taux/12; Mois; -MontantFinancé)'
    ],
    purpose: 'Calculez le coût réel d\'achat d\'un véhicule neuf ou d\'occasion en prenant en compte l\'apport initial, la durée de crédit, le taux et les frais annexes.',
    overview: 'L\'achat d\'une voiture est l\'une des dépenses les plus courantes. Les concessionnaires proposent souvent des financements à mensualités attrayantes mais à durées excessives. Ce calculateur vous permet de décomposer chaque coût et de déterminer si l\'opération respecte votre équilibre budgétaire.',
    howToUse: [
      'Indiquez le prix négocié du véhicule clés en main.',
      'Saisissez votre apport personnel et la valeur de reprise éventuelle de votre ancien véhicule.',
      'Définissez la durée d\'emprunt en mois (24, 36, 48 ou 60 mois) et le taux d\'intérêt annuel proposé.',
      'Comparez le coût total d\'un crédit classique face à une offre de location avec option d\'achat (LOA).',
      'Vérifiez que votre mensualité auto ne dépasse pas 10 à 15% de vos revenus nets mensuels.'
    ],
    whoBenefits: [
      'Futurs acheteurs comparant les offres de financement de concessionnaires et d\'organismes bancaires.',
      'Automobilistes hésitant entre crédit bancaire classique et leasing (LOA/LLD).',
      'Conducteurs souhaitant anticiper l\'impact d\'un apport personnel plus élevé sur leurs mensualités.'
    ],
    faq: [
      {
        question: 'Quelle est la durée maximale conseillée pour un prêt automobile ?',
        answer: 'Il est généralement recommandé de ne pas dépasser 48 à 60 mois afin d\'éviter que la dépréciation du véhicule ne soit supérieure au capital restant dû.'
      },
      {
        question: 'Le calculateur inclut-il la TVA ou les taxes d\'immatriculation ?',
        answer: 'Vous pouvez inclure les frais d\'immatriculation et taxes directement dans le champ Prix Total du véhicule.'
      },
      {
        question: 'Puis-je simuler un remboursement anticipé ?',
        answer: 'Oui. Le tableau d\'amortissement complet s\'ajuste si vous augmentez la mensualité.'
      },
      {
        question: 'Le fichier fonctionne-t-il sur Google Sheets ?',
        answer: 'Oui. Il est 100% compatible et s\'ouvre sans conversion ni perte de formules.'
      }
    ]
  },
  {
    id: 'mortgage-planner',
    slug: 'mortgage-planner',
    title: 'Simulateur de Prêt Immobilier Gratuit (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Simulateur de crédit immobilier gratuit pour Excel et Google Sheets. Tableau d\'amortissement, intérêts, assurance et mensualités sans inscription.',
    h1: 'Simulateur de Prêt Immobilier Gratuit',
    category: 'Gestion des dettes',
    categoryIcon: '💳',
    fileName: '07_US_Mortgage_Planner.xlsx',
    fileSize: '6.5 Ko',
    sheetNames: ['Crédit Immobilier'],
    keyFormulas: [
      'Mensualité Hors Assurance = VPM(Taux/12; Années*12; -CapitalEmprunté)',
      'Intérêts Cumulés = CUMPRINC et CUMIPMT programmés'
    ],
    purpose: 'Modélisez votre prêt immobilier avec tableau d\'amortissement détaillé, décomposition capital/intérêts et simulation de versements anticipés.',
    overview: 'L\'emprunt immobilier engage vos finances sur 15, 20 ou 25 ans. Comprendre la répartition exacte entre capital remboursé et intérêts payés chaque mois est indispensable pour optimiser votre patrimoine. Ce tableur professionnel vous fournit une transparence absolue sur votre financement.',
    howToUse: [
      'Indiquez le montant total du bien immobilier et votre apport personnel.',
      'Saisissez le taux nominal du crédit, le taux d\'assurance emprunteur et la durée en années.',
      'Consultez votre mensualité totale tout compris et le coût global du crédit.',
      'Consultez le tableau d\'amortissement mois par mois pour suivre l\'évolution de votre capital net.',
      'Testez l\'effet d\'un remboursement partiel anticipé sur la durée ou le montant des mensualités.'
    ],
    whoBenefits: [
      'Candidats à l\'accession à la propriété préparant leur plan de financement.',
      'Propriétaires actuels étudiant l\'opportunité d\'un rachat de crédit ou d\'une renégociation.',
      'Investisseurs locatifs calculant la rentabilité nette et l\'effort d\'épargne mensuel requis.'
    ],
    faq: [
      {
        question: 'L\'assurance emprunteur est-elle intégrée au calcul ?',
        answer: 'Oui. Le modèle calcule séparément la part de capital, les intérêts bancaires et la cotisation d\'assurance.'
      },
      {
        question: 'Comment simuler une baisse de durée suite à un apport ponctuel ?',
        answer: 'Le tableau vous permet de renseigner un versement exceptionnel pour observer le gain de mois de crédit.'
      },
      {
        question: 'Puis-je exporter l\'échéancier au format PDF ?',
        answer: 'Oui. Vous pouvez imprimer ou exporter directement la feuille de calcul au format PDF depuis Excel.'
      },
      {
        question: 'Les formules sont-elles fiables et transparentes ?',
        answer: 'Toutes les formules utilisent les standards financiers internationaux (VPM, SOMME, TAUX) sans macro cachée.'
      }
    ]
  },
  {
    id: '401k-retirement-planner',
    slug: '401k-retirement-planner',
    title: 'Planificateur d\'Épargne Retraite Gratuit (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Modèle de planificateur de retraite gratuit pour Excel et Google Sheets. Projetez votre capital futur avec intérêts composés sans inscription.',
    h1: 'Planificateur d\'Épargne Retraite Gratuit',
    category: 'Investissement & Retraite',
    categoryIcon: '📈',
    fileName: '08_US_401k_Retirement_Planner.xlsx',
    fileSize: '6.5 Ko',
    sheetNames: ['Plan Épargne Retraite'],
    keyFormulas: [
      'Capital Futur = VC(RendementAnnuel/12; Années*12; -VersementMensuel; -CapitalInitial)',
      'Rente Mensuelle Estimée = Capital Retraite * Taux de Retrait Sûr (4%) / 12'
    ],
    purpose: 'Projetez la constitution de votre capital retraite sur 10, 20 ou 30 ans en combinant vos versements programmés, les abondements éventuels et les intérêts composés.',
    overview: 'Préparer sa retraite demande de la régularité et une vision de long terme. Ce planificateur financier calcule l\'accumulation de votre capital d\'épargne (PER, assurance-vie ou compte titres) en fonction de vos versements mensuels et de l\'hypothèse de rendement retenue.',
    howToUse: [
      'Indiquez votre âge actuel, votre âge cible de départ à la retraite et votre capital de départ.',
      'Renseignez votre versement mensuel programmé et la part d\'abondement employeur le cas échéant.',
      'Définissez une hypothèse réaliste de rendement annuel net d\'inflation (ex. 5% à 7%).',
      'Visualisez le montant de capital accumulé au moment de votre départ.',
      'Estimez le revenu mensuel passif que ce capital pourra générer selon la règle des 4%.'
    ],
    whoBenefits: [
      'Salariés et indépendants souhaitant sécuriser leur niveau de vie futur.',
      'Investisseurs appliquant une stratégie d\'investissement passif indiciel régulier (DCA).',
      'Toute personne souhaitant vérifier si son rythme d\'épargne actuel suffit pour ses vieux jours.'
    ],
    faq: [
      {
        question: 'Quel taux de rendement annuel est-il raisonnable de prévoir ?',
        answer: 'Sur un horizon de 20 ans et plus, une allocation diversifiée en actions mondiales dégage historiquement entre 5% et 7% de rendement réel net d\'inflation.'
      },
      {
        question: 'Qu\'est-ce que la règle des 4% ?',
        answer: 'C\'est une règle empirique estimant qu\'un capital diversifié peut être ponctionné de 4% par an sans risque significatif d\'épuisement sur une retraite de 30 ans.'
      },
      {
        question: 'Puis-je adapter ce modèle à un PER ou une assurance-vie ?',
        answer: 'Oui. Le modèle est indépendant du cadre fiscal et simule purement la mécanique des intérêts composés.'
      },
      {
        question: 'Le fichier contient-il des graphiques d\'évolution ?',
        answer: 'Oui. Un graphique d\'accumulation dynamique illustre visuellement la part des versements vs les intérêts générés.'
      }
    ]
  },
  {
    id: 'roth-ira-planner',
    slug: 'roth-ira-planner',
    title: 'Planificateur Compte d\'Épargne & PEA Gratuit (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Planificateur d\'épargne individuelle et compte d\'investissement gratuit pour Excel et Google Sheets. Simulez versements et croissance sans inscription.',
    h1: 'Planificateur Compte d\'Épargne & Investissement Gratuit',
    category: 'Investissement & Retraite',
    categoryIcon: '📈',
    fileName: '09_US_Roth_IRA_Planner.xlsx',
    fileSize: '6.3 Ko',
    sheetNames: ['Épargne Individuelle'],
    keyFormulas: [
      'Valeur Acquise = VC(Taux/12; Mois; -Versement; -SoldeActuel)',
      'Total des Intérêts Générés = Valeur Acquise - Cumul des Versements'
    ],
    purpose: 'Simulez la croissance de vos comptes d\'épargne défiscalisés ou enveloppes d\'investissement (PEA, Roth IRA, compte titres) avec calcul de gains nets.',
    overview: 'Maximiser vos versements dans des enveloppes d\'investissement performantes est l\'une des méthodes les plus sûres pour bâtir son indépendance financière. Ce tableur vous permet de mesurer avec clarté le multiplicateur de richesse créé par la réinjection constante des dividendes et plus-values.',
    howToUse: [
      'Renseignez votre solde actuel et votre capacité de versement mensuel.',
      'Définissez votre horizon de placement en années.',
      'Choisissez votre profil de risque pour déterminer le rendement prévisionnel.',
      'Mesurez l\'effet démultiplicateur des intérêts composés par rapport à l\'épargne brute.',
      'Ajustez vos versements pour atteindre votre objectif de capital patrimonial.'
    ],
    whoBenefits: [
      'Investisseurs réguliers alimentant un PEA ou un compte d\'investissement chaque mois.',
      'Jeunes actifs souhaitant mesurer l\'impact de démarrer leur épargne tôt.',
      'Toute personne recherchant une simulation claire et visuelle de son enrichissement futur.'
    ],
    faq: [
      {
        question: 'En quoi ce modèle diffère-t-il du planificateur retraite ?',
        answer: 'Ce modèle se concentre sur les plafonds de versement annuels et la séparation nette entre capital versé et intérêts purs.'
      },
      {
        question: 'Les versements peuvent-ils être modifiés chaque année ?',
        answer: 'Oui. Vous pouvez faire évoluer vos apports pour refléter de futures augmentations de revenus.'
      },
      {
        question: 'Ce fichier fonctionne-t-il sur Mac et PC ?',
        answer: 'Oui. Il est 100% universel pour Microsoft Excel, Google Sheets et Numbers.'
      },
      {
        question: 'Le téléchargement nécessite-t-il un e-mail ?',
        answer: 'Aucun e-mail ni coordonnée bancaire. Téléchargement direct et gratuit.'
      }
    ]
  },
  {
    id: 'emergency-fund-planner',
    slug: 'emergency-fund-planner',
    title: 'Planificateur de Fonds d\'Urgence Gratuit (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Modèle gratuit de planificateur de fonds d\'urgence pour Excel et Google Sheets. Calculez votre sécurité financière et vos mois d\'autonomie sans inscription.',
    h1: 'Planificateur de Fonds d\'Urgence Gratuit',
    category: 'Épargne',
    categoryIcon: '🛡️',
    fileName: '10_US_Emergency_Fund_Planner.xlsx',
    fileSize: '6.4 Ko',
    sheetNames: ['Fonds d\'Urgence'],
    keyFormulas: [
      'Objectif Sécurité = Dépenses Mensuelles Essentielles * Mois de Couverture (3 à 6)',
      'Mois Restants = (Objectif Sécurité - Épargne Actuelle) / Épargne Mensuelle Allouée'
    ],
    purpose: 'Évaluez votre socle de dépenses incompressibles et définissez un objectif réaliste de fonds d\'urgence pour protéger votre foyer des imprévus de la vie.',
    overview: 'Un fonds d\'urgence (ou épargne de précaution) constitue le premier bouclier de protection de votre santé financière. Sans cette réserve liquide, le moindre accident de parcours (réparation automobile, frais de santé, perte d\'emploi) contraint à s\'endetter. Ce tableur calcule précisément votre besoin en fonction de vos dépenses réelles.',
    howToUse: [
      'Listez vos dépenses vitales incompressibles (loyer, nourriture essentielle, santé, assurances, transport).',
      'Excluez les dépenses discrétionnaires (sorties, voyages, abonnements de divertissement).',
      'Choisissez votre niveau de sécurité cible : 3 mois (revenus stables), 6 mois (famille) ou 9 mois (indépendants).',
      'Indiquez votre solde d\'épargne sécurisée actuel.',
      'Saisissez votre versement mensuel pour connaître la date exacte où votre fonds sera entièrement constitué.'
    ],
    whoBenefits: [
      'Personnes vivant de paie à paie et vulnérables au moindre imprévu financier.',
      'Travailleurs indépendants, freelances et auto-entrepreneurs aux revenus irréguliers.',
      'Foyers souhaitant sécuriser leur trésorerie avant de commencer à investir en bourse ou en immobilier.'
    ],
    faq: [
      {
        question: 'Combien de mois de dépenses faut-il conserver sur son fonds d\'urgence ?',
        answer: 'La règle générale recommande 3 mois pour un salarié en CDI sans charge de famille, et 6 mois pour un couple avec enfants ou des professionnels indépendants.'
      },
      {
        question: 'Où placer son fonds d\'urgence ?',
        answer: 'Sur un support 100% sécurisé et immédiatement disponible, comme un Livret A, LDDS ou compte sur livret bancaire garanti.'
      },
      {
        question: 'Faut-il investir son fonds d\'urgence en bourse ?',
        answer: 'Non. Le but d\'un fonds d\'urgence est la sécurité et la liquidité immédiate, pas la recherche de rendement spéculatif.'
      },
      {
        question: 'Le tableau calcule-t-il automatiquement la progression ?',
        answer: 'Oui. Une jauge de complétion en pourcentage vous indique exactement où vous en êtes de votre objectif.'
      }
    ]
  },
  {
    id: 'subscription-audit',
    slug: 'subscription-audit',
    title: 'Audit des Abonnements Récurrents Gratuit (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Feuille d\'audit d\'abonnements gratuite pour Excel et Google Sheets. Identifiez et résiliez vos frais récurrents et abonnements oubliés sans inscription.',
    h1: 'Audit des Abonnements Récurrents Gratuit',
    category: 'Audits & Suivi',
    categoryIcon: '🧾',
    fileName: '11_US_Subscription_Audit.xlsx',
    fileSize: '9.5 Ko',
    sheetNames: ['Audit Abonnements'],
    keyFormulas: [
      'Coût Annuelisé = SI(Fréquence="Mensuel"; Montant*12; Montant)',
      'Économies Potentielles = SOMME.SI(Statut; "À Résilier"; CoûtAnnuel)'
    ],
    purpose: 'Centralisez la totalité de vos abonnements numériques, services de streaming et prélèvements automatiques pour éliminer les fuites d\'argent silencieuses.',
    overview: 'Avec la prolifération des services par abonnement, des dizaines d\'euros sont débités chaque mois sans qu\'on y prête attention. Cet outil d\'audit classe vos abonnements par utilité, calcule leur coût réel annualisé et met en évidence les économies immédiates réalisables en résiliant les services sous-utilisés.',
    howToUse: [
      'Examinez vos trois derniers relevés bancaires pour repérer chaque prélèvement automatique récurrent.',
      'Renseignez le nom du service, la fréquence de facturation et le montant prélevé.',
      'Attribuez un statut clair : Essentiel, À Conserver, En Surcroît ou À Résilier.',
      'Consultez le total annuelisé de vos abonnements et la part qu\'ils représentent dans votre budget.',
      'Résiliez les services identifiés et mesurez immédiatement le pouvoir d\'achat récupéré.'
    ],
    whoBenefits: [
      'Toute personne surprise par le cumul des prélèvements automatiques sur son compte bancaire.',
      'Foyers abonnés à plusieurs services de vidéo, musique, applications mobiles et salles de sport.',
      'Particuliers menant une démarche d\'assainissement budgétaire pour dégager une capacité d\'épargne.'
    ],
    faq: [
      {
        question: 'Combien dépense en moyenne un foyer en abonnements oubliés ?',
        answer: 'Les études estiment que la plupart des utilisateurs sous-estiment leurs frais d\'abonnements récurrents de 50 à 100 € par mois.'
      },
      {
        question: 'Le fichier gère-t-il les prélèvements annuels ?',
        answer: 'Oui. Le sélecteur de fréquence convertit automatiquement les abonnements annuels, trimestriels et mensuels.'
      },
      {
        question: 'Puis-je classer mes abonnements par catégorie ?',
        answer: 'Oui. Vous pouvez filtrer par streaming, logiciels, sport, énergie ou assurances.'
      },
      {
        question: 'Le classeur est-il compatible avec Google Sheets ?',
        answer: 'Oui. Il s\'ouvre parfaitement dans Google Sheets avec mise en forme conditionnelle active.'
      }
    ]
  },
  {
    id: 'sinking-fund-planner',
    slug: 'sinking-fund-planner',
    title: 'Planificateur d\'Épargne Ciblée (Sinking Funds) Gratuit | Free Expense Tracker',
    metaDescription: 'Modèle gratuit de planificateur de sinking funds (épargne ciblée) pour Excel et Google Sheets. Anticipez dépenses annuelles et projets sans inscription.',
    h1: 'Planificateur d\'Épargne Ciblée (Sinking Funds) Gratuit',
    category: 'Épargne',
    categoryIcon: '🛡️',
    fileName: '12_US_Sinking_Fund_Planner.xlsx',
    fileSize: '8.0 Ko',
    sheetNames: ['Épargne Ciblée'],
    keyFormulas: [
      'Épargne Mensuelle Requise = (Montant Cible - Épargne Déjà Allouée) / Mois Restants',
      'Total Mensuel Sinking Funds = SOMME de tous les versements programmés'
    ],
    purpose: 'Prévoyez et lissez les dépenses prévisibles mais irrégulières (vacances, impôts, entretien auto, cadeaux de fin d\'année) pour ne plus jamais être pris au dépourvu.',
    overview: 'Un "sinking fund" (ou fonds d\'amortissement dédié) consiste à mettre de côté une somme fixe chaque mois en prévision d\'une dépense future certaine. Contrairement au fonds d\'urgence qui sert aux aléas imprévisibles, l\'épargne ciblée anticipe les échéances connues et supprime le stress financier.',
    howToUse: [
      'Identifiez vos dépenses annuelles ou exceptionnelles (fêtes de fin d\'année, révision automobile, vacances).',
      'Indiquez la date cible de la dépense et le montant total prévisionnel.',
      'Saisissez les sommes déjà provisionnées sur cette enveloppe.',
      'Le tableau calcule automatiquement la mensualité exacte à virer sur votre sous-compte chaque mois.',
      'Suivez la progression de chaque cagnotte jusqu\'à l\'échéance fixée.'
    ],
    whoBenefits: [
      'Personnes déstabilisées chaque année par les factures d\'assurance ou les taxes annuelles.',
      'Foyers planifiant un grand voyage, un mariage ou un projet d\'aménagement sans s\'endetter.',
      'Gestionnaires de budget souhaitant stabiliser leur reste à vivre tout au long de l\'année.'
    ],
    faq: [
      {
        question: 'Quelle est la différence entre un fonds d\'urgence et un sinking fund ?',
        answer: 'Le fonds d\'urgence intervient pour les chocs imprévus (panne subite, santé). Le sinking fund provisionne une dépense prévisible dont l\'échéance est connue à l\'avance.'
      },
      {
        question: 'Combien d\'enveloppes d\'épargne ciblée peut-on créer ?',
        answer: 'Le tableau vous permet de suivre jusqu\'à 20 cagnottes d\'épargne distinctes simultanément.'
      },
      {
        question: 'Dois-je ouvrir des comptes bancaires séparés pour chaque projet ?',
        answer: 'Pas nécessairement. Vous pouvez conserver les fonds sur un livret unique et utiliser ce tableur comme registre comptable.'
      },
      {
        question: 'Le fichier est-il gratuit sans abonnement ?',
        answer: 'Oui. Vous le téléchargez une fois et l\'utilisez à vie sans aucun frais.'
      }
    ]
  },
  {
    id: 'net-worth-tracker',
    slug: 'net-worth-tracker',
    title: 'Suivi de Valeur Nette & Patrimoine Gratuit (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Tableau de bord gratuit de suivi de valeur nette et patrimoine pour Excel et Google Sheets. Mesurez actifs, passifs et enrichissement sans inscription.',
    h1: 'Suivi de Valeur Nette & Patrimoine Gratuit',
    category: 'Investissement & Retraite',
    categoryIcon: '📈',
    fileName: '13_US_Net_Worth_Tracker.xlsx',
    fileSize: '8.5 Ko',
    sheetNames: ['Patrimoine Net'],
    keyFormulas: [
      'Valeur Nette = Total des Actifs (Biens + Placements + Trésorerie) - Total des Passifs (Emprunts)',
      'Évolution Mensuelle = Valeur Nette Mois N - Valeur Nette Mois N-1'
    ],
    purpose: 'Mesurez la véritable boussole de votre santé financière : l\'évolution mois par mois de votre patrimoine net global en consolidant vos biens, livrets, investissements et emprunts.',
    overview: 'Le revenu seul ne reflète pas la solidité financière : une personne avec un fort salaire mais lourdement endettée peut avoir une valeur nette négative. Ce tableau de bord consolide l\'ensemble de ce que vous possédez (actifs) et de ce que vous devez (passifs) pour suivre votre enrichissement réel au fil du temps.',
    howToUse: [
      'Enregistrez vos actifs liquides : comptes courants, livrets d\'épargne et devises.',
      'Renseignez vos actifs financiers : assurance-vie, PEA, compte titres et cryptomonnaies.',
      'Ajoutez vos actifs physiques : valeur vénale de vos biens immobiliers et véhicules.',
      'Listez l\'ensemble de vos passifs : capital restant dû sur crédits immobiliers, conso et découverts.',
      'Mettez à jour vos soldes une fois par mois pour tracer la courbe de progression de votre valeur nette.'
    ],
    whoBenefits: [
      'Particuliers engagés dans une démarche FIRE (indépendance financière et retraite anticipée).',
      'Investisseurs détenant plusieurs comptes et souhaitant une vision patrimoniale unifiée.',
      'Toute personne voulant mesurer l\'impact concret de ses efforts d\'épargne et de désendettement.'
    ],
    faq: [
      {
        question: 'À quelle fréquence faut-il actualiser son patrimoine net ?',
        answer: 'Une actualisation mensuelle ou trimestrielle est idéale. Un rythme plus fréquent expose à la volatilité court terme sans réelle utilité.'
      },
      {
        question: 'Faut-il inclure les véhicules dans les actifs ?',
        answer: 'Vous pouvez les inclure à leur valeur marchande actuelle décotée, sans oublier d\'inscrire le crédit associé dans les passifs.'
      },
      {
        question: 'Comment estimer la valeur de son logement ?',
        answer: 'Retenez une estimation prudente basée sur les prix récents des transactions de votre quartier, déduction faite des frais d\'agence.'
      },
      {
        question: 'Les graphiques se mettent-ils à jour automatiquement ?',
        answer: 'Oui. Le graphique historique trace instantanément votre progression sur 12 à 36 mois.'
      }
    ]
  },
  {
    id: 'financial-dashboard',
    slug: 'financial-dashboard',
    title: 'Tableau de Bord Financier Personnel Gratuit (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Tableau de bord financier tout-en-un gratuit pour Excel et Google Sheets. Suivi revenus, dépenses, trésorerie et ratios clés sans inscription.',
    h1: 'Tableau de Bord Financier Personnel Gratuit',
    category: 'Gestion de budget',
    categoryIcon: '💰',
    fileName: '14_US_Financial_Dashboard.xlsx',
    fileSize: '12.5 Ko',
    sheetNames: ['Tableau de Bord'],
    keyFormulas: [
      'Flux de Trésorerie Net = Total Revenus - Total Dépenses',
      'Taux d\'Épargne (%) = (Revenus - Dépenses) / Revenus'
    ],
    purpose: 'Regroupez l\'intégralité de vos indicateurs financiers dans un tableau de bord visuel avec graphiques dynamiques, suivi du cash-flow et indicateurs clés de performance.',
    overview: 'Le tableau de bord financier personnel réunit sur une seule page de synthèse votre flux de trésorerie mensuel, la répartition de vos charges par grandes catégories, votre taux d\'épargne réel et votre bilan annuel. C\'est l\'outil de référence pour les gestionnaires avertis souhaitant une vision d\'ensemble de leurs finances.',
    howToUse: [
      'Consignez vos entrées et sorties d\'argent mensuelles par grandes familles budgétaires.',
      'Suivez les indicateurs clés calculés en temps réel : cash-flow net, taux d\'épargne et charges fixes.',
      'Analysez les graphiques de répartition pour identifier vos plus gros postes de dépenses.',
      'Comparez vos réalisations budgétaires par rapport aux objectifs fixés en début d\'année.',
      'Conservez un historique annuel pour apprécier l\'amélioration de vos fondamentaux.'
    ],
    whoBenefits: [
      'Utilisateurs confirmés souhaitant un cockpit financier complet et visuel.',
      'Familles gérant des flux de trésorerie multiples nécessitant un suivi consolidé.',
      'Indépendants et créateurs de contenu organisant leurs finances professionnelles et privées.'
    ],
    faq: [
      {
        question: 'Le tableau de bord nécessite-t-il des connaissances avancées en Excel ?',
        answer: 'Non. Toutes les formules, tables croisées et graphiques sont pré-paramétrés. Il vous suffit de renseigner vos montants.'
      },
      {
        question: 'Puis-je l\'utiliser avec Google Sheets ?',
        answer: 'Oui. Le classeur a été testé et optimisé pour Google Sheets avec graphiques parfaitement interactifs.'
      },
      {
        question: 'Existe-t-il des alertes visuelles de dépassement ?',
        answer: 'Oui. Des mises en forme conditionnelles colorent automatiquement en rouge les postes en déficit.'
      },
      {
        question: 'Ce fichier est-il totalement gratuit ?',
        answer: 'Oui. 100% gratuit, sans inscription, sans abonnement et sans suivi tiers.'
      }
    ]
  },
  {
    id: 'monthly-spending-analyzer',
    slug: 'monthly-spending-analyzer',
    title: 'Analyseur Mensuel des Dépenses Gratuit (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Analyseur mensuel des dépenses gratuit pour Excel et Google Sheets. Catégorisation automatique, totaux par poste et détection de fuites sans inscription.',
    h1: 'Analyseur Mensuel des Dépenses Gratuit',
    category: 'Gestion de budget',
    categoryIcon: '💰',
    fileName: '15_US_Monthly_Spending_Analyzer.xlsx',
    fileSize: '12.8 Ko',
    sheetNames: ['Analyse des Dépenses'],
    keyFormulas: [
      'Total Catégorie = SOMME.SI(PlageCatégories; "Logement"; PlageMontants)',
      'Pourcentage du Budget = Total Catégorie / Total Général des Dépenses'
    ],
    purpose: 'Décomposez vos relevés de compte pour auditer avec précision la répartition de chaque euro dépensé et localiser vos gisements d\'économies.',
    overview: 'On s\'étonne souvent de voir son solde bancaire fondre sans gros achat marquant. Ce sont généralement les micro-dépenses répétées et non mesurées qui grèvent le budget. L\'analyseur mensuel ventile chaque dépense par catégorie (alimentation, transport, loisirs, santé) et vous offre une clarté immédiate sur vos habitudes réelles de consommation.',
    howToUse: [
      'Importez ou saisissez vos dépenses du mois avec leur date, leur intitulé et leur montant.',
      'Attribuez une catégorie standard à chaque opération.',
      'Visualisez le récapitulatif automatique par poste de dépense et leur poids en pourcentage.',
      'Identifiez les écarts anormaux par rapport à votre moyenne habituelle.',
      'Fixez des plafonds de dépenses pour le mois suivant sur les postes à optimiser.'
    ],
    whoBenefits: [
      'Personnes ayant du mal à comprendre où part leur salaire chaque mois.',
      'Foyers souhaitant réduire leurs coûts pour dégager une capacité d\'épargne ou d\'investissement.',
      'Toute personne réalisant un bilan financier de début d\'année ou de changement de vie.'
    ],
    faq: [
      {
        question: 'Combien de transactions puis-je saisir par mois ?',
        answer: 'La feuille est calibrée pour accueillir plusieurs centaines de lignes de transactions mensuelles sans ralentissement.'
      },
      {
        question: 'Puis-je copier-coller mes lignes de relevé bancaire ?',
        answer: 'Oui. Vous pouvez coller directement les données exportées de votre banque en ligne au format CSV ou texte.'
      },
      {
        question: 'Le fichier calcule-t-il les moyennes quotidiennes ?',
        answer: 'Oui. Le tableau de synthèse affiche la moyenne de dépenses par jour calendaire.'
      },
      {
        question: 'Faut-il installer un logiciel spécifique ?',
        answer: 'Non. Tout tableur standard comme Excel, Google Sheets ou LibreOffice permet d\'utiliser le fichier.'
      }
    ]
  },
  {
    id: 'monthly-bill-tracker',
    slug: 'monthly-bill-tracker',
    title: 'Suivi Mensuel des Factures Gratuit (Excel & Google Sheets) | Free Expense Tracker',
    metaDescription: 'Modèle de suivi des factures mensuelles gratuit pour Excel et Google Sheets. Calendrier d\'échéances, prélèvements et statuts payés sans inscription.',
    h1: 'Suivi Mensuel des Factures Gratuit',
    category: 'Audits & Suivi',
    categoryIcon: '📅',
    fileName: '16_US_Monthly_Bill_Tracker.xlsx',
    fileSize: '31.5 Ko',
    sheetNames: ['Suivi des Factures'],
    keyFormulas: [
      'Factures Restantes Dues = SOMME.SI(PlageStatut; "En Attente"; PlageMontant)',
      'Total Factures Mensuelles = SOMME(PlageMontants)'
    ],
    purpose: 'Centralisez la totalité de vos charges fixes récurrentes, leurs dates limites de règlement, les modes de paiement et leur statut d\'exécution.',
    overview: 'Oublier une facture entraîne des pénalités de retard, des coupures de service et un stress inutile. Ce registre des factures mensuelles vous offre une vue panoramique sur vos échéances calendaires. Vous savez exactement quelle somme doit rester disponible sur votre compte à chaque quinzaine pour honorer tous vos prélèvements.',
    howToUse: [
      'Listez l\'ensemble de vos fournisseurs récurrents (loyer, électricité, internet, eau, assurances).',
      'Renseignez la date limite d\'exigibilité (ex. le 5 ou le 20 du mois) et le montant prévu.',
      'Indiquez si le paiement est effectué par prélèvement automatique (mandat SEPA) ou manuel.',
      'Cochez la case ou marquez "Payé" dès que l\'opération est débitée de votre relevé bancaire.',
      'Surveillez le montant total résiduel restant à honorer avant la prochaine paie.'
    ],
    whoBenefits: [
      'Particuliers jonglant avec des dates d\'échéance multiples réparties sur tout le mois.',
      'Foyers souhaitant sécuriser leur solde bancaire pour éviter les rejets de prélèvement.',
      'Colocataires ou couples partageant les factures du logement commun.'
    ],
    faq: [
      {
        question: 'Ce modèle permet-il de suivre les factures sur toute l\'année ?',
        answer: 'Oui. Il intègre des colonnes mensuelles de janvier à décembre pour un suivi continu sans recréer de tableau.'
      },
      {
        question: 'Comment gérer les factures à montant variable comme l\'électricité ?',
        answer: 'Vous pouvez inscrire une estimation moyenne, puis renseigner le montant réel exact lors de la réception de la facture.'
      },
      {
        question: 'Y a-t-il une alerte visuelle pour les factures non payées ?',
        answer: 'Oui. Les lignes non réglées restent mises en évidence pour attirer votre attention avant l\'échéance.'
      },
      {
        question: 'Ce classeur est-il compatible avec Excel et Google Sheets ?',
        answer: 'Oui. Le format .xlsx s\'ouvre immédiatement dans Microsoft Excel, Google Sheets et toute suite bureautique compatible.'
      }
    ]
  }
];

