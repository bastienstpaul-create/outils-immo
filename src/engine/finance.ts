// Moteur financier déterministe. Aucune dépendance, aucune I/O : entrées → chiffres.
// C'est le seul endroit où l'arithmétique financière est faite.

import type { Params } from '../state/params.ts'
import type { Property } from '../state/property.ts'

export type ScenarioKey = 'nu' | 'meuble' | 'lots2' | 'lots3'

export type ScenarioDef = {
  key: ScenarioKey
  label: string
  meuble: boolean
  nbLots: number // 1 pour l'état, 2 ou 3 pour la division
}

export const SCENARIOS: ScenarioDef[] = [
  { key: 'nu', label: "En l'état — nu", meuble: false, nbLots: 1 },
  { key: 'meuble', label: "En l'état — meublé", meuble: true, nbLots: 1 },
  { key: 'lots2', label: '2 lots (meublé)', meuble: true, nbLots: 2 },
  { key: 'lots3', label: '3 lots (meublé)', meuble: true, nbLots: 3 },
]

// Surface minimale légale d'un logement créé (art. L111-6-1 CCH).
export const SURFACE_MINI_LEGALE = 14 // m²

export type ScenarioResult = {
  def: ScenarioDef
  lots: number[] // surfaces des lots créés (m²)
  lotIllegal: boolean // au moins un lot < 14 m² → scénario illégal, jamais retenu

  coutTotal: number
  loyerMensuel: number // loyer théorique brut (avant vacance)
  rdtBrut: number // %
  mensualite: number // crédit + assurance, €/mois
  cfAvantImpot: number // €/mois
  cfApresIS: number // €/mois

  // Détail fiscal (année 1), pour transparence dans l'UI
  resultatFiscal: number // €/an
  is: number // €/an
  amortissements: number // €/an
  interetsAn1: number // €/an
}

// Mensualité d'un crédit amortissable classique.
export function mensualiteCredit(capital: number, tauxAnnuelPct: number, dureeAnnees: number): number {
  const i = tauxAnnuelPct / 100 / 12
  const n = dureeAnnees * 12
  if (n <= 0) return 0
  if (i === 0) return capital / n
  return (capital * i) / (1 - Math.pow(1 + i, -n))
}

// Intérêts payés année par année sur toute la durée du prêt (l'index 0 = année 1).
// Le capital remboursé monte chaque année → les intérêts déductibles baissent :
// c'est la première moitié de l'« effet ciseau ».
export function interetsParAnnee(capital: number, tauxAnnuelPct: number, dureeAnnees: number): number[] {
  const i = tauxAnnuelPct / 100 / 12
  const n = dureeAnnees * 12
  if (n <= 0) return []
  const pay = mensualiteCredit(capital, tauxAnnuelPct, dureeAnnees)
  let solde = capital
  const annuel: number[] = []
  for (let annee = 0; annee < dureeAnnees; annee++) {
    let interets = 0
    for (let m = 0; m < 12; m++) {
      if (annee * 12 + m >= n) break
      const interetMois = solde * i
      interets += interetMois
      solde -= pay - interetMois
    }
    annuel.push(interets)
  }
  return annuel
}

// Somme des intérêts payés sur les 12 premiers mois (année fiscale 1).
export function interetsPremiereAnnee(capital: number, tauxAnnuelPct: number, dureeAnnees: number): number {
  return interetsParAnnee(capital, tauxAnnuelPct, dureeAnnees)[0] ?? 0
}

// IS d'une SCI à l'IS : 15 % jusqu'à 42 500 € de bénéfice, 25 % au-delà. Base ≤ 0 → 0.
export function calculerIS(baseImposable: number): number {
  if (baseImposable <= 0) return 0
  return 0.15 * Math.min(baseImposable, 42500) + 0.25 * Math.max(0, baseImposable - 42500)
}

// Répartit la surface habitable en `nbLots` lots égaux, après perte des cloisons.
export function repartitionLots(surface: number, nbLots: number, pertesCloison: number): number[] {
  if (nbLots <= 1) return [surface]
  const cloisons = nbLots - 1
  const habitable = Math.max(0, surface - cloisons * pertesCloison)
  const parLot = habitable / nbLots
  return Array.from({ length: nbLots }, () => parLot)
}

// Assiette d'un scénario : toutes les grandeurs qui ne dépendent PAS de l'année.
// Partagée par le calcul « année 1 » (computeScenario) et la projection pluriannuelle,
// pour qu'ils ne puissent jamais diverger.
type Assiette = {
  isDivision: boolean
  lots: number[]
  lotIllegal: boolean
  coutTotal: number
  emprunt: number
  loyerMensuel: number
  loyerEncaisseAn: number
  chargesAn: number
  mensualite: number // crédit + assurance, €/mois
  assuranceAn: number // €/an
  // Dotations annuelles d'amortissement, chacune active tant que Y ≤ sa durée.
  amortBatiAn: number
  amortTravauxAn: number
  amortMobilierAn: number
}

function assietteScenario(def: ScenarioDef, prop: Property, p: Params): Assiette {
  const isDivision = def.nbLots > 1
  const lots = repartitionLots(prop.surface, def.nbLots, p.pertesCloison)
  const lotIllegal = isDivision && lots.some((ls) => ls < SURFACE_MINI_LEGALE)

  // --- Coût total (financé à 110 %, sans apport) ---
  const fraisNotaire = (prop.prix * p.fraisNotairePct) / 100
  const fraisBancaires = (prop.prix * p.fraisBancairesPct) / 100
  const decoupe = isDivision ? p.coutDecoupe : 0
  const mobilierTotal = def.meuble ? p.mobilierParLot * def.nbLots : 0
  const coutTotal = prop.prix + fraisNotaire + fraisBancaires + prop.travaux + decoupe + mobilierTotal
  const emprunt = coutTotal

  // --- Loyer brut mensuel théorique ---
  let loyerMensuel: number
  if (isDivision) {
    loyerMensuel = lots.reduce((s, ls) => s + p.loyerMicroLot * ls, 0)
  } else if (def.meuble) {
    loyerMensuel = p.loyerM2Meuble * prop.surface
  } else {
    loyerMensuel = p.loyerM2Nu * prop.surface
  }

  const loyerEncaisseMois = loyerMensuel * (1 - p.tauxVacance / 100)
  const loyerEncaisseAn = loyerEncaisseMois * 12
  const chargesAn = ((loyerEncaisseMois * p.chargesNonRecupPct) / 100) * 12

  // --- Mensualité (crédit + assurance sur capital initial) ---
  const mCredit = mensualiteCredit(emprunt, p.tauxInteret, p.dureeAnnees)
  const mAssurance = (emprunt * p.tauxAssurance) / 100 / 12
  const mensualite = mCredit + mAssurance
  const assuranceAn = mAssurance * 12

  // --- Dotations d'amortissement (linéaires) ---
  const amortBatiAn = p.dureeAmortBati > 0 ? ((prop.prix * p.quotePartAmortissable) / 100) / p.dureeAmortBati : 0
  const amortTravauxAn = p.dureeAmortTravaux > 0 ? (prop.travaux + decoupe) / p.dureeAmortTravaux : 0
  const amortMobilierAn = def.meuble && p.dureeAmortMobilier > 0 ? mobilierTotal / p.dureeAmortMobilier : 0

  return {
    isDivision,
    lots,
    lotIllegal,
    coutTotal,
    emprunt,
    loyerMensuel,
    loyerEncaisseAn,
    chargesAn,
    mensualite,
    assuranceAn,
    amortBatiAn,
    amortTravauxAn,
    amortMobilierAn,
  }
}

export function computeScenario(def: ScenarioDef, prop: Property, p: Params): ScenarioResult {
  const a = assietteScenario(def, prop, p)
  const rdtBrut = a.coutTotal > 0 ? ((a.loyerMensuel * 12) / a.coutTotal) * 100 : 0

  // Étape 2 : cash-flow avant impôt (mensuel).
  const cfAvantImpot = a.loyerEncaisseAn / 12 - a.chargesAn / 12 - prop.taxeFonciere / 12 - a.mensualite

  // Étape 3 : IS de l'année 1 (intérêts max → base fiscale mini → IS mini).
  const interetsAn1 = interetsPremiereAnnee(a.emprunt, p.tauxInteret, p.dureeAnnees)
  const amortissements = a.amortBatiAn + a.amortTravauxAn + a.amortMobilierAn
  const resultatFiscal =
    a.loyerEncaisseAn - a.chargesAn - prop.taxeFonciere - interetsAn1 - a.assuranceAn - amortissements
  const is = calculerIS(resultatFiscal)

  // L'IS ampute la trésorerie ; l'amortissement, lui, n'est pas une sortie de cash.
  const cfApresIS = cfAvantImpot - is / 12

  return {
    def,
    lots: a.lots,
    lotIllegal: a.lotIllegal,
    coutTotal: a.coutTotal,
    loyerMensuel: a.loyerMensuel,
    rdtBrut,
    mensualite: a.mensualite,
    cfAvantImpot,
    cfApresIS,
    resultatFiscal,
    is,
    amortissements,
    interetsAn1,
  }
}

export function computeAllScenarios(prop: Property, p: Params): ScenarioResult[] {
  return SCENARIOS.map((def) => computeScenario(def, prop, p))
}

// --- Projection pluriannuelle (l'« effet ciseau ») ---------------------------
// Hypothèses constantes et assumées : loyers, charges et taxe foncière NON indexés.
// Le seul moteur de la dérive est fiscal : intérêts déductibles qui baissent +
// dotations d'amortissement qui s'éteignent → base imposable et IS qui montent,
// alors que la trésorerie avant impôt, elle, ne bouge pas.

export type ProjectionAnnee = {
  annee: number // 1-indexée
  interets: number // €/an, déductibles cette année
  amortissements: number // €/an, dotations encore actives
  resultatCourant: number // €/an, avant imputation des déficits reportés
  deficitImpute: number // €/an, déficit antérieur imputé cette année
  baseImposable: number // €/an, après imputation
  is: number // €/an
  cfAvantImpot: number // €/an (constant tant que le prêt court)
  cfApresIS: number // €/an
}

export type Projection = {
  def: ScenarioDef
  horizon: number // nb d'années projetées
  annees: ProjectionAnnee[]
  premiereAnneeIS: number | null // 1re année où l'IS devient > 0
  premiereAnneeCfNegatif: number | null // 1re année où le CF après IS passe < 0
  isCumule: number // € cumulés sur l'horizon
  cfApresISCumule: number // € cumulés sur l'horizon
  cfApresISMoisAn1: number // €/mois année 1
  cfApresISMoisFin: number // €/mois dernière année de l'horizon
}

export function projeterScenario(def: ScenarioDef, prop: Property, p: Params, horizon: number): Projection {
  const a = assietteScenario(def, prop, p)
  const interetsAnnuels = interetsParAnnee(a.emprunt, p.tauxInteret, p.dureeAnnees)

  const annees: ProjectionAnnee[] = []
  let stockDeficit = 0 // déficits antérieurs reportables (report illimité en IS)
  let isCumule = 0
  let cfApresISCumule = 0
  let premiereAnneeIS: number | null = null
  let premiereAnneeCfNegatif: number | null = null

  for (let y = 1; y <= horizon; y++) {
    const pretActif = y <= p.dureeAnnees
    const interets = interetsAnnuels[y - 1] ?? 0
    const assuranceAn = pretActif ? a.assuranceAn : 0

    // Dotations : chacune s'éteint une fois sa durée atteinte.
    const amortBati = y <= p.dureeAmortBati ? a.amortBatiAn : 0
    const amortTravaux = y <= p.dureeAmortTravaux ? a.amortTravauxAn : 0
    const amortMobilier = def.meuble && y <= p.dureeAmortMobilier ? a.amortMobilierAn : 0
    const amortissements = amortBati + amortTravaux + amortMobilier

    const resultatCourant =
      a.loyerEncaisseAn - a.chargesAn - prop.taxeFonciere - interets - assuranceAn - amortissements

    // Report des déficits : un exercice déficitaire alimente le stock ;
    // un exercice bénéficiaire l'impute d'abord, puis l'IS porte sur le reliquat.
    let deficitImpute = 0
    let baseImposable = 0
    if (resultatCourant < 0) {
      stockDeficit += -resultatCourant
    } else {
      deficitImpute = Math.min(stockDeficit, resultatCourant)
      stockDeficit -= deficitImpute
      baseImposable = resultatCourant - deficitImpute
    }

    const is = calculerIS(baseImposable)
    const mensualiteAn = pretActif ? a.mensualite * 12 : 0
    const cfAvantImpot = a.loyerEncaisseAn - a.chargesAn - prop.taxeFonciere - mensualiteAn
    const cfApresIS = cfAvantImpot - is

    if (is > 0 && premiereAnneeIS === null) premiereAnneeIS = y
    if (cfApresIS < 0 && premiereAnneeCfNegatif === null) premiereAnneeCfNegatif = y

    isCumule += is
    cfApresISCumule += cfApresIS

    annees.push({
      annee: y,
      interets,
      amortissements,
      resultatCourant,
      deficitImpute,
      baseImposable,
      is,
      cfAvantImpot,
      cfApresIS,
    })
  }

  return {
    def,
    horizon,
    annees,
    premiereAnneeIS,
    premiereAnneeCfNegatif,
    isCumule,
    cfApresISCumule,
    cfApresISMoisAn1: (annees[0]?.cfApresIS ?? 0) / 12,
    cfApresISMoisFin: (annees[annees.length - 1]?.cfApresIS ?? 0) / 12,
  }
}
