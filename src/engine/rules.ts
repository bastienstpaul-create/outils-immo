// Règles métier dures : drapeaux rouges et verdict GO / À CREUSER / STOP.
// Les kill-switches légaux par scénario (lot < 14 m²) sont portés par finance.ts (lotIllegal).

import type { Params } from '../state/params.ts'
import type { Property } from '../state/property.ts'
import type { ScenarioResult } from './finance.ts'

export type FlagLevel = 'red' | 'warn'

export type Flag = {
  level: FlagLevel
  titre: string
  detail: string
}

export type Verdict = 'GO' | 'À CREUSER' | 'STOP'

export type Evaluation = {
  verdict: Verdict
  raisons: string[]
  flags: Flag[]
  meilleurScenario: ScenarioResult | null // meilleur scénario légal passant les deux seuils
}

export function computeFlags(prop: Property): Flag[] {
  const flags: Flag[] = []

  if (prop.occupe) {
    flags.push({
      level: 'red',
      titre: 'Bien vendu occupé',
      detail:
        "Achat par une société → baux en cours prorogés de 6 ans (3 ans seulement pour une personne physique). Un bien vacant vaut plus. Vérifier la possibilité de congé.",
    })
  }

  if (prop.nbLogementsImmeuble != null && prop.nbLogementsImmeuble > 5) {
    flags.push({
      level: 'red',
      titre: `Immeuble de ${prop.nbLogementsImmeuble} logements (> 5)`,
      detail:
        'Droit de préemption des locataires en cas de vente (loi du 31/12/1975). Complexifie et ralentit l’acquisition.',
    })
  }

  if (prop.copropriete && prop.divisionEnvisagee) {
    flags.push({
      level: 'warn',
      titre: 'Division en copropriété',
      detail:
        "Créer une 2ᵉ porte palière touche une partie commune → autorisation en AG à la majorité de l'art. 25. À sécuriser avant l'achat.",
    })
  }

  return flags
}

// Seuils atteints : un scénario légal est « viable » s'il passe brut ET cash-flow avant impôt.
function passeSeuils(s: ScenarioResult, p: Params): boolean {
  return s.rdtBrut >= p.seuilBanque && s.cfAvantImpot >= p.seuilCashflow
}

export function evaluate(scenarios: ScenarioResult[], prop: Property, p: Params): Evaluation {
  const flags = computeFlags(prop)
  const hasRedFlag = flags.some((f) => f.level === 'red')

  const legaux = scenarios.filter((s) => !s.lotIllegal)
  const viables = legaux.filter((s) => passeSeuils(s, p))
  // Meilleur = cash-flow avant impôt le plus élevé parmi les viables.
  const meilleur = viables.reduce<ScenarioResult | null>(
    (best, s) => (best == null || s.cfAvantImpot > best.cfAvantImpot ? s : best),
    null,
  )
  const viablesEnEtat = viables.filter((s) => s.def.nbLots === 1)

  const raisons: string[] = []
  let verdict: Verdict

  if (viables.length === 0) {
    verdict = 'STOP'
    const passeBrut = legaux.some((s) => s.rdtBrut >= p.seuilBanque)
    const passeCF = legaux.some((s) => s.cfAvantImpot >= p.seuilCashflow)
    if (legaux.length === 0) {
      raisons.push('Aucun scénario légal : tous les découpages créent un lot sous 14 m².')
    }
    if (!passeBrut) {
      raisons.push(`Aucun scénario n'atteint le rendement brut minimal (${p.seuilBanque} %).`)
    }
    if (!passeCF) {
      raisons.push(`Aucun scénario n'atteint le cash-flow avant impôt minimal (${p.seuilCashflow} €/mois).`)
    }
  } else if (viablesEnEtat.length > 0 && !hasRedFlag) {
    verdict = 'GO'
    raisons.push(
      `Rentable dès l'état (${viablesEnEtat[0].def.label}) sans découpe, seuils banque et cash-flow tenus.`,
    )
  } else {
    verdict = 'À CREUSER'
    if (viablesEnEtat.length === 0) {
      raisons.push('Rentable uniquement via division ou meublé : dépend de la faisabilité de la découpe.')
    }
    if (hasRedFlag) {
      raisons.push('Un drapeau rouge conditionne le deal (voir ci-dessous).')
    }
  }

  return { verdict, raisons, flags, meilleurScenario: meilleur }
}
