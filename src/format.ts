// Formatage d'affichage (fr-FR). Aucune logique métier ici.

const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const num0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const num1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

export function eur(n: number): string {
  return eur0.format(Math.round(n))
}

// Cash-flow : signe explicite pour lire d'un coup positif/négatif.
export function eurSigne(n: number): string {
  const s = eur0.format(Math.round(Math.abs(n)))
  return n < 0 ? `− ${s}` : `+ ${s}`
}

export function pct(n: number): string {
  return `${num1.format(n)} %`
}

export function m2(n: number): string {
  return `${num1.format(n)} m²`
}

export function nombre(n: number): string {
  return num0.format(n)
}
