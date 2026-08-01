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

// Somme des intérêts payés sur les 12 premiers mois (année fiscale 1).
export function interetsPremiereAnnee(capital: number, tauxAnnuelPct: number, dureeAnnees: number): number {
  const i = tauxAnnuelPct / 100 / 12
  const n = dureeAnnees * 12
  if (n <= 0) return 0
  const pay = mensualiteCredit(capital, tauxAnnuelPct, dureeAnnees)
  let solde = capital
  let interets = 0
  const mois = Math.min(12, n)
  for (let m = 0; m < mois; m++) {
    const interetMois = solde * i
    interets += interetMois
    solde -= pay - interetMois
  }
  return interets
}

// Répartit la surface habitable en `nbLots` lots égaux, après perte des cloisons.
export function repartitionLots(surface: number, nbLots: number, pertesCloison: number): number[] {
  if (nbLots <= 1) return [surface]
  const cloisons = nbLots - 1
  const habitable = Math.max(0, surface - cloisons * pertesCloison)
  const parLot = habitable / nbLots
  return Array.from({ length: nbLots }, () => parLot)
}

export function computeScenario(def: ScenarioDef, prop: Property, p: Params): ScenarioResult {
  const isDivision = def.nbLots > 1
  const lots = repartitionLots(prop.surface, def.nbLots, p.pertesCloison)

  // --- Coût total (financé à 110 %) ---
  const fraisNotaire = (prop.prix * p.fraisNotairePct) / 100
  const fraisBancaires = (prop.prix * p.fraisBancairesPct) / 100
  const decoupe = isDivision ? p.coutDecoupe : 0
  const mobilierTotal = def.meuble ? p.mobilierParLot * def.nbLots : 0
  const coutTotal = prop.prix + fraisNotaire + fraisBancaires + prop.travaux + decoupe + mobilierTotal
  const emprunt = coutTotal // sans apport

  // --- Loyer brut mensuel théorique ---
  let loyerMensuel: number
  if (isDivision) {
    loyerMensuel = lots.reduce((s, ls) => s + p.loyerMicroLot * ls, 0)
  } else if (def.meuble) {
    loyerMensuel = p.loyerM2Meuble * prop.surface
  } else {
    loyerMensuel = p.loyerM2Nu * prop.surface
  }

  const rdtBrut = coutTotal > 0 ? ((loyerMensuel * 12) / coutTotal) * 100 : 0

  // --- Encaissé après vacance ---
  const loyerEncaisseMois = loyerMensuel * (1 - p.tauxVacance / 100)
  const loyerEncaisseAn = loyerEncaisseMois * 12

  // --- Mensualité ---
  const mCredit = mensualiteCredit(emprunt, p.tauxInteret, p.dureeAnnees)
  const mAssurance = (emprunt * p.tauxAssurance) / 100 / 12
  const mensualite = mCredit + mAssurance

  // --- Charges & taxe foncière ---
  const chargesMois = (loyerEncaisseMois * p.chargesNonRecupPct) / 100
  const tfMois = prop.taxeFonciere / 12

  // --- Étape 2 : cash-flow avant impôt ---
  const cfAvantImpot = loyerEncaisseMois - chargesMois - tfMois - mensualite

  // --- Étape 3 : impôt sur les sociétés (année 1) ---
  const interetsAn1 = interetsPremiereAnnee(emprunt, p.tauxInteret, p.dureeAnnees)
  const assuranceAn = mAssurance * 12
  const amortBati = p.dureeAmortBati > 0 ? ((prop.prix * p.quotePartAmortissable) / 100) / p.dureeAmortBati : 0
  const amortTravaux = p.dureeAmortTravaux > 0 ? (prop.travaux + decoupe) / p.dureeAmortTravaux : 0
  const amortMobilier = def.meuble && p.dureeAmortMobilier > 0 ? mobilierTotal / p.dureeAmortMobilier : 0
  const amortissements = amortBati + amortTravaux + amortMobilier

  const chargesAn = chargesMois * 12
  const resultatFiscal =
    loyerEncaisseAn - chargesAn - prop.taxeFonciere - interetsAn1 - assuranceAn - amortissements

  // IS : 15 % jusqu'à 42 500 € de bénéfice, 25 % au-delà. Déficit → 0 (reportable).
  const is =
    resultatFiscal > 0
      ? 0.15 * Math.min(resultatFiscal, 42500) + 0.25 * Math.max(0, resultatFiscal - 42500)
      : 0

  // L'IS ampute la trésorerie ; l'amortissement, lui, n'est pas une sortie de cash.
  const cfApresIS = cfAvantImpot - is / 12

  const lotIllegal = isDivision && lots.some((ls) => ls < SURFACE_MINI_LEGALE)

  return {
    def,
    lots,
    lotIllegal,
    coutTotal,
    loyerMensuel,
    rdtBrut,
    mensualite,
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
