// Service worker MV3.
// Au clic sur l'icône : ouvre le panneau latéral, extrait l'annonce de la page active,
// et dépose le résultat dans chrome.storage.local (le panneau React le lit ensuite).
//
// L'extraction tourne dans le « monde isolé » de l'onglet via chrome.scripting :
// contrairement à un bookmarklet javascript:, elle N'EST PAS soumise à la CSP du site.

// Même stratégie de lecture que le bookmarklet du site, du plus fiable au filet de sécurité :
// JSON-LD -> __NEXT_DATA__ (leboncoin) -> OpenGraph -> texte visible de la page.
function extraireAnnonce() {
  try {
    var d = document,
      o = { url: location.href }
    function meta(p) {
      var e = d.querySelector('meta[property="' + p + '"],meta[name="' + p + '"]')
      return e ? e.content : ''
    }
    try {
      var S = d.querySelectorAll('script[type="application/ld+json"]')
      for (var i = 0; i < S.length; i++) {
        var j = JSON.parse(S[i].textContent)
        var A = Array.isArray(j) ? j : j['@graph'] || [j]
        for (var k = 0; k < A.length; k++) {
          var it = A[k]
          if (it && it.offers && it.offers.price && !o.prix) o.prix = parseFloat(it.offers.price)
          if (it && it.price && !o.prix) o.prix = parseFloat(it.price)
        }
      }
    } catch {}
    try {
      var nd = d.getElementById('__NEXT_DATA__')
      if (nd) {
        var n = JSON.parse(nd.textContent),
          pp = (n.props && n.props.pageProps) || {},
          ad = pp.ad || pp.adview || pp.listing
        if (ad) {
          if (!o.prix) o.prix = parseFloat((ad.price && ad.price[0]) || ad.price)
          o.title = ad.subject || o.title
          o.description = ad.body || ad.description
          if (ad.location && ad.location.zipcode) o.cp = ad.location.zipcode
          if (ad.attributes)
            ad.attributes.forEach(function (a) {
              var K = (a.key || '') + ' ' + (a.key_label || '')
              if (/square|surface/i.test(K) && !o.surface) o.surface = parseFloat(a.value)
              if (/rooms|pi.ce/i.test(K) && !o.pieces) o.pieces = parseInt(a.value, 10)
            })
        }
      }
    } catch {}
    o.title = o.title || meta('og:title') || d.title
    if (!o.prix) {
      var pm = meta('product:price:amount')
      if (pm) o.prix = parseFloat(pm)
    }
    var main = d.querySelector('main') || d.body
    var T = main ? main.innerText : ''
    var C = T.search(
      /Les annonces de ce pro|Ces annonces peuvent|Annonces Google|Voir plus d.annonces|Ignorer la liste/i,
    )
    if (C > 0) T = T.slice(0, C)
    o.text = ((o.description || '') + '\n' + T).slice(0, 6000)
    return o
  } catch (err) {
    return { url: location.href, error: String(err) }
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return
  // Ouverture du panneau : doit rester dans le geste utilisateur -> en premier.
  try {
    await chrome.sidePanel.open({ tabId: tab.id })
  } catch {}
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extraireAnnonce,
    })
    if (res && res.result) {
      await chrome.storage.local.set({ 'oai.incomingAd': res.result })
    }
  } catch {
    // Page non extractible (onglet interne, PDF, etc.) : le panneau reste utilisable en saisie manuelle.
  }
})
