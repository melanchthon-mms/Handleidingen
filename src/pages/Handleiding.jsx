import { useEffect, useMemo, useRef, useState } from 'react'
import Icoon from '../components/Icoon.jsx'
import { maakCodeblokken } from '../arduino.js'
import { groepen } from '../catalogus.js'
import { verfraai } from '../opmaak.js'

function voegKopieerknopToe(pre) {
  const box = pre.parentElement
  if (box.querySelector('.code-bar')) return
  const bar = document.createElement('div')
  bar.className = 'code-bar'
  bar.innerHTML = '<span>Code</span><button type="button" class="code-copy">📋 Kopieer code</button>'
  bar.querySelector('button').addEventListener('click', async (e) => {
    const b = e.currentTarget
    try { await navigator.clipboard.writeText(pre.textContent) } catch {
      const r = document.createRange(); r.selectNodeContents(pre)
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand('copy')
    }
    b.textContent = '✓ Gekopieerd!'
    setTimeout(() => { b.textContent = '📋 Kopieer code' }, 1800)
  })
  box.prepend(bar)
}

// Kort filmpje dat zich gedraagt als een gifje ("lus": true in de catalogus): speelt vanzelf, zonder geluid,
// zolang het in beeld is. Klikken zet het stil of weer aan. Wie in Windows animaties uit heeft staan, start het zelf.
function Lusfilm({ x }) {
  const ref = useRef(null)
  const [speelt, setSpeelt] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !el.dataset.stil) el.play().catch(() => {})
      else el.pause()
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const wissel = () => {
    const el = ref.current
    if (el.paused) { delete el.dataset.stil; el.play().catch(() => {}) } else { el.dataset.stil = '1'; el.pause() }
  }
  return (
    <figure className="anim video lus">
      <button type="button" className="lus-knop" onClick={wissel} aria-label={`${speelt ? 'Filmpje stilzetten' : 'Filmpje afspelen'}: ${x.titel}`}>
        <video ref={ref} src={x.video} poster={x.poster} muted loop playsInline preload="none" onPlay={() => setSpeelt(true)} onPause={() => setSpeelt(false)} />
        {!speelt && <span className="lus-play" aria-hidden="true">▶</span>}
      </button>
      <figcaption>{x.titel}</figcaption>
    </figure>
  )
}

function Extra({ x }) {
  if (x.video && x.lus) return <Lusfilm x={x} />
  if (x.video) {
    // filmpje zonder geluid (bijv. een timelapse): speelt pas als de leerling op afspelen klikt
    return (
      <figure className="anim video">
        <video src={x.video} poster={x.poster} controls muted loop playsInline preload="none" />
        <figcaption>{x.titel}</figcaption>
      </figure>
    )
  }
  return (
    <figure className="anim">
      <iframe src={x.src} title={x.titel} loading="lazy" allow="clipboard-write" />
      <figcaption>
        Op de website kun je dit uitproberen: {x.titel} · <a className="anim-open" href={x.src} target="_blank" rel="noopener">Open in een groot venster</a>
      </figcaption>
    </figure>
  )
}

// Extra's met "na" komen onder het hoofdstuk waarvan de id dat stukje bevat; de rest in een eigen hoofdstuk "Uitproberen"
function verdeelExtras(extras = [], secties) {
  const perSectie = {}, los = []
  for (const x of extras) {
    const s = x.na && secties.find((s) => s.id.includes(x.na))
    if (s) (perSectie[s.id] ||= []).push(x)
    else los.push(x)
  }
  return { perSectie, los }
}

// Hoofdstuk-HTML in stukken: een extra met "bij" komt direct na de alinea met die tekst
// (bijv. "Op de website kun je het filmpje … bekijken."), een extra met "voor" vlak vóór de tussenkop of het blok
// met die tekst, en anders aan het eind van het hoofdstuk. Filmpjes op dezelfde plek komen naast elkaar.
function Hoofdstuk({ html, extras = [] }) {
  const plek = (x) => {
    if (x.voor) {
      const i = html.indexOf(x.voor)
      const begin = i >= 0 ? Math.max(html.lastIndexOf('<h3', i), html.lastIndexOf('<aside', i)) : -1
      if (begin >= 0) return begin
    }
    const i = x.bij ? html.indexOf(x.bij) : -1
    const eind = i >= 0 ? html.indexOf('</p>', i) : -1
    return eind >= 0 ? eind + 4 : html.length
  }
  const plekken = []
  for (const x of extras) {
    const pos = plek(x)
    const zelfde = plekken.find((p) => p.pos === pos)
    if (zelfde) zelfde.xs.push(x)
    else plekken.push({ pos, xs: [x] })
  }
  plekken.sort((a, b) => a.pos - b.pos)
  const delen = []
  let vorige = 0
  plekken.forEach(({ xs, pos }, n) => {
    if (pos > vorige) delen.push(<div key={`t${n}`} dangerouslySetInnerHTML={{ __html: html.slice(vorige, pos) }} />)
    const films = xs.map((x) => <Extra key={x.src || x.video} x={x} />)
    delen.push(xs.length > 1 && xs.every((x) => x.lus) ? <div className="film-rij" key={`f${n}`}>{films}</div> : films)
    vorige = pos
  })
  if (vorige < html.length) delen.push(<div key="rest" dangerouslySetInnerHTML={{ __html: html.slice(vorige) }} />)
  return delen
}

// Knop rechtsonder om terug naar boven te gaan; verschijnt pas als je een stuk gescrold hebt
function NaarBoven() {
  const [toon, setToon] = useState(false)
  useEffect(() => {
    const f = () => setToon(scrollY > 1200)
    addEventListener('scroll', f, { passive: true })
    return () => removeEventListener('scroll', f)
  }, [])
  if (!toon) return null
  return <button type="button" className="omhoog" onClick={() => scrollTo({ top: 0, behavior: 'smooth' })}>↑ Naar boven</button>
}

export default function Handleiding({ item, anker, navOpen, setNavOpen }) {
  const [data, setData] = useState(null)
  const [fout, setFout] = useState(false)
  const [actief, setActief] = useState(null)
  const mainRef = useRef(null)

  useEffect(() => {
    let weg = false
    setData(null); setFout(false)
    fetch(`data/${item.slug}.json?v=${__BOUW__}`)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then((d) => { if (!weg) setData(d) })
      .catch(() => { if (!weg) setFout(true) })
    return () => { weg = true }
  }, [item.slug])

  // HTML uit de omzetter netjes maken (zie opmaak.js); "· PORT" hoort niet in de ondertitel
  const pagina = useMemo(() => data && {
    intro: verfraai(data.intro, { id: 'intro', titel: data.titel }).html,
    sub: (data.sub || '').replace(/\s*·\s*PORT\b/g, ''),
    secties: data.secties.map((s) => ({ ...s, ...verfraai(s.html, s) })),
  }, [data])

  // de naam van de tegel voorop: zo heten Word 1 en Word 2 niet allebei "Schrijven met Word"
  useEffect(() => {
    if (!data) { document.title = 'Handleidingen'; return }
    document.title = `${item.titel === data.titel ? data.titel : `${item.titel}: ${data.titel}`} · Handleidingen`
  }, [data, item.titel])

  // na laden: naar het gekozen hoofdstuk, anders naar boven
  useEffect(() => {
    if (!pagina) return
    const el = anker && document.getElementById(anker)
    if (el) el.scrollIntoView()
    else if (!anker) window.scrollTo(0, 0)
  }, [pagina, anker])

  // Arduino-code als codeblok (oude Word-bestanden), en een kopieerknop bij elk codeblok uit stijl Code (v27)
  useEffect(() => {
    if (!pagina || !mainRef.current) return
    if (item.slug === 'arduino') maakCodeblokken(mainRef.current)
    mainRef.current.querySelectorAll('.code > pre').forEach(voegKopieerknopToe)
  }, [pagina, item.slug])

  // huidig hoofdstuk oplichten in het menu
  useEffect(() => {
    if (!pagina || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver((es) => {
      for (const en of es) if (en.isIntersecting) setActief(en.target.id)
    }, { rootMargin: '-15% 0px -75% 0px' })
    document.querySelectorAll('section.ch').forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [pagina])

  if (fout) {
    return (
      <main id="main" className="home">
        <p className="crumb"><a href="#/">Alle handleidingen</a> / {item.groep}</p>
        <h1>{item.titel}</h1>
        <p>Deze handleiding staat nog niet online. Probeer het later nog eens.</p>
      </main>
    )
  }
  if (!pagina) return <main id="main" className="home"><p className="laden">Handleiding laden…</p></main>

  const { perSectie, los } = verdeelExtras(item.extras, pagina.secties)
  const hoofdstukken = [...pagina.secties.map((s) => ({ id: s.id, titel: s.titel, koppen: s.koppen })), ...(los.length ? [{ id: 'uitproberen', titel: 'Uitproberen', koppen: [] }] : [])]
  // volgende handleiding in dezelfde groep, voor onderaan de pagina
  const buren = groepen.find((g) => g.titel === item.groep)?.items || []
  const volgende = buren[buren.findIndex((it) => it.slug === item.slug) + 1]

  return (
    <div className="layout">
      <nav id="nav" className={`nav${navOpen ? ' open' : ''}`} aria-label="Hoofdstukken">
        <a className="back" href="#/">Alle handleidingen</a>
        <p className="nav-t">{item.titel}</p>
        <ol>
          {hoofdstukken.map((h) => (
            <li key={h.id}>
              <a href={`#/${item.slug}/${h.id}`} aria-current={actief === h.id ? 'true' : undefined} onClick={() => setNavOpen(false)}>{h.titel}</a>
              {/* lang hoofdstuk: de tussenkoppen (Stap 1, Stap 2 …) erbij zolang je in dat hoofdstuk bent */}
              {actief === h.id && h.koppen.length >= 3 && (
                <ol>
                  {h.koppen.map((k) => <li key={k.id}><a href={`#/${item.slug}/${k.id}`} onClick={() => setNavOpen(false)}>{k.titel}</a></li>)}
                </ol>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <main id="main" ref={mainRef}>
        <div className="hero">
          <p className="crumb"><a href="#/">Alle handleidingen</a> / {item.groep} / {item.titel}</p>
          <div className="title">
            <Icoon naam={item.icoon} maat={56} />
            <div>
              <h1>{data.titel} {item.beta && <span className="beta">Beta</span>}</h1>
              {pagina.sub && <p className="sub" dangerouslySetInnerHTML={{ __html: pagina.sub }} />}
            </div>
          </div>
          {item.beta && (
            <aside className="beta-note"><b>Beta</b>Aan deze handleiding wordt nog gewerkt. Er kan nog iets veranderen of ontbreken. Klopt er iets niet? Zeg het tegen je docent.</aside>
          )}
          <div dangerouslySetInnerHTML={{ __html: pagina.intro }} />
        </div>
        {pagina.secties.map((s) => (
          <section id={s.id} className="ch" key={s.id}>
            <h2>{s.titel}</h2>
            <Hoofdstuk html={s.html} extras={perSectie[s.id]} />
          </section>
        ))}
        {los.length > 0 && (
          <section id="uitproberen" className="ch">
            <h2>Uitproberen</h2>
            {los.map((x) => <Extra key={x.src || x.video} x={x} />)}
          </section>
        )}
        <p className="einde">
          <a href="#/">‹ Alle handleidingen</a>
          {volgende && <a className="hoofd" href={`#/${volgende.slug}`}>Verder met {volgende.titel} ›</a>}
        </p>
        <footer className="foot">Handleidingen · Melanchthon Mavo Schiebroek · versie {data.versie}</footer>
        <NaarBoven />
      </main>
    </div>
  )
}
