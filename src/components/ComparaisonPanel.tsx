// Encart de comparaison : le MÊME bien (meilleur scénario) en SCI à l'IS vs nom propre
// (meilleur régime auto), sur l'horizon de projection — pour trancher la stratégie.

import { useMemo } from 'react'
import type { ScenarioKey, Strategy } from '../engine/finance.ts'
import { SCENARIOS, projeterScenario } from '../engine/finance.ts'
import type { Params } from '../state/params.ts'
import type { Property } from '../state/property.ts'
import { eur, eurSigne } from '../format.ts'

type Props = {
  property: Property
  params: Params
  meilleurKey: ScenarioKey | null
  strategieActive: Strategy
  onChoisir: (s: Strategy) => void
}

export function ComparaisonPanel({ property, params, meilleurKey, strategieActive, onChoisir }: Props) {
  const renseigne = property.prix > 0 && property.surface > 0
  const key: ScenarioKey = meilleurKey ?? 'nu'
  const def = SCENARIOS.find((d) => d.key === key)!
  const horizon = Math.max(1, Math.min(40, Math.round(params.horizonProjection || 1)))

  const projIS = useMemo(
    () => projeterScenario(def, property, params, horizon, 'sci-is'),
    [def, property, params, horizon],
  )
  const projNP = useMemo(
    () => projeterScenario(def, property, params, horizon, 'nom-propre'),
    [def, property, params, horizon],
  )

  if (!renseigne || !meilleurKey) {
    return (
      <section className="panel">
        <h2>SCI à l'IS vs nom propre</h2>
        <p className="panel__hint">
          {renseigne
            ? "Aucun scénario viable pour l'instant : ajuste les faits du bien ou les seuils."
            : 'Renseigne le prix et la surface pour comparer les deux stratégies.'}
        </p>
      </section>
    )
  }

  const cartes: { strategie: Strategy; titre: string; regime: string; proj: typeof projIS }[] = [
    { strategie: 'sci-is', titre: "SCI à l'IS", regime: projIS.regimeLabel, proj: projIS },
    { strategie: 'nom-propre', titre: 'Nom propre', regime: projNP.regimeLabel, proj: projNP },
  ]
  // La meilleure stratégie = CF après impôt cumulé le plus élevé sur l'horizon.
  const gagnante: Strategy =
    projNP.cfApresImpotCumule > projIS.cfApresImpotCumule ? 'nom-propre' : 'sci-is'

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>SCI à l'IS vs nom propre</h2>
        <span className="cmp__scope">
          {def.label} · sur {horizon} ans
        </span>
      </div>

      <div className="cmp__grid">
        {cartes.map((c) => {
          const active = c.strategie === strategieActive
          const best = c.strategie === gagnante
          return (
            <div key={c.strategie} className={`cmp__card${best ? ' cmp__card--best' : ''}`}>
              <div className="cmp__card-head">
                <span className="cmp__titre">{c.titre}</span>
                {best && <span className="badge badge--best">meilleure</span>}
              </div>
              <div className="cmp__regime">{c.regime}</div>
              <dl className="cmp__rows">
                <div>
                  <dt>CF après impôt an 1</dt>
                  <dd className={c.proj.cfApresImpotMoisAn1 >= 0 ? 'pos' : 'neg'}>
                    {eurSigne(c.proj.cfApresImpotMoisAn1)}/mois
                  </dd>
                </div>
                <div>
                  <dt>CF après impôt an {horizon}</dt>
                  <dd className={c.proj.cfApresImpotMoisFin >= 0 ? 'pos' : 'neg'}>
                    {eurSigne(c.proj.cfApresImpotMoisFin)}/mois
                  </dd>
                </div>
                <div>
                  <dt>CF après impôt cumulé</dt>
                  <dd className={c.proj.cfApresImpotCumule >= 0 ? 'pos' : 'neg'}>
                    {eurSigne(c.proj.cfApresImpotCumule)}
                  </dd>
                </div>
                <div>
                  <dt>Impôt cumulé</dt>
                  <dd>{eur(c.proj.impotCumule)}</dd>
                </div>
              </dl>
              <button
                type="button"
                className={`btn cmp__btn${active ? '' : ' btn--ghost'}`}
                onClick={() => onChoisir(c.strategie)}
                disabled={active}
              >
                {active ? '✓ Stratégie active' : 'Voir cette stratégie'}
              </button>
            </div>
          )
        })}
      </div>

      <p className="panel__hint">
        Comparaison du cash-flow après impôt cumulé sur l'horizon (loyers/charges non indexés, hors
        revente). En SCI à l'IS, les prélèvements sociaux ne s'appliquent qu'à la distribution de
        dividendes (non modélisée) ; en nom propre ils frappent chaque année le résultat imposable.
      </p>
    </section>
  )
}
