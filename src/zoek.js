import { groepen } from './catalogus.js'

// Zoeken in alle handleidingen, zonder server: de JSON-bestanden worden bij de eerste keer zoeken opgehaald.
// Tolerant voor hoofdletters, accenten, kleine typfouten en vraagzinnen ("hoe lever ik in").

const STOP = new Set(('hoe wat waar wanneer waarom wie welke welk ik je jij jouw mijn me mij we wij ons onze de het een en of ' +
  'is zijn ben bent was kan kun kunt moet moeten wil wilt doe doen ga gaat in op aan met van voor naar bij om uit er dat dit die ' +
  'niet geen wel ook nog al dan als zo te tot over iets maak maken').split(' '))

// Woorden die leerlingen gebruiken → woorden die in de handleidingen staan
const SYNONIEMEN = {
  printen: ['3d', 'printer', 'bambu'], printer: ['3d', 'bambu'], '3dprinter': ['3d', 'printer'],
  laser: ['laseren', 'xtool', 'falcon', 'lasersnijden'], snijden: ['cricut', 'laser'],
  inleveren: ['opdracht', 'teams', 'onedrive'], huiswerk: ['opdracht', 'teams'],
  wifi: ['eduroam'], internet: ['eduroam', 'wifi'], wachtwoord: ['eduroam', 'inloggen'],
  opslaan: ['onedrive'], bestand: ['onedrive'], delen: ['onedrive', 'teams'],
  presentatie: ['powerpoint'], dia: ['powerpoint'], rekenen: ['excel'], tabel: ['excel', 'word'],
  formule: ['excel'], typen: ['word'], verslag: ['word'], werkstuk: ['word'],
  filmpje: ['clipchamp', 'video'], video: ['clipchamp'], monteren: ['clipchamp'],
  poster: ['adobe', 'express'], flyer: ['adobe', 'express'], logo: ['adobe', 'express'],
  robot: ['lego', 'spike'], programmeren: ['makecode', 'arduino', 'code'], microbit: ['makecode'],
  ontwerpen: ['tinkercad'], '3d': ['tinkercad', 'printen'], rooster: ['zermelo'], keuze: ['zermelo'],
  ai: ['lovable'], app: ['lovable'], website: ['lovable'],
}

export const normaal = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const woorden = (s) => normaal(s).split(/[^a-z0-9]+/).filter(Boolean)

// Eén letter verschil (vervangen, erbij of eraf)
function bijna(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, fout = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++fout > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return fout + (a.length - i) + (b.length - j) <= 1
}

// Past de zoekterm bij dit woord? Begin van het woord telt ook ("filam" → filament)
function past(term, woord) {
  if (woord.startsWith(term)) return true
  if (term.length < 4) return false
  return bijna(term, woord) || bijna(term, woord.slice(0, term.length)) || bijna(term, woord.slice(0, term.length + 1))
}

let index = null
export function laadIndex() {
  if (index) return index
  const tekstVan = (html) => new DOMParser().parseFromString(html, 'text/html').body.textContent.replace(/\s+/g, ' ').trim()
  const items = groepen.flatMap((g) => g.items)
  index = Promise.all(items.map(async (it) => {
    const basis = { slug: it.slug, handleiding: it.titel, icoon: it.icoon }
    const uit = [{ ...basis, id: '', titel: it.titel, tekst: it.tekst || '', kop: woorden(`${it.titel} ${it.tekst || ''} ${it.bron}`) }]
    if (it.slot) return uit // inhoud achter een code niet doorzoeken
    try {
      const d = await (await fetch(`data/${it.slug}.json?v=${__BOUW__}`)).json()
      for (const s of d.secties) {
        const tekst = tekstVan(s.html)
        uit.push({ ...basis, id: s.id, titel: s.titel, tekst, kop: woorden(s.titel), lijf: new Set(woorden(tekst)) })
      }
    } catch { /* handleiding nog niet online */ }
    return uit
  })).then((r) => r.flat())
  return index
}

// Termen uit de zoekvraag; elk met de synoniemen erbij
function termen(vraag) {
  const w = woorden(vraag)
  const zonderStop = w.filter((x) => !STOP.has(x))
  return (zonderStop.length ? zonderStop : w).map((t) => [t, ...(SYNONIEMEN[t] || [])])
}

function score(e, groep) {
  let beste = 0
  for (const t of groep) {
    const zwaar = t === groep[0] ? 1 : 0.6 // synoniem telt minder
    if (e.kop.some((w) => past(t, w))) beste = Math.max(beste, (e.id ? 4 : 6) * zwaar)
    else if (e.lijf) for (const w of e.lijf) if (past(t, w)) { beste = Math.max(beste, 1.5 * zwaar); break }
  }
  return beste
}

// Stukje tekst rond het eerste gevonden woord
function stukje(e, groepen) {
  if (!e.tekst) return ''
  const n = normaal(e.tekst)
  let pos = -1
  for (const g of groepen) for (const t of g) { const i = n.search(new RegExp(`\\b${t.slice(0, Math.max(3, t.length - 1))}`)); if (i >= 0 && (pos < 0 || i < pos)) pos = i }
  if (pos < 0) pos = 0
  const van = Math.max(0, pos - 40)
  return (van > 0 ? '…' : '') + e.tekst.slice(van, van + 130).trim() + (e.tekst.length > van + 130 ? '…' : '')
}

export async function zoek(vraag, max = 8) {
  const groepen = termen(vraag)
  if (!groepen.length) return []
  const alles = await laadIndex()
  const reken = (alleen) => alles.map((e) => {
    const s = groepen.map((g) => score(e, g))
    const totaal = alleen ? (s.every((x) => x > 0) ? s.reduce((a, b) => a + b, 0) : 0) : s.reduce((a, b) => a + b, 0)
    return { e, totaal }
  }).filter((x) => x.totaal > 0)
  let r = reken(true)
  if (!r.length) r = reken(false) // geen hits op alle woorden: dan de beste losse hits
  return r.sort((a, b) => b.totaal - a.totaal).slice(0, max).map(({ e }) => ({ ...e, stukje: e.id ? stukje(e, groepen) : e.tekst }))
}
