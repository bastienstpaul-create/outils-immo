// Carnet de « coups de cœur » : annonces qu'on veut garder sous le coude (surtout les
// « À CREUSER »). 100 % local, persisté en localStorage — rien ne quitte l'appareil.

import type { Verdict } from '../engine/rules.ts'
import type { Strategy } from '../engine/finance.ts'
import type { Property } from './property.ts'
import type { Params } from './params.ts'

// Instantané complet permettant de rejouer l'analyse exacte au clic sur un coup de cœur.
export type FavoriteSnapshot = {
  property: Property
  params: Params
  strategie: Strategy
}

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
  cfApresImpot: number | null // €/mois du meilleur scénario (après impôt, année 1)
  rdtBrut: number | null // % du meilleur scénario
  strategie?: Strategy // stratégie active à l'enregistrement (optionnel : anciens enregistrements)
  regimeLabel?: string | null // régime fiscal retenu (nom propre)
  snapshot?: FavoriteSnapshot // instantané complet (absent des anciens enregistrements)
  note: string // annotation libre de l'utilisateur
}

// Ancien format d'enregistrement (avant la migration multi-stratégie) : le carnet ne
// versionne pas sa clé, donc on tolère `cfApresIS` sur les enregistrements existants.
type FavoriteStored = Partial<Favorite> & { cfApresIS?: number | null }

const STORAGE_KEY = 'oai.favorites.v1'

export function loadFavorites(): Favorite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Normalisation : les anciens enregistrements portent `cfApresIS`.
    return (parsed as FavoriteStored[]).map((f) => ({
      id: f.id ?? crypto.randomUUID(),
      savedAt: f.savedAt ?? new Date(0).toISOString(),
      url: f.url ?? '',
      verdict: f.verdict ?? 'À CREUSER',
      prix: f.prix ?? 0,
      surface: f.surface ?? 0,
      pieces: f.pieces ?? null,
      arrondissement: f.arrondissement ?? '',
      meilleurLabel: f.meilleurLabel ?? null,
      cfApresImpot: f.cfApresImpot ?? f.cfApresIS ?? null,
      rdtBrut: f.rdtBrut ?? null,
      strategie: f.strategie,
      regimeLabel: f.regimeLabel ?? null,
      snapshot: f.snapshot,
      note: f.note ?? '',
    }))
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

const STRATEGIE_CSV: Record<Strategy, string> = { 'sci-is': "SCI à l'IS", 'nom-propre': 'Nom propre' }

// Export CSV téléchargeable, pour ranger le carnet hors de l'app.
export function favoritesToCsv(list: Favorite[]): string {
  const head = [
    'Enregistré le',
    'Verdict',
    'Stratégie',
    'Régime',
    'Arrondissement',
    'Prix (€)',
    'Surface (m²)',
    'Pièces',
    'Meilleur scénario',
    'CF après impôt (€/mois)',
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
      f.strategie ? STRATEGIE_CSV[f.strategie] : '',
      f.regimeLabel ?? '',
      f.arrondissement,
      f.prix,
      f.surface,
      f.pieces,
      f.meilleurLabel,
      f.cfApresImpot == null ? '' : Math.round(f.cfApresImpot),
      f.rdtBrut == null ? '' : f.rdtBrut.toFixed(1),
      f.note,
      f.url,
    ]
      .map(cell)
      .join(';'),
  )
  return [head.join(';'), ...rows].join('\n')
}
