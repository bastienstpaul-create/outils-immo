import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

import type { Params } from './state/params.ts'
import { loadParams, saveParams, DEFAULT_PARAMS } from './state/params.ts'
import type { Property } from './state/property.ts'
import { DEFAULT_PROPERTY } from './state/property.ts'
import type { Strategy } from './engine/finance.ts'
import { computeAllScenarios } from './engine/finance.ts'
import { evaluate } from './engine/rules.ts'
import { extractFromText } from './parse/extract.ts'
import { decodeBase64Utf8, buildImport } from './parse/importAd.ts'
import type { AdPayload } from './parse/importAd.ts'
import { buildQuestions } from './logic/questions.ts'
import type { Favorite } from './state/favorites.ts'
import { loadFavorites, saveFavorites } from './state/favorites.ts'
import { isExtension, readIncomingAd, subscribeIncomingAd } from './platform/ext.ts'

import { ImportBar } from './components/ImportBar.tsx'
import { AdInput } from './components/AdInput.tsx'
import { PropertyForm } from './components/PropertyForm.tsx'
import { ParamsPanel } from './components/ParamsPanel.tsx'
import { ScenarioTable } from './components/ScenarioTable.tsx'
import { ProjectionPanel } from './components/ProjectionPanel.tsx'
import { ComparaisonPanel } from './components/ComparaisonPanel.tsx'
import { ExitPanel } from './components/ExitPanel.tsx'
import { VerdictPanel } from './components/VerdictPanel.tsx'
import { FavoritesPanel } from './components/FavoritesPanel.tsx'
import { FavoriDetail } from './components/FavoriDetail.tsx'

const STRATEGIE_KEY = 'oai.strategie.v1'

export default function App() {
  const [params, setParams] = useState<Params>(() => loadParams())
  const [property, setProperty] = useState<Property>(DEFAULT_PROPERTY)
  const [adText, setAdText] = useState('')
  const [found, setFound] = useState<(keyof Property)[]>([])
  const [nbTrouves, setNbTrouves] = useState<number | null>(null)
  const [favorites, setFavorites] = useState<Favorite[]>(() => loadFavorites())
  const [strategie, setStrategie] = useState<Strategy>(
    () => (localStorage.getItem(STRATEGIE_KEY) as Strategy) || 'sci-is',
  )
  // Navigation : page d'analyse, carnet (liste), ou détail d'un coup de cœur.
  const [vue, setVue] = useState<'analyse' | 'carnet'>('analyse')
  const [favoriOuvert, setFavoriOuvert] = useState<Favorite | null>(null)

  // Persistance des paramètres calibrés (uniquement les paramètres, pas les annonces).
  useEffect(() => {
    saveParams(params)
  }, [params])

  // Persistance de la stratégie active.
  useEffect(() => {
    try {
      localStorage.setItem(STRATEGIE_KEY, strategie)
    } catch {
      // localStorage indisponible : on ignore.
    }
  }, [strategie])

  // Persistance du carnet de coups de cœur.
  useEffect(() => {
    saveFavorites(favorites)
  }, [favorites])

  // Applique une annonce importée (depuis le bookmarklet web ou l'extension) aux champs.
  const appliquerPayload = useCallback((payload: AdPayload) => {
    const { adText: importedText, patch, found: foundImported } = buildImport(payload)
    setAdText(importedText)
    setProperty((prev) => ({ ...prev, ...patch }))
    setFound(foundImported)
    setNbTrouves(foundImported.length)
  }, [])

  // Import 1-clic. Web : le bookmarklet passe les données dans le hash (#ad=…).
  // Extension : le service worker les dépose dans chrome.storage (au 1er rendu + à chaque annonce).
  useEffect(() => {
    const m = window.location.hash.match(/#ad=(.+)$/)
    if (m) {
      try {
        appliquerPayload(JSON.parse(decodeBase64Utf8(decodeURIComponent(m[1]))) as AdPayload)
      } catch {
        // payload illisible : on ignore, l'app reste utilisable en copier-coller.
      }
      // Nettoie le hash pour qu'un rechargement ne ré-importe pas.
      window.history.replaceState(null, '', window.location.pathname)
    }
    readIncomingAd().then((p) => {
      if (p) appliquerPayload(p)
    })
    subscribeIncomingAd(appliquerPayload)
  }, [appliquerPayload])

  // Recalcul live : toute modif de bien, paramètre ou stratégie recalcule tout, sans réseau.
  const scenarios = useMemo(
    () => computeAllScenarios(property, params, strategie),
    [property, params, strategie],
  )
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

  // Un coup de cœur est identifié par son lien : on évite d'enregistrer deux fois la même annonce.
  const urlNettoyee = property.url.trim()
  const dejaEnregistre = urlNettoyee !== '' && favorites.some((f) => f.url === urlNettoyee)

  function enregistrerFavori() {
    if (dejaEnregistre) return
    const best = evaluation.meilleurScenario
    const fav: Favorite = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      url: urlNettoyee,
      verdict: evaluation.verdict,
      prix: property.prix,
      surface: property.surface,
      pieces: property.pieces,
      arrondissement: property.arrondissement,
      meilleurLabel: best?.def.label ?? null,
      cfApresImpot: best ? best.cfApresImpot : null,
      rdtBrut: best ? best.rdtBrut : null,
      strategie,
      regimeLabel: best?.regimeLabel ?? null,
      snapshot: { property, params, strategie },
      note: '',
    }
    setFavorites((prev) => [fav, ...prev])
  }
  function retirerFavori(id: string) {
    setFavorites((prev) => prev.filter((f) => f.id !== id))
    setFavoriOuvert((cur) => (cur?.id === id ? null : cur))
  }
  function modifierNote(id: string, note: string) {
    setFavorites((prev) => prev.map((f) => (f.id === id ? { ...f, note } : f)))
  }
  // Charge un coup de cœur dans l'analyse en direct (écrase le bien/params/stratégie courants).
  function chargerFavori(f: Favorite) {
    if (!f.snapshot) return
    setProperty(f.snapshot.property)
    setParams(f.snapshot.params)
    setStrategie(f.snapshot.strategie)
    setFavoriOuvert(null)
    setVue('analyse')
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>Qualification d'annonces · Marseille</h1>
        <p>
          Colle une annonce, vérifie les faits, lis le verdict. Calcul déterministe, en direct et 100 % local.
        </p>
        {vue === 'analyse' && !favoriOuvert && (
          <div className="strat" role="group" aria-label="Stratégie d'acquisition">
            <span className="strat__lbl">Stratégie</span>
            <div className="strat__toggle">
              <button
                type="button"
                className={`strat__opt${strategie === 'sci-is' ? ' strat__opt--on' : ''}`}
                onClick={() => setStrategie('sci-is')}
              >
                SCI à l'IS
              </button>
              <button
                type="button"
                className={`strat__opt${strategie === 'nom-propre' ? ' strat__opt--on' : ''}`}
                onClick={() => setStrategie('nom-propre')}
              >
                Nom propre
              </button>
            </div>
          </div>
        )}
      </header>

      <nav className="nav">
        <button
          type="button"
          className={`nav__tab${vue === 'analyse' && !favoriOuvert ? ' nav__tab--on' : ''}`}
          onClick={() => {
            setFavoriOuvert(null)
            setVue('analyse')
          }}
        >
          Analyse
        </button>
        <button
          type="button"
          className={`nav__tab${vue === 'carnet' || favoriOuvert ? ' nav__tab--on' : ''}`}
          onClick={() => {
            setFavoriOuvert(null)
            setVue('carnet')
          }}
        >
          Mes coups de cœur{favorites.length > 0 ? ` (${favorites.length})` : ''}
        </button>
      </nav>

      {favoriOuvert ? (
        <FavoriDetail favori={favoriOuvert} onRetour={() => setFavoriOuvert(null)} onCharger={chargerFavori} />
      ) : vue === 'carnet' ? (
        <FavoritesPanel
          favorites={favorites}
          onRemove={retirerFavori}
          onUpdateNote={modifierNote}
          onOpen={setFavoriOuvert}
        />
      ) : (
        <>
      <main className="layout">
        <div className="layout__inputs">
          {!isExtension && <ImportBar />}
          <AdInput
            texte={adText}
            onTexteChange={setAdText}
            onAnalyser={analyser}
            nbChampsTrouves={nbTrouves}
          />
          <PropertyForm property={property} found={found} onChange={patchProperty} />
        </div>

        <div className="layout__results">
          <VerdictPanel
            evaluation={evaluation}
            questions={questions}
            onSave={enregistrerFavori}
            dejaEnregistre={dejaEnregistre}
          />
          <ComparaisonPanel
            property={property}
            params={params}
            meilleurKey={evaluation.meilleurScenario?.def.key ?? null}
            strategieActive={strategie}
            onChoisir={setStrategie}
          />
          <ScenarioTable
            scenarios={scenarios}
            params={params}
            strategie={strategie}
            meilleurKey={evaluation.meilleurScenario?.def.key ?? null}
          />
          <ProjectionPanel
            property={property}
            params={params}
            scenarios={scenarios}
            strategie={strategie}
            meilleurKey={evaluation.meilleurScenario?.def.key ?? null}
          />
          <ExitPanel
            property={property}
            params={params}
            strategie={strategie}
            meilleurKey={evaluation.meilleurScenario?.def.key ?? null}
          />
        </div>
      </main>

          <ParamsPanel params={params} onChange={patchParams} onReset={resetParams} />
        </>
      )}

      <footer className="app__footer">
        v1 locale · aucune donnée ne quitte cet appareil · les hypothèses de marché (loyer/m², vacance)
        se saisissent à la main — la recherche web automatique viendra en v2.
      </footer>
    </div>
  )
}
