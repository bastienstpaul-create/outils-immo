// Projection pluriannuelle : rend l'« effet ciseau » visible, année par année.
// Le triage de l'année 1 (tableau des scénarios) surestime le rendement ; ici on voit
// l'IS monter à mesure que les intérêts baissent et que l'amortissement s'éteint.

import { useMemo, useState } from 'react'
import type { ScenarioKey, ScenarioResult } from '../engine/finance.ts'
import { SCENARIOS, projeterScenario } from '../engine/finance.ts'
import type { Params } from '../state/params.ts'
import type { Property } from '../state/property.ts'
import { eur, eurSigne } from '../format.ts'

type Props = {
  property: Property
  params: Params
  scenarios: ScenarioResult[]
  meilleurKey: ScenarioKey | null
}

export function ProjectionPanel({ property, params, scenarios, meilleurKey }: Props) {
  // Scénario projeté : le meilleur par défaut, sinon le premier non illégal.
  const parKey = useMemo(() => new Map(scenarios.map((s) => [s.def.key, s])), [scenarios])
  const defautKey =
    meilleurKey ?? (scenarios.find((s) => !s.lotIllegal)?.def.key ?? 'nu')
  const [choix, setChoix] = useState<ScenarioKey | null>(null)
  const key = choix ?? defautKey
  const def = SCENARIOS.find((d) => d.key === key)!

  const horizon = Math.max(1, Math.min(40, Math.round(params.horizonProjection || 1)))
  const proj = useMemo(
    () => projeterScenario(def, property, params, horizon),
    [def, property, params, horizon],
  )

  const renseigne = property.prix > 0 && property.surface > 0
  const illegal = parKey.get(key)?.lotIllegal ?? false

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Projection · effet ciseau</h2>
        <label className="check check--inline">
          <span>Scénario</span>
          <select
            className="proj__select"
            value={key}
            onChange={(e) => setChoix(e.target.value as ScenarioKey)}
          >
            {SCENARIOS.map((d) => {
              const ill = parKey.get(d.key)?.lotIllegal
              return (
                <option key={d.key} value={d.key} disabled={ill}>
                  {d.label}
                  {d.key === defautKey ? ' — meilleur' : ''}
                  {ill ? ' — illégal' : ''}
                </option>
              )
            })}
          </select>
        </label>
      </div>

      {!renseigne ? (
        <p className="panel__hint">Renseigne le prix et la surface du bien pour voir la projection.</p>
      ) : illegal ? (
        <p className="panel__hint">Ce scénario est illégal (lot &lt; 14 m²) : il n'est jamais retenu.</p>
      ) : (
        <>
          <div className="proj__synth">
            <div className="proj__stat">
              <span className="proj__stat-lbl">CF après IS · an 1 → an {horizon}</span>
              <span className="proj__stat-val">
                <span className={proj.cfApresISMoisAn1 >= 0 ? 'pos' : 'neg'}>
                  {eurSigne(proj.cfApresISMoisAn1)}
                </span>
                {' → '}
                <span className={proj.cfApresISMoisFin >= 0 ? 'pos' : 'neg'}>
                  {eurSigne(proj.cfApresISMoisFin)}
                </span>
                <em className="proj__unit"> /mois</em>
              </span>
            </div>
            <div className="proj__stat">
              <span className="proj__stat-lbl">L'IS démarre en</span>
              <span className="proj__stat-val">
                {proj.premiereAnneeIS ? `année ${proj.premiereAnneeIS}` : 'jamais sur l’horizon'}
              </span>
            </div>
            <div className="proj__stat">
              <span className="proj__stat-lbl">CF après IS négatif dès</span>
              <span className="proj__stat-val">
                {proj.premiereAnneeCfNegatif ? (
                  <span className="neg">année {proj.premiereAnneeCfNegatif}</span>
                ) : (
                  <span className="pos">jamais sur l’horizon</span>
                )}
              </span>
            </div>
            <div className="proj__stat">
              <span className="proj__stat-lbl">IS cumulé sur {horizon} ans</span>
              <span className="proj__stat-val">{eur(proj.isCumule)}</span>
            </div>
          </div>

          <div className="tablewrap">
            <table className="scenarios">
              <thead>
                <tr>
                  <th className="left">Année</th>
                  <th>Intérêts</th>
                  <th>Amort.</th>
                  <th>Résultat courant</th>
                  <th>Base imposable</th>
                  <th>IS /an</th>
                  <th>CF après IS /an</th>
                </tr>
              </thead>
              <tbody>
                {proj.annees.map((r) => (
                  <tr key={r.annee}>
                    <td className="left">{r.annee}</td>
                    <td className="muted">{eur(r.interets)}</td>
                    <td className="muted">{eur(r.amortissements)}</td>
                    <td className={r.resultatCourant > 0 ? '' : 'muted'}>{eur(r.resultatCourant)}</td>
                    <td className={r.baseImposable > 0 ? '' : 'muted'}>{eur(r.baseImposable)}</td>
                    <td className={r.is > 0 ? '' : 'muted'}>{eur(r.is)}</td>
                    <td className={r.cfApresIS >= 0 ? 'pos' : 'neg'}>{eurSigne(r.cfApresIS)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="panel__hint">
            Hypothèses constantes et assumées : loyers, charges et taxe foncière <strong>non indexés</strong>.
            La dérive vient donc uniquement de la fiscalité — intérêts déductibles qui baissent, dotations
            d'amortissement qui s'éteignent — et les déficits des premières années sont reportés sur les
            exercices bénéficiaires (report illimité en IS). Regarde l'année où le CF après IS bascule :
            c'est elle, pas l'année 1, qui décide si le deal tient dans la durée.
          </p>
        </>
      )}
    </section>
  )
}
