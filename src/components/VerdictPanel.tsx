// Verdict GO / À CREUSER / STOP, drapeaux rouges, et 3 questions à poser à l'agent.

import type { Evaluation } from '../engine/rules.ts'

type Props = {
  evaluation: Evaluation
  questions: string[]
}

const VERDICT_CLASS: Record<Evaluation['verdict'], string> = {
  GO: 'verdict--go',
  'À CREUSER': 'verdict--maybe',
  STOP: 'verdict--stop',
}

export function VerdictPanel({ evaluation, questions }: Props) {
  const { verdict, raisons, flags } = evaluation

  return (
    <section className="panel">
      <div className={`verdict ${VERDICT_CLASS[verdict]}`}>
        <span className="verdict__label">{verdict}</span>
        <ul className="verdict__reasons">
          {raisons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      {flags.length > 0 && (
        <div className="flags">
          <h3>Drapeaux</h3>
          {flags.map((f, i) => (
            <div key={i} className={`flag flag--${f.level}`}>
              <span className="flag__dot" aria-hidden />
              <div>
                <strong>{f.titre}</strong>
                <p>{f.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="questions">
        <h3>3 questions à poser à l'agent</h3>
        <ol>
          {questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ol>
      </div>
    </section>
  )
}
