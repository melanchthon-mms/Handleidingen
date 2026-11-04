import { useEffect, useRef, useState } from 'react'
import { laadIndex, zoek } from '../zoek.js'
import Icoon from './Icoon.jsx'

// Zoekbalk midden in de paarse balk; wordt breder als je erin klikt
export default function Zoek() {
  const [vraag, setVraag] = useState('')
  const [open, setOpen] = useState(false)
  const [res, setRes] = useState([])
  const [kies, setKies] = useState(0)
  const [bezig, setBezig] = useState(false)
  const vak = useRef(null)
  const invoer = useRef(null)

  useEffect(() => {
    let weg = false
    if (vraag.trim().length < 2) { setRes([]); return }
    setBezig(true)
    const t = setTimeout(() => zoek(vraag).then((r) => { if (!weg) { setRes(r); setKies(0); setBezig(false) } }), 120)
    return () => { weg = true; clearTimeout(t) }
  }, [vraag])

  // buiten de zoekbalk klikken of naar een andere pagina gaan: sluiten
  useEffect(() => {
    const klik = (e) => { if (!vak.current?.contains(e.target)) setOpen(false) }
    const hash = () => { setOpen(false); invoer.current?.blur() }
    document.addEventListener('click', klik)
    addEventListener('hashchange', hash)
    return () => { document.removeEventListener('click', klik); removeEventListener('hashchange', hash) }
  }, [])

  function ga(r) {
    if (!r) return
    location.hash = r.id ? `#/${r.slug}/${r.id}` : `#/${r.slug}`
    setVraag(''); setOpen(false)
  }

  function toets(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setKies((k) => Math.min(k + 1, res.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setKies((k) => Math.max(k - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); ga(res[kies]) }
    else if (e.key === 'Escape') { setOpen(false); invoer.current.blur() }
  }

  const toon = open && vraag.trim().length >= 2
  return (
    <div className={`zoek${open ? ' open' : ''}`} ref={vak} role="search">
      <div className="zoek-veld">
        <svg className="zoek-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" /></svg>
        <input ref={invoer} type="search" value={vraag} placeholder="Zoek in de handleidingen" aria-label="Zoek in de handleidingen"
          autoComplete="off" enterKeyHint="search" aria-expanded={toon} aria-controls="zoek-res"
          onFocus={() => { setOpen(true); laadIndex() }} onChange={(e) => { setVraag(e.target.value); setOpen(true) }} onKeyDown={toets} />
      </div>
      {toon && (
        <div className="zoek-res" id="zoek-res">
          {res.length > 0 ? (
            <ul>
              {res.map((r, i) => (
                <li key={`${r.slug}/${r.id}`}>
                  <a href={r.id ? `#/${r.slug}/${r.id}` : `#/${r.slug}`} className={i === kies ? 'actief' : undefined}
                    onMouseEnter={() => setKies(i)} onClick={(e) => { e.preventDefault(); ga(r) }}>
                    <Icoon naam={r.icoon} maat={32} />
                    <span>
                      <b>{r.id ? <>{r.handleiding} <span className="zoek-pijl">›</span> {r.titel}</> : r.titel}</b>
                      {r.stukje && <small>{r.stukje}</small>}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="zoek-leeg">{bezig ? 'Zoeken…' : <>Niets gevonden voor "{vraag}". Probeer een ander woord, of vraag het je docent.</>}</p>
          )}
        </div>
      )}
    </div>
  )
}
