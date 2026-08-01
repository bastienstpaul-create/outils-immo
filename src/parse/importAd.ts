// Traite le payload envoyé par le bookmarklet (données lues sur la page LBC/SeLoger ouverte).
// Les champs structurés (fiables) priment ; le texte visible sert de filet via l'extracteur regex.

import type { Property } from '../state/property.ts'
import { extractFromText } from './extract.ts'

// Ce que le bookmarklet transmet. Tout est optionnel : selon le site, on a plus ou moins.
export type AdPayload = {
  url?: string
  title?: string
  description?: string
  text?: string // texte visible de la page (fallback)
  prix?: number
  surface?: number
  pieces?: number
  cp?: string | number // code postal
}

export type ImportResult = {
  adText: string
  patch: Partial<Property>
  found: (keyof Property)[]
}

// Décode une chaîne base64 (UTF-8) sans fonctions dépréciées.
export function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function buildImport(payload: AdPayload): ImportResult {
  const adText = [payload.title, payload.description, payload.text].filter(Boolean).join('\n')

  // 1) Extraction regex sur le texte visible : remplit ce qui peut l'être.
  const { champsTrouves, ...regexPatch } = extractFromText(adText)
  const patch: Partial<Property> = { ...regexPatch }
  const found = new Set<keyof Property>(champsTrouves)

  // 2) Champs structurés du site : plus fiables, ils écrasent la regex.
  if (typeof payload.prix === 'number' && payload.prix > 10000) {
    patch.prix = Math.round(payload.prix)
    found.add('prix')
  }
  if (typeof payload.surface === 'number' && payload.surface > 5) {
    patch.surface = payload.surface
    found.add('surface')
  }
  if (typeof payload.pieces === 'number' && payload.pieces > 0) {
    patch.pieces = payload.pieces
    found.add('pieces')
  }
  if (payload.cp != null && String(payload.cp).length >= 4) {
    patch.arrondissement = String(payload.cp)
    found.add('arrondissement')
  }
  if (typeof payload.url === 'string' && /^https?:\/\//.test(payload.url)) {
    patch.url = payload.url
    found.add('url')
  }

  return { adText, patch, found: [...found] }
}
