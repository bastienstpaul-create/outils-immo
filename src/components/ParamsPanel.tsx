// Panneau de paramètres de calibration. Construit depuis PARAM_GROUPS (aucune valeur codée en dur).

import type { Params } from '../state/params.ts'
import { PARAM_GROUPS, DEFAULT_PARAMS } from '../state/params.ts'
import { NumberField } from './Fields.tsx'

type Props = {
  params: Params
  onChange: (patch: Partial<Params>) => void
  onReset: () => void
}

export function ParamsPanel({ params, onChange, onReset }: Props) {
  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Paramètres</h2>
        <button className="btn btn--ghost" onClick={onReset} title="Revenir aux valeurs par défaut">
          Réinitialiser
        </button>
      </div>
      <p className="panel__hint">
        Recalibre librement — tout est pris en compte instantanément et mémorisé sur cet appareil.
      </p>

      {PARAM_GROUPS.map((group) => (
        <fieldset key={group.title} className="paramgroup">
          <legend>{group.title}</legend>
          <div className="grid grid--params">
            {group.fields.map((f) => (
              <NumberField
                key={f.key}
                label={f.label}
                unit={f.unit}
                step={f.step}
                value={params[f.key]}
                onChange={(v) => onChange({ [f.key]: v } as Partial<Params>)}
              />
            ))}
          </div>
        </fieldset>
      ))}

      <p className="panel__default">
        Défauts : loyer micro-lot {DEFAULT_PARAMS.loyerMicroLot} €/m², perte cloison{' '}
        {DEFAULT_PARAMS.pertesCloison} m², découpe {DEFAULT_PARAMS.coutDecoupe} €.
      </p>
    </section>
  )
}
