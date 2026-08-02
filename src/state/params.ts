// Paramètres de calibration — tous éditables dans l'UI, persistés en localStorage.
// Rien n'est codé en dur ailleurs : le moteur ne lit QUE ces valeurs.

export type Params = {
  // --- Financement (achat SCI à l'IS, sans apport, 110 %) ---
  fraisNotairePct: number // % du prix (ancien ≈ 7,5)
  fraisBancairesPct: number // garantie + dossier, % du prix
  tauxInteret: number // taux nominal annuel du crédit, %
  dureeAnnees: number // durée du prêt, années
  tauxAssurance: number // assurance emprunteur, % annuel du capital

  // --- Loyers (€/m²/mois) ---
  loyerM2Nu: number // location nue, secteur du bien
  loyerM2Meuble: number // location meublée, secteur du bien
  loyerMicroLot: number // micro-lot meublé (mesuré : 32)
  pertesCloison: number // m² perdus par cloison (mesuré : 1,5)
  coutDecoupe: number // € pour créer les lots (cible déjà cloisonné : 0)
  mobilierParLot: number // € de meuble par logement meublé (0 pour ignorer)

  // --- Exploitation ---
  tauxVacance: number // % de vacance locative
  chargesNonRecupPct: number // charges non récup. (gestion, PNO, CFE…), % du loyer encaissé

  // --- Fiscalité IS (SCI à l'IS) ---
  quotePartAmortissable: number // part du prix affectée au bâti amortissable, %
  dureeAmortBati: number // durée d'amortissement du bâti, années
  dureeAmortTravaux: number // durée d'amortissement des travaux, années
  dureeAmortMobilier: number // durée d'amortissement du mobilier, années

  // --- Fiscalité nom propre (IR) ---
  tmi: number // tranche marginale d'imposition, %
  tauxPrelevementsSociaux: number // prélèvements sociaux, % (17,2)
  plafondDeficitFoncier: number // plafond du déficit foncier imputable sur le revenu global, €/an
  seuilMicroFoncier: number // plafond de recettes du micro-foncier, €
  seuilMicroBic: number // plafond de recettes du micro-BIC, €
  abattementMicroFoncier: number // abattement forfaitaire micro-foncier, %
  abattementMicroBic: number // abattement forfaitaire micro-BIC, %

  // --- Seuils de verdict ---
  seuilBanque: number // rendement brut minimal exigé par la banque, %
  seuilCashflow: number // cash-flow avant impôt minimal accepté, €/mois

  // --- Projection ---
  horizonProjection: number // nb d'années projetées pour l'effet ciseau
}

export const DEFAULT_PARAMS: Params = {
  fraisNotairePct: 7.5,
  fraisBancairesPct: 1.0,
  tauxInteret: 3.5,
  dureeAnnees: 20,
  tauxAssurance: 0.3,

  loyerM2Nu: 14,
  loyerM2Meuble: 18,
  loyerMicroLot: 32,
  pertesCloison: 1.5,
  coutDecoupe: 0,
  mobilierParLot: 3000,

  tauxVacance: 5,
  chargesNonRecupPct: 8,

  quotePartAmortissable: 85,
  dureeAmortBati: 30,
  dureeAmortTravaux: 10,
  dureeAmortMobilier: 6,

  tmi: 30,
  tauxPrelevementsSociaux: 17.2,
  plafondDeficitFoncier: 10700,
  seuilMicroFoncier: 15000,
  seuilMicroBic: 77700,
  abattementMicroFoncier: 30,
  abattementMicroBic: 50,

  seuilBanque: 10,
  seuilCashflow: 0,

  horizonProjection: 10,
}

const STORAGE_KEY = 'oai.params.v1'

export function loadParams(): Params {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PARAMS }
    const parsed = JSON.parse(raw) as Partial<Params>
    // Fusion défensive : un nouveau paramètre ajouté au code reprend sa valeur par défaut.
    return { ...DEFAULT_PARAMS, ...parsed }
  } catch {
    return { ...DEFAULT_PARAMS }
  }
}

export function saveParams(p: Params): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // localStorage indisponible (mode privé) : on ignore, l'app reste fonctionnelle.
  }
}

// Métadonnées d'affichage pour construire le panneau de paramètres sans le coder en dur.
export type ParamGroup = {
  title: string
  fields: { key: keyof Params; label: string; unit: string; step?: number }[]
}

export const PARAM_GROUPS: ParamGroup[] = [
  {
    title: 'Financement (110 %, sans apport)',
    fields: [
      { key: 'fraisNotairePct', label: 'Frais de notaire', unit: '% du prix', step: 0.1 },
      { key: 'fraisBancairesPct', label: 'Frais bancaires / garantie', unit: '% du prix', step: 0.1 },
      { key: 'tauxInteret', label: "Taux d'intérêt", unit: '% / an', step: 0.05 },
      { key: 'dureeAnnees', label: 'Durée du prêt', unit: 'ans', step: 1 },
      { key: 'tauxAssurance', label: 'Assurance emprunteur', unit: '% / an', step: 0.05 },
    ],
  },
  {
    title: 'Loyers',
    fields: [
      { key: 'loyerM2Nu', label: 'Loyer nu', unit: '€/m²/mois', step: 0.5 },
      { key: 'loyerM2Meuble', label: 'Loyer meublé', unit: '€/m²/mois', step: 0.5 },
      { key: 'loyerMicroLot', label: 'Loyer micro-lot', unit: '€/m²/mois', step: 0.5 },
      { key: 'pertesCloison', label: 'Perte par cloison', unit: 'm²', step: 0.1 },
      { key: 'coutDecoupe', label: 'Coût de découpe', unit: '€', step: 500 },
      { key: 'mobilierParLot', label: 'Mobilier par logement', unit: '€', step: 250 },
    ],
  },
  {
    title: 'Exploitation',
    fields: [
      { key: 'tauxVacance', label: 'Vacance locative', unit: '%', step: 0.5 },
      { key: 'chargesNonRecupPct', label: 'Charges non récup.', unit: '% du loyer', step: 0.5 },
    ],
  },
  {
    title: "Fiscalité (SCI à l'IS / amortissements)",
    fields: [
      { key: 'quotePartAmortissable', label: 'Quote-part bâti amortissable', unit: '% du prix', step: 1 },
      { key: 'dureeAmortBati', label: 'Amortissement bâti', unit: 'ans', step: 1 },
      { key: 'dureeAmortTravaux', label: 'Amortissement travaux', unit: 'ans', step: 1 },
      { key: 'dureeAmortMobilier', label: 'Amortissement mobilier', unit: 'ans', step: 1 },
    ],
  },
  {
    title: 'Fiscalité (nom propre)',
    fields: [
      { key: 'tmi', label: "Tranche marginale d'imposition", unit: '%', step: 1 },
      { key: 'tauxPrelevementsSociaux', label: 'Prélèvements sociaux', unit: '%', step: 0.1 },
      { key: 'plafondDeficitFoncier', label: 'Plafond déficit foncier', unit: '€/an', step: 100 },
      { key: 'seuilMicroFoncier', label: 'Plafond micro-foncier', unit: '€', step: 500 },
      { key: 'seuilMicroBic', label: 'Plafond micro-BIC', unit: '€', step: 1000 },
      { key: 'abattementMicroFoncier', label: 'Abattement micro-foncier', unit: '%', step: 1 },
      { key: 'abattementMicroBic', label: 'Abattement micro-BIC', unit: '%', step: 1 },
    ],
  },
  {
    title: 'Seuils de verdict',
    fields: [
      { key: 'seuilBanque', label: 'Rendement brut mini (banque)', unit: '%', step: 0.5 },
      { key: 'seuilCashflow', label: 'Cash-flow avant impôt mini', unit: '€/mois', step: 50 },
    ],
  },
  {
    title: 'Projection',
    fields: [{ key: 'horizonProjection', label: 'Horizon de projection', unit: 'ans', step: 1 }],
  },
]
