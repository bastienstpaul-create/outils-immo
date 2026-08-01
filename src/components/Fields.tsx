// Petits champs réutilisables. Un input numérique renvoie toujours un number.

type NumberFieldProps = {
  label: string
  unit?: string
  value: number
  onChange: (v: number) => void
  step?: number
  highlight?: boolean // signale un champ pré-rempli par l'extraction
}

export function NumberField({ label, unit, value, onChange, step, highlight }: NumberFieldProps) {
  return (
    <label className={`field${highlight ? ' field--found' : ''}`}>
      <span className="field__label">
        {label}
        {unit ? <em className="field__unit"> {unit}</em> : null}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={step ?? 'any'}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        onFocus={(e) => e.target.select()}
      />
    </label>
  )
}

type TextFieldProps = {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  highlight?: boolean
}

export function TextField({ label, value, onChange, placeholder, highlight }: TextFieldProps) {
  return (
    <label className={`field${highlight ? ' field--found' : ''}`}>
      <span className="field__label">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

type CheckFieldProps = {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}

export function CheckField({ label, checked, onChange }: CheckFieldProps) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
