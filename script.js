const STORAGE_KEY = 'word-list-items'

const form = document.querySelector('#word-form')
const wordInput = document.querySelector('#word-input')
const noteInput = document.querySelector('#note-input')
const tagInput = document.querySelector('#tag-input')
const tagChipList = document.querySelector('#tag-chip-list')
const tagAddButton = document.querySelector('#tag-add-button')
const tagSuggestions = document.querySelector('#tag-suggestions')
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
const checkUpdateButton = document.querySelector('#check-update')
const exportButton = document.querySelector('#export-data')
const importButton = document.querySelector('#import-data')
const importFile = document.querySelector('#import-file')
const statusMessage = document.querySelector('#status-message')

let items = loadItems()
let currentTestItems = []
let currentTestIndex = 0
let editingId = null
let pendingTags = []

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

function showStatus(message) {
  statusMessage.textContent = message
  window.clearTimeout(showStatus.timer)
  showStatus.timer = window.setTimeout(() => {
    statusMessage.textContent = ''
  }, 2600)
}

function exportItems() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `word-list-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
  showStatus('エクスポートしました')
}

function isValidItem(value) {
  return (
    value &&
    typeof value.id === 'string' &&
    typeof value.word === 'string' &&
    (value.note == null || typeof value.note === 'string') &&
    (value.tags == null || (Array.isArray(value.tags) && value.tags.every(tag => typeof tag === 'string'))) &&
    (value.checks == null || typeof value.checks === 'number')
  )
}

function importItems(file) {
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    showStatus('ファイルが大きすぎます')
    return
  }

  const reader = new FileReader()
  reader.onload = event => {
    try {
      const payload = JSON.parse(event.target.result)
      if (!Array.isArray(payload.items) || !payload.items.every(isValidItem)) {
        throw new Error('invalid')
      }
      if (!window.confirm('現在の単語を置き換えてインポートしますか？')) return
      items = payload.items.map(item => ({
        ...item,
        note: item.note ?? '',
        tags: item.tags ?? [],
        checks: item.checks ?? 1,
      }))
      pendingTags = []
      saveItems()
      renderTagComposer()
      render()
      showStatus('インポートしました')
    } catch {
      showStatus('JSON を読み込めませんでした')
    } finally {
      importFile.value = ''
    }
  }
  reader.readAsText(file)
}

async function checkForUpdate() {
  if (!('serviceWorker' in navigator)) {
    window.location.reload()
    return
  }

  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) {
    window.location.reload()
    return
  }

  await registration.update()
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    showStatus('更新を適用しています')
    return
  }
  showStatus('最新です')
}

function normalizeWord(value) {
  return value.trim().toLocaleLowerCase()
}

function normalizeTag(value) {
  return value.trim()
}

function renderTagComposer() {
  tagChipList.innerHTML = ''

  pendingTags.forEach(tagValue => {
    const chip = document.createElement('span')
    chip.className = 'tag-chip'

    const label = document.createElement('span')
    label.textContent = tagValue

    const remove = document.createElement('button')
    remove.className = 'tag-remove-button'
    remove.type = 'button'
    remove.ariaLabel = `${tagValue} を削除`
    remove.textContent = '×'
    remove.addEventListener('click', () => {
      pendingTags = pendingTags.filter(tag => tag !== tagValue)
      renderTagComposer()
      tagInput.focus()
    })

    chip.append(label, remove)
    tagChipList.append(chip)
  })

  refreshTagSuggestions()
}

function addPendingTag() {
  const tag = normalizeTag(tagInput.value)
  if (!tag || pendingTags.includes(tag)) {
    tagInput.value = ''
    return
  }

  pendingTags = [...pendingTags, tag]
  tagInput.value = ''
  renderTagComposer()
}

function getAllTags() {
  return [...new Set(items.flatMap(item => item.tags ?? []))].sort((a, b) => a.localeCompare(b, 'ja'))
}

function getVisibleItems() {
  const selectedTag = tagFilter.value
  if (selectedTag === 'all') return items
  return items.filter(item => item.tags?.includes(selectedTag))
}

function refreshTagSuggestions() {
  tagSuggestions.innerHTML = ''

  getAllTags()
    .filter(tag => !pendingTags.includes(tag))
    .forEach(tag => {
      const option = document.createElement('option')
      option.value = tag
      tagSuggestions.append(option)
    })
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
      pendingTags = [...(item.tags ?? [])]
      renderTagComposer()
      editingId = item.id
      submitButton.textContent = '更新'
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

  const normalizedWord = normalizeWord(word)
  const duplicate = items.find(
    entry => entry.id !== id && normalizeWord(entry.word) === normalizedWord
  )

  if (duplicate) {
    // 既存の単語へマージ：checks・メモ・タグを統合して編集中の項目を削除
    duplicate.checks = (duplicate.checks ?? 1) + (item.checks ?? 1)
    if (note) duplicate.note = note
    duplicate.tags = [...new Set([...(duplicate.tags ?? []), ...tags])]
    duplicate.updatedAt = new Date().toISOString()
    items = items.filter(entry => entry.id !== id)
    return
  }

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

const submitButton = document.querySelector('#submit-button')

form.addEventListener('submit', event => {
  event.preventDefault()
  const word = wordInput.value.trim()
  const note = noteInput.value.trim()
  addPendingTag()
  const tags = [...pendingTags]
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
  pendingTags = []
  submitButton.textContent = '追加'
  renderTagComposer()
  saveItems()
  render()
  wordInput.focus()
})

tagFilter.addEventListener('change', render)
startTestButton.addEventListener('click', openTest)
tagAddButton.addEventListener('click', () => {
  addPendingTag()
  tagInput.focus()
})

tagInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault()
    addPendingTag()
  }

  if (event.key === 'Backspace' && !tagInput.value && pendingTags.length > 0) {
    pendingTags = pendingTags.slice(0, -1)
    renderTagComposer()
  }
})

revealNote.addEventListener('click', () => {
  testNote.hidden = false
})

nextWord.addEventListener('click', () => {
  currentTestIndex = (currentTestIndex + 1) % currentTestItems.length
  renderTestCard()
})

exportButton.addEventListener('click', exportItems)
importButton.addEventListener('click', () => importFile.click())
importFile.addEventListener('change', event => importItems(event.target.files?.[0]))
checkUpdateButton.addEventListener('click', checkForUpdate)

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload())
}

renderTagComposer()
render()
