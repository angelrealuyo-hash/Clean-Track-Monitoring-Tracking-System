// Gives every data-table cell a `data-label` with its column heading, so on
// phones the CSS in styles/ui.css can show each row as a small card
// ("Purok: Purok 2") instead of a wide table that must scroll sideways.
// Tables are found automatically, including ones that render later.

function labelTable(table) {
  const heads = [...table.querySelectorAll('thead tr:last-child th')].map((th) => th.textContent.trim())
  if (!heads.length) return
  for (const tr of table.querySelectorAll('tbody tr, tfoot tr')) {
    let col = 0
    for (const cell of tr.children) {
      const label = heads[col] ?? ''
      if (cell.dataset.label !== label) cell.dataset.label = label
      col += cell.colSpan || 1
    }
  }
}

export function startResponsiveTables(root = document.body) {
  let queued = false
  const run = () => {
    queued = false
    root.querySelectorAll('table.ct-table').forEach(labelTable)
  }
  const schedule = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(run)
  }
  const observer = new MutationObserver(schedule)
  observer.observe(root, { childList: true, subtree: true, characterData: true })
  schedule()
  return () => observer.disconnect()
}
