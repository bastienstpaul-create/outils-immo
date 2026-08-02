// Moteur financier déterministe. Aucune dépendance, aucune I/O : entrées → chiffres.
// C'est le seul endroit où l'arithmétique financière est faite.
//
// Architecture : `assietteScenario` calcule tout ce qui est indépendant de l'année
// (coût, emprunt, loyer, charges, dotations d'amortissement). L'étage FISCAL est le
// seul qui varie selon la stratégie / le régime : il est isolé dans des "calculateurs"
// annuels purs (TAX_CALCULATORS), appelés par la projection ; l'année 1 est simplement
// la 1re itération. Ainsi année 1 et projection ne peuvent jamais diverger.

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

// --- Stratégie d'acquisition et régimes fiscaux -----------------------------

export type Strategy = 'sci-is' | 'nom-propre'

export type Regime = 'sci-is' | 'micro-foncier' | 'foncier-reel' | 'micro-bic' | 'lmnp-reel'

export const REGIME_LABELS: Record<Regime, string> = {
  'sci-is': "SCI à l'IS",
  'micro-foncier': 'Micro-foncier',
  'foncier-reel': 'Foncier réel',
  'micro-bic': 'Micro-BIC',
  'lmnp-reel': 'LMNP réel',
}

// Régimes candidats selon la stratégie et la configuration physique du scénario.
// (Phase A : seul 'sci-is' possède un calculateur ; les autres arrivent en Phase B.)
export function regimesApplicables(strategy: Strategy, def: ScenarioDef): Regime[] {
  if (strategy === 'sci-is') return ['sci-is']
  return def.meuble ? ['micro-bic', 'lmnp-reel'] : ['micro-foncier', 'foncier-reel']
}

// Contexte fiscal : constantes de calibration, identiques pour toutes les années.
export type TaxContext = {
  strategy: Strategy
  tmi: number // taux marginal d'imposition IR, % (nom propre)
  tauxPS: number // prélèvements sociaux, % (17,2)
  plafondDeficitFoncier: number // 10 700 €
  seuilMicroFoncier: number // 15 000 € de recettes
  seuilMicroBic: number // 77 700 € de recettes
  abattementMicroFoncier: number // 30 %
  abattementMicroBic: number // 50 %
}

export function buildTaxContext(p: Params, strategy: Strategy): TaxContext {
  return {
    strategy,
    tmi: p.tmi,
    tauxPS: p.tauxPrelevementsSociaux,
    plafondDeficitFoncier: p.plafondDeficitFoncier,
    seuilMicroFoncier: p.seuilMicroFoncier,
    seuilMicroBic: p.seuilMicroBic,
    abattementMicroFoncier: p.abattementMicroFoncier,
    abattementMicroBic: p.abattementMicroBic,
  }
}

// Entrées annuelles dérivées de l'assiette, pour l'année Y.
export type AnnualTaxInputs = {
  annee: number // 1-indexée
  loyerEncaisseAn: number
  chargesRecurrentesAn: number
  taxeFonciere: number
  interetsAn: number // intérêts d'emprunt de l'année Y
  assuranceAn: number // assurance emprunteur de l'année Y (0 après remboursement)
  travauxDeductiblesAn: number // travaux passés en charge (foncier réel), Y=1 seulement
  amortBatiAn: number
  amortTravauxAn: number
  amortMobilierAn: number
}

// État fiscal reporté d'une année sur l'autre (discriminé par régime).
type Vintage = { annee: number; montant: number }

export type TaxState =
  | { kind: 'sci-is'; stockDeficit: number } // report illimité
  | { kind: 'micro' } // aucun report
  | { kind: 'foncier-reel'; reports: Vintage[] } // report 10 ans sur revenus fonciers
  | { kind: 'lmnp-reel'; stockAmortDiffere: number; reportsBic: Vintage[] } // ARD illimité + déficit BIC 10 ans

// Résultat fiscal d'une année, produit par un calculateur.
export type TaxYearResult = {
  regime: Regime
  regimeLabel: string
  resultatCourant: number // €/an, avant imputations (pour l'affichage)
  baseImposable: number // €/an, après abattement/imputations (≥ 0)
  impotAn: number // €/an total décaissé : (IR|IS) + PS ; peut être < 0 (économie déficit foncier global)
  prelevementsSociaux: number // €/an, part PS
  deficitImpute: number // €/an, déficit antérieur imputé cette année
  deficitReporte: number // €/an, stock total reporté en fin d'année
  amortissementsAn: number // €/an, dotations effectivement prises en compte (affichage)
  interetsAn: number // €/an (affichage)
  state: TaxState // à passer à l'année Y+1
}

export type TaxCalculator = (
  input: AnnualTaxInputs,
  ctx: TaxContext,
  prev: TaxState | null,
) => TaxYearResult

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

// --- Calculateurs fiscaux (un par régime) -----------------------------------

// SCI à l'IS : résultat = recettes − charges − TF − intérêts − assurance − amortissements.
// Déficit reportable sans limite ; imputé d'abord sur les exercices bénéficiaires. Aucun PS.
const calcSciIs: TaxCalculator = (input, _ctx, prev) => {
  const stock = prev && prev.kind === 'sci-is' ? prev.stockDeficit : 0
  const amort = input.amortBatiAn + input.amortTravauxAn + input.amortMobilierAn
  const resultatCourant =
    input.loyerEncaisseAn -
    input.chargesRecurrentesAn -
    input.taxeFonciere -
    input.interetsAn -
    input.assuranceAn -
    amort

  let stockDeficit = stock
  let deficitImpute = 0
  let baseImposable = 0
  if (resultatCourant < 0) {
    stockDeficit += -resultatCourant
  } else {
    deficitImpute = Math.min(stockDeficit, resultatCourant)
    stockDeficit -= deficitImpute
    baseImposable = resultatCourant - deficitImpute
  }

  return {
    regime: 'sci-is',
    regimeLabel: REGIME_LABELS['sci-is'],
    resultatCourant,
    baseImposable,
    impotAn: calculerIS(baseImposable),
    prelevementsSociaux: 0,
    deficitImpute,
    deficitReporte: stockDeficit,
    amortissementsAn: amort,
    interetsAn: input.interetsAn,
    state: { kind: 'sci-is', stockDeficit },
  }
}

// Purge les déficits reportés périmés (report limité à `dureeReport` ans).
function purgeVintages(reports: Vintage[], anneeCourante: number, dureeReport: number): Vintage[] {
  return reports.filter((v) => anneeCourante - v.annee < dureeReport)
}

// Impute un montant à couvrir sur des déficits reportés, du plus ancien au plus récent.
function imputerReports(
  reports: Vintage[],
  montantACouvrir: number,
): { impute: number; restants: Vintage[] } {
  let reste = montantACouvrir
  let impute = 0
  const restants: Vintage[] = []
  for (const v of reports) {
    if (reste <= 0) {
      restants.push(v)
      continue
    }
    const pris = Math.min(v.montant, reste)
    impute += pris
    reste -= pris
    const solde = v.montant - pris
    if (solde > 0) restants.push({ annee: v.annee, montant: solde })
  }
  return { impute, restants }
}

// Impôt IR + PS sur une base positive (régimes nom propre).
function impotIrPs(base: number, ctx: TaxContext): { ir: number; ps: number } {
  if (base <= 0) return { ir: 0, ps: 0 }
  return { ir: (base * ctx.tmi) / 100, ps: (base * ctx.tauxPS) / 100 }
}

// Micro-foncier (nu) : abattement forfaitaire 30 %, aucune charge/déficit.
const calcMicroFoncier: TaxCalculator = (input, ctx) => {
  const base = input.loyerEncaisseAn * (1 - ctx.abattementMicroFoncier / 100)
  const { ir, ps } = impotIrPs(base, ctx)
  return {
    regime: 'micro-foncier',
    regimeLabel: REGIME_LABELS['micro-foncier'],
    resultatCourant: base,
    baseImposable: base,
    impotAn: ir + ps,
    prelevementsSociaux: ps,
    deficitImpute: 0,
    deficitReporte: 0,
    amortissementsAn: 0,
    interetsAn: input.interetsAn,
    state: { kind: 'micro' },
  }
}

// Foncier réel (nu) : charges + intérêts déductibles, PAS d'amortissement.
// Les intérêts s'imputent d'abord sur les loyers ; le déficit hors intérêts est
// imputable sur le revenu global (plafond 10 700 €/an → économie d'IR), l'excédent et
// le déficit d'intérêts sont reportés 10 ans sur les revenus fonciers.
const calcFoncierReel: TaxCalculator = (input, ctx, prev) => {
  const reportsAnterieurs = prev && prev.kind === 'foncier-reel' ? prev.reports : []
  const reportsActifs = purgeVintages(reportsAnterieurs, input.annee, 10)

  const L = input.loyerEncaisseAn
  const I = input.interetsAn
  const autresCharges = input.chargesRecurrentesAn + input.taxeFonciere + input.assuranceAn + input.travauxDeductiblesAn

  const revenuApresInterets = L - I
  let baseAvantReports = 0
  let deficitInterets = 0
  let deficitGlobalBrut = 0
  if (revenuApresInterets <= 0) {
    deficitInterets = -revenuApresInterets
    deficitGlobalBrut = autresCharges
  } else {
    const net = revenuApresInterets - autresCharges
    if (net >= 0) baseAvantReports = net
    else deficitGlobalBrut = -net
  }

  // Imputer les reports fonciers antérieurs sur la base positive.
  const { impute: deficitImpute, restants } = imputerReports(reportsActifs, baseAvantReports)
  const base = baseAvantReports - deficitImpute

  // Déficit hors intérêts imputable sur le revenu global (plafonné) → économie d'IR.
  const deficitGlobalImpute = Math.min(deficitGlobalBrut, ctx.plafondDeficitFoncier)
  const excedentGlobal = deficitGlobalBrut - deficitGlobalImpute
  const nouveauReport = deficitInterets + excedentGlobal
  const reports = nouveauReport > 0 ? [...restants, { annee: input.annee, montant: nouveauReport }] : restants

  const economieImpotGlobal = (deficitGlobalImpute * ctx.tmi) / 100
  const { ir, ps } = impotIrPs(base, ctx)
  const deficitReporte = reports.reduce((s, v) => s + v.montant, 0)

  return {
    regime: 'foncier-reel',
    regimeLabel: REGIME_LABELS['foncier-reel'],
    resultatCourant: L - I - autresCharges,
    baseImposable: base,
    impotAn: ir + ps - economieImpotGlobal,
    prelevementsSociaux: ps,
    deficitImpute,
    deficitReporte,
    amortissementsAn: 0,
    interetsAn: I,
    state: { kind: 'foncier-reel', reports },
  }
}

// Micro-BIC (meublé) : abattement forfaitaire 50 %, aucune charge/déficit.
const calcMicroBic: TaxCalculator = (input, ctx) => {
  const base = input.loyerEncaisseAn * (1 - ctx.abattementMicroBic / 100)
  const { ir, ps } = impotIrPs(base, ctx)
  return {
    regime: 'micro-bic',
    regimeLabel: REGIME_LABELS['micro-bic'],
    resultatCourant: base,
    baseImposable: base,
    impotAn: ir + ps,
    prelevementsSociaux: ps,
    deficitImpute: 0,
    deficitReporte: 0,
    amortissementsAn: 0,
    interetsAn: input.interetsAn,
    state: { kind: 'micro' },
  }
}

// LMNP réel (meublé) : charges + intérêts déductibles + amortissements, mais
// l'amortissement NE PEUT PAS créer de déficit (report illimité en ARD). Le déficit
// d'exploitation (charges/intérêts) est reportable 10 ans sur les seuls revenus BIC.
const calcLmnpReel: TaxCalculator = (input, ctx, prev) => {
  const prevState = prev && prev.kind === 'lmnp-reel' ? prev : { stockAmortDiffere: 0, reportsBic: [] }
  const amortAnnee = input.amortBatiAn + input.amortTravauxAn + input.amortMobilierAn

  const resultatAvantAmort =
    input.loyerEncaisseAn - input.chargesRecurrentesAn - input.taxeFonciere - input.interetsAn - input.assuranceAn

  let reportsBic = purgeVintages(prevState.reportsBic, input.annee, 10)
  let stockAmortDiffere = prevState.stockAmortDiffere
  let deficitImpute = 0
  let amortUtilise = 0
  let base = 0

  if (resultatAvantAmort < 0) {
    // Déficit BIC (hors amort) reporté 10 ans ; tout l'amortissement est différé.
    reportsBic = [...reportsBic, { annee: input.annee, montant: -resultatAvantAmort }]
    stockAmortDiffere += amortAnnee
  } else {
    const imp = imputerReports(reportsBic, resultatAvantAmort)
    deficitImpute = imp.impute
    reportsBic = imp.restants
    const beneficeApresDeficit = resultatAvantAmort - deficitImpute
    const amortDispo = amortAnnee + stockAmortDiffere
    amortUtilise = Math.min(amortDispo, beneficeApresDeficit)
    stockAmortDiffere = amortDispo - amortUtilise
    base = beneficeApresDeficit - amortUtilise
  }

  const { ir, ps } = impotIrPs(base, ctx)
  const deficitReporte = reportsBic.reduce((s, v) => s + v.montant, 0) + stockAmortDiffere

  return {
    regime: 'lmnp-reel',
    regimeLabel: REGIME_LABELS['lmnp-reel'],
    resultatCourant: resultatAvantAmort,
    baseImposable: base,
    impotAn: ir + ps,
    prelevementsSociaux: ps,
    deficitImpute,
    deficitReporte,
    amortissementsAn: amortUtilise,
    interetsAn: input.interetsAn,
    state: { kind: 'lmnp-reel', stockAmortDiffere, reportsBic },
  }
}

// Registre des calculateurs fiscaux, un par régime.
export const TAX_CALCULATORS: Record<Regime, TaxCalculator> = {
  'sci-is': calcSciIs,
  'micro-foncier': calcMicroFoncier,
  'foncier-reel': calcFoncierReel,
  'micro-bic': calcMicroBic,
  'lmnp-reel': calcLmnpReel,
}

function getCalculator(regime: Regime): TaxCalculator {
  return TAX_CALCULATORS[regime]
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
// Partagée par le calcul « année 1 » et la projection, pour qu'ils ne divergent jamais.
type Assiette = {
  isDivision: boolean
  lots: number[]
  lotIllegal: boolean
  coutTotal: number
  apport: number
  emprunt: number // = coutTotal − apport
  loyerMensuel: number
  loyerEncaisseAn: number
  chargesAn: number
  mensualite: number // crédit + assurance, €/mois
  assuranceAn: number // €/an
  // Dotations annuelles d'amortissement, chacune active tant que Y ≤ sa durée.
  amortBatiAn: number
  amortTravauxAn: number
  amortMobilierAn: number
  // Ingrédients fiscaux supplémentaires (foncier réel / LMNP / plus-value).
  travauxImmobilises: number // travaux + découpe
  mobilierTotal: number
  fraisAcquisition: number // notaire + bancaires
}

function assietteScenario(def: ScenarioDef, prop: Property, p: Params): Assiette {
  const isDivision = def.nbLots > 1
  const lots = repartitionLots(prop.surface, def.nbLots, p.pertesCloison)
  const lotIllegal = isDivision && lots.some((ls) => ls < SURFACE_MINI_LEGALE)

  // --- Coût total, puis emprunt = coût total − apport ---
  const fraisNotaire = (prop.prix * p.fraisNotairePct) / 100
  const fraisBancaires = (prop.prix * p.fraisBancairesPct) / 100
  const decoupe = isDivision ? p.coutDecoupe : 0
  const mobilierTotal = def.meuble ? p.mobilierParLot * def.nbLots : 0
  const coutTotal = prop.prix + fraisNotaire + fraisBancaires + prop.travaux + decoupe + mobilierTotal
  const apport = Math.max(0, Math.min(prop.apport, coutTotal))
  const emprunt = Math.max(0, coutTotal - apport)

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

  // --- Mensualité (crédit + assurance sur capital emprunté) ---
  const mCredit = mensualiteCredit(emprunt, p.tauxInteret, p.dureeAnnees)
  const mAssurance = (emprunt * p.tauxAssurance) / 100 / 12
  const mensualite = mCredit + mAssurance
  const assuranceAn = mAssurance * 12

  // --- Dotations d'amortissement (linéaires) ---
  const travauxImmobilises = prop.travaux + decoupe
  const amortBatiAn = p.dureeAmortBati > 0 ? ((prop.prix * p.quotePartAmortissable) / 100) / p.dureeAmortBati : 0
  const amortTravauxAn = p.dureeAmortTravaux > 0 ? travauxImmobilises / p.dureeAmortTravaux : 0
  const amortMobilierAn = def.meuble && p.dureeAmortMobilier > 0 ? mobilierTotal / p.dureeAmortMobilier : 0

  return {
    isDivision,
    lots,
    lotIllegal,
    coutTotal,
    apport,
    emprunt,
    loyerMensuel,
    loyerEncaisseAn,
    chargesAn,
    mensualite,
    assuranceAn,
    amortBatiAn,
    amortTravauxAn,
    amortMobilierAn,
    travauxImmobilises,
    mobilierTotal,
    fraisAcquisition: fraisNotaire + fraisBancaires,
  }
}

// Construit les entrées fiscales de l'année Y à partir de l'assiette.
function annualInputs(a: Assiette, p: Params, annee: number, interetsAn: number): AnnualTaxInputs {
  const pretActif = annee <= p.dureeAnnees
  return {
    annee,
    loyerEncaisseAn: a.loyerEncaisseAn,
    chargesRecurrentesAn: a.chargesAn,
    taxeFonciere: 0, // renseigné par l'appelant (dépend de prop)
    interetsAn,
    assuranceAn: pretActif ? a.assuranceAn : 0,
    travauxDeductiblesAn: annee === 1 ? a.travauxImmobilises : 0,
    amortBatiAn: annee <= p.dureeAmortBati ? a.amortBatiAn : 0,
    amortTravauxAn: annee <= p.dureeAmortTravaux ? a.amortTravauxAn : 0,
    amortMobilierAn: annee <= p.dureeAmortMobilier ? a.amortMobilierAn : 0,
  }
}

export type ScenarioResult = {
  def: ScenarioDef
  lots: number[] // surfaces des lots créés (m²)
  lotIllegal: boolean // au moins un lot < 14 m² → scénario illégal, jamais retenu

  strategie: Strategy
  regime: Regime // régime retenu (le plus avantageux en nom propre)
  regimeLabel: string

  coutTotal: number
  apport: number
  emprunt: number // = coutTotal − apport
  loyerMensuel: number // loyer théorique brut (avant vacance)
  rdtBrut: number // %
  mensualite: number // crédit + assurance, €/mois
  cfAvantImpot: number // €/mois
  cfApresImpot: number // €/mois
  cfApresIS: number // @deprecated alias de cfApresImpot (migration Phase A→B)

  // Détail fiscal (année 1), pour transparence dans l'UI
  resultatFiscal: number // €/an
  baseImposable: number // €/an
  impot: number // €/an (IR|IS + PS)
  is: number // @deprecated alias de impot
  amortissements: number // €/an
  interetsAn1: number // €/an
}

export function computeScenario(
  def: ScenarioDef,
  prop: Property,
  p: Params,
  strategy: Strategy = 'sci-is',
): ScenarioResult {
  const a = assietteScenario(def, prop, p)
  const ctx = buildTaxContext(p, strategy)
  // Le régime retenu doit être le même que celui de la projection (choix pluriannuel).
  const regime =
    strategy === 'sci-is' ? 'sci-is' : choisirRegime(def, prop, p, ctx, p.horizonProjection).regime
  const calc = getCalculator(regime)

  const rdtBrut = a.coutTotal > 0 ? ((a.loyerMensuel * 12) / a.coutTotal) * 100 : 0
  const cfAvantImpot = a.loyerEncaisseAn / 12 - a.chargesAn / 12 - prop.taxeFonciere / 12 - a.mensualite

  const interetsAn1 = interetsPremiereAnnee(a.emprunt, p.tauxInteret, p.dureeAnnees)
  const input = { ...annualInputs(a, p, 1, interetsAn1), taxeFonciere: prop.taxeFonciere }
  const y1 = calc(input, ctx, null)
  const cfApresImpot = cfAvantImpot - y1.impotAn / 12

  return {
    def,
    lots: a.lots,
    lotIllegal: a.lotIllegal,
    strategie: strategy,
    regime,
    regimeLabel: y1.regimeLabel,
    coutTotal: a.coutTotal,
    apport: a.apport,
    emprunt: a.emprunt,
    loyerMensuel: a.loyerMensuel,
    rdtBrut,
    mensualite: a.mensualite,
    cfAvantImpot,
    cfApresImpot,
    cfApresIS: cfApresImpot,
    resultatFiscal: y1.resultatCourant,
    baseImposable: y1.baseImposable,
    impot: y1.impotAn,
    is: y1.impotAn,
    amortissements: y1.amortissementsAn,
    interetsAn1,
  }
}

export function computeAllScenarios(prop: Property, p: Params, strategy: Strategy = 'sci-is'): ScenarioResult[] {
  return SCENARIOS.map((def) => computeScenario(def, prop, p, strategy))
}

// --- Projection pluriannuelle (l'« effet ciseau ») ---------------------------
// Hypothèses constantes et assumées : loyers, charges et taxe foncière NON indexés.
// Le seul moteur de la dérive est fiscal : intérêts déductibles qui baissent +
// dotations d'amortissement qui s'éteignent → base imposable et impôt qui montent,
// alors que la trésorerie avant impôt, elle, ne bouge pas.

export type ProjectionAnnee = {
  annee: number // 1-indexée
  interets: number // €/an, déductibles cette année
  amortissements: number // €/an, dotations encore actives
  resultatCourant: number // €/an, avant imputation des déficits reportés
  deficitImpute: number // €/an, déficit antérieur imputé cette année
  baseImposable: number // €/an, après imputation
  prelevementsSociaux: number // €/an, part PS (nom propre ; 0 en IS)
  deficitReporte: number // €/an, stock de déficit/ARD reporté en fin d'année
  impot: number // €/an (IR|IS + PS)
  is: number // @deprecated alias de impot
  cfAvantImpot: number // €/an (constant tant que le prêt court)
  cfApresImpot: number // €/an
  cfApresIS: number // @deprecated alias de cfApresImpot
}

export type Projection = {
  def: ScenarioDef
  regime: Regime
  regimeLabel: string
  horizon: number // nb d'années projetées
  annees: ProjectionAnnee[]
  premiereAnneeImpot: number | null // 1re année où l'impôt devient > 0
  premiereAnneeIS: number | null // @deprecated alias
  premiereAnneeCfNegatif: number | null // 1re année où le CF après impôt passe < 0
  impotCumule: number // € cumulés sur l'horizon
  isCumule: number // @deprecated alias
  cfApresImpotCumule: number // € cumulés sur l'horizon
  cfApresISCumule: number // @deprecated alias
  cfApresImpotMoisAn1: number // €/mois année 1
  cfApresImpotMoisFin: number // €/mois dernière année de l'horizon
  cfApresISMoisAn1: number // @deprecated alias
  cfApresISMoisFin: number // @deprecated alias
}

function projeterRegime(
  def: ScenarioDef,
  prop: Property,
  p: Params,
  ctx: TaxContext,
  regime: Regime,
  horizon: number,
): Projection {
  const a = assietteScenario(def, prop, p)
  const calc = getCalculator(regime)
  const interetsAnnuels = interetsParAnnee(a.emprunt, p.tauxInteret, p.dureeAnnees)

  const annees: ProjectionAnnee[] = []
  let state: TaxState | null = null
  let impotCumule = 0
  let cfApresImpotCumule = 0
  let premiereAnneeImpot: number | null = null
  let premiereAnneeCfNegatif: number | null = null

  for (let y = 1; y <= horizon; y++) {
    const pretActif = y <= p.dureeAnnees
    const interets = interetsAnnuels[y - 1] ?? 0
    const input = { ...annualInputs(a, p, y, interets), taxeFonciere: prop.taxeFonciere }
    const r = calc(input, ctx, state)
    state = r.state

    const mensualiteAn = pretActif ? a.mensualite * 12 : 0
    const cfAvantImpot = a.loyerEncaisseAn - a.chargesAn - prop.taxeFonciere - mensualiteAn
    const cfApresImpot = cfAvantImpot - r.impotAn

    if (r.impotAn > 0 && premiereAnneeImpot === null) premiereAnneeImpot = y
    if (cfApresImpot < 0 && premiereAnneeCfNegatif === null) premiereAnneeCfNegatif = y

    impotCumule += r.impotAn
    cfApresImpotCumule += cfApresImpot

    annees.push({
      annee: y,
      interets,
      amortissements: r.amortissementsAn,
      resultatCourant: r.resultatCourant,
      deficitImpute: r.deficitImpute,
      baseImposable: r.baseImposable,
      prelevementsSociaux: r.prelevementsSociaux,
      deficitReporte: r.deficitReporte,
      impot: r.impotAn,
      is: r.impotAn,
      cfAvantImpot,
      cfApresImpot,
      cfApresIS: cfApresImpot,
    })
  }

  const moisAn1 = (annees[0]?.cfApresImpot ?? 0) / 12
  const moisFin = (annees[annees.length - 1]?.cfApresImpot ?? 0) / 12

  return {
    def,
    regime,
    regimeLabel: REGIME_LABELS[regime],
    horizon,
    annees,
    premiereAnneeImpot,
    premiereAnneeIS: premiereAnneeImpot,
    premiereAnneeCfNegatif,
    impotCumule,
    isCumule: impotCumule,
    cfApresImpotCumule,
    cfApresISCumule: cfApresImpotCumule,
    cfApresImpotMoisAn1: moisAn1,
    cfApresImpotMoisFin: moisFin,
    cfApresISMoisAn1: moisAn1,
    cfApresISMoisFin: moisFin,
  }
}

// Choix du meilleur régime en nom propre : on projette chaque régime éligible sur
// l'horizon et on retient celui qui maximise le cash-flow après impôt cumulé.
export type ChoixRegime = {
  regime: Regime
  projection: Projection
  alternatives: { regime: Regime; projection: Projection }[]
}

export function choisirRegime(
  def: ScenarioDef,
  prop: Property,
  p: Params,
  ctx: TaxContext,
  horizon: number,
): ChoixRegime {
  const a = assietteScenario(def, prop, p)
  // Le micro est écarté si les recettes dépassent son plafond ; le régime réel reste toujours candidat.
  const candidats = regimesApplicables(ctx.strategy, def).filter((r) => {
    if (r === 'micro-foncier') return a.loyerEncaisseAn <= ctx.seuilMicroFoncier
    if (r === 'micro-bic') return a.loyerEncaisseAn <= ctx.seuilMicroBic
    return true
  })

  const projections = candidats.map((regime) => ({
    regime,
    projection: projeterRegime(def, prop, p, ctx, regime, horizon),
  }))

  const estMicro = (r: Regime) => r === 'micro-foncier' || r === 'micro-bic'
  projections.sort((x, y) => {
    const d = y.projection.cfApresImpotCumule - x.projection.cfApresImpotCumule
    if (Math.abs(d) > 1e-6) return d
    // Égalité : préférer le régime réel (plus robuste dans la durée).
    return (estMicro(x.regime) ? 1 : 0) - (estMicro(y.regime) ? 1 : 0)
  })

  const best = projections[0]
  return { regime: best.regime, projection: best.projection, alternatives: projections.slice(1) }
}

// Projection publique : IS → régime unique ; nom propre → meilleur régime auto.
export function projeterScenario(
  def: ScenarioDef,
  prop: Property,
  p: Params,
  horizon: number,
  strategy: Strategy = 'sci-is',
): Projection {
  const ctx = buildTaxContext(p, strategy)
  if (strategy === 'sci-is') return projeterRegime(def, prop, p, ctx, 'sci-is', horizon)
  return choisirRegime(def, prop, p, ctx, horizon).projection
}

// Les deux stratégies calculées d'un coup, pour l'encart de comparaison.
export function computeComparaison(
  prop: Property,
  p: Params,
): { sciIs: ScenarioResult[]; nomPropre: ScenarioResult[] } {
  return {
    sciIs: computeAllScenarios(prop, p, 'sci-is'),
    nomPropre: computeAllScenarios(prop, p, 'nom-propre'),
  }
}
