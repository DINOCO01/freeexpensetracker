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
    "id": "paycheck-budget",
    "slug": "paycheck-budget",
    "title": "Modèle Budget par Salaire Gratuit (Excel & Sheets) | Free Expense Tracker",
    "metaDescription": "Téléchargez notre modèle gratuit de budget par salaire pour Excel et Google Sheets. Gérez vos dépenses et votre épargne dès réception de votre paie.",
    "h1": "Modèle de Budget par Salaire Gratuit (.xlsx)",
    "category": "Gestion de budget",
    "categoryIcon": "💰",
    "fileName": "01_US_Paycheck_Budget.xlsx",
    "fileSize": "7.5 Ko",
    "sheetNames": [
      "Budget par Salaire",
      "Synthèse Annuelle"
    ],
    "keyFormulas": [
      "Surplus Restant = Revenu Net - (Charges Fixes + Dépenses Variables + Épargne + Dettes)",
      "Total par Catégorie = SOMME.SI(Plage_Catégorie; \"Alimentation\"; Plage_Montants)",
      "Taux d'Épargne par Paie = (Épargne Allouée ÷ Salaire Net Total) × 100"
    ],
    "purpose": "Conçu pour le budget base zéro et la gestion de paie à paie, ce modèle vous permet d'attribuer une mission financière précise à chaque euro dès son encaissement sur votre compte bancaire, éliminant les découverts de fin de mois.",
    "overview": "Le modèle de budget par salaire s'adresse aux personnes et foyers dont les flux de revenus suivent une fréquence régulière (bimensuelle, bihebdomadaire ou mensuelle) et qui souhaitent éviter le décalage habituel entre les dates de factures et l'arrivée des fonds. Plutôt que de vous fier à des moyennes mensuelles abstraites qui masquent les tensions ponctuelles de trésorerie, vous ventilez vos charges fixes (loyer, assurances, électricité) et vos enveloppes hebdomadaires de dépenses courantes sur la paie qui les finance directement. Cette approche proactive garantit que vos comptes restent toujours approvisionnés avant chaque prélèvement automatique.",
    "howToUse": [
      "Inscrivez le montant net exact perçu lors de votre versement de salaire dans la case Revenu Principal.",
      "Saisissez les charges incompressibles à régler avant votre prochaine rentrée d'argent (loyer, mensualités de crédit, abonnements).",
      "Allouez un montant réaliste pour vos dépenses variables hebdomadaires (alimentation, transport, loisirs) sous forme d'enveloppes dédiées.",
      "Transférez immédiatement la part réservée à vos objectifs d'épargne ou fonds de précaution vers un compte rémunéré séparé.",
      "Vérifiez que le solde restant atteint exactement zéro : chaque euro est désormais assigné et votre budget est sécurisé."
    ],
    "whoBenefits": [
      "Salariés payés à la quinzaine, toutes les deux semaines ou en fin de mois souhaitant synchroniser leurs prélèvements.",
      "Ménages voulant mettre fin au stress des fins de mois difficiles et aux découverts bancaires récurrents.",
      "Débutants en gestion financière cherchant une méthode concrète sans calculs théoriques complexes.",
      "Adeptes de la méthode du budget base zéro (Zero-Based Budgeting) privilégiant un contrôle strict de leurs flux."
    ],
    "faq": [
      {
        "question": "Quelle est la différence entre un budget mensuel classique et un budget par salaire ?",
        "answer": "Un budget mensuel lisse l'ensemble des revenus et charges sur 30 jours, ce qui peut masquer un déficit temporaire si vos factures tombent le 5 du mois alors que votre salaire arrive le 15. Le budget par salaire planifie précisément l'argent disponible entre deux versements consécutifs."
      },
      {
        "question": "Comment gérer les mois comptant trois versements de salaire ?",
        "answer": "Pour les salariés rémunérés toutes les deux semaines, deux mois par an comptent trois paies. Ce modèle vous permet de sanctuariser cette troisième paie pour booster votre épargne de précaution ou rembourser une dette par anticipation."
      },
      {
        "question": "Le fichier est-il compatible avec LibreOffice et Google Sheets ?",
        "answer": "Oui, le classeur est enregistré au format standard Microsoft Excel (.xlsx) et s'ouvre parfaitement dans Google Sheets, LibreOffice Calc et Numbers sans perte de formules ni de mise en page."
      },
      {
        "question": "Dois-je renseigner mon salaire brut ou mon salaire net ?",
        "answer": "Indiquez toujours votre salaire net disponible, c'est-à-dire le montant réellement crédité sur votre compte bancaire après retenue des cotisations sociales et prélèvement à la source."
      },
      {
        "question": "Puis-je adapter les catégories de dépenses à mes besoins personnels ?",
        "answer": "Absolument. Toutes les lignes et intitulés de catégories sont entièrement déverrouillés et personnalisables pour refléter fidèlement le train de vie de votre foyer."
      }
    ]
  },
  {
    "id": "debt-snowball",
    "slug": "debt-snowball",
    "title": "Modèle Dette Boule de Neige Gratuit (Excel & Sheets) | Free Expense Tracker",
    "metaDescription": "Téléchargez la feuille Excel gratuite de remboursement de dettes par la méthode boule de neige. Éliminez vos crédits avec motivation et suivi automatisé.",
    "h1": "Modèle de Remboursement Dette Boule de Neige (.xlsx)",
    "category": "Gestion des dettes",
    "categoryIcon": "💳",
    "fileName": "02_US_Debt_Snowball.xlsx",
    "fileSize": "7.0 Ko",
    "sheetNames": [
      "Boule de Neige",
      "Calendrier d'Amortissement"
    ],
    "keyFormulas": [
      "Ordre de Priorité = TRI CROISSANT selon le Capital Restant Dû",
      "Mensualité d'Accélération = Mensualité Minimum + Extra Boule de Neige Libéré",
      "Mois Restants = NPER(Taux_Mensuel; -Mensualité; Capital_Restant)"
    ],
    "purpose": "Feuille de calcul interactive organisant le remboursement accéléré de vos emprunts selon la méthode boule de neige : vous remboursez les plus petits soldes en premier pour remporter des victoires psychologiques rapides.",
    "overview": "La méthode boule de neige (Debt Snowball) est l'une des stratégies d'élimination des dettes les plus populaires et efficaces au monde. Contrairement aux approches purement théoriques qui privilégient les taux d'intérêt, cette méthode mise sur la psychologie comportementale humaine. En concentrant tout votre effort financier sur votre dette la plus faible tout en maintenant les mensualités minimales sur les autres, vous obtenez rapidement une première extinction de crédit en quelques mois. Ce premier succès libère une trésorerie mensuelle supplémentaire qui vient grossir le remboursement de la dette suivante, créant un puissant effet d'accélération continu.",
    "howToUse": [
      "Dressez l'inventaire de tous vos crédits non immobiliers : cartes de crédit, prêts personnels, crédit auto, facilités de paiement.",
      "Saisissez pour chaque emprunt le capital restant dû, le taux d'intérêt annuel (TAEG) et l'échéance mensuelle minimale obligatoire.",
      "Triez automatiquement vos dettes du plus petit capital restant dû au plus élevé, indépendamment de leurs taux d'intérêt.",
      "Définissez votre extra mensuel boule de neige : la somme supplémentaire que vous pouvez consacrer chaque mois à l'amortissement.",
      "Chaque fois qu'une dette est soldée, reportez l'intégralité de sa mensualité sur la dette suivante pour accélérer son remboursement."
    ],
    "whoBenefits": [
      "Personnes ayant accumulé plusieurs petits crédits à la consommation et cartes de magasin souhaitant retrouver de la visibilité.",
      "Emprunteurs ayant besoin de victoires psychologiques rapides pour conserver leur motivation dans la durée.",
      "Ménages cherchant à simplifier la gestion de leurs prélèvements bancaires en diminuant rapidement leur nombre de créanciers.",
      "Toute personne désirant un plan de désendettement pas à pas avec estimation précise de la date de libération financière."
    ],
    "faq": [
      {
        "question": "Comment fonctionne exactement le principe de la boule de neige financière ?",
        "answer": "Vous versez les mensualités minimales obligatoires sur chaque créancier, puis vous injectez chaque euro disponible sur la dette au capital le plus faible. Lorsqu'elle est remboursée, sa mensualité s'ajoute au paiement de la suivante, faisant grossir la somme consacrée au remboursement comme une boule de neige qui dévale une colline."
      },
      {
        "question": "Pourquoi rembourser le plus petit solde plutôt que le taux le plus élevé ?",
        "answer": "Les études en économie comportementale démontrent que l'abandon des régimes de désendettement découle du découragement. Éliminer une première dette en 60 ou 90 jours procure un sentiment de victoire tangible qui renforce l'engagement sur le long terme."
      },
      {
        "question": "Dois-je inclure mon prêt immobilier principal dans ce modèle ?",
        "answer": "Non, les prêts immobiliers portent généralement sur des montants très élevés et des taux plus faibles. La méthode boule de neige se concentre sur les dettes à la consommation, cartes revolving et découverts."
      },
      {
        "question": "Le fichier calcule-t-il automatiquement la date où je serai libre de dettes ?",
        "answer": "Oui, grâce aux formules préprogrammées, le tableau met à jour en temps réel le nombre de mois nécessaires et la date prévisionnelle de libération totale en fonction de votre effort mensuel."
      },
      {
        "question": "Que se passe-t-il si je parviens à injecter une prime ou rentrée d'argent exceptionnelle ?",
        "answer": "Vous pouvez ajouter un remboursement ponctuel sur la ligne de votre plus petite dette en cours : le classeur recalculera immédiatement l'impact sur l'ensemble de votre calendrier d'amortissement."
      }
    ]
  },
  {
    "id": "debt-avalanche",
    "slug": "debt-avalanche",
    "title": "Modèle Dette Avalanche Gratuit (Excel & Sheets) | Free Expense Tracker",
    "metaDescription": "Téléchargez notre modèle Excel gratuit de dette avalanche. Remboursez en priorité les taux d'intérêt les plus élevés pour minimiser le coût de vos crédits.",
    "h1": "Modèle de Dette Avalanche Gratuit (.xlsx)",
    "category": "Gestion des dettes",
    "categoryIcon": "💳",
    "fileName": "03_US_Debt_Avalanche.xlsx",
    "fileSize": "7.0 Ko",
    "sheetNames": [
      "Dette Avalanche",
      "Comparatif Intérêts"
    ],
    "keyFormulas": [
      "Ordre de Priorité = TRI DÉCROISSANT selon le Taux Annuel Effectif Global (TAEG)",
      "Économie d'Intérêts = SOMME(Intérêts_Initiaux) - SOMME(Intérêts_Optimisés)",
      "Allocation Prioritaire = Mensualité Minimum + Trésorerie d'Accélération Dédiée"
    ],
    "purpose": "Tableur d'optimisation financière mathématique conçu pour minimiser le montant total des intérêts bancaires payés en priorisant les dettes aux taux d'intérêt les plus élevés.",
    "overview": "La stratégie de la dette avalanche est la méthode la plus efficace sur le plan mathématique pur pour effacer vos obligations financières. Contrairement à la méthode boule de neige qui classe les dossiers selon le montant restant, l'avalanche ordonne vos dettes par ordre décroissant de taux d'intérêt annuel (TAEG). Vous assurez les mensualités minimales sur l'ensemble de vos comptes, et orientez la totalité de votre surplus d'épargne mensuel vers le prêt dont le taux d'intérêt est le plus lourd. Une fois ce crédit le plus onéreux liquidé, vous transférez cette capacité d'amortissement vers le taux immédiatement inférieur. Vous réduisez ainsi drastiquement l'enrichissement des banques à votre détriment.",
    "howToUse": [
      "Listez tous vos passifs financiers avec leur montant exigible, taux nominal ou TAEG, et mensualité minimale contractuelle.",
      "Triez le tableau par ordre décroissant de taux d'intérêt (du TAEG le plus haut au TAEG le plus faible).",
      "Réglez scrupuleusement la mensualité minimale requise sur chaque ligne pour préserver votre dossier bancaire.",
      "Attribuez la totalité de votre budget de remboursement supplémentaire au crédit affichant le taux le plus prohibitif.",
      "Lorsque le crédit numéro 1 est soldé, basculez l'ensemble de sa mensualité sur le crédit numéro 2 jusqu'à extinction complète."
    ],
    "whoBenefits": [
      "Emprunteurs guidés par la logique mathématique souhaitant réduire au strict minimum les frais financiers et agios.",
      "Titulaires de cartes revolving ou découverts bancaires à taux d'usure (15 % à 21 %) subissant de lourds intérêts d'emprunt.",
      "Foyers disposant d'une discipline financière constante n'ayant pas besoin de victoires psychologiques rapides pour tenir le cap.",
      "Investisseurs souhaitant libérer le plus rapidement possible leur trésorerie nette en coupant les intérêts destructeurs."
    ],
    "faq": [
      {
        "question": "Quelle est la différence fondamentale entre la dette avalanche et la dette boule de neige ?",
        "answer": "L'avalanche cible les taux d'intérêt les plus élevés d'abord pour réduire mathématiquement les frais financiers totaux, tandis que la boule de neige cible les plus petits soldes pour apporter une motivation psychologique immédiate."
      },
      {
        "question": "Combien d'argent puis-je espérer économiser avec la méthode avalanche ?",
        "answer": "Selon le volume de vos dettes et l'écart de taux entre vos crédits revolving (18-20 %) et vos prêts personnels (4-6 %), l'avalanche permet fréquemment d'économiser des centaines voire des milliers d'euros d'intérêts par rapport à un amortissement linéaire."
      },
      {
        "question": "Que faire si deux dettes affichent exactement le même taux d'intérêt ?",
        "answer": "En cas d'égalité de taux d'intérêt, appliquez le principe de la boule de neige en arbitrant en faveur du crédit ayant le solde le plus faible afin de solder un dossier plus rapidement."
      },
      {
        "question": "Puis-je combiner méthode avalanche et renégociation de crédit ?",
        "answer": "Oui, renégocier ou regrouper des crédits pour faire baisser les taux les plus hauts complète idéalement la méthode avalanche en réduisant directement votre charge d'intérêts globale."
      },
      {
        "question": "Le modèle fonctionne-t-il si mes taux d'intérêt sont variables ?",
        "answer": "Oui, vous pouvez actualiser le taux d'intérêt d'une ligne à tout moment : le tableur réajuste automatiquement l'ordre des priorités et le calcul des économies futures."
      }
    ]
  },
  {
    "id": "debt-to-income-calculator",
    "slug": "debt-to-income-calculator",
    "title": "Calculateur Taux d'Endettement Excel Gratuit | Free Expense Tracker",
    "metaDescription": "Calculez gratuitement votre taux d'endettement avec notre modèle Excel et Google Sheets. Évaluez votre capacité d'emprunt selon les normes bancaires.",
    "h1": "Calculateur de Taux d'Endettement Gratuit (.xlsx)",
    "category": "Gestion des dettes",
    "categoryIcon": "⚖️",
    "fileName": "04_US_Debt_to_Income_Calculator.xlsx",
    "fileSize": "7.5 Ko",
    "sheetNames": [
      "Calculateur DTI",
      "Capacité d'Emprunt"
    ],
    "keyFormulas": [
      "Taux d'Endettement (%) = (Total des Mensualités de Crédit ÷ Revenus Bruts Mensuels) × 100",
      "Reste à Vivre = Revenus Nets du Foyer - Total des Charges Fixes et Emprunts",
      "Capacité d'Emprunt Maximale = (Revenus Bruts × 0,35) - Charges Financières Actuelles"
    ],
    "purpose": "Outil d'analyse financière permettant de mesurer avec exactitude votre taux d'endettement et votre capacité résiduelle d'emprunt conformément aux critères d'octroi bancaires européens et internationaux.",
    "overview": "Le taux d'endettement (Debt-to-Income ou DTI) est le principal indicateur examiné par les établissements bancaires et courtiers avant d'accorder un crédit immobilier, un prêt professionnel ou un prêt à la consommation. Il mesure la part de vos revenus mensuels absorbée par le remboursement de vos charges de crédits obligatoires. En France et dans la zone euro, les recommandations du Haut Conseil de Stabilité Financière (HCSF) fixent généralement le seuil maximal d'endettement à 35 % assurance comprise. Ce simulateur vous permet d'anticiper l'audit des banques, de calculer votre reste à vivre et d'assainir votre profil emprunteur avant de déposer une demande de prêt.",
    "howToUse": [
      "Renseignez vos revenus réguliers : salaires fixes nets imposables, primes lissées sur l'année, revenus locatifs pondérés ou pensions.",
      "Inscrivez toutes vos charges récurrentes de crédit : mensualités de prêt immobilier, prêts auto, crédits travaux, pensions alimentaires versées.",
      "Consultez votre taux d'endettement calculé automatiquement avec code couleur vert/orange/rouge selon les normes en vigueur.",
      "Vérifiez le calcul de votre reste à vivre, qui mesure la somme restante pour subvenir aux besoins alimentaires et courants du foyer.",
      "Testez différents scénarios en simulant le remboursement anticipé d'un prêt pour observer la baisse immédiate de votre taux."
    ],
    "whoBenefits": [
      "Futurs acquéreurs préparant un projet d'achat immobilier souhaitant vérifier leur solvabilité avant de contacter un courtier.",
      "Foyers souhaitant s'assurer qu'ils ne franchissent pas la zone de surendettement lors de la souscription d'un nouveau projet.",
      "Investisseurs immobiliers calculant l'impact d'une nouvelle opération locative sur leur capacité d'emprunt globale.",
      "Conseillers et particuliers voulant évaluer la solidité financière d'un dossier sans partager de données confidentielles en ligne."
    ],
    "faq": [
      {
        "question": "Quel est le taux d'endettement maximal accepté par les banques ?",
        "answer": "En France, les normes réglementaires du HCSF imposent un plafond de 35 % d'endettement (assurance de prêt incluse) sur une durée maximale de 25 ans. À l'international, les banques acceptent parfois jusqu'à 43 % pour des profils à très hauts revenus."
      },
      {
        "question": "Les loyers actuels sont-ils pris en compte si j'achète ma résidence principale ?",
        "answer": "Non, si vous achetez votre résidence principale, votre loyer actuel disparaîtra et sera remplacé par la future mensualité du prêt immobilier dans le calcul bancaire."
      },
      {
        "question": "Qu'est-ce que le reste à vivre et pourquoi est-il déterminant ?",
        "answer": "Le reste à vivre est le montant d'argent net qu'il vous reste chaque mois après paiement de toutes vos mensualités de crédit. Une banque peut refuser un prêt à 30 % d'endettement si le reste à vivre est insuffisant pour nourrir une famille, ou accepter une dérogation à 35 % si le reste à vivre est très confortable."
      },
      {
        "question": "Comment les revenus locatifs sont-ils comptabilisés dans le calcul ?",
        "answer": "Les banques appliquent généralement une décote de prudence de 20 % à 30 % sur les loyers bruts perçus (pour couvrir la vacance locative, les charges et la fiscalité) avant d'intégrer 70 % à 80 % de la somme à vos revenus."
      },
      {
        "question": "Comment réduire rapidement mon taux d'endettement avant de demander un prêt ?",
        "answer": "Solder par anticipation un petit crédit conso ou un prêt auto à faible capital restant permet d'éliminer une mensualité complète et d'abaisser instantanément votre taux d'endettement de plusieurs points."
      }
    ]
  },
  {
    "id": "student-loan-planner",
    "slug": "student-loan-planner",
    "title": "Modèle Remboursement Prêt Étudiant Excel Gratuit | Free Expense Tracker",
    "metaDescription": "Planifiez le remboursement de votre prêt étudiant avec notre simulateur Excel gratuit. Calculez l'impact des remboursements anticipés sur les intérêts.",
    "h1": "Planificateur de Prêt Étudiant Gratuit (.xlsx)",
    "category": "Gestion des dettes",
    "categoryIcon": "🎓",
    "fileName": "05_US_Student_Loan_Planner.xlsx",
    "fileSize": "7.5 Ko",
    "sheetNames": [
      "Prêt Étudiant",
      "Stratégie Anticipée"
    ],
    "keyFormulas": [
      "Mensualité Amortissement = VPM(Taux_Annuel/12; Durée_Mois; -Capital_Emprunté)",
      "Intérêts Cumulés sur la Durée = SOMME(Intérêts_Mensuels)",
      "Gain Remboursement Anticipé = Durée_Initiale - Nouvelle_Durée_Mois"
    ],
    "purpose": "Simulateur complet pour visualiser l'échéancier de votre prêt étudiant, mesurer le coût de la période de franchise (différé) et simuler l'accélération de votre remboursement.",
    "overview": "Le prêt étudiant représente souvent la première dette d'envergure contractée par un jeune diplômé entrant sur le marché du travail. Entre la période de franchise totale ou partielle pendant les études et l'entrée dans la phase d'amortissement, il est facile de sous-estimer le volume total des intérêts capitalisés. Ce planificateur Excel modélise fidèlement votre échéancier complet. Il vous permet de tester l'effet concret d'un versement mensuel supplémentaire ou d'un remboursement partiel anticipé, démontrant comment un effort modeste de 50 € à 100 € par mois peut raccourcir votre période de remboursement de plusieurs années.",
    "howToUse": [
      "Indiquez le capital total emprunté pour financer vos études, le taux d'intérêt contractuel et la durée totale en années.",
      "Spécifiez la période de franchise si vous avez bénéficié d'un différé d'amortissement pendant vos années d'études.",
      "Examinez le tableau d'amortissement mois par mois séparant la part de capital remboursé et la part d'intérêts bancaires.",
      "Testez dans la colonne Versements Supplémentaires l'impact d'une contribution mensuelle accrue de 50 €, 100 € ou 200 €.",
      "Observez l'estimation chiffrée des intérêts économisés et l'avancement de votre date de fin de prêt."
    ],
    "whoBenefits": [
      "Étudiants et jeunes diplômés débutant leur carrière souhaitant planifier sereinement l'entrée en phase d'amortissement.",
      "Jeunes actifs souhaitant se débarrasser au plus vite de leur prêt d'études pour préparer leur premier achat immobilier.",
      "Parents ayant co-signé un emprunt étudiant voulant suivre la décrue du capital et optimiser les versements.",
      "Toute personne évaluant l'intérêt d'un rachat ou regroupement de prêt étudiant auprès d'une autre banque."
    ],
    "faq": [
      {
        "question": "Qu'est-ce que la période de différé (franchise) sur un prêt étudiant ?",
        "answer": "Pendant vos études, vous bénéficiez souvent d'une franchise partielle (vous ne payez que les intérêts et l'assurance) ou totale (vous ne payez que l'assurance, les intérêts étant reportés). L'amortissement du capital ne commence qu'après l'obtention de votre diplôme."
      },
      {
        "question": "Y a-t-il des pénalités bancaires en cas de remboursement anticipé d'un prêt étudiant ?",
        "answer": "En France et selon la directive européenne sur le crédit à la consommation, les remboursements anticipés sont totalement gratuits si le montant remboursé par anticipation est inférieur à 10 000 € sur 12 mois."
      },
      {
        "question": "Vaut-il mieux rembourser son prêt étudiant ou commencer à investir en bourse ?",
        "answer": "Si votre prêt étudiant affiche un taux très bas (0 % à 1,5 %), il peut être judicieux de placer votre épargne sur un livret réglementé ou en ETF. Si votre prêt est à plus de 3-4 %, le rembourser par anticipation procure un rendement net garanti équivalent au taux d'intérêt économisé."
      },
      {
        "question": "Comment les remboursements supplémentaires sont-ils imputés ?",
        "answer": "Un versement supplémentaire vient directement réduire le capital restant dû, ce qui diminue instantanément la base de calcul des intérêts pour tous les mois suivants."
      },
      {
        "question": "Le modèle gère-t-il les prêts étudiants garantis par l'État ?",
        "answer": "Oui, les conditions financières (capital, taux fixe et durée) s'intègrent de manière identique dans le modèle, quelle que soit la garantie souscrite."
      }
    ]
  },
  {
    "id": "auto-loan-calculator",
    "slug": "auto-loan-calculator",
    "title": "Calculateur Prêt Automobile Excel Gratuit | Free Expense Tracker",
    "metaDescription": "Simulez le coût réel de votre crédit auto avec notre modèle Excel gratuit. Intégrez apport, mensualités, intérêts et coût d'entretien annuel.",
    "h1": "Calculateur de Prêt Automobile Gratuit (.xlsx)",
    "category": "Gestion des dettes",
    "categoryIcon": "🚗",
    "fileName": "06_US_Auto_Loan_Calculator.xlsx",
    "fileSize": "7.5 Ko",
    "sheetNames": [
      "Calculateur Auto",
      "Coût Réel Possession"
    ],
    "keyFormulas": [
      "Capital Financé = Prix du Véhicule - Apport Personnel - Valeur Reprise Ancienne Voiture",
      "Mensualité Crédit = VPM(Taux_Annuel/12; Durée_Mois; -Capital_Financé)",
      "Coût Total de Possession (TCO) = Mensualités + Assurance + Carburant + Entretien + Décote"
    ],
    "purpose": "Feuille de calcul complète pour évaluer le coût total de financement d'un véhicule neuf ou d'occasion, comparer les offres de crédit et mesurer le coût de possession réel.",
    "overview": "L'achat d'un véhicule représente le deuxième poste de dépenses de nombreux foyers après le logement. Pourtant, la plupart des acheteurs se concentrent uniquement sur le montant de la mensualité sans mesurer le coût global du crédit ni les dépenses annexes obligatoires. Ce calculateur Excel vous aide à négocier sereinement votre financement auto : vous déterminez le montant exact des intérêts bancaires selon votre apport, comparez différentes durées d'emprunt (36, 48, 60 ou 72 mois) et visualisez le coût d'usage complet (carburant, assurance, entretien préventif et dépréciation kilométrique).",
    "howToUse": [
      "Indiquez le prix d'achat clé en main du véhicule (options, carte grise et frais de mise en route inclus).",
      "Saisissez le montant de votre apport personnel initial et la valeur éventuelle de reprise de votre ancien véhicule.",
      "Renseignez la durée d'emprunt souhaitée en mois et le taux annuel effectif global (TAEG) proposé par le concessionnaire ou votre banque.",
      "Consultez votre mensualité exacte, le coût total du crédit et le calendrier d'amortissement détaillé.",
      "Complétez l'onglet Coût Réel pour estimer vos dépenses d'entretien, d'assurance et de carburant mensuelles moyennes."
    ],
    "whoBenefits": [
      "Acheteurs de véhicules neufs ou d'occasion souhaitant comparer les financements de concession et les prêts bancaires.",
      "Automobilistes hésitant entre un achat à crédit classique, un paiement comptant ou une formule de location (LOA/LLD).",
      "Conducteurs souhaitant anticiper l'impact réel d'une nouvelle voiture sur leur budget mensuel global.",
      "Gestionnaires de budget voulant vérifier la conformité du contrat de financement avant signature."
    ],
    "faq": [
      {
        "question": "Vaut-il mieux souscrire son crédit auto en concession ou auprès de sa banque ?",
        "answer": "Les taux proposés en concession sont souvent assortis d'assurances facultatives très onéreuses. Faire une simulation préalable auprès de sa banque ou d'un comparateur en ligne permet d'arriver en position de force pour négocier le TAEG."
      },
      {
        "question": "Quelle est la durée de prêt auto recommandée ?",
        "answer": "Il est conseillé de ne pas dépasser 48 à 60 mois d'emprunt. Une durée trop longue (72 à 84 mois) entraîne une dépréciation de la voiture plus rapide que le remboursement du capital, créant une situation de valeur nette négative en cas de revente."
      },
      {
        "question": "Quel montant d'apport personnel est conseillé pour une voiture ?",
        "answer": "Un apport personnel représentant au moins 10 % à 20 % du prix du véhicule permet de couvrir la dépréciation immédiate de la première année et de réduire substantiellement les intérêts bancaires."
      },
      {
        "question": "Le modèle prend-il en compte l'assurance emprunteur ?",
        "answer": "Oui, une ligne dédiée vous permet d'intégrer le coût mensuel de l'assurance de prêt pour obtenir le TAEG effectif global tout compris."
      },
      {
        "question": "Quelle est la différence entre crédit classique et location avec option d'achat (LOA) ?",
        "answer": "Avec un crédit classique, vous êtes propriétaire du véhicule dès le premier jour et le conservez après la dernière mensualité. Avec une LOA, vous payez un loyer d'usage et devez verser une valeur résiduelle importante en fin de contrat pour devenir propriétaire."
      }
    ]
  },
  {
    "id": "mortgage-planner",
    "slug": "mortgage-planner",
    "title": "Tableau d'Amortissement Prêt Immobilier Excel | Free Expense Tracker",
    "metaDescription": "Téléchargez notre simulateur d'emprunt immobilier gratuit pour Excel. Visualisez le tableau d'amortissement complet et l'impact des remboursements anticipés.",
    "h1": "Simulateur de Prêt Immobilier & Amortissement (.xlsx)",
    "category": "Gestion des dettes",
    "categoryIcon": "🏡",
    "fileName": "07_US_Mortgage_Planner.xlsx",
    "fileSize": "7.5 Ko",
    "sheetNames": [
      "Prêt Immobilier",
      "Échéancier Mensuel"
    ],
    "keyFormulas": [
      "Mensualité Hors Assurance = VPM(Taux_Nominal/12; Durée_Années*12; -Capital_Emprunté)",
      "Cotisation Assurance Mensuelle = (Capital_Initial × Taux_Assurance) ÷ 12",
      "Amortissement du Capital = Mensualité - (Capital_Restant_Dû × Taux_Mensuel)"
    ],
    "purpose": "Générateur complet de tableau d'amortissement pour prêt immobilier résidentiel avec calcul des intérêts, ventilation de l'assurance emprunteur et simulation des remboursements anticipés.",
    "overview": "L'emprunt immobilier est généralement l'engagement financier le plus lourd d'une vie. Sur une période de 15, 20 ou 25 ans, une infime variation de taux ou de frais d'assurance représente des dizaines de milliers d'euros de différence sur le coût final. Ce classeur Excel génère un échéancier complet mois par mois, décomposant chaque prélèvement entre capital remboursé, intérêts bancaires et prime d'assurance. Grâce à son module de remboursement anticipé, vous visualisez immédiatement le gain financier spectaculaire obtenu en versant quelques centaines d'euros d'amortissement supplémentaire chaque année.",
    "howToUse": [
      "Saisissez le montant total du prêt immobilier après déduction de votre apport personnel et des frais de notaire.",
      "Renseignez la durée du crédit en années (15, 20 ou 25 ans) ainsi que le taux d'intérêt nominal fixe consenti par la banque.",
      "Indiquez le taux de l'assurance emprunteur (sur capital initial ou capital restant dû selon votre contrat).",
      "Parcourez le tableau d'amortissement pour constater la bascule progressive entre part d'intérêts et part de capital amorti.",
      "Renseignez des montants de remboursement anticipé partiel pour mesurer le raccourcissement de la durée restante du prêt."
    ],
    "whoBenefits": [
      "Candidats à l'accession à la propriété préparant leur plan de financement pour leur future résidence principale.",
      "Propriétaires en cours de prêt souhaitant vérifier leur échéancier officiel et auditer leurs coûts d'assurance.",
      "Emprunteurs recevant une rentrée d'argent (succession, bonus) voulant arbitrer entre placement et remboursement anticipé.",
      "Investisseurs locatifs calculant la quote-part d'intérêts déductibles de leurs revenus fonciers ou BIC."
    ],
    "faq": [
      {
        "question": "Comment évolue la part de capital par rapport aux intérêts au fil des années ?",
        "answer": "Durant les premières années d'un prêt immobilier, vos mensualités sont composées en grande majorité d'intérêts bancaires. Ce n'est qu'après plusieurs années que la part de capital amorti devient prépondérante dans vos mensualités."
      },
      {
        "question": "Quels sont les frais applicables en cas de remboursement anticipé partiel ?",
        "answer": "En France, la loi encadre les indemnités de remboursement anticipé (IRA) à un maximum de 6 mois d'intérêts plafonnés à 3 % du capital restant dû, et elles sont fréquemment négociables à 0 % hors rachat par la concurrence."
      },
      {
        "question": "Comment la délégation d'assurance emprunteur est-elle modélisée ?",
        "answer": "Le modèle permet de distinguer le taux de l'assurance groupe bancaire et le taux d'une assurance externe individuelle pour calculer immédiatement votre économie mensuelle et globale."
      },
      {
        "question": "Le fichier calcule-t-il le coût total du crédit ?",
        "answer": "Oui, une case de synthèse récapitule la somme exacte de tous les intérêts versés et de toutes les primes d'assurance cumulées sur l'intégralité de la durée d'emprunt."
      },
      {
        "question": "Puis-je adapter ce modèle à un investissement locatif ?",
        "answer": "Absolument, le tableau d'amortissement généré fournit année par année le montant exact des intérêts d'emprunt nécessaires pour vos déclarations fiscales locatives."
      }
    ]
  },
  {
    "id": "401k-retirement-planner",
    "slug": "401k-retirement-planner",
    "title": "Planificateur Épargne Retraite & Intérêts Composés | Free Expense Tracker",
    "metaDescription": "Estimez votre capital de retraite futur avec notre simulateur d'intérêts composés gratuit sous Excel et Google Sheets. Anticipez votre rente sans frais.",
    "h1": "Planificateur d'Épargne Retraite Gratuit (.xlsx)",
    "category": "Investissement & Retraite",
    "categoryIcon": "📈",
    "fileName": "08_US_401k_Retirement_Planner.xlsx",
    "fileSize": "7.5 Ko",
    "sheetNames": [
      "Épargne Retraite",
      "Projection Croissance"
    ],
    "keyFormulas": [
      "Capital Retraite = VC(Taux_Rendement/12; Années*12; -Versement_Mensuel; -Capital_Départ)",
      "Intérêts Composés Générés = Capital_Retraite_Final - Total_Versements_Effectués",
      "Rente Mensuelle Estimée = (Capital_Retraite × Taux_Retrait_Sûr) ÷ 12"
    ],
    "purpose": "Simulateur d'investissement à long terme permettant de modéliser la constitution de votre patrimoine de retraite grâce à la force des intérêts composés et des versements programmés.",
    "overview": "Préparer sa retraite est un impératif universel face aux incertitudes qui pèsent sur les régimes de retraite par répartition. Plus vous commencez tôt à placer une somme régulière, plus l'effet boule de neige des intérêts composés travaille en votre faveur : au bout de 20 ou 30 ans, les gains réinvestis dépassent largement le total des sommes que vous avez sorties de votre poche. Ce planificateur Excel d'épargne retraite modélise l'évolution de votre portefeuille selon votre âge actuel, votre âge de départ souhaité, vos versements mensuels et un taux de rendement moyen réaliste (actions mondiales, obligations ou fonds euros).",
    "howToUse": [
      "Indiquez votre âge actuel et l'âge visé pour la cessation d'activité professionnelle ou l'indépendance financière.",
      "Saisissez le capital déjà accumulé sur vos supports d'épargne existants (PER, assurance-vie, PEA, compte-titres).",
      "Définissez votre versement mensuel programmé ainsi que l'abondement éventuel de votre employeur.",
      "Choisissez une hypothèse de rendement annuel moyen net d'inflation (généralement 5 % à 7 % pour un portefeuille diversifié).",
      "Consultez la trajectoire de votre capital de fin de carrière et la rente mensuelle pérenne que vous pourrez en tirer."
    ],
    "whoBenefits": [
      "Épargnants de tout âge souhaitant quantifier l'effort d'épargne nécessaire pour maintenir leur niveau de vie à la retraite.",
      "Salariés bénéficiant d'un dispositif d'épargne salariale ou retraite d'entreprise (PER d'entreprise, PEE, abondement).",
      "Travailleurs indépendants et professions libérales devant bâtir leur propre retraite par capitalisation.",
      "Adeptes du mouvement FIRE (Financial Independence, Retire Early) planifiant une liberté financière anticipée."
    ],
    "faq": [
      {
        "question": "Comment fonctionnent les intérêts composés sur 20 ou 30 ans ?",
        "answer": "Les intérêts perçus chaque année sont automatiquement réinvestis et produisent eux-mêmes de nouveaux intérêts les années suivantes. Sur une longue période, cette croissance géométrique fait exploser la valeur de votre capital bien au-delà de vos versements réels."
      },
      {
        "question": "Quel taux de rendement annuel moyen est-il raisonnable de retenir ?",
        "answer": "Historiquement, un portefeuille diversifié en actions mondiales (type MSCI World) génère entre 7 % et 8 % par an brut, soit environ 5 % à 6 % net d'inflation. Pour une approche prudente, une hypothèse de 5 % est recommandée."
      },
      {
        "question": "Qu'est-ce que la règle des 4 % (Taux de Retrait Sûr) ?",
        "answer": "La règle des 4 % issue de l'étude Trinity indique qu'un retraité peut retirer chaque année 4 % de son portefeuille financier initial (ajusté de l'inflation) sans risquer d'épuiser son capital sur une période de 30 ans."
      },
      {
        "question": "Le modèle est-il adapté aux plans d'épargne français (PER, PEA, Assurance-Vie) ?",
        "answer": "Oui, le moteur de calcul mathématique des intérêts composés et de l'effort d'épargne s'applique de manière identique à tout compte de capitalisation, qu'il s'agisse d'un PER, d'un PEA ou d'un compte-titres."
      },
      {
        "question": "Pourquoi est-il crucial de commencer à épargner dès 25 ou 30 ans ?",
        "answer": "Commencer 10 ans plus tôt permet souvent de doubler le capital final à la retraite avec deux fois moins d'effort d'épargne mensuel, grâce aux années supplémentaires de capitalisation des intérêts."
      }
    ]
  },
  {
    "id": "roth-ira-planner",
    "slug": "roth-ira-planner",
    "title": "Simulateur Épargne Long Terme & Intérêts Composés | Free Expense Tracker",
    "metaDescription": "Modélisez la croissance d'un portefeuille d'investissement à long terme avec notre tableur Excel gratuit. Intégrez versements réguliers et rendement annuel.",
    "h1": "Simulateur d'Investissement & Intérêts Composés (.xlsx)",
    "category": "Investissement & Retraite",
    "categoryIcon": "📈",
    "fileName": "09_US_Roth_IRA_Planner.xlsx",
    "fileSize": "7.5 Ko",
    "sheetNames": [
      "Simulateur Épargne",
      "Tableau Annuel"
    ],
    "keyFormulas": [
      "Cumul Annuel = Solde_Précédent × (1 + Taux_Rendement) + Versements_Annuels",
      "Part Intérêts vs Versements = Intérêts_Cumulés ÷ Valeur_Totale_Portefeuille",
      "Capital à Horizon = VC(Taux_Annuel; Années; -Versements_Annuels; -Capital_Initial)"
    ],
    "purpose": "Outil de projection de patrimoine à long terme pour évaluer la croissance d'une enveloppe d'investissement défiscalisée ou d'un portefeuille d'actions régulier avec versements automatisés.",
    "overview": "Bâtir un patrimoine financier solide repose sur une règle simple : la régularité des versements combinée au temps de détention sur les marchés. Que vous investissiez via un compte individuel de retraite, une assurance-vie ou un plan d'épargne en actions, ce modèle Excel projette année par année la croissance de vos actifs. Vous mesurez précisément à quel moment les gains annuels générés par vos investissements dépassent le montant de votre salaire ou de votre contribution annuelle, marquant le franchissement d'une étape décisive vers l'indépendance financière.",
    "howToUse": [
      "Indiquez votre capital de départ actuel disponible pour votre stratégie d'investissement à long terme.",
      "Saisissez le montant de votre versement programmé mensuel ou annuel (la régularité est le facteur clé du succès).",
      "Définissez votre horizon temporel de placement en nombre d'années (par exemple 10, 15, 20 ou 25 ans).",
      "Renseignez un taux de croissance annuel moyen prudent pour votre portefeuille d'actifs.",
      "Analysez la ventilation entre le montant total de vos apports personnels et le montant prodigieux des intérêts composés accumulés."
    ],
    "whoBenefits": [
      "Investisseurs particuliers pratiquant la stratégie DCA (Dollar Cost Averaging / Investissement Programmé) sur ETF.",
      "Jeunes actifs souhaitant visualiser concrètement l'impact de verser 100 €, 200 € ou 500 € par mois sur les marchés financiers.",
      "Parents préparant un capital d'avenir pour le financement des études supérieures de leurs enfants.",
      "Épargnants cherchant à comparer un placement boursier dynamique avec les livrets bancaires traditionnels."
    ],
    "faq": [
      {
        "question": "Qu'est-ce que la méthode DCA (Dollar-Cost Averaging) ?",
        "answer": "Le DCA consiste à investir une somme fixe à intervalles réguliers (tous les mois par exemple), quel que soit l'état du marché. Cela permet d'acheter plus de parts quand les cours baissent et moins quand ils montent, lissant votre prix de revient unitaire sans stress de timing."
      },
      {
        "question": "Comment ce simulateur prend-il en compte la volatilité des marchés ?",
        "answer": "Le modèle retient un taux moyen annualisé lissé. Dans la réalité, les marchés boursiers connaissent des années de forte hausse et des années de baisse, mais convergent vers leur moyenne historique sur un horizon de 15 à 20 ans."
      },
      {
        "question": "Les intérêts sont-ils taxés chaque année dans la simulation ?",
        "answer": "Le modèle simule une enveloppe à capitalisation (comme le PEA en France ou le Roth IRA aux États-Unis), où les gains ne subissent aucune fiscalité tant qu'ils demeurent investis à l'intérieur du compte."
      },
      {
        "question": "Puis-je modifier le montant de mes versements au cours du temps ?",
        "answer": "Oui, vous pouvez ajuster manuellement les versements dans les colonnes annuelles du tableur pour refléter une augmentation prévisible de vos revenus professionnels futurs."
      },
      {
        "question": "Pourquoi privilégier les fonds indiciels (ETF) pour ce type de stratégie ?",
        "answer": "Les ETF offrent une diversification instantanée sur des centaines d'entreprises avec des frais de gestion extrêmement faibles (souvent moins de 0,2 % par an), maximisant la part des gains qui reste dans votre poche."
      }
    ]
  },
  {
    "id": "emergency-fund-planner",
    "slug": "emergency-fund-planner",
    "title": "Modèle Planificateur Fonds d'Urgence Excel Gratuit | Free Expense Tracker",
    "metaDescription": "Calculez et constituez votre réserve de précaution de 3 à 6 mois de charges fixes avec notre tableur Excel gratuit sans inscription.",
    "h1": "Planificateur de Fonds d'Urgence Gratuit (.xlsx)",
    "category": "Épargne",
    "categoryIcon": "🛡️",
    "fileName": "10_US_Emergency_Fund_Planner.xlsx",
    "fileSize": "7.5 Ko",
    "sheetNames": [
      "Fonds d'Urgence",
      "Paliers de Sécurité"
    ],
    "keyFormulas": [
      "Dépenses Mensuelles Incompressibles = Loyer + Énergie + Alimentation + Assurances + Transports + Dettes",
      "Objectif 3 Mois (Palier 1) = Dépenses_Incompressibles × 3",
      "Objectif 6 Mois (Palier 2) = Dépenses_Incompressibles × 6",
      "Progression Actuelle (%) = (Épargne_Disponible ÷ Objectif_Cible) × 100"
    ],
    "purpose": "Feuille d'évaluation méthodique pour chiffrer vos dépenses vitales incompressibles et bâtir un matelas de sécurité de 3 à 6 mois pour immuniser votre foyer contre les aléas de la vie.",
    "overview": "Le fonds d'urgence est la pierre angulaire absolue de toute santé financière durable. Sans épargne de précaution disponible immédiatement, le moindre imprévu de la vie quotidienne — une panne automobile imprévue, un problème de santé, une toiture à réparer ou une perte d'emploi temporaire — vous contraint à vous endetter par des crédits revolving coûteux ou à liquider vos investissements au pire moment. Ce planificateur Excel classe vos dépenses entre charges incompressibles vitales et dépenses de confort, calcule votre objectif d'épargne personnalisé et trace un plan d'alimentation par étapes pour sécuriser votre foyer.",
    "howToUse": [
      "Recensez dans la colonne Charges Incompressibles vos dépenses vitales : logement, électricité, nourriture de base, santé, assurances et transport.",
      "Excluez volontairement les dépenses superflues (restaurants, shopping, streaming) que vous couperiez immédiatement en cas de crise.",
      "Sélectionnez votre niveau de sécurité cible : 3 mois (salariés stables), 6 mois (familles avec enfants) ou 9-12 mois (indépendants/freelances).",
      "Inscrivez le montant d'épargne liquide actuellement disponible sur vos livrets d'épargne sécurisés.",
      "Suivez votre jauge de progression visuelle et fixez le versement mensuel nécessaire pour combler l'écart restant."
    ],
    "whoBenefits": [
      "Personnes vivant de paie en paie souhaitant briser la précarité financière et dormir sur leurs deux oreilles.",
      "Travailleurs indépendants, freelances et auto-entrepreneurs confrontés à des revenus d'activité irréguliers.",
      "Jeunes couples venant d'emménager ensemble souhaitant créer une première réserve de sécurité commune.",
      "Investisseurs voulant s'assurer d'avoir une poche de sécurité liquide avant d'engager des capitaux en bourse ou immobilier."
    ],
    "faq": [
      {
        "question": "Combien de mois de dépenses faut-il conserver dans son fonds d'urgence ?",
        "answer": "La règle générale recommande 3 mois de dépenses incompressibles pour un fonctionnaire ou salarié en CDI sans charges lourdes, 6 mois pour un ménage avec enfants ou crédit immobilier, et 9 à 12 mois pour un indépendant ou freelance aux revenus fluctuants."
      },
      {
        "question": "Où doit être placé l'argent du fonds de précaution ?",
        "answer": "Le fonds d'urgence doit être placé exclusivement sur des supports totalement sécurisés, sans risque de perte en capital et disponibles instantanément (type Livret A, LDDS ou comptes sur livret bancaire)."
      },
      {
        "question": "Qu'est-ce qui justifie de piocher dans son fonds d'urgence ?",
        "answer": "Le fonds ne doit servir qu'à des urgences réelles répondant à trois critères stricts : imprévues, indispensables et urgentes (panne de véhicule pour aller travailler, réparation de chaudière en plein hiver, franchise médicale)."
      },
      {
        "question": "Dois-je continuer à investir tant que mon fonds d'urgence n'est pas rempli ?",
        "answer": "Il est vivement conseillé de suspendre les investissements risqués tant que vous n'avez pas au minimum 1 à 2 mois de dépenses de sécurité de côté, afin de ne jamais devoir liquider vos actifs en cas de coup dur."
      },
      {
        "question": "Comment reconstituer le fonds après une dépense imprévue ?",
        "answer": "Dès que le fonds d'urgence a été entamé, la priorité absolue de votre budget mensuel consiste à y rediriger votre épargne disponible jusqu'à ce que la réserve revienne à son niveau initial."
      }
    ]
  },
  {
    "id": "subscription-audit",
    "slug": "subscription-audit",
    "title": "Modèle Audit des Abonnements & Factures Récurrentes | Free Expense Tracker",
    "metaDescription": "Identifiez et résiliez vos abonnements superflus avec notre modèle Excel gratuit. Calculez vos économies annuelles récurrentes en quelques minutes.",
    "h1": "Feuille d'Audit des Abonnements & Dépenses Récurrentes (.xlsx)",
    "category": "Audits & Suivi",
    "categoryIcon": "🔍",
    "fileName": "11_US_Subscription_Audit.xlsx",
    "fileSize": "7.5 Ko",
    "sheetNames": [
      "Audit Abonnements",
      "Plan d'Économies"
    ],
    "keyFormulas": [
      "Coût Annuel de l'Abonnement = Coût_Mensuel × 12",
      "Total des Prélèvements Annuels = SOMME(Plage_Coûts_Annuels)",
      "Économie Immédiate Réalisée = SOMME.SI(Statut; \"À Résilier\"; Plage_Coûts_Annuels)"
    ],
    "purpose": "Feuille d'inventaire exhaustif de tous vos contrats récurrents (streaming, forfaits mobiles, salles de sport, logiciels) pour traquer les prélèvements fantômes et libérer du pouvoir d'achat.",
    "overview": "À l'ère des abonnements automatiques et des micro-prélèvements invisibles, les fuites financières récurrentes s'accumulent insidieusement. Dix euros pour un service de streaming délaissé, quinze euros pour une application mobile oubliée, quarante euros pour une salle de sport désertée... Ces montants fragmentés semblent dérisoires au mois le mois, mais totalisent fréquemment entre 800 € et 2 000 € gaspillés chaque année. Ce classeur Excel recense l'intégralité de vos abonnements, calcule leur coût annualisé réel et vous aide à décider froidement : conserver, renégocier ou résilier immédiatement.",
    "howToUse": [
      "Ouvrez vos trois derniers relevés de compte bancaire pour repérer tous les prélèvements automatiques récurrents.",
      "Saisissez chaque service dans le tableur avec son intitulé, sa catégorie, sa fréquence de facturation et son coût.",
      "Attribuez un statut franc à chaque abonnement : Actif & Utilisé, À Renégocier, ou À Résilier.",
      "Consultez la synthèse automatique chiffrant le coût annuel de chaque poste et l'économie globale à portée de main.",
      "Résiliez sans délai les services marqués \"À Résilier\" et réaffectez l'argent récupéré vers vos objectifs d'épargne."
    ],
    "whoBenefits": [
      "Foyers constatant que leur solde bancaire diminue mystérieusement sans achats exceptionnels.",
      "Consommateurs ayant souscrit à de multiples périodes d'essai gratuit ayant basculé en prélèvements payants.",
      "Utilisateurs souhaitant optimiser leurs contrats d'assurance, box internet et forfaits de téléphonie mobile.",
      "Toute personne réalisant un grand nettoyage de printemps financier pour réduire ses charges fixes."
    ],
    "faq": [
      {
        "question": "Pourquoi les abonnements mensuels sont-ils si trompeurs pour le budget ?",
        "answer": "La psychologie des abonnements repose sur la faible douleur ressentie lors d'un débit de 9,99 €. En lissant ce coût sur 12 mois (120 €) ou 5 ans (600 €), on prend conscience du coût disproportionné par rapport à l'usage réel."
      },
      {
        "question": "Combien d'argent un audit d'abonnements permet-il d'économiser en moyenne ?",
        "answer": "Un audit complet permet en moyenne à un foyer de résilier ou renégocier entre 30 € et 120 € de prélèvements mensuels superflus, soit une économie directe de 360 € à 1 440 € par an sans impacter son confort."
      },
      {
        "question": "Comment repérer les abonnements cachés ou oubliés ?",
        "answer": "Passez au crible vos relevés de compte et cartes bancaires sur une année complète (certains abonnements comme les noms de domaine, antivirus ou cotisations de cartes sont annuels) ainsi que les rubriques abonnements de vos téléphones (Apple App Store / Google Play)."
      },
      {
        "question": "Que faire pour les abonnements que je souhaite conserver mais qui sont trop chers ?",
        "answer": "Marquez-les \"À Renégocier\" dans le tableur : contacter votre fournisseur d'accès internet, votre assureur ou votre opérateur mobile en mentionnant la concurrence permet d'obtenir des réductions de 20 % à 40 % dans 80 % des cas."
      },
      {
        "question": "Dois-je reconduire cet audit régulièrement ?",
        "answer": "Réaliser cet audit deux fois par an (par exemple en janvier et en septembre) est une excellente hygiène financière pour éviter l'accumulation de nouveaux prélèvements automatiques."
      }
    ]
  },
  {
    "id": "sinking-fund-planner",
    "slug": "sinking-fund-planner",
    "title": "Modèle Épargne Ciblée & Dépenses Annuelles Excel | Free Expense Tracker",
    "metaDescription": "Anticipez vos dépenses prévisibles (assurances, impôts, vacances) avec notre modèle d'épargne ciblée gratuit pour Excel et Google Sheets.",
    "h1": "Planificateur d'Épargne Ciblée (Sinking Funds) (.xlsx)",
    "category": "Épargne",
    "categoryIcon": "🎯",
    "fileName": "12_US_Sinking_Fund_Planner.xlsx",
    "fileSize": "7.5 Ko",
    "sheetNames": [
      "Épargne Ciblée",
      "Tableau d'Allocation"
    ],
    "keyFormulas": [
      "Versement Mensuel Requis = (Montant_Cible - Épargne_Déjà_Amassée) ÷ Mois_Restants",
      "Total Provisionné par Mois = SOMME(Plage_Versements_Mensuels)",
      "Statut d'Échéance = SI(Épargne_Actuelle >= Montant_Cible; \"Objectif Atteint\"; \"En Cours\")"
    ],
    "purpose": "Modèle d'organisation de cagnottes d'épargne dédiées (sinking funds) pour provisionner chaque mois vos dépenses annuelles ou exceptionnelles prévisibles et préserver votre trésorerie courante.",
    "overview": "La plupart des déséquilibres budgétaires ne proviennent pas de dépenses imprévisibles, mais de dépenses parfaitement prévisibles dont on néglige la planification ! La taxe foncière annuelle, la prime d'assurance automobile, les révisions mécaniques, les cadeaux de Noël ou les vacances d'été ne sont pas des urgences : ce sont des certitudes calendaires. La méthode des fonds dédiés (Sinking Funds) consiste à diviser le coût total de chaque événement futur par le nombre de mois qui vous en sépare, puis à épargner cette quote-part mensuelle. Le jour où la facture arrive, vous la réglez l'esprit totalement tranquille.",
    "howToUse": [
      "Listez l'ensemble de vos dépenses prévisibles des 12 prochains mois (primes d'assurance, entretien auto, Noël, vacances, impôts).",
      "Indiquez le montant total estimé pour chaque objectif et la date d'échéance à laquelle les fonds devront être disponibles.",
      "Saisissez la somme dont vous disposez déjà éventuellement pour chaque cagnotte dans la case Épargne Initiale.",
      "Le tableur calcule instantanément la mensualité exacte à virer sur chaque sous-compte ou enveloppe d'épargne.",
      "Lors de l'échéance, réglez la facture avec les fonds provisionnés sans toucher à votre salaire du mois ni à votre fonds d'urgence."
    ],
    "whoBenefits": [
      "Propriétaires immobiliers ayant à anticiper les taxes locales, appels de charges de copropriété ou travaux d'entretien.",
      "Automobilistes voulant en finir avec l'angoisse de la facture imprévue lors du contrôle technique annuel.",
      "Familles préparant les vacances ou les fêtes de fin d'année sans recourir aux facilités de paiement ou crédits conso.",
      "Toute personne souhaitant stabiliser ses dépenses mensuelles en lissant les gros chocs de factures sur l'année."
    ],
    "faq": [
      {
        "question": "Quelle est la différence entre un fonds d'urgence et un sinking fund (épargne ciblée) ?",
        "answer": "Le fonds d'urgence est réservé aux imprévus absolus et soudains (accident, perte d'emploi). Le sinking fund sert à provisionner des dépenses connues et inévitables dont la date et le montant sont anticipés à l'avance."
      },
      {
        "question": "Combien de cagnottes d'épargne ciblée est-il conseillé de créer ?",
        "answer": "Pour débuter efficacement sans s'éparpiller, concentrez-vous sur 3 à 5 postes majeurs : entretien automobile, dépenses de fin d'année/vacances, assurances/taxes annuelles, et santé/vétérinaire."
      },
      {
        "question": "Faut-il ouvrir un compte bancaire distinct pour chaque cagnotte ?",
        "answer": "Non, ce n'est pas obligatoire. Vous pouvez conserver l'argent sur un unique livret d'épargne rémunéré et utiliser ce tableur Excel pour suivre la répartition virtuelle de chaque euro par objectif."
      },
      {
        "question": "Que faire si une dépense arrive plus tôt que prévu ?",
        "answer": "Si une révision auto intervient au bout de 6 mois au lieu de 12, utilisez la somme déjà provisionnée dans la cagnotte : vous n'aurez qu'à combler la différence résiduelle plutôt que de financer la facture totale."
      },
      {
        "question": "Le modèle recalcule-t-il les mensualités si je modifie une date cible ?",
        "answer": "Oui, les formules recalculent automatiquement le nombre de mois restants et le nouvel effort d'épargne mensuel nécessaire chaque fois que vous modifiez un montant ou une échéance."
      }
    ]
  },
  {
    "id": "net-worth-tracker",
    "slug": "net-worth-tracker",
    "title": "Modèle Suivi du Patrimoine Net Excel Gratuit | Free Expense Tracker",
    "metaDescription": "Mesurez l'évolution de votre patrimoine net (actifs moins passifs) avec notre modèle Excel gratuit. Suivez votre trajectoire d'enrichissement personnel.",
    "h1": "Modèle de Suivi du Patrimoine Net Gratuit (.xlsx)",
    "category": "Audits & Suivi",
    "categoryIcon": "💎",
    "fileName": "13_US_Net_Worth_Tracker.xlsx",
    "fileSize": "7.5 Ko",
    "sheetNames": [
      "Patrimoine Net",
      "Historique Mensuel"
    ],
    "keyFormulas": [
      "Patrimoine Net Total = Total des Actifs Réels - Total des Dettes & Passifs",
      "Actifs = Liquidités + Placements Financiers + Immobilier + Biens Matériels",
      "Variation Mensuelle = Valeur_Mois_En_Cours - Valeur_Mois_Précédent"
    ],
    "purpose": "Feuille de calcul patrimoniale consolidée pour récapituler l'ensemble de vos actifs et passifs, mesurer votre valeur nette réelle et visualiser l'évolution de votre enrichissement dans le temps.",
    "overview": "Le revenu est ce que vous gagnez, mais le patrimoine net est ce que vous conservez ! Gagner un salaire élevé ne garantit pas la sécurité financière si chaque euro gagné est absorbé par des dettes ou des dépenses éphémères. Le patrimoine net — calculé en soustrayant le total de vos dettes du total de vos possessions — est le baromètre absolu et ultime de votre progression financière. En actualisant ce modèle chaque trimestre ou chaque mois, vous observez concrètement la montée en puissance de vos investissements et l'érosion de vos emprunts, transformant vos efforts quotidiens en patrimoine durable.",
    "howToUse": [
      "Renseignez vos actifs liquides : comptes courants, livrets d'épargne réglementés et fonds de précaution.",
      "Ajoutez vos placements financiers à long terme : valorisation de vos actions, PEA, assurance-vie, PER, crypto ou comptes d'investissement.",
      "Inscrivez vos actifs tangibles : estimation prudente de votre résidence principale, biens locatifs et véhicules.",
      "Listez exhaustivement vos passifs : capital restant dû de votre crédit immobilier, prêts auto, crédits conso et dettes diverses.",
      "Consultez votre patrimoine net instantané et consignez-le dans l'onglet Historique pour admirer votre courbe d'évolution."
    ],
    "whoBenefits": [
      "Toute personne souhaitant avoir une vision panoramique et consolidée de sa situation financière en un seul coup d'œil.",
      "Épargnants en phase de désendettement voulant voir leur valeur nette grimper au fur et à mesure des remboursements.",
      "Investisseurs suivant la croissance de leurs portefeuilles d'actifs et leur allocation patrimoniale.",
      "Futurs retraités évaluant leur niveau d'autonomie financière et de transmission successorale."
    ],
    "faq": [
      {
        "question": "Comment calcule-t-on le patrimoine net d'un individu ou d'un ménage ?",
        "answer": "Le patrimoine net est la différence mathématique simple entre ce que vous possédez (vos actifs : comptes, immobilier, placements) et ce que vous devez (vos passifs : emprunts immobiliers, crédits, découverts)."
      },
      {
        "question": "À quelle fréquence est-il recommandé d'actualiser son patrimoine net ?",
        "answer": "Une actualisation mensuelle ou trimestrielle est idéale. Actualiser trop souvent peut générer de l'anxiété inutile face aux fluctuations court terme des marchés financiers."
      },
      {
        "question": "Faut-il inclure les véhicules personnels dans le calcul de ses actifs ?",
        "answer": "Oui, mais en appliquant une valeur de revente d'occasion réaliste (cote Argus) et non le prix d'achat, car une voiture perd de la valeur chaque année."
      },
      {
        "question": "Mon patrimoine net est négatif, est-ce dramatique ?",
        "answer": "C'est une situation très fréquente chez les jeunes diplômés qui remboursent un prêt étudiant ou chez les récents acquéreurs immobiliers qui viennent de financer les frais de notaire. L'important est que la tendance mensuelle soit positive et en constante hausse."
      },
      {
        "question": "La valeur de ma résidence principale doit-elle inclure le crédit ?",
        "answer": "Vous inscrivez la valeur marchande totale du bien dans la colonne Actifs, et le capital restant dû du prêt dans la colonne Passifs : la différence représentera la valeur nette de votre équité immobilière réelle."
      }
    ]
  },
  {
    "id": "financial-dashboard",
    "slug": "financial-dashboard",
    "title": "Tableau de Bord Financier Personnel Excel Gratuit | Free Expense Tracker",
    "metaDescription": "Centralisez budget, trésorerie mensuelle, taux d'épargne et dettes dans un tableau de bord Excel interactif gratuit et 100% privé.",
    "h1": "Tableau de Bord Financier Personnel Gratuit (.xlsx)",
    "category": "Audits & Suivi",
    "categoryIcon": "📊",
    "fileName": "14_US_Financial_Dashboard.xlsx",
    "fileSize": "7.5 Ko",
    "sheetNames": [
      "Dashboard",
      "Données Annuelles"
    ],
    "keyFormulas": [
      "Cash-Flow Net Mensuel = Total des Revenus - Total des Dépenses Réalisées",
      "Taux d'Épargne Consolidé = (Total_Épargné ÷ Total_Revenus) × 100",
      "Ratio Dépenses Fixes = (Charges_Incompressibles ÷ Revenus_Totaux) × 100"
    ],
    "purpose": "Poste de commandement financier complet réunissant vos indicateurs clés de performance : cash-flow mensuel, taux d'épargne, structure des dépenses et décrue des dettes dans une interface visuelle épurée.",
    "overview": "Prendre les bonnes décisions financières exige d'avoir accès à des indicateurs clairs et synthétiques plutôt que de se perdre dans des centaines de lignes de relevés bancaires. Le tableau de bord financier personnel agit comme le tableau de bord de votre voiture : il met en lumière vos signaux vitaux sans surcharge cognitive. D'un seul coup d'œil, vous surveillez votre taux d'épargne mensuel, l'évolution de vos dépenses par grand pôle (50/30/20), votre trésorerie nette et la réduction de votre endettement. C'est l'outil d'arbitrage parfait pour piloter son budget en toute sérénité.",
    "howToUse": [
      "Saisissez les totaux mensuels de vos rentrées financières et de vos dépenses réparties par catégorie principale.",
      "Visualisez instantanément la répartition de votre budget selon la règle éprouvée 50/30/20 (Besoins, Envies, Épargne).",
      "Observez votre taux d'épargne effectif recalculé dynamiquement chaque mois pour mesurer votre discipline.",
      "Suivez la courbe de votre cash-flow net pour vous assurer que vos flux demeurent structurellement positifs.",
      "Utilisez les graphiques intégrés pour identifier les dérives saisonnières et planifier vos objectifs de l'année suivante."
    ],
    "whoBenefits": [
      "Gestionnaires de budget expérimentés recherchant une vue de synthèse élégante sans formules compliquées.",
      "Couples souhaitant faire un point financier mensuel clair et apaisé sans éplucher chaque ticket de caisse.",
      "Indépendants et freelances ayant besoin de mesurer la saisonnalité de leur trésorerie nette.",
      "Toute personne souhaitant substituer aux applications mobiles payantes un classeur Excel pérenne et confidentiel."
    ],
    "faq": [
      {
        "question": "Quels sont les indicateurs clés les plus importants à surveiller sur ce tableau de bord ?",
        "answer": "Les trois indicateurs primordiaux sont : le cash-flow net (qui doit être positif), le taux d'épargne (viser 15 % à 25 % des revenus) et le ratio des charges fixes (qui devrait rester inférieur à 50 % de vos rentrées nettes)."
      },
      {
        "question": "Comment est visualisée la règle budgétaire 50/30/20 ?",
        "answer": "Un graphique en anneau compare automatiquement votre répartition réelle aux seuils recommandés : 50 % pour les besoins vitaux, 30 % pour les plaisirs et loisirs, et 20 % pour l'épargne et l'investissement."
      },
      {
        "question": "Dois-je renseigner manuellement chaque transaction dans ce tableau de bord ?",
        "answer": "Non, ce tableau de bord est conçu pour accueillir des totaux mensuels consolidés, ce qui ne demande que 5 minutes de mise à jour à la fin de chaque mois."
      },
      {
        "question": "Les graphiques sont-ils interactifs ?",
        "answer": "Oui, les graphiques Excel intégrés s'ajustent automatiquement au fur et à mesure que vous complétez les données de chaque nouveau mois écoulé."
      },
      {
        "question": "Puis-je l'utiliser sur Google Sheets ?",
        "answer": "Oui, les plages de données et graphiques ont été optimisés pour s'importer avec une fidélité parfaite dans Google Sheets."
      }
    ]
  },
  {
    "id": "monthly-spending-analyzer",
    "slug": "monthly-spending-analyzer",
    "title": "Analyseur Mensuel des Dépenses Excel Gratuit | Free Expense Tracker",
    "metaDescription": "Analysez vos postes de dépenses mensuels par catégorie avec notre tableur Excel gratuit. Détectez les fuites de budget et réduisez vos charges.",
    "h1": "Analyseur Mensuel des Dépenses Gratuit (.xlsx)",
    "category": "Audits & Suivi",
    "categoryIcon": "🔍",
    "fileName": "15_US_Monthly_Spending_Analyzer.xlsx",
    "fileSize": "7.5 Ko",
    "sheetNames": [
      "Analyseur Dépenses",
      "Graphiques de Répartition"
    ],
    "keyFormulas": [
      "Poids Relatif Catégorie (%) = (Dépenses_Catégorie ÷ Total_Dépenses_Mois) × 100",
      "Écart vs Budget Prévu = Dépenses_Réelles - Dépenses_Budgétées",
      "Moyenne Quotidienne = Total_Dépenses_Mois ÷ Nombre_Jours_Mois"
    ],
    "purpose": "Feuille d'analyse granulaire pour disséquer vos sorties d'argent par pôle de consommation, identifier vos postes d'achats impulsifs et optimiser vos arbitrages budgétaires.",
    "overview": "Vous arrive-t-il de constater que votre compte bancaire est à sec le 25 du mois sans réussir à identifier où votre argent s'est envolé ? L'analyseur mensuel des dépenses est le microscope financier dont vous avez besoin. Il ventile vos dépenses par commerçant, pôle de consommation et type de paiement, révélant les petites habitudes quotidiennes apparemment inoffensives (cafés à emporter, déjeuners à l'extérieur, livraisons express) qui siphonnent discrètement votre pouvoir d'achat. En identifiant précisément vos centres de coûts disproportionnés, vous reprenez la main sur vos arbitrages en pleine conscience.",
    "howToUse": [
      "Exportez le fichier CSV ou relevé de votre banque et collez vos transactions du mois dans l'onglet de saisie.",
      "Associez chaque transaction à une catégorie harmonisée : Logement, Épicerie, Restaurants, Loisirs, Shopping, etc.",
      "Consultez la matrice d'analyse catégorielle qui classe instantanément vos postes de dépenses par ordre décroissant de coût.",
      "Comparez vos dépenses réelles à vos prévisions budgétaires initiales pour repérer les catégories en dépassement.",
      "Isolez 2 ou 3 postes d'achats discrétionnaires non essentiels pour fixer des plafonds d'économies dès le mois suivant."
    ],
    "whoBenefits": [
      "Personnes ayant le sentiment de trop dépenser sans réussir à localiser avec exactitude la fuite financière.",
      "Foyers souhaitant réduire leur budget courses et restauration sans sacrifier leur qualité de vie.",
      "Consommateurs voulant faire un bilan précis de leur niveau de vie avant d'entamer un changement de carrière.",
      "Étudiants et jeunes actifs désireux de comprendre la structure réelle de leurs coûts de subsistance."
    ],
    "faq": [
      {
        "question": "Comment cet outil m'aide-t-il à repérer les fuites financières ?",
        "answer": "En calculant le pourcentage exact que chaque catégorie représente par rapport à votre total de dépenses, le tableur met en exergue des anomalies flagrantes (par exemple découvrir que les livraisons de repas représentent 22 % de vos revenus)."
      },
      {
        "question": "Combien de temps faut-il pour analyser son mois de dépenses ?",
        "answer": "Grâce au tri automatique et aux formules de calcul préprogrammées, l'importation et la catégorisation de vos transactions mensuelles ne prennent que 10 à 15 minutes."
      },
      {
        "question": "Puis-je créer mes propres sous-catégories de dépenses ?",
        "answer": "Oui, le fichier est conçu de manière flexible pour vous permettre d'ajouter des catégories personnalisées adaptées à vos loisirs ou contraintes professionnelles spécifiques."
      },
      {
        "question": "Ce modèle permet-il de comparer deux mois consécutifs ?",
        "answer": "Oui, une colonne dédiée aux écarts permet de mesurer si vos efforts de réduction de dépenses portent leurs fruits d'un mois sur l'autre."
      },
      {
        "question": "Mes données d'achats restent-elles privées ?",
        "answer": "Absolument. Contrairement aux applications mobiles bancaires connectées qui analysent vos habitudes pour vous afficher des publicités, ce fichier Excel fonctionne 100 % hors-ligne sur votre ordinateur."
      }
    ]
  },
  {
    "id": "monthly-bill-tracker",
    "slug": "monthly-bill-tracker",
    "title": "Suivi Mensuel des Factures & Échéances Excel | Free Expense Tracker",
    "metaDescription": "Ne manquez plus aucune échéance grâce à notre calendrier de suivi des factures récurrentes gratuit pour Excel et Google Sheets.",
    "h1": "Feuille de Suivi Mensuel des Factures (.xlsx)",
    "category": "Gestion de budget",
    "categoryIcon": "📅",
    "fileName": "16_US_Monthly_Bill_Tracker.xlsx",
    "fileSize": "7.5 Ko",
    "sheetNames": [
      "Suivi Factures",
      "Calendrier Annuel"
    ],
    "keyFormulas": [
      "Total Factures du Mois = SOMME(Plage_Montants_Factures)",
      "Factures Restant à Payer = SOMME.SI(Statut; \"Non Payé\"; Plage_Montants)",
      "Taux de Factures en Prélèvement Auto = NB.SI(Mode; \"Prélèvement\") ÷ NB.TOTAL"
    ],
    "purpose": "Calendrier centralisé de vos obligations financières pour suivre les dates limites de règlement, sécuriser vos prélèvements automatiques et bannir définitivement les pénalités de retard.",
    "overview": "Un oubli de facture peut coûter cher : frais de rejet de prélèvement bancaire, pénalités de retard, coupures de service ou dégradation de votre relation avec votre banquier. Entre le loyer, l'électricité, l'eau, internet, la cantine des enfants et les cotisations d'assurance, mémoriser chaque date d'échéance devient un véritable casse-tête mental. Cette feuille de suivi mensuel des factures centralise toutes vos échéances sur une grille calendrier claire. Vous cochez chaque paiement au fur et à mesure, visualisez les prélèvements à venir et gardez une trésorerie toujours calibrée sur votre compte courant.",
    "howToUse": [
      "Listez l'ensemble de vos factures fixes mensuelles avec le nom du créancier, le montant estimé et le jour d'échéance dans le mois.",
      "Indiquez le mode de règlement utilisé pour chaque poste : Prélèvement automatique SEPA, virement bancaire, carte ou chèque.",
      "Au début de chaque mois, consultez la liste chronologique des échéances pour vous assurer que le compte bancaire est approvisionné.",
      "Cochez la case \"Réglé\" dès qu'un paiement est débité sur votre relevé pour mettre à jour votre tableau de bord.",
      "Surveillez le montant total résiduel restant à honorer avant la fin du cycle mensuel."
    ],
    "whoBenefits": [
      "Personnes ayant subi des frais d'incident ou de rejet bancaire suite à un oubli de date de prélèvement.",
      "Familles gérant de multiples prestataires de services scolaires, sportifs et domestiques.",
      "Colocataires et couples partageant la gestion des charges courantes du logement.",
      "Toute personne cherchant à alléger sa charge mentale en organisant ses obligations financières."
    ],
    "faq": [
      {
        "question": "Pourquoi utiliser un suivi de factures si tous mes prélèvements sont automatiques ?",
        "answer": "Le prélèvement automatique évite d'oublier de payer, mais il expose à des frais de rejet très coûteux si le solde de votre compte est insuffisant le jour du prélèvement. Ce suivi vous permet de vous assurer que le solde disponible couvre toujours les prélèvements à venir."
      },
      {
        "question": "Comment gérer les factures dont le montant fluctue (comme l'eau ou l'énergie) ?",
        "answer": "Inscrivez une moyenne haute provisoire, puis ajustez le montant exact dès réception de l'avis d'échéance ou de la facture réelle."
      },
      {
        "question": "Le fichier gère-t-il les factures trimestrielles ou annuelles ?",
        "answer": "Oui, une colonne Fréquence vous permet d'identifier les paiements bimensuels, trimestriels ou annuels pour les faire ressortir aux mois concernés."
      },
      {
        "question": "Puis-je l'imprimer pour l'accrocher sur mon réfrigérateur ?",
        "answer": "Absolument. La mise en page du classeur est calibrée au format standard A4 / US Letter pour une impression nette et pratique à cocher au stylo."
      },
      {
        "question": "Combien de temps faut-il pour configurer cet échéancier ?",
        "answer": "Une quinzaine de minutes suffit pour saisir l'ensemble de vos créanciers habituels. Ensuite, la consultation ne demande qu'une minute par semaine."
      }
    ]
  },
  {
    "id": "52-week-savings-challenge",
    "slug": "52-week-savings-challenge",
    "title": "Défi Épargne 52 Semaines Gratuit (Excel & PDF) | Free Expense Tracker",
    "metaDescription": "Téléchargez le modèle gratuit défi épargne 52 semaines pour Excel et PDF imprimable. Épargnez 1 378 € en un an avec progression automatisée.",
    "h1": "Défi Épargne 52 Semaines Gratuit (1 378 €) (.xlsx)",
    "category": "Épargne",
    "categoryIcon": "🎯",
    "fileName": "17_US_52_Week_Savings_Challenge.xlsx",
    "fileSize": "12.5 Ko",
    "sheetNames": [
      "Défi 52 Semaines",
      "Version Inversée",
      "Planning Bihebdomadaire"
    ],
    "keyFormulas": [
      "Versement Semaine N = N € (Semaine 1 = 1 €, Semaine 52 = 52 €)",
      "Total Cumulé = (Nombre_Semaines × (Nombre_Semaines + 1)) ÷ 2 = (52 × 53) ÷ 2 = 1 378 €",
      "Cumul Réalisé = SOMME.SI(Cases_Cochées; VRAI; Montants_Épargne)"
    ],
    "purpose": "Le jeu d'épargne progressif le plus populaire au monde, conçu pour développer une habitude financière d'une régularité sans faille et accumuler 1 378 € en 52 semaines sans effort brutal.",
    "overview": "Le Défi Épargne 52 Semaines a transformé les finances de millions de personnes à travers le monde. Son principe est d'une simplicité géniale : en semaine 1, vous mettez de côté 1 € ; en semaine 2, vous mettez 2 € ; en semaine 3, 3 €... et ainsi de suite jusqu'à la semaine 52 où vous déposez 52 €. Grâce à ce démarrage en douceur, vous ancrez une routine d'épargne sans jamais ressentir de privation brutale. Au bout d'une année complète, vous avez accumulé très exactement 1 378 € ! Ce tableur Excel complet inclut le calendrier classique, la version inversée (pour les personnes préférant commencer fort) et le format bihebdomadaire adapté aux rythmes de paie.",
    "howToUse": [
      "Téléchargez le classeur Excel (.xlsx) ou la version PDF prête à imprimer sur une page.",
      "Choisissez votre variante : Défi classique (1 € à 52 €) ou Défi Inversé (52 € à 1 €).",
      "Chaque semaine (par exemple le lundi), transférez le montant indiqué vers votre livret d'épargne ou glissez-le dans une boîte.",
      "Cochez la case correspondante dans le fichier Excel ou coloriez la case sur votre feuille imprimée.",
      "Admirez la montée exponentielle de votre trésorerie et célébrez votre cagnotte de 1 378 € à la fin de l'année !"
    ],
    "whoBenefits": [
      "Débutants absolus en épargne voulant prouver qu'ils sont capables de tenir une routine sur 365 jours.",
      "Personnes souhaitant constituer un premier fonds de secours de plus de 1 300 € sans impacter leur train de vie.",
      "Parents voulant initier leurs adolescents et enfants aux mécanismes de l'épargne progressive de façon ludique.",
      "Épargnants préparant un budget vacances d'été ou un budget de cadeaux de Noël sans stress."
    ],
    "faq": [
      {
        "question": "Comment fonctionne le calcul mathématique du défi 52 semaines ?",
        "answer": "Le calcul repose sur la somme des 52 premiers entiers naturels (suite arithmétique de formule n(n+1)/2). Pour n = 52, le calcul (52 × 53) ÷ 2 donne très exactement 1 378 €."
      },
      {
        "question": "Qu'est-ce que la variante inversée et pourquoi est-elle populaire ?",
        "answer": "La version inversée commence à 52 € en semaine 1 et diminue d'un euro chaque semaine pour finir à 1 € en semaine 52. Elle est très appréciée car elle profite de la motivation maximale de janvier et allège l'effort en décembre pendant les fêtes."
      },
      {
        "question": "Puis-je adapter ce défi avec des montants doublés (2 756 €) ?",
        "answer": "Oui, vous pouvez multiplier les montants par deux (2 € en semaine 1, 4 € en semaine 2...) pour accumuler exactement 2 756 € en un an."
      },
      {
        "question": "Une fiche PDF imprimable est-elle disponible ?",
        "answer": "Oui, une fiche calendrier au format PDF avec cases à cocher illustrées est téléchargeable gratuitement pour ceux qui aiment cocher physiquement leurs progrès au stylo."
      },
      {
        "question": "Que faire si j'ai manqué une semaine de versement ?",
        "answer": "Ne renoncez surtout pas ! Vous pouvez rattraper la semaine manquée lors de la quinzaine suivante ou cocher une petite semaine à 5 € ou 10 € pour garder votre dynamique."
      }
    ]
  },
  {
    "id": "5000-savings-challenge",
    "slug": "5000-savings-challenge",
    "title": "Modèle Défi Épargne 5 000 $ Gratuit (Excel & PDF) | Free Expense Tracker",
    "metaDescription": "Téléchargez notre feuille Excel gratuite du défi épargne 5 000 $ sur 52 semaines. Calendrier progressif, cases à cocher et cumul automatisé.",
    "h1": "Défi Épargne 5 000 $ Gratuit sur 52 Semaines (.xlsx)",
    "category": "Épargne",
    "categoryIcon": "🎯",
    "fileName": "18_US_5000_Savings_Challenge.xlsx",
    "fileSize": "12.2 Ko",
    "sheetNames": [
      "Défi 5000",
      "Version Inversée",
      "Suivi Mensuel"
    ],
    "keyFormulas": [
      "Progression Hebdomadaire = Versement de 20 $ (Semaine 1) à 173 $ (Semaine 52) avec palier de +3 $ par semaine",
      "Cumul Total = SOMME(Versements_Semaine_1_à_52) = Exactement 5 000 $",
      "Avancement Global = SOMME.SI(Validation; VRAI; Montants) ÷ 5000"
    ],
    "purpose": "Calendrier d'épargne structuré et progressif sur 52 semaines conçu pour accumuler un fonds de sécurité robuste de 5 000 $ en une année avec cases à cocher et suivi dynamique.",
    "overview": "Atteindre un palier de 5 000 $ d'épargne liquide change profondément votre sérénité au quotidien. Ce montant représente pour la grande majorité des ménages un véritable fonds de sécurité complet capable d'absorber n'importe quel coup dur de la vie sans jamais emprunter un centime. Le Défi Épargne 5 000 $ structure cet objectif ambitieux sous forme d'une progression hebdomadaire douce : en démarrant à seulement 20 $ en première semaine et en augmentant de 3 $ chaque semaine (23 $, 26 $, 29 $...), l'effort reste parfaitement digeste et proportionné tout au long de l'année. Ce classeur Excel complet inclut les versions classique et inversée ainsi qu'une fiche PDF imprimable prête à l'emploi.",
    "howToUse": [
      "Téléchargez la feuille de calcul Excel (.xlsx) ou la fiche récapitulative PDF prête pour l'impression.",
      "Sélectionnez votre modalité : la progression classique (20 $ vers 173 $) ou la formule inversée (173 $ vers 20 $).",
      "Chaque semaine, transférez le montant programmé sur votre compte d'épargne ou livret de réserve.",
      "Cochez la case de validation sur le classeur ou coloriez la case sur votre feuille imprimée au mur.",
      "Suivez les 4 trimestres d'étapes (494 $ au T1, 1 495 $ au T2, 3 003 $ au T3, 5 000 $ au T4) pour garder une motivation d'acier."
    ],
    "whoBenefits": [
      "Personnes souhaitant bâtir un fonds d'urgence de premier ordre de 5 000 $ en 12 mois.",
      "Épargnants ayant déjà réussi le défi classique des 1 378 $ et voulant relever un défi de niveau supérieur.",
      "Futurs mariés, voyageurs ou acheteurs préparant un apport personnel significatif sans crédit.",
      "Foyers désirant une feuille de route visuelle et gratifiante pour discipliner leurs finances."
    ],
    "faq": [
      {
        "question": "Comment les montants hebdomadaires de 20 $ à 173 $ sont-ils calculés ?",
        "answer": "Le défi commence à 20 $ en semaine 1 et progresse de 3 $ chaque semaine (23 $, 26 $, etc.) jusqu'à 173 $ en semaine 52. La somme arithmétique exacte des 52 semaines donne très exactement 5 000 $."
      },
      {
        "question": "Pourquoi choisir le défi 5 000 $ plutôt que le défi classique 52 semaines ?",
        "answer": "Le défi classique permet d'épargner 1 378 €, ce qui constitue une excellente mise en jambe. Le défi 5 000 $ s'adresse à ceux qui ont une capacité d'épargne un peu plus élevée et visent un matelas de sécurité plus substantiel."
      },
      {
        "question": "Que faire durant les semaines de fin d'année où le montant approche les 170 $ ?",
        "answer": "Si vous anticipez des dépenses lourdes en décembre, optez pour la Version Inversée disponible dans le classeur : vous commencerez à 173 $ en janvier pour terminer à seulement 20 $ en décembre pendant les fêtes."
      },
      {
        "question": "Puis-je adapter ce modèle en euros (€) ou autre devise ?",
        "answer": "Oui, le symbole monétaire et les montants peuvent être convertis en euros sans aucune modification de formule : vous épargnerez 5 000 € selon le même calendrier."
      },
      {
        "question": "Une version papier à cocher est-elle incluse ?",
        "answer": "Oui, une fiche PDF imprimable sur une page A4 / Letter haute définition avec cases à cocher est téléchargeable gratuitement en un clic."
      }
    ]
  },
  {
    "id": "10000-savings-challenge",
    "slug": "10000-savings-challenge",
    "title": "Modèle Défi Épargne 10 000 $ Gratuit (Excel & PDF) | Free Expense Tracker",
    "metaDescription": "Atteignez 10 000 $ d'épargne en 52 semaines grâce à notre modèle Excel gratuit et PDF imprimable. Feuille de route progressive sans inscription.",
    "h1": "Défi Épargne 10 000 $ Gratuit sur 52 Semaines (.xlsx)",
    "category": "Épargne",
    "categoryIcon": "🏆",
    "fileName": "19_US_10000_Savings_Challenge.xlsx",
    "fileSize": "12.2 Ko",
    "sheetNames": [
      "Défi 10000",
      "Version Inversée",
      "Paliers Trimestriels"
    ],
    "keyFormulas": [
      "Progression Hebdomadaire = Versement de 25 $ (Semaine 1) à 359 $ (Semaine 52)",
      "Total Annuel Cumulé = SOMME(Semaine_1_à_52) = Exactement 10 000 $",
      "Palier Trimestriel = SOMME(Semaines_du_Trimestre) pour valider chaque quart d'année"
    ],
    "purpose": "Le défi d'épargne reine pour franchir le cap symbolique et transformateur des cinq chiffres d'épargne liquide (10 000 $) en une année grâce à un plan d'action millimétré.",
    "overview": "Détenir 10 000 $ d'épargne disponible est un tournant décisif dans une vie financière : ce capital vous confère un pouvoir d'action inédit, une sérénité totale face aux imprévus et la possibilité de saisir de réelles opportunités d'investissement. Le Défi Épargne 10 000 $ décompose cet objectif impressionnant en paliers hebdomadaires concrets. Débutant à 25 $ en semaine 1 pour monter progressivement jusqu'à 359 $ en semaine 52, le calendrier vous pousse à optimiser continuellement vos dépenses et à dénicher de nouvelles rentrées d'argent tout au long de l'année pour franchir la ligne d'arrivée avec 10 000 $ nets sur votre compte.",
    "howToUse": [
      "Téléchargez la feuille Excel (.xlsx) ou la fiche PDF d'objectifs prête à imprimer.",
      "Configurez un virement bancaire automatique hebdomadaire vers votre livret de réserve le jour de votre choix.",
      "Passez en revue vos dépenses chaque trimestre pour trouver les marges nécessaires lors de la montée en puissance des montants.",
      "Validez chaque semaine dans le tableur en observant la jauge de progression s'approcher des 10 000 $.",
      "Célébrez le franchissement des grands jalons : 2 500 $ (Semaine 22), 5 000 $ (Semaine 36), 7 500 $ (Semaine 45) et 10 000 $ (Semaine 52)."
    ],
    "whoBenefits": [
      "Épargnants ambitieux voulant accumuler une réserve de trésorerie à cinq chiffres en un an.",
      "Investisseurs préparant un apport substantiel pour une acquisition immobilière ou la création d'une entreprise.",
      "Foyers disposant d'un bon niveau de revenus mais manquant de discipline pour capitaliser leur surplus.",
      "Personnes ayant réussi le défi 5 000 $ et désireuses de doubler leur performance financière."
    ],
    "faq": [
      {
        "question": "Comment les versements du défi 10 000 $ sont-ils échelonnés ?",
        "answer": "Le calendrier démarre à 25 $ en semaine 1 et augmente progressivement d'environ 6,55 $ par semaine jusqu'à 359 $ en semaine 52. La somme cumulée de l'année donne rigoureusement 10 000 $."
      },
      {
        "question": "Comment tenir le rythme lorsque les versements dépassent 250 $ par semaine ?",
        "answer": "Durant le second semestre, vous pouvez combiner réduction drastique de dépenses superflues, vente d'objets inutilisés, missions ponctuelles de freelance ou allocation de primes professionnelles."
      },
      {
        "question": "Existe-t-il une version inversée pour alléger la fin d'année ?",
        "answer": "Oui, le classeur comprend un onglet Version Inversée qui commence à 359 $ en janvier pour descendre à 25 $ en décembre, idéal si vous recevez un bonus en début d'année."
      },
      {
        "question": "Puis-je adapter ce défi sur 26 versements bihebdomadaires ?",
        "answer": "Oui, vous pouvez coupler ce défi avec notre modèle de défi bihebdomadaire en doublant les montants par période de paie."
      },
      {
        "question": "Le fichier est-il totalement gratuit et sans publicité ?",
        "answer": "Absolument. Comme tous les outils de Free Expense Tracker, ce classeur est 100 % gratuit, sans inscription, sans publicité et fonctionne en toute confidentialité."
      }
    ]
  },
  {
    "id": "biweekly-savings-challenge",
    "slug": "biweekly-savings-challenge",
    "title": "Défi Épargne Bihebdomadaire Gratuit (26 Paies) | Free Expense Tracker",
    "metaDescription": "Synchronisez votre épargne avec vos 26 versements de paie annuels pour accumuler 5 000 $. Modèle Excel gratuit avec suivi progressif.",
    "h1": "Défi Épargne Bihebdomadaire Gratuit (26 Périodes) (.xlsx)",
    "category": "Épargne",
    "categoryIcon": "📅",
    "fileName": "20_US_Biweekly_Savings_Challenge.xlsx",
    "fileSize": "12.2 Ko",
    "sheetNames": [
      "Défi Bihebdomadaire",
      "Version Inversée",
      "Planning 26 Paies"
    ],
    "keyFormulas": [
      "Progression par Paie = Versement de 50 $ (Paie 1) à 338 $ (Paie 26)",
      "Total Cumulé 26 Paies = SOMME(Paie_1_à_26) = Exactement 5 000 $",
      "Moyenne par Période = 5 000 $ ÷ 26 = 192,31 $ par paie"
    ],
    "purpose": "Feuille de route d'épargne calquée sur 26 cycles de paie bihebdomadaires permettant d'économiser 5 000 $ en parfaite harmonie avec la date de versement de votre salaire.",
    "overview": "Pour les salariés rémunérés toutes les deux semaines (soit 26 paies par an), suivre un calendrier d'épargne hebdomadaire classique peut s'avérer contraignant car il oblige à virer des fonds des semaines où aucune rentrée d'argent n'a lieu. Le Défi Épargne Bihebdomadaire résout ce problème d'adéquation de trésorerie : il fait coïncider très exactement chaque dépôt d'épargne avec le jour de réception de votre paie. En débutant à 50 $ lors de la première paie pour progresser régulièrement jusqu'à 338 $ lors de la 26e paie, vous accumulez exactement 5 000 $ sur l'année sans jamais risquer de découvert bancaire.",
    "howToUse": [
      "Téléchargez la feuille de calcul Excel (.xlsx) ou la version imprimable PDF.",
      "Faites correspondre les 26 dates de versements avec le calendrier officiel de paie de votre employeur.",
      "Programmez un virement automatique le lendemain de chaque jour de paie pour le montant indiqué.",
      "Cochez la case de validation dans le tableur au fur et à mesure que les virements sont exécutés.",
      "Admirez la croissance de votre compte d'épargne atteignant 5 000 $ au terme des 26 cycles de paie."
    ],
    "whoBenefits": [
      "Salariés payés toutes les deux semaines (26 cycles annuels) souhaitant automatiser leur épargne dès réception du virement.",
      "Personnes ayant du mal à épargner les semaines où aucun salaire n'est crédité sur leur compte bancaire.",
      "Ménages voulant constituer un fonds de sécurité de 5 000 $ en phase avec leur rythme professionnel.",
      "Adeptes de la méthode « Pay Yourself First » (Payez-vous en premier) qui sanctuarisent leur épargne le jour de paie."
    ],
    "faq": [
      {
        "question": "Pourquoi un calendrier sur 26 périodes plutôt que 52 semaines ou 12 mois ?",
        "answer": "Un calendrier sur 26 périodes s'adapte précisément à la réalité des personnes rémunérées toutes les deux semaines. Épargner le jour où l'argent arrive est le moyen le plus sûr de ne pas le dépenser ailleurs."
      },
      {
        "question": "Comment les montants progressent-ils au fil des 26 paies ?",
        "answer": "Le défi commence à 50 $ à la paie 1 et augmente d'environ 11,52 $ par versement pour atteindre 338 $ à la 26e paie, aboutissant à un cumul exact de 5 000 $."
      },
      {
        "question": "Puis-je adapter ce défi pour atteindre 10 000 $ ?",
        "answer": "Oui, vous pouvez simplement multiplier chaque montant par deux pour épargner 10 000 $ sur vos 26 paies de l'année."
      },
      {
        "question": "Que faire durant les deux mois de l'année qui comptent 3 paies ?",
        "answer": "Les deux paies « magiques » supplémentaires de l'année représentent une opportunité formidable : vous pouvez en profiter pour prendre de l'avance sur votre défi ou alimenter un autre projet d'épargne."
      },
      {
        "question": "Existe-t-il une version inversée dans le classeur ?",
        "answer": "Oui, l'onglet Version Inversée démarre à 338 $ sur la première paie et diminue jusqu'à 50 $ sur la 26e paie pour ceux qui préfèrent démarrer avec un effort soutenu."
      }
    ]
  }
];
