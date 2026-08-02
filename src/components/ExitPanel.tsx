// Module de sortie : revente (plus-value) et refinancement (extraction d'equity).
// Calculé pour le meilleur scénario, sous la stratégie active.

import { useMemo } from 'react'
import type { ScenarioKey, Strategy } from '../engine/finance.ts'
import { SCENARIOS, computeRevente, computeRefinancement } from '../engine/finance.ts'
import type { Params } from '../state/params.ts'
import type { Property } from '../state/property.ts'
import { eur, eurSigne } from '../format.ts'

type Props = {
  property: Property
  params: Params
  meilleurKey: ScenarioKey | null
  strategie: Strategy
}

const pctFrac = (f: number) => `${Math.round(f * 100)} %`

export function ExitPanel({ property, params, meilleurKey, strategie }: Props) {
  const renseigne = property.prix > 0 && property.surface > 0
  const key: ScenarioKey = meilleurKey ?? 'nu'
  const def = SCENARIOS.find((d) => d.key === key)!

  const revente = useMemo(
    () => computeRevente(def, property, params, strategie),
    [def, property, params, strategie],
  )
  const refi = useMemo(() => computeRefinancement(def, property, params), [def, property, params])
  const refiActif = property.anneeRefi > 0

  if (!renseigne || !meilleurKey) {
    return (
      <section className="panel">
        <h2>Sortie · revente & refinancement</h2>
        <p className="panel__hint">
          {renseigne
            ? "Aucun scénario viable : ajuste les faits du bien ou les seuils."
            : 'Renseigne le prix et la surface, puis les hypothèses de sortie (durée, valeur, année de refi).'}
        </p>
      </section>
    )
  }

  const nomPropre = strategie === 'nom-propre'

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Sortie · revente & refinancement</h2>
        <span className="cmp__scope">{def.label}</span>
      </div>

      <div className="exit__grid">
        {/* --- Revente --- */}
        <div className="exit__block">
          <h3>Revente en année {revente.annees}</h3>
          <dl className="cmp__rows">
            <div>
              <dt>Valeur de revente</dt>
              <dd>{eur(revente.valeurRevente)}</dd>
            </div>
            <div>
              <dt>{nomPropre ? "Prix d'acquisition majoré" : 'Valeur nette comptable'}</dt>
              <dd>{eur(revente.prixAcquisitionMajore)}</dd>
            </div>
            <div>
              <dt>Plus-value brute</dt>
              <dd className={revente.plusValueBrute >= 0 ? 'pos' : 'neg'}>
                {eurSigne(revente.plusValueBrute)}
              </dd>
            </div>
            {nomPropre && (
              <div>
                <dt>Abattement (IR / PS)</dt>
                <dd>
                  {pctFrac(revente.abattementIR)} / {pctFrac(revente.abattementPS)}
                </dd>
              </div>
            )}
            <div>
              <dt>{nomPropre ? 'Impôt (IR + PS + surtaxe)' : 'IS sur la plus-value'}</dt>
              <dd>{eur(revente.impotTotal)}</dd>
            </div>
            <div>
              <dt>Plus-value nette</dt>
              <dd className={revente.plusValueNette >= 0 ? 'pos' : 'neg'}>
                {eurSigne(revente.plusValueNette)}
              </dd>
            </div>
            <div className="exit__hl">
              <dt>Produit net de vente</dt>
              <dd className={revente.produitNetVente >= 0 ? 'pos' : 'neg'}>
                {eurSigne(revente.produitNetVente)}
              </dd>
            </div>
          </dl>
          <p className="exit__note">valeur − capital restant dû ({eur(revente.capitalRestantDu)}) − impôt</p>
        </div>

        {/* --- Refinancement --- */}
        <div className="exit__block">
          <h3>Refinancement {refiActif ? `en année ${refi.annee}` : ''}</h3>
          {!refiActif ? (
            <p className="panel__hint">
              Renseigne « Année du refinancement » dans les faits du bien pour simuler l'extraction
              d'equity (0 = pas de refi).
            </p>
          ) : (
            <>
              <dl className="cmp__rows">
                <div>
                  <dt>Valeur réévaluée</dt>
                  <dd>{eur(refi.valeurReevaluee)}</dd>
                </div>
                <div>
                  <dt>Nouveau prêt ({Math.round(refi.ltv)} % LTV)</dt>
                  <dd>{eur(refi.nouveauPret)}</dd>
                </div>
                <div>
                  <dt>Capital restant dû</dt>
                  <dd>{eur(refi.capitalRestantDuAvant)}</dd>
                </div>
                <div>
                  <dt>Frais de refi</dt>
                  <dd>{eur(refi.fraisRefi)}</dd>
                </div>
                <div className="exit__hl">
                  <dt>Cash extrait</dt>
                  <dd className={refi.cashOut >= 0 ? 'pos' : 'neg'}>{eurSigne(refi.cashOut)}</dd>
                </div>
                <div>
                  <dt>Mensualité (avant → après)</dt>
                  <dd>
                    {eur(refi.ancienneMensualite)} → {eur(refi.nouvelleMensualite)}
                  </dd>
                </div>
                <div>
                  <dt>Argent laissé dans le deal</dt>
                  <dd className={refi.argentLaisse <= 0 ? 'pos' : 'neg'}>{eur(refi.argentLaisse)}</dd>
                </div>
              </dl>
              <p className="exit__note">
                apport ({eur(refi.apport)}) − cash extrait. Négatif = tu récupères plus que ta mise (effet
                BRRR).
              </p>
            </>
          )}
        </div>
      </div>

      <p className="panel__hint">
        Hypothèses de sortie constantes (valeur saisie ou appréciation composée). Revente répétée en nom
        propre : attention à la <strong>requalification en marchand de biens</strong> (fiscalité tout autre,
        non modélisée).
      </p>
    </section>
  )
}
