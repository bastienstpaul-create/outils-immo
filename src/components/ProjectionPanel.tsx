// Projection pluriannuelle : rend l'« effet ciseau » visible, année par année.
// Le triage de l'année 1 (tableau des scénarios) surestime le rendement ; ici on voit
// l'IS monter à mesure que les intérêts baissent et que l'amortissement s'éteint.

import { useMemo, useState } from 'react'
import type { ScenarioKey, ScenarioResult, Strategy } from '../engine/finance.ts'
import { SCENARIOS, projeterScenario } from '../engine/finance.ts'
import type { Params } from '../state/params.ts'
import type { Property } from '../state/property.ts'
import { eur, eurSigne } from '../format.ts'

type Props = {
  property: Property
  params: Params
  scenarios: ScenarioResult[]
  strategie: Strategy
  meilleurKey: ScenarioKey | null
}

export function ProjectionPanel({ property, params, scenarios, strategie, meilleurKey }: Props) {
  const nomPropre = strategie === 'nom-propre'
  // Scénario projeté : le meilleur par défaut, sinon le premier non illégal.
  const parKey = useMemo(() => new Map(scenarios.map((s) => [s.def.key, s])), [scenarios])
  const defautKey =
    meilleurKey ?? (scenarios.find((s) => !s.lotIllegal)?.def.key ?? 'nu')
  const [choix, setChoix] = useState<ScenarioKey | null>(null)
  const key = choix ?? defautKey
  const def = SCENARIOS.find((d) => d.key === key)!

  const horizon = Math.max(1, Math.min(40, Math.round(params.horizonProjection || 1)))
  const proj = useMemo(
    () => projeterScenario(def, property, params, horizon, strategie),
    [def, property, params, horizon, strategie],
  )

  const renseigne = property.prix > 0 && property.surface > 0
  const illegal = parKey.get(key)?.lotIllegal ?? false

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>
          Projection · effet ciseau
          {renseigne && !illegal && <span className="proj__regime"> · {proj.regimeLabel}</span>}
        </h2>
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
              <span className="proj__stat-lbl">CF après impôt · an 1 → an {horizon}</span>
              <span className="proj__stat-val">
                <span className={proj.cfApresImpotMoisAn1 >= 0 ? 'pos' : 'neg'}>
                  {eurSigne(proj.cfApresImpotMoisAn1)}
                </span>
                {' → '}
                <span className={proj.cfApresImpotMoisFin >= 0 ? 'pos' : 'neg'}>
                  {eurSigne(proj.cfApresImpotMoisFin)}
                </span>
                <em className="proj__unit"> /mois</em>
              </span>
            </div>
            <div className="proj__stat">
              <span className="proj__stat-lbl">L'impôt démarre en</span>
              <span className="proj__stat-val">
                {proj.premiereAnneeImpot ? `année ${proj.premiereAnneeImpot}` : 'jamais sur l’horizon'}
              </span>
            </div>
            <div className="proj__stat">
              <span className="proj__stat-lbl">CF après impôt négatif dès</span>
              <span className="proj__stat-val">
                {proj.premiereAnneeCfNegatif ? (
                  <span className="neg">année {proj.premiereAnneeCfNegatif}</span>
                ) : (
                  <span className="pos">jamais sur l’horizon</span>
                )}
              </span>
            </div>
            <div className="proj__stat">
              <span className="proj__stat-lbl">Impôt cumulé sur {horizon} ans</span>
              <span className="proj__stat-val">{eur(proj.impotCumule)}</span>
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
                  {nomPropre && <th>dont PS</th>}
                  <th>Impôt /an</th>
                  <th>CF après impôt /an</th>
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
                    {nomPropre && (
                      <td className="muted">{eur(r.prelevementsSociaux)}</td>
                    )}
                    <td className={r.impot > 0 ? '' : r.impot < 0 ? 'pos' : 'muted'}>{eur(r.impot)}</td>
                    <td className={r.cfApresImpot >= 0 ? 'pos' : 'neg'}>{eurSigne(r.cfApresImpot)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="panel__hint">
            Hypothèses constantes et assumées : loyers, charges et taxe foncière <strong>non indexés</strong>.
            La dérive vient de la fiscalité — intérêts déductibles qui baissent, amortissements qui s'éteignent.
            {nomPropre
              ? ' En nom propre, l’impôt = IR à ta TMI + prélèvements sociaux (17,2 %) ; déficits fonciers reportés 10 ans (plafond 10 700 € sur le revenu global), amortissement LMNP différé sans limite et ne créant jamais de déficit.'
              : ' En SCI à l’IS, les déficits sont reportés sans limite sur les exercices bénéficiaires.'}{' '}
            Regarde l'année où le CF après impôt bascule : c'est elle, pas l'année 1, qui décide.
          </p>
        </>
      )}
    </section>
  )
}
