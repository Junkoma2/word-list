// word-list の主要フロー（追加・検索/タグ絞り込み・絞り込み0件表示・インポート確認・
// テストモード進行）に対する最小のブラウザ回帰確認。
//
// script.js はビルドステップのない素朴な<script>のため、jsdomにindex.html/script.jsを
// そのまま読み込ませ、実際のイベントディスパッチ（クリック・入力・submit）を通して検証する。
// jsdomは<dialog>のshowModal/closeを実装していないため、tests/dom-app.mjsで最小限のshimを
// 当てている（詳細はそちらのコメント参照）。
//
// 実行方法: npm test （= node --test tests/*.test.js）

import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp, fireEvent, wait } from './dom-app.mjs'

test('単語を追加すると一覧に表示される', async () => {
  const window = await createApp()
  const document = window.document

  document.getElementById('word-input').value = 'apple'
  document.getElementById('note-input').value = 'a fruit'
  document.getElementById('tag-input').value = 'food'
  fireEvent(document.getElementById('tag-add-button'), 'click')

  fireEvent(document.getElementById('word-form'), 'submit')

  const rows = document.querySelectorAll('#word-list li')
  assert.equal(rows.length, 1, '追加した単語が一覧に1件表示されること')
  assert.equal(rows[0].querySelector('.word').textContent, 'apple')
  assert.equal(rows[0].querySelector('.note').textContent, 'a fruit')
  assert.equal(rows[0].querySelector('.tags').textContent, 'food')

  // フォームがリセットされること
  assert.equal(document.getElementById('word-input').value, '')
  assert.equal(document.getElementById('tag-chip-list').children.length, 0)
})

test('単語未入力で追加しようとするとエラーを表示し、一覧に追加しない', async () => {
  const window = await createApp()
  const document = window.document

  document.getElementById('word-input').value = '   '
  fireEvent(document.getElementById('word-form'), 'submit')

  assert.equal(document.querySelectorAll('#word-list li').length, 0)
  assert.equal(document.getElementById('word-error').hidden, false)
})

test('検索・タグ絞り込みで一致する単語だけが表示される', async () => {
  const window = await createApp()
  const document = window.document

  window.addOrMarkWord('apple', 'a fruit', ['food'])
  window.addOrMarkWord('banana', 'a fruit too', ['food'])
  window.addOrMarkWord('car', 'a vehicle', ['vehicle'])
  window.render()
  assert.equal(document.querySelectorAll('#word-list li').length, 3, '前提: 3件登録されていること')

  const searchInput = document.getElementById('search-input')
  searchInput.value = 'ban'
  fireEvent(searchInput, 'input')

  let words = [...document.querySelectorAll('#word-list .word')].map(el => el.textContent)
  assert.deepEqual(words, ['banana'], 'テキスト検索で一致する単語だけに絞り込まれること')

  searchInput.value = ''
  fireEvent(searchInput, 'input')

  const tagFilter = document.getElementById('tag-filter')
  tagFilter.value = 'vehicle'
  fireEvent(tagFilter, 'change')

  words = [...document.querySelectorAll('#word-list .word')].map(el => el.textContent)
  assert.deepEqual(words, ['car'], 'タグ絞り込みで一致する単語だけに絞り込まれること')
})

test('絞り込みに一致する単語が無いとき、一覧を空にして空状態を示す', async () => {
  const window = await createApp()
  const document = window.document

  window.addOrMarkWord('apple', '', ['food'])
  window.render()

  const searchInput = document.getElementById('search-input')
  searchInput.value = 'zzz-no-match'
  fireEvent(searchInput, 'input')

  // 表示文言はPR#103（絞り込み0件時の空状態改善）で変わる可能性があるため、
  // ここでは文言ではなく「0件になり、テストを開始できない」という構造的な状態だけを固定する。
  assert.equal(document.querySelectorAll('#word-list li').length, 0)
  assert.equal(document.getElementById('empty-state').hidden, false, '空状態メッセージが表示されること')
  assert.equal(document.getElementById('start-test').disabled, true, 'テスト開始ボタンが無効化されること')

  // 絞り込みを解除すると復帰すること
  searchInput.value = ''
  fireEvent(searchInput, 'input')
  assert.equal(document.querySelectorAll('#word-list li').length, 1)
  assert.equal(document.getElementById('empty-state').hidden, true)
  assert.equal(document.getElementById('start-test').disabled, false)
})

test('インポートは確認ダイアログを経て、OKでのみ反映される', async () => {
  const window = await createApp()
  const document = window.document

  window.addOrMarkWord('apple', '', [])
  window.render()

  const payload = JSON.stringify({
    version: 1,
    items: [{ id: 'imported-1', word: 'banana', note: '', tags: [], checks: 1 }],
  })
  const importFile = document.getElementById('import-file')

  function triggerImport() {
    const file = new window.File([payload], 'import.json', { type: 'application/json' })
    Object.defineProperty(importFile, 'files', { value: [file], configurable: true })
    fireEvent(importFile, 'change')
    return wait(50) // FileReaderの読み込み完了を待つ
  }

  // キャンセル: ダイアログは開くが、データは置き換わらない
  await triggerImport()
  assert.equal(document.getElementById('confirm-dialog').open, true, '確認ダイアログが開くこと')
  assert.equal(
    document.getElementById('confirm-dialog-message').textContent,
    '現在の単語を置き換えてインポートしますか？'
  )
  fireEvent(document.getElementById('confirm-dialog-cancel'), 'click')
  assert.equal(document.getElementById('confirm-dialog').open, false)
  assert.deepEqual(
    [...document.querySelectorAll('#word-list .word')].map(el => el.textContent),
    ['apple'],
    'キャンセル時は既存データのままであること'
  )

  // OK: データが置き換わる。連続実行してもcallbackが多重発火しないこと
  // （インポート確認ダイアログのcallback残留バグの再発防止）
  await triggerImport()
  fireEvent(document.getElementById('confirm-dialog-ok'), 'click')

  const words = [...document.querySelectorAll('#word-list .word')].map(el => el.textContent)
  assert.deepEqual(words, ['banana'], 'OK時はインポートしたデータに置き換わること')
  assert.equal(document.getElementById('status-message').textContent, 'インポートしました')
})

test('テストモードでカードを進行し、完了後は最初に戻る', async () => {
  const window = await createApp()
  const document = window.document

  window.addOrMarkWord('apple', 'a fruit', [])
  window.addOrMarkWord('banana', 'a fruit too', [])
  window.render()

  fireEvent(document.getElementById('start-test'), 'click')
  assert.equal(document.getElementById('test-dialog').open, true)
  assert.equal(document.getElementById('test-progress').textContent, '1 / 2')

  // 1枚目: 「知らなかった」を選ぶと次のカードへ進む
  fireEvent(document.getElementById('reveal-note'), 'click')
  assert.equal(document.getElementById('test-note').hidden, false, '意味を見ると表示されること')
  fireEvent(document.getElementById('unknown-word'), 'click')
  assert.equal(document.getElementById('test-progress').textContent, '2 / 2', '次のカードに進むこと')

  // 2枚目（最後）: 「知ってた」を選ぶとテスト完了になり、しばらくして先頭に戻る
  fireEvent(document.getElementById('reveal-note'), 'click')
  fireEvent(document.getElementById('known-word'), 'click')
  assert.equal(document.getElementById('status-message').textContent, 'テスト完了')

  await wait(900)
  assert.equal(document.getElementById('test-progress').textContent, '1 / 2', '完了後は先頭のカードに戻ること')
})
