// Tableau des scénarios : brut → CF avant impôt → CF après IS. Scénario illégal barré.

import { useState } from 'react'
import type { ScenarioResult, Strategy } from '../engine/finance.ts'
import type { Params } from '../state/params.ts'
import { eur, eurSigne, pct, m2 } from '../format.ts'

type Props = {
  scenarios: ScenarioResult[]
  params: Params
  strategie: Strategy
  meilleurKey: string | null
}

function cfClass(v: number): string {
  return v >= 0 ? 'pos' : 'neg'
}

export function ScenarioTable({ scenarios, params, strategie, meilleurKey }: Props) {
  const [detail, setDetail] = useState(false)
  const nomPropre = strategie === 'nom-propre'

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Scénarios</h2>
        <label className="check check--inline">
          <input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} />
          <span>Détail fiscal (année 1)</span>
        </label>
      </div>

      <div className="panel__strat-note">
        {nomPropre
          ? "Nom propre : le régime le plus avantageux est retenu par scénario (affiché sous chaque ligne)."
          : "SCI à l'IS."}
      </div>

      <div className="tablewrap">
        <table className="scenarios">
          <thead>
            <tr>
              <th className="left">Scénario</th>
              <th>Loyer /mois</th>
              <th>Coût total</th>
              <th>Mensualité</th>
              <th>
                Rdt brut
                <em className="th__sub">seuil {params.seuilBanque} %</em>
              </th>
              <th>
                CF avant impôt
                <em className="th__sub">seuil {eur(params.seuilCashflow)}</em>
              </th>
              <th>CF après impôt</th>
              {detail && (
                <>
                  <th>Amort. /an</th>
                  <th>Intérêts an 1</th>
                  <th>Résultat fiscal</th>
                  <th>Impôt /an</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => {
              const brutOk = s.rdtBrut >= params.seuilBanque
              const cfOk = s.cfAvantImpot >= params.seuilCashflow
              const best = s.def.key === meilleurKey
              return (
                <tr
                  key={s.def.key}
                  className={`${s.lotIllegal ? 'illegal' : ''} ${best ? 'best' : ''}`.trim()}
                >
                  <td className="left">
                    <div className="scen__label">
                      {s.def.label}
                      {s.lotIllegal && <span className="badge badge--illegal">illégal · &lt; 14 m²</span>}
                      {best && <span className="badge badge--best">meilleur</span>}
                    </div>
                    {s.def.nbLots > 1 && (
                      <div className="scen__lots">{s.lots.map((l) => m2(l)).join(' · ')}</div>
                    )}
                    {nomPropre && !s.lotIllegal && (
                      <div className="scen__regime">{s.regimeLabel}</div>
                    )}
                  </td>
                  <td>{eur(s.loyerMensuel)}</td>
                  <td>{eur(s.coutTotal)}</td>
                  <td>{eur(s.mensualite)}</td>
                  <td className={brutOk ? 'ok' : 'ko'}>{pct(s.rdtBrut)}</td>
                  <td className={`${cfClass(s.cfAvantImpot)} ${cfOk ? 'ok' : 'ko'}`}>
                    {eurSigne(s.cfAvantImpot)}
                  </td>
                  <td className={cfClass(s.cfApresImpot)}>{eurSigne(s.cfApresImpot)}</td>
                  {detail && (
                    <>
                      <td className="muted">{eur(s.amortissements)}</td>
                      <td className="muted">{eur(s.interetsAn1)}</td>
                      <td className={s.resultatFiscal > 0 ? '' : 'muted'}>{eur(s.resultatFiscal)}</td>
                      <td className={s.impot > 0 ? '' : 'muted'}>{eur(s.impot)}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {detail && nomPropre && (
        <p className="panel__hint">
          Nom propre : l'impôt inclut l'IR à ta TMI + les prélèvements sociaux (17,2 %). Le régime retenu
          par scénario est le plus avantageux sur l'horizon de projection. Un impôt négatif traduit
          l'économie d'IR d'un déficit foncier imputé sur ton revenu global.
        </p>
      )}
      {detail && !nomPropre && (
        <p className="panel__hint">
          Année 1 : l'amortissement et les intérêts écrasent souvent le résultat fiscal → IS ≈ 0 → le
          cash-flow après impôt colle au cash-flow avant impôt (avantage SCI à l'IS). Attention à l'effet
          ciseau plus tard : quand l'amortissement passe sous le capital remboursé, l'IS grimpe alors que
          la trésorerie ne suit pas. Ce triage sur l'année 1 le sous-estime.
        </p>
      )}
    </section>
  )
}
