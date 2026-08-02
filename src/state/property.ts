// Faits du bien analysé — saisis à la main (pré-remplis par regex depuis l'annonce).
// Change à chaque deal, donc séparé des paramètres de calibration.

export type Property = {
  prix: number // prix FAI affiché, €
  surface: number // surface habitable, m²
  pieces: number | null // nombre de pièces (T2 → 2)
  arrondissement: string // ex. "13008" (indicatif, sert au repérage en v2)
  url: string // lien de l'annonce (rempli par l'import, éditable) — sert aux coups de cœur
  travaux: number // budget travaux estimé, €
  apport: number // apport personnel, € (0 = financement à 110 %)
  taxeFonciere: number // taxe foncière, €/an
  loyerActuel: number | null // loyer affiché dans l'annonce (info, non utilisé dans les calculs)

  occupe: boolean // bien vendu occupé → baux prorogés 6 ans en société
  copropriete: boolean // en copropriété
  divisionEnvisagee: boolean // on envisage de créer des lots
  nbLogementsImmeuble: number | null // si immeuble entier : nb de logements (préemption > 5)

  // --- Hypothèses de sortie (revente / refinancement) ---
  dureeDetentionRevente: number // durée de détention avant revente, années
  valeurReventeAttendue: number | null // valeur estimée à la sortie, € (null → dérivée par appréciation)
  tauxAppreciationAn: number // appréciation annuelle du bien, %/an
  anneeRefi: number // année du refinancement (0 = pas de refi)
  refiLtvOverride: number | null // LTV spécifique au refi, % (null → valeur des paramètres)
}

export const DEFAULT_PROPERTY: Property = {
  prix: 0,
  surface: 0,
  pieces: null,
  arrondissement: '',
  url: '',
  travaux: 0,
  apport: 0,
  taxeFonciere: 0,
  loyerActuel: null,
  occupe: false,
  copropriete: true, // en ville, la copropriété est le cas le plus fréquent
  divisionEnvisagee: false,
  nbLogementsImmeuble: null,

  dureeDetentionRevente: 10,
  valeurReventeAttendue: null,
  tauxAppreciationAn: 0,
  anneeRefi: 0,
  refiLtvOverride: null,
}
