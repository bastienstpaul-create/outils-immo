// 3 questions à poser à l'agent, choisies selon les drapeaux du bien (v1 templatée).
// En v2, ces questions seront générées par le LLM à partir du contexte de l'annonce.

import type { Property } from '../state/property.ts'

type QuestionCandidate = { priorite: number; texte: string }

export function buildQuestions(prop: Property): string[] {
  const candidats: QuestionCandidate[] = []

  if (prop.occupe) {
    candidats.push({
      priorite: 0,
      texte:
        'Le bien peut-il être livré vacant ? Sinon, à quelle échéance un congé (vente/reprise) est-il possible et quel est le loyer réel du bail en cours ?',
    })
  }

  if (prop.copropriete && prop.divisionEnvisagee) {
    candidats.push({
      priorite: 1,
      texte:
        'Le règlement de copropriété autorise-t-il la division ? Une AG a-t-elle déjà voté des travaux ou refusé une seconde porte palière ?',
    })
  }

  if (prop.copropriete) {
    candidats.push({
      priorite: 2,
      texte: 'Quel est le montant annuel des charges de copropriété et quels travaux ont été votés en AG ?',
    })
  }

  if (prop.divisionEnvisagee) {
    candidats.push({
      priorite: 2,
      texte:
        'Peut-on créer des accès et des compteurs (eau/élec) séparés pour chaque lot, et l’évacuation des eaux usées le permet-elle ?',
    })
  }

  // Questions systématiques (priorité basse : ne passent qu'à défaut de plus urgent).
  candidats.push({ priorite: 4, texte: 'Quel est le montant exact de la taxe foncière ?' })
  candidats.push({ priorite: 4, texte: 'La surface Carrez est-elle certifiée par un diagnostic récent ?' })
  candidats.push({
    priorite: 5,
    texte: 'Quel est le DPE, et quels travaux (ravalement, toiture, mise aux normes) sont à prévoir ?',
  })

  candidats.sort((a, b) => a.priorite - b.priorite)
  return candidats.slice(0, 3).map((c) => c.texte)
}
