const STORAGE_KEY = 'word-list-items'

const form = document.querySelector('#word-form')
const wordInput = document.querySelector('#word-input')
const noteInput = document.querySelector('#note-input')
const tagInput = document.querySelector('#tag-input')
const tagFilter = document.querySelector('#tag-filter')
const list = document.querySelector('#word-list')
const emptyState = document.querySelector('#empty-state')
const startTestButton = document.querySelector('#start-test')
const testDialog = document.querySelector('#test-dialog')
const testProgress = document.querySelector('#test-progress')
const testWord = document.querySelector('#test-word')
const testNote = document.querySelector('#test-note')
const revealNote = document.querySelector('#reveal-note')
const nextWord = document.querySelector('#next-word')

let items = loadItems()
let currentTestItems = []
let currentTestIndex = 0
let editingId = null

function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []
  } catch {
    return []
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function normalizeWord(value) {
  return value.trim().toLocaleLowerCase()
}

function parseTags(value) {
  return [...new Set(
    value
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean),
  )]
}

function getAllTags() {
  return [...new Set(items.flatMap(item => item.tags ?? []))].sort((a, b) => a.localeCompare(b, 'ja'))
}

function getVisibleItems() {
  const selectedTag = tagFilter.value
  if (selectedTag === 'all') return items
  return items.filter(item => item.tags?.includes(selectedTag))
}

function refreshTagFilter() {
  const selected = tagFilter.value
  tagFilter.innerHTML = '<option value="all">すべて</option>'

  getAllTags().forEach(tag => {
    const option = document.createElement('option')
    option.value = tag
    option.textContent = tag
    tagFilter.append(option)
  })

  tagFilter.value = [...tagFilter.options].some(option => option.value === selected) ? selected : 'all'
}

function render() {
  refreshTagFilter()
  list.innerHTML = ''

  const visibleItems = getVisibleItems()

  visibleItems.forEach(item => {
    const row = document.createElement('li')
    row.className = 'word-item'

    const word = document.createElement('span')
    word.className = 'word'
    word.textContent = item.word

    const note = document.createElement('span')
    note.className = 'note'
    note.textContent = item.note || '意味未入力'

    const tags = document.createElement('span')
    tags.className = 'tags'
    ;(item.tags ?? []).forEach(tagValue => {
      const tag = document.createElement('span')
      tag.className = 'tag'
      tag.textContent = tagValue
      tags.append(tag)
    })

    const checks = document.createElement('span')
    checks.className = 'checks'
    checks.textContent = item.checks ? `✔ ${item.checks}` : '—'

    const actions = document.createElement('span')
    actions.className = 'row-actions'

    const edit = document.createElement('button')
    edit.className = 'subtle-button'
    edit.type = 'button'
    edit.textContent = '編集'
    edit.addEventListener('click', () => {
      wordInput.value = item.word
      noteInput.value = item.note ?? ''
      tagInput.value = (item.tags ?? []).join(', ')
      editingId = item.id
      wordInput.focus()
    })

    const remove = document.createElement('button')
    remove.className = 'delete-button'
    remove.type = 'button'
    remove.textContent = '削除'
    remove.addEventListener('click', () => {
      items = items.filter(entry => entry.id !== item.id)
      saveItems()
      render()
    })

    actions.append(edit, remove)
    row.append(word, note, tags, checks, actions)
    list.append(row)
  })

  emptyState.hidden = visibleItems.length > 0
  startTestButton.disabled = visibleItems.length === 0
}

function addOrMarkWord(word, note, tags) {
  const normalizedWord = normalizeWord(word)
  const existing = items.find(item => normalizeWord(item.word) === normalizedWord)

  if (existing) {
    existing.checks = (existing.checks ?? 1) + 1
    existing.updatedAt = new Date().toISOString()
    if (note) existing.note = note
    existing.tags = [...new Set([...(existing.tags ?? []), ...tags])]
    return
  }

  items.unshift({
    id: crypto.randomUUID(),
    word,
    note,
    tags,
    checks: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

function updateWord(id, word, note, tags) {
  const item = items.find(entry => entry.id === id)
  if (!item) return

  item.word = word
  item.note = note
  item.tags = tags
  item.updatedAt = new Date().toISOString()
}

function openTest() {
  currentTestItems = [...getVisibleItems()]
  currentTestIndex = 0
  if (currentTestItems.length === 0) return
  renderTestCard()
  testDialog.showModal()
}

function renderTestCard() {
  const item = currentTestItems[currentTestIndex]
  testProgress.textContent = `${currentTestIndex + 1} / ${currentTestItems.length}`
  testWord.textContent = item.word
  testNote.textContent = item.note || '意味未入力'
  testNote.hidden = true
}

form.addEventListener('submit', event => {
  event.preventDefault()
  const word = wordInput.value.trim()
  const note = noteInput.value.trim()
  const tags = parseTags(tagInput.value)
  if (!word) return

  if (editingId) {
    updateWord(editingId, word, note, tags)
    editingId = null
  } else {
    addOrMarkWord(word, note, tags)
  }
  wordInput.value = ''
  noteInput.value = ''
  tagInput.value = ''
  saveItems()
  render()
  wordInput.focus()
})

tagFilter.addEventListener('change', render)
startTestButton.addEventListener('click', openTest)

revealNote.addEventListener('click', () => {
  testNote.hidden = false
})

nextWord.addEventListener('click', () => {
  currentTestIndex = (currentTestIndex + 1) % currentTestItems.length
  renderTestCard()
})

render()
