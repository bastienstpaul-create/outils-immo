// Carnet de coups de cœur : liste des annonces mises de côté, avec lien cliquable,
// note libre, suppression, et export CSV. Tout est local (localStorage).

import type { Favorite } from '../state/favorites.ts'
import { favoritesToCsv } from '../state/favorites.ts'
import { eur, eurSigne, pct } from '../format.ts'

type Props = {
  favorites: Favorite[]
  onRemove: (id: string) => void
  onUpdateNote: (id: string, note: string) => void
}

const VERDICT_MODIF: Record<Favorite['verdict'], string> = {
  GO: 'go',
  'À CREUSER': 'maybe',
  STOP: 'stop',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR')
}

export function FavoritesPanel({ favorites, onRemove, onUpdateNote }: Props) {
  function exporterCsv() {
    // BOM ﻿ : Excel ouvre alors le CSV en UTF-8 (accents corrects).
    const blob = new Blob([`﻿${favoritesToCsv(favorites)}`], {
      type: 'text/csv;charset=utf-8;',
    })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = 'coups-de-coeur.csv'
    a.click()
    URL.revokeObjectURL(href)
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Mes coups de cœur {favorites.length > 0 && <span className="fav__count">{favorites.length}</span>}</h2>
        {favorites.length > 0 && (
          <button type="button" className="btn btn--ghost" onClick={exporterCsv}>
            ⬇ Exporter (CSV)
          </button>
        )}
      </div>

      {favorites.length === 0 ? (
        <p className="panel__hint">
          Aucun coup de cœur pour l'instant. Sous un verdict, clique
          « ⭐ Enregistrer dans mes coups de cœur » pour archiver une annonce ici avec son lien.
        </p>
      ) : (
        <ul className="fav__list">
          {favorites.map((f) => {
            const titre =
              [f.arrondissement || null, f.surface ? `${f.surface} m²` : null, f.prix ? eur(f.prix) : null]
                .filter(Boolean)
                .join(' · ') || 'Bien sans détail'
            return (
              <li key={f.id} className="fav">
                <div className="fav__top">
                  <span className={`fav__verdict fav__verdict--${VERDICT_MODIF[f.verdict]}`}>
                    {f.verdict}
                  </span>
                  <span className="fav__titre">{titre}</span>
                  <span className="fav__date">{formatDate(f.savedAt)}</span>
                  <button
                    type="button"
                    className="fav__del"
                    title="Retirer des coups de cœur"
                    aria-label="Retirer"
                    onClick={() => onRemove(f.id)}
                  >
                    ✕
                  </button>
                </div>

                <div className="fav__meta">
                  {f.meilleurLabel ? (
                    <span>
                      {f.meilleurLabel} · CF après IS{' '}
                      <strong className={(f.cfApresIS ?? 0) >= 0 ? 'pos' : 'neg'}>
                        {eurSigne(f.cfApresIS ?? 0)}/mois
                      </strong>
                      {f.rdtBrut != null && <> · brut {pct(f.rdtBrut)}</>}
                    </span>
                  ) : (
                    <span className="muted">Aucun scénario viable retenu</span>
                  )}
                </div>

                {f.url ? (
                  <a className="fav__link" href={f.url} target="_blank" rel="noreferrer noopener">
                    {f.url}
                  </a>
                ) : (
                  <span className="fav__link muted">Lien manquant (ajoute-le dans « Faits du bien »)</span>
                )}

                <input
                  className="fav__note"
                  type="text"
                  value={f.note}
                  placeholder="Note (ex. « rappeler l'agent », « revoir après travaux »)…"
                  onChange={(e) => onUpdateNote(f.id, e.target.value)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
