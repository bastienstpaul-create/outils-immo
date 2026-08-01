// Barre d'import « 1 clic » : un favori (bookmarklet) à glisser une fois dans la barre du navigateur.
// Sur une annonce LBC/SeLoger ouverte, un clic lit la page et rouvre l'app pré-remplie.
// Aucun serveur : on lit la page déjà chargée (donc DataDome est déjà satisfait), pas de fetch.

import { useEffect, useRef } from 'react'

// Source du bookmarklet. __ORIGIN__ est remplacé par l'adresse de cette app au rendu.
// Stratégie de lecture (du plus fiable au filet de sécurité) :
//   JSON-LD → __NEXT_DATA__ (leboncoin) → balises OpenGraph → texte visible de la page.
// Le texte visible part toujours : si tout le reste échoue, l'extracteur regex de l'app prend le relais.
const SOURCE = `javascript:(function(){try{var d=document,o={url:location.href};function m(p){var e=d.querySelector('meta[property="'+p+'"],meta[name="'+p+'"]');return e?e.content:'';}try{var S=d.querySelectorAll('script[type="application/ld+json"]');for(var i=0;i<S.length;i++){var j=JSON.parse(S[i].textContent);var A=Array.isArray(j)?j:(j['@graph']||[j]);for(var k=0;k<A.length;k++){var it=A[k];if(it&&it.offers&&it.offers.price&&!o.prix)o.prix=parseFloat(it.offers.price);if(it&&it.price&&!o.prix)o.prix=parseFloat(it.price);}}}catch(e){}try{var nd=d.getElementById('__NEXT_DATA__');if(nd){var n=JSON.parse(nd.textContent),pp=(n.props&&n.props.pageProps)||{},ad=pp.ad||pp.adview||pp.listing;if(ad){if(!o.prix)o.prix=parseFloat((ad.price&&ad.price[0])||ad.price);o.title=ad.subject||o.title;o.description=ad.body||ad.description;if(ad.location&&ad.location.zipcode)o.cp=ad.location.zipcode;if(ad.attributes)ad.attributes.forEach(function(a){var K=(a.key||'')+' '+(a.key_label||'');if(/square|surface/i.test(K)&&!o.surface)o.surface=parseFloat(a.value);if(/rooms|pi.ce/i.test(K)&&!o.pieces)o.pieces=parseInt(a.value,10);});}}}catch(e){}o.title=o.title||m('og:title')||d.title;if(!o.prix){var pm=m('product:price:amount');if(pm)o.prix=parseFloat(pm);}var main=d.querySelector('main')||d.body;var T=main?main.innerText:'';var C=T.search(/Les annonces de ce pro|Ces annonces peuvent|Annonces Google|Voir plus d.annonces|Ignorer la liste/i);if(C>0)T=T.slice(0,C);o.text=((o.description||'')+'\\n'+T).slice(0,6000);var pl=btoa(unescape(encodeURIComponent(JSON.stringify(o))));window.open('__ORIGIN__/#ad='+pl,'_blank');}catch(err){alert('Import impossible sur cette page : '+err);}})();`

function buildBookmarklet(origin: string): string {
  return SOURCE.replace('__ORIGIN__', origin)
}

export function ImportBar() {
  const ref = useRef<HTMLAnchorElement>(null)
  // Adresse complète de l'app, chemin de base inclus : en prod l'app est servie sous
  // un sous-dossier (/outils-immo/), donc l'origine seule ne suffirait pas au favori.
  const appUrl = (window.location.origin + import.meta.env.BASE_URL).replace(/\/$/, '')

  // href défini via le DOM pour contourner la neutralisation des URL "javascript:" par React.
  useEffect(() => {
    if (ref.current) ref.current.setAttribute('href', buildBookmarklet(appUrl))
  }, [appUrl])

  return (
    <section className="panel importbar">
      <h2>Import 1-clic depuis une annonce</h2>
      <ol className="importbar__steps">
        <li>
          Glisse ce bouton dans ta barre de favoris (une seule fois) :{' '}
          <a
            ref={ref}
            className="btn btn--primary importbar__blet"
            href="#"
            onClick={(e) => e.preventDefault()}
            title="Glisse-moi dans la barre de favoris"
          >
            ⚡ Analyser l'annonce
          </a>
        </li>
        <li>
          Ouvre une annonce leboncoin / SeLoger, puis <strong>clique le favori</strong> : cet outil se
          rouvre avec les champs pré-remplis.
        </li>
      </ol>
      <p className="panel__hint">
        Rien n'est envoyé à un serveur : le favori lit la page que tu as déjà ouverte. Si le site change
        de format, le texte visible reste récupéré et l'extraction repart dessus.
      </p>
    </section>
  )
}
