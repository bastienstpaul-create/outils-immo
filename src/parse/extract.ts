// Pré-extraction 100 % déterministe (regex) du texte d'annonce collé ou importé.
// Objectif : pré-remplir le formulaire. L'utilisateur corrige toujours.
// Aucun appel réseau, aucun LLM.
//
// Deux pièges d'une page leboncoin/SeLoger, gérés ici :
//  1) la page contient une liste d'ANNONCES RECOMMANDÉES en bas → on coupe avant.
//  2) les faits utiles ont des LIBELLÉS stables (« Prix du bien », « Surface habitable »…)
//     → on s'ancre dessus plutôt que de deviner.

import type { Property } from '../state/property.ts'

export type Extraction = Partial<Property> & {
  champsTrouves: (keyof Property)[]
}

// "185 000 €" / "185.000" / "43 823" (espaces fines/insécables incluses) → 185000
function parseNombre(s: string): number {
  return Number(s.replace(/[^\d]/g, '')) || 0
}

// Coupe le texte avant la première section de recommandations / autres annonces.
// Tout ce qui suit ces marqueurs concerne d'AUTRES biens et pollue l'extraction.
function cropToAd(t: string): string {
  const marqueurs =
    /(Les annonces de ce pro|Ces annonces peuvent|Annonces Google|Voir plus d.annonces|Ignorer la liste|Autres annonces)/i
  const m = t.search(marqueurs)
  return m > 0 ? t.slice(0, m) : t
}

// Cherche une valeur numérique suivant un libellé, dans un court intervalle.
function valeurApresLibelle(t: string, libelle: string): number | null {
  const re = new RegExp(libelle + '[^\\d€%]{0,15}(\\d[\\d\\s\\u00a0\\u202f.]*)', 'i')
  const m = t.match(re)
  if (!m) return null
  const v = parseNombre(m[1])
  return v > 0 ? v : null
}

export function extractFromText(texteBrut: string): Extraction {
  const t = cropToAd(texteBrut || '')
  const champs: (keyof Property)[] = []
  const out: Partial<Property> = {}

  // --- Prix : d'abord le libellé « Prix du bien », sinon le 1er montant € plausible. ---
  let prix = valeurApresLibelle(t, 'Prix du bien') ?? valeurApresLibelle(t, 'Prix de vente')
  if (prix == null || prix < 10000) {
    // Fallback : PREMIER prix de la page (le prix de l'annonce est en haut), pas le plus gros.
    const m = t.match(/(\d[\d\s  .]{3,})\s*€/)
    if (m) {
      const v = parseNombre(m[1])
      if (v > 10000) prix = v
    }
  }
  if (prix != null && prix > 10000) {
    out.prix = prix
    champs.push('prix')
  }

  // --- Surface : « Surface habitable », sinon « Surface », sinon 1er « … m² ». ---
  const surfLabel =
    t.match(/Surface habitable[^\d]{0,15}(\d{1,4}(?:[.,]\d{1,2})?)\s*m(?:²|2|\^2)/i) ??
    t.match(/Surface[^\d]{0,15}(\d{1,4}(?:[.,]\d{1,2})?)\s*m(?:²|2|\^2)/i) ??
    t.match(/(\d{1,4}(?:[.,]\d{1,2})?)\s*m(?:²|2|\^2)(?![\d.,])/i)
  if (surfLabel) {
    const val = Number(surfLabel[1].replace(',', '.'))
    if (val > 5 && val < 5000) {
      out.surface = val
      champs.push('surface')
    }
  }

  // --- Pièces : « Nombre de pièces » (≠ salles de bain), sinon « T3 »/« F3 », sinon « 3 pièces ». ---
  const nbP = t.match(/Nombre de pi[eè]ces[^\d]{0,10}(\d{1,2})/i)
  const tMatch = t.match(/\b[TF](\d)\b/i)
  const piecesTxt = t.match(/(\d)\s*pi[eè]ces?/i)
  if (nbP) {
    out.pieces = Number(nbP[1])
    champs.push('pieces')
  } else if (tMatch) {
    out.pieces = Number(tMatch[1])
    champs.push('pieces')
  } else if (piecesTxt) {
    out.pieces = Number(piecesTxt[1])
    champs.push('pieces')
  }

  // --- Code postal (France entière, plus seulement Marseille) : 1er code à 5 chiffres. ---
  const cp = t.match(/\b(\d{5})\b/)
  if (cp) {
    out.arrondissement = cp[1]
    champs.push('arrondissement')
  }

  // --- Taxe foncière : « Taxe foncière … 327 € ». ---
  const tf = valeurApresLibelle(t, 'Taxe fonci[eè]re')
  if (tf != null && tf > 50 && tf < 50000) {
    out.taxeFonciere = tf
    champs.push('taxeFonciere')
  }

  // --- Occupé / loué (bail commercial et loyer garanti = bien déjà loué). ---
  if (/\b(lou[ée]|occup[ée]e?|bail en cours|bail commercial|locataire en place|loyer garanti|actuellement lou)/i.test(t)) {
    out.occupe = true
    champs.push('occupe')
  }

  // --- Copropriété. ---
  if (/copropri[ée]t[ée]|charges de copro|syndic|lot(?:s)? de copropri/i.test(t)) {
    out.copropriete = true
    champs.push('copropriete')
  }

  // --- Loyer affiché (info) : « loyer 650 € », « 2750 € net … de loyer ». ---
  const loyerMatch =
    t.match(/loyer[^\d€]{0,15}(\d[\d\s  . ]{1,6})\s*€/i) ??
    t.match(/(\d[\d\s  . ]{1,6})\s*€[^.]{0,20}de loyer/i)
  if (loyerMatch) {
    const val = parseNombre(loyerMatch[1])
    if (val > 100 && val < 20000) {
      out.loyerActuel = val
      champs.push('loyerActuel')
    }
  }

  return { ...out, champsTrouves: champs }
}
