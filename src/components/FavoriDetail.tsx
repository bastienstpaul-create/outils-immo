// Page détaillée d'un coup de cœur : rejoue l'analyse complète à partir de l'instantané
// (bien + paramètres + stratégie) enregistré. Exploration locale (bascule de stratégie,
// choix de scénario) sans impacter l'analyse en direct.

import { useMemo, useState } from 'react'
import type { Strategy } from '../engine/finance.ts'
import { computeAllScenarios } from '../engine/finance.ts'
import { evaluate } from '../engine/rules.ts'
import { buildQuestions } from '../logic/questions.ts'
import type { Favorite } from '../state/favorites.ts'
import { eur } from '../format.ts'

import { VerdictPanel } from './VerdictPanel.tsx'
import { ComparaisonPanel } from './ComparaisonPanel.tsx'
import { ScenarioTable } from './ScenarioTable.tsx'
import { ProjectionPanel } from './ProjectionPanel.tsx'
import { ExitPanel } from './ExitPanel.tsx'

type Props = {
  favori: Favorite
  onRetour: () => void
  onCharger: (f: Favorite) => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR')
}

export function FavoriDetail({ favori, onRetour, onCharger }: Props) {
  const snap = favori.snapshot
  const [strategie, setStrategie] = useState<Strategy>(snap?.strategie ?? favori.strategie ?? 'sci-is')

  // Hooks toujours appelés (règles des hooks) : valeurs neutres si pas d'instantané.
  const property = snap?.property
  const params = snap?.params
  const scenarios = useMemo(
    () => (property && params ? computeAllScenarios(property, params, strategie) : []),
    [property, params, strategie],
  )
  const evaluation = useMemo(
    () => (property && params ? evaluate(scenarios, property, params) : null),
    [scenarios, property, params],
  )
  const questions = useMemo(() => (property ? buildQuestions(property) : []), [property])

  const titre =
    [favori.arrondissement || null, favori.surface ? `${favori.surface} m²` : null, favori.prix ? eur(favori.prix) : null]
      .filter(Boolean)
      .join(' · ') || 'Bien sans détail'

  return (
    <div className="detail">
      <div className="detail__bar">
        <button type="button" className="btn btn--ghost" onClick={onRetour}>
          ‹ Retour au carnet
        </button>
        <div className="detail__title">
          <strong>{titre}</strong>
          <span className="detail__date">enregistré le {formatDate(favori.savedAt)}</span>
        </div>
        {snap && (
          <button type="button" className="btn btn--primary" onClick={() => onCharger(favori)}>
            Charger dans l'analyse
          </button>
        )}
      </div>

      {favori.url && (
        <a className="detail__link" href={favori.url} target="_blank" rel="noreferrer noopener">
          {favori.url}
        </a>
      )}
      {favori.note && <p className="detail__note">Note : {favori.note}</p>}

      {!snap || !property || !params || !evaluation ? (
        <section className="panel">
          <p className="panel__hint">
            Analyse détaillée indisponible : ce coup de cœur a été enregistré avant l'ajout de cette
            fonctionnalité. Les nouveaux enregistrements gardent l'analyse complète.
          </p>
        </section>
      ) : (
        <>
          <div className="strat" role="group" aria-label="Stratégie">
            <span className="strat__lbl">Stratégie</span>
            <div className="strat__toggle">
              <button
                type="button"
                className={`strat__opt${strategie === 'sci-is' ? ' strat__opt--on' : ''}`}
                onClick={() => setStrategie('sci-is')}
              >
                SCI à l'IS
              </button>
              <button
                type="button"
                className={`strat__opt${strategie === 'nom-propre' ? ' strat__opt--on' : ''}`}
                onClick={() => setStrategie('nom-propre')}
              >
                Nom propre
              </button>
            </div>
          </div>

          <VerdictPanel evaluation={evaluation} questions={questions} onSave={() => {}} dejaEnregistre />
          <ComparaisonPanel
            property={property}
            params={params}
            meilleurKey={evaluation.meilleurScenario?.def.key ?? null}
            strategieActive={strategie}
            onChoisir={setStrategie}
          />
          <ScenarioTable
            scenarios={scenarios}
            params={params}
            strategie={strategie}
            meilleurKey={evaluation.meilleurScenario?.def.key ?? null}
          />
          <ProjectionPanel
            property={property}
            params={params}
            scenarios={scenarios}
            strategie={strategie}
            meilleurKey={evaluation.meilleurScenario?.def.key ?? null}
          />
          <ExitPanel
            property={property}
            params={params}
            strategie={strategie}
            meilleurKey={evaluation.meilleurScenario?.def.key ?? null}
          />
        </>
      )}
    </div>
  )
}
