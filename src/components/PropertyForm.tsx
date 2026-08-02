// Faits du bien : pré-remplis par l'extraction, corrigeables. Surface saisie à la main
// (elle porte le kill-switch légal, jamais « lue » sur un plan).

import type { Property } from '../state/property.ts'
import { NumberField, TextField, CheckField } from './Fields.tsx'

type Props = {
  property: Property
  found: (keyof Property)[]
  onChange: (patch: Partial<Property>) => void
}

export function PropertyForm({ property, found, onChange }: Props) {
  const isFound = (k: keyof Property) => found.includes(k)

  return (
    <section className="panel">
      <h2>Faits du bien</h2>
      <div className="grid grid--facts">
        <NumberField
          label="Prix FAI"
          unit="€"
          step={1000}
          value={property.prix}
          highlight={isFound('prix')}
          onChange={(v) => onChange({ prix: v })}
        />
        <NumberField
          label="Surface"
          unit="m²"
          step={1}
          value={property.surface}
          highlight={isFound('surface')}
          onChange={(v) => onChange({ surface: v })}
        />
        <NumberField
          label="Pièces"
          unit="T"
          step={1}
          value={property.pieces ?? 0}
          highlight={isFound('pieces')}
          onChange={(v) => onChange({ pieces: v || null })}
        />
        <TextField
          label="Code postal"
          value={property.arrondissement}
          placeholder="13400"
          highlight={isFound('arrondissement')}
          onChange={(v) => onChange({ arrondissement: v })}
        />
        <NumberField
          label="Travaux estimés"
          unit="€"
          step={1000}
          value={property.travaux}
          onChange={(v) => onChange({ travaux: v })}
        />
        <NumberField
          label="Apport"
          unit="€ (0 = 110 %)"
          step={5000}
          value={property.apport}
          onChange={(v) => onChange({ apport: v })}
        />
        <NumberField
          label="Taxe foncière"
          unit="€/an"
          step={50}
          value={property.taxeFonciere}
          highlight={isFound('taxeFonciere')}
          onChange={(v) => onChange({ taxeFonciere: v })}
        />
        <NumberField
          label="Nb logements (immeuble)"
          unit="0 = lot seul"
          step={1}
          value={property.nbLogementsImmeuble ?? 0}
          onChange={(v) => onChange({ nbLogementsImmeuble: v || null })}
        />
        <NumberField
          label="Loyer actuel (info)"
          unit="€/mois"
          step={10}
          value={property.loyerActuel ?? 0}
          highlight={isFound('loyerActuel')}
          onChange={(v) => onChange({ loyerActuel: v || null })}
        />
      </div>

      <div className="field-url">
        <TextField
          label="Lien de l'annonce"
          value={property.url}
          placeholder="https://www.leboncoin.fr/…"
          highlight={isFound('url')}
          onChange={(v) => onChange({ url: v })}
        />
      </div>

      <div className="checks">
        <CheckField
          label="Vendu occupé"
          checked={property.occupe}
          onChange={(v) => onChange({ occupe: v })}
        />
        <CheckField
          label="En copropriété"
          checked={property.copropriete}
          onChange={(v) => onChange({ copropriete: v })}
        />
        <CheckField
          label="Division envisagée"
          checked={property.divisionEnvisagee}
          onChange={(v) => onChange({ divisionEnvisagee: v })}
        />
      </div>
    </section>
  )
}
