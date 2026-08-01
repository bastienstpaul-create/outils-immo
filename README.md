# Qualification d'annonces — SCI à l'IS · Marseille

Outil **personnel** de triage rapide d'annonces immobilières. Une seule page, 100 % local :
on colle une annonce, on vérifie les faits, on lit le verdict et les scénarios chiffrés.

Pas de clé API, pas de backend, aucune donnée ne quitte l'appareil (v1).

## Lancer

```bash
npm install     # une seule fois
npm run dev      # http://localhost:5173
npm run build    # build de prod dans dist/ (hébergeable en statique)
```

## Import d'une annonce

Aller *chercher* une URL côté serveur ne marche pas (CORS + anti-bot DataDome de LBC/SeLoger).
On lit donc la page **déjà ouverte** dans le navigateur, via un **bookmarklet** :

1. Lance l'app (`npm run dev`), déplie le panneau « Import 1-clic » et **glisse le favori
   « ⚡ Analyser l'annonce »** dans ta barre de favoris (une seule fois).
2. Sur une annonce leboncoin / SeLoger ouverte, **clique le favori** → l'app se rouvre pré-remplie.

Le favori lit, du plus fiable au filet de sécurité : JSON-LD → `__NEXT_DATA__` (leboncoin) →
balises OpenGraph → **texte visible de la page**. Ce dernier part toujours : si un site change de
format, l'extraction regex reprend le relais. Rien n'est envoyé à un serveur ; le favori pointe vers
l'adresse où tourne l'app (il faut donc que l'app soit lancée). Le bookmarklet se régénère
automatiquement si tu héberges l'app ailleurs.

## Ce que ça fait

- **Import 1-clic** (ci-dessus) ou **coller** le texte brut → pré-extraction (regex) de prix,
  surface, pièces, arrondissement, occupé/copro. **Tout est corrigeable à la main** (la surface, qui
  porte le kill-switch légal, se valide toujours manuellement).
- **4 scénarios** recalculés en direct : en l'état nu, en l'état meublé, 2 lots, 3 lots.
  Colonnes brut → cash-flow avant impôt → cash-flow après IS de la SCI (amortissement + IS 15/25 %).
- **Projection pluriannuelle (« effet ciseau »)** : le cash-flow après IS année par année, sur un
  horizon paramétrable. Les intérêts déductibles baissent et les amortissements s'éteignent → l'IS
  monte et la trésorerie s'érode. Les déficits des premières années sont reportés (report illimité en
  IS). On voit l'année où le CF après IS bascule — c'est elle, pas l'année 1, qui décide.
- **Verdict** GO / À CREUSER / STOP, drapeaux rouges et 3 questions à poser à l'agent.
- **Paramètres** entièrement éditables et mémorisés (localStorage) : loyers/m², taux, durée,
  frais, TF, vacance, amortissements, seuils. Rien n'est codé en dur.

## Règles métier encodées

- Lot créé < 14 m² (art. L111-6-1 CCH) → scénario **barré, jamais retenu**.
- Immeuble > 5 logements → préemption des locataires (loi 31/12/1975) → drapeau rouge.
- Bien vendu occupé → baux prorogés 6 ans en société → drapeau rouge.
- Copropriété + division → 2ᵉ porte palière en AG (art. 25) → à signaler.

## Structure

```
src/
  engine/finance.ts   moteur déterministe (le SEUL endroit qui calcule la finance) — année 1 + projection
  engine/rules.ts     drapeaux + verdict
  parse/extract.ts    pré-extraction regex de l'annonce
  logic/questions.ts  3 questions templatées
  state/params.ts     paramètres + défauts + persistance localStorage
  state/property.ts    faits du bien
  components/          UI (une page) — dont ProjectionPanel (effet ciseau)
  App.tsx             câblage + recalcul live
```

## Limites assumées (v1)

- Les hypothèses de marché (loyer/m² nu & meublé, vacance) se **saisissent à la main**.
  La recherche web automatique avec source citée est prévue en **v2** (proxy + clé Anthropic).
- Le tableau des scénarios trie sur **l'année 1** (intérêts max → IS mini) ; la **projection
  pluriannuelle** (effet ciseau) complète ce triage sur la durée. La projection suppose des loyers,
  charges et taxe foncière **non indexés** (v2 : indexation optionnelle).
- Photos / plan : **affichage seul**, aucune lecture automatique tant qu'il n'y a pas de LLM (v2).
- Historique des annonces / détection des baisses de prix : **v3**.
