// Carnet de « coups de cœur » : annonces qu'on veut garder sous le coude (surtout les
// « À CREUSER »). 100 % local, persisté en localStorage — rien ne quitte l'appareil.

import type { Verdict } from '../engine/rules.ts'

export type Favorite = {
  id: string
  savedAt: string // ISO 8601
  url: string // lien de l'annonce (peut être vide si saisie manuelle sans lien)
  verdict: Verdict // verdict au moment de l'enregistrement
  prix: number
  surface: number
  pieces: number | null
  arrondissement: string
  meilleurLabel: string | null // libellé du meilleur scénario retenu, si viable
  cfApresIS: number | null // €/mois du meilleur scénario (après IS, année 1)
  rdtBrut: number | null // % du meilleur scénario
  note: string // annotation libre de l'utilisateur
}

const STORAGE_KEY = 'oai.favorites.v1'

export function loadFavorites(): Favorite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Favorite[]) : []
  } catch {
    return []
  }
}

export function saveFavorites(list: Favorite[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // localStorage indisponible (mode privé) : on ignore, l'app reste fonctionnelle.
  }
}

// Export CSV téléchargeable, pour ranger le carnet hors de l'app.
export function favoritesToCsv(list: Favorite[]): string {
  const head = [
    'Enregistré le',
    'Verdict',
    'Arrondissement',
    'Prix (€)',
    'Surface (m²)',
    'Pièces',
    'Meilleur scénario',
    'CF après IS (€/mois)',
    'Rdt brut (%)',
    'Note',
    'Lien',
  ]
  const cell = (v: string | number | null): string => {
    const s = v == null ? '' : String(v)
    // Échappement CSV : guillemets doublés, champ entre guillemets si nécessaire.
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = list.map((f) =>
    [
      f.savedAt,
      f.verdict,
      f.arrondissement,
      f.prix,
      f.surface,
      f.pieces,
      f.meilleurLabel,
      f.cfApresIS == null ? '' : Math.round(f.cfApresIS),
      f.rdtBrut == null ? '' : f.rdtBrut.toFixed(1),
      f.note,
      f.url,
    ]
      .map(cell)
      .join(';'),
  )
  return [head.join(';'), ...rows].join('\n')
}
