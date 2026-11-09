// Kleine verbeteringen aan de HTML uit de omzetter, vlak voor het tonen:
// beschrijving bij afbeeldingen, kleine plaatjes niet uitrekken, een nette tekenlijst en adressen voor tussenkoppen.

// alinea met alleen een knopnummer (span.k)
const alleenK = (p) => p?.tagName === 'P' && p.children.length > 0 &&
  [...p.childNodes].every((n) => (n.nodeType === 1 ? n.classList.contains('k') : !n.textContent.trim()))

const breedte = (f) => +f.querySelector('img')?.getAttribute('width') || 0
const isIcoon = (f) => !f.querySelector('figcaption') && breedte(f) > 0 && breedte(f) <= 160

export function verfraai(html, sectie) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const body = doc.body

  // Klein plaatje + knopnummer + uitleg onder elkaar (bijv. de tekens in Zermelo) wordt één strakke lijst
  for (const f of [...body.querySelectorAll('figure.shot')]) {
    if (!f.parentNode || !isIcoon(f)) continue
    const k = f.nextElementSibling
    const tekst = k?.nextElementSibling
    if (!alleenK(k) || tekst?.tagName !== 'P') continue
    let lijst = f.previousElementSibling
    if (!lijst?.classList.contains('legenda')) {
      lijst = doc.createElement('ul')
      lijst.className = 'legenda'
      f.before(lijst)
    }
    const im = f.querySelector('img')
    im.alt = '' // de uitleg staat ernaast
    const beeld = doc.createElement('span'); beeld.className = 'legenda-b'; beeld.append(im)
    const nr = doc.createElement('span'); nr.className = 'legenda-k'; nr.append(...k.children)
    const uitleg = doc.createElement('div'); uitleg.className = 'legenda-t'; uitleg.append(...tekst.childNodes)
    const li = doc.createElement('li')
    li.append(beeld, nr, uitleg)
    lijst.append(li)
    f.remove(); k.remove(); tekst.remove()
  }

  body.querySelectorAll('figure.shot').forEach((f) => {
    const bijschrift = f.querySelector('figcaption')?.textContent.trim()
    f.querySelectorAll('img').forEach((im) => {
      if (!im.alt || im.alt === 'Afbeelding') im.alt = bijschrift || `Schermafbeelding bij ${sectie.titel}`
    })
    // een klein plaatje blijft klein en scherp
    const w = breedte(f)
    if (w && w < 300 && !f.matches('.multi, .tel')) f.style.maxWidth = `${w}px`
  })

  // tussenkoppen krijgen een adres, zodat het menu ernaartoe kan springen
  const koppen = [...body.querySelectorAll('h3')].map((h, i) => {
    h.id = `${sectie.id}--${i + 1}`
    return { id: h.id, titel: h.textContent.trim() }
  })
  return { html: body.innerHTML, koppen }
}
