import { JSDOM, ResourceLoader } from 'jsdom'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// index.html が読み込む相対パスのscript/linkを、ネットワーク経由ではなくローカルの
// ファイルシステムから解決するためのResourceLoader。
class FileResourceLoader extends ResourceLoader {
  fetch(url) {
    const parsed = new URL(url)
    const filePath = path.join(REPO_ROOT, decodeURIComponent(parsed.pathname))
    try {
      return Promise.resolve(fs.readFileSync(filePath))
    } catch (err) {
      return Promise.reject(err)
    }
  }
}

const indexHtml = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8')

// jsdomは<dialog>のshowModal/closeを実装していない。
// script.jsが使う最小限の挙動（open属性の反映とcloseイベント発火）だけを補う。
function shimDialog(window) {
  window.HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  window.HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
    this.dispatchEvent(new window.Event('close'))
  }
}

/**
 * index.html / script.js を実ブラウザに近い形でjsdomへ読み込み、
 * window の load 完了後の状態を返す。
 * script.js はモジュールではなく素朴な<script>のため、トップレベルの関数宣言
 * （render, addOrMarkWord, openTest など）はそのままwindowのプロパティになる。
 * 各テストはこの関数を毎回呼び、新しいDOM・新しいlocalStorageから開始する。
 */
export async function createApp() {
  const dom = new JSDOM(indexHtml, {
    url: 'https://example.org/',
    runScripts: 'dangerously',
    resources: new FileResourceLoader(),
    pretendToBeVisual: true,
    storageQuota: 10_000_000,
  })

  await new Promise((resolve, reject) => {
    dom.window.addEventListener('load', resolve)
    dom.window.addEventListener('error', event => {
      reject(event.error ?? new Error(String(event.message)))
    })
    setTimeout(() => reject(new Error('index.html の読み込みがタイムアウトしました')), 5000)
  })

  shimDialog(dom.window)
  return dom.window
}

export function fireEvent(el, type, options = {}) {
  const Event = el.ownerDocument.defaultView.Event
  el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, ...options }))
}

export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
