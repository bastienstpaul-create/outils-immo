import { useEffect, useMemo, useState } from 'react'
import './App.css'

import type { Params } from './state/params.ts'
import { loadParams, saveParams, DEFAULT_PARAMS } from './state/params.ts'
import type { Property } from './state/property.ts'
import { DEFAULT_PROPERTY } from './state/property.ts'
import { computeAllScenarios } from './engine/finance.ts'
import { evaluate } from './engine/rules.ts'
import { extractFromText } from './parse/extract.ts'
import { decodeBase64Utf8, buildImport } from './parse/importAd.ts'
import type { AdPayload } from './parse/importAd.ts'
import { buildQuestions } from './logic/questions.ts'

import { ImportBar } from './components/ImportBar.tsx'
import { AdInput } from './components/AdInput.tsx'
import { PropertyForm } from './components/PropertyForm.tsx'
import { ParamsPanel } from './components/ParamsPanel.tsx'
import { ScenarioTable } from './components/ScenarioTable.tsx'
import { ProjectionPanel } from './components/ProjectionPanel.tsx'
import { VerdictPanel } from './components/VerdictPanel.tsx'

export default function App() {
  const [params, setParams] = useState<Params>(() => loadParams())
  const [property, setProperty] = useState<Property>(DEFAULT_PROPERTY)
  const [adText, setAdText] = useState('')
  const [found, setFound] = useState<(keyof Property)[]>([])
  const [nbTrouves, setNbTrouves] = useState<number | null>(null)

  // Persistance des paramètres calibrés (uniquement les paramètres, pas les annonces).
  useEffect(() => {
    saveParams(params)
  }, [params])

  // Import 1-clic : le bookmarklet ouvre l'app avec les données de l'annonce dans le hash (#ad=…).
  useEffect(() => {
    const m = window.location.hash.match(/#ad=(.+)$/)
    if (!m) return
    try {
      const payload = JSON.parse(decodeBase64Utf8(decodeURIComponent(m[1]))) as AdPayload
      const { adText: importedText, patch, found: foundImported } = buildImport(payload)
      setAdText(importedText)
      setProperty((prev) => ({ ...prev, ...patch }))
      setFound(foundImported)
      setNbTrouves(foundImported.length)
    } catch {
      // payload illisible : on ignore, l'app reste utilisable en copier-coller.
    } finally {
      // Nettoie le hash pour qu'un rechargement ne ré-importe pas.
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  // Recalcul live : toute modif de bien ou de paramètre recalcule tout, sans réseau.
  const scenarios = useMemo(() => computeAllScenarios(property, params), [property, params])
  const evaluation = useMemo(() => evaluate(scenarios, property, params), [scenarios, property, params])
  const questions = useMemo(() => buildQuestions(property), [property])

  function patchParams(patch: Partial<Params>) {
    setParams((prev) => ({ ...prev, ...patch }))
  }
  function patchProperty(patch: Partial<Property>) {
    setProperty((prev) => ({ ...prev, ...patch }))
  }
  function resetParams() {
    setParams({ ...DEFAULT_PARAMS })
  }

  function analyser() {
    const { champsTrouves, ...patch } = extractFromText(adText)
    setProperty((prev) => ({ ...prev, ...patch }))
    setFound(champsTrouves)
    setNbTrouves(champsTrouves.length)
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>Qualification d'annonces — SCI à l'IS · Marseille</h1>
        <p>
          Colle une annonce, vérifie les faits, lis le verdict. Calcul déterministe, sans plus-value :
          uniquement du cash-flow.
        </p>
      </header>

      <main className="layout">
        <div className="layout__inputs">
          <ImportBar />
          <AdInput
            texte={adText}
            onTexteChange={setAdText}
            onAnalyser={analyser}
            nbChampsTrouves={nbTrouves}
          />
          <PropertyForm property={property} found={found} onChange={patchProperty} />
        </div>

        <div className="layout__results">
          <VerdictPanel evaluation={evaluation} questions={questions} />
          <ScenarioTable
            scenarios={scenarios}
            params={params}
            meilleurKey={evaluation.meilleurScenario?.def.key ?? null}
          />
          <ProjectionPanel
            property={property}
            params={params}
            scenarios={scenarios}
            meilleurKey={evaluation.meilleurScenario?.def.key ?? null}
          />
        </div>
      </main>

      <ParamsPanel params={params} onChange={patchParams} onReset={resetParams} />

      <footer className="app__footer">
        v1 locale · aucune donnée ne quitte cet appareil · les hypothèses de marché (loyer/m², vacance)
        se saisissent à la main — la recherche web automatique viendra en v2.
      </footer>
    </div>
  )
}
