// Zone d'entrée : texte de l'annonce (copier-coller) + photos/plan (affichage seul en v1).

import { useEffect, useState } from 'react'

type Props = {
  texte: string
  onTexteChange: (v: string) => void
  onAnalyser: () => void
  nbChampsTrouves: number | null // null tant qu'on n'a pas analysé
}

export function AdInput({ texte, onTexteChange, onAnalyser, nbChampsTrouves }: Props) {
  const [images, setImages] = useState<{ url: string; name: string }[]>([])

  // Libère les object URLs au démontage.
  useEffect(() => {
    return () => images.forEach((i) => URL.revokeObjectURL(i.url))
  }, [images])

  function onFiles(files: FileList | null) {
    if (!files) return
    const nouvelles = Array.from(files).map((f) => ({ url: URL.createObjectURL(f), name: f.name }))
    setImages((prev) => [...prev, ...nouvelles])
  }

  return (
    <section className="panel">
      <h2>Annonce</h2>
      <textarea
        className="adtext"
        placeholder="Colle ici le texte brut de l'annonce (leboncoin / SeLoger)…"
        value={texte}
        onChange={(e) => onTexteChange(e.target.value)}
        rows={10}
      />

      <div className="adrow">
        <button className="btn btn--primary" onClick={onAnalyser} disabled={texte.trim().length === 0}>
          Analyser
        </button>
        {nbChampsTrouves != null && (
          <span className="adrow__note">
            {nbChampsTrouves > 0
              ? `${nbChampsTrouves} champ${nbChampsTrouves > 1 ? 's' : ''} pré-rempli${
                  nbChampsTrouves > 1 ? 's' : ''
                } — à vérifier ci-dessous.`
              : 'Rien de détecté automatiquement — saisis les faits à la main.'}
          </span>
        )}
      </div>

      <div className="uploads">
        <label className="btn btn--ghost">
          + Photos / plan
          <input type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        </label>
        <span className="uploads__note">Affichage seul (aide-mémoire). Aucune lecture automatique en v1.</span>
      </div>

      {images.length > 0 && (
        <div className="thumbs">
          {images.map((img, i) => (
            <a key={i} href={img.url} target="_blank" rel="noreferrer" title={img.name}>
              <img src={img.url} alt={img.name} />
            </a>
          ))}
        </div>
      )}
    </section>
  )
}
