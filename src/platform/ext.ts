// Adaptateur « plateforme » : selon qu'on tourne dans le site web ou dans l'extension
// Chrome, la source d'une annonce entrante diffère (hash d'URL vs chrome.storage).
// Le reste de l'app (moteur, UI) est strictement identique.

import type { AdPayload } from '../parse/importAd.ts'

const INCOMING_KEY = 'oai.incomingAd'

// Vrai uniquement dans le contexte d'une extension (panneau latéral).
export const isExtension =
  typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local

// Lit une annonce déposée par le service worker, puis la consomme (pour ne pas ré-importer).
export async function readIncomingAd(): Promise<AdPayload | null> {
  if (!isExtension) return null
  try {
    const data = await chrome.storage.local.get(INCOMING_KEY)
    const payload = data[INCOMING_KEY] as AdPayload | undefined
    if (!payload) return null
    await chrome.storage.local.remove(INCOMING_KEY)
    return payload
  } catch {
    return null
  }
}

// S'abonne aux annonces déposées pendant que le panneau est déjà ouvert (nouvelle annonce visitée).
export function subscribeIncomingAd(cb: (payload: AdPayload) => void): void {
  if (!isExtension) return
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    const change = changes[INCOMING_KEY]
    if (change && change.newValue) {
      cb(change.newValue as AdPayload)
      chrome.storage.local.remove(INCOMING_KEY)
    }
  })
}
