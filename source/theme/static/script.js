'use strict';

/*
 * Adapted Font Awesome icons, CC BY 4.0 License:
 * https://fontawesome.com
 * https://creativecommons.org/licenses/by/4.0/
 */


function nxt_scroll_init() {
    // Scroll-based compact logo animation has been removed.
    // The logo now uses a static flex layout.
}



function nxt_tab_click(e) {
    e.preventDefault()
    history.replaceState({}, '', e.target.href)
    e.target.parentElement.previousElementSibling.checked=true
}


function nxt_tab_init() {
    for (const el of document.querySelectorAll('.nxt_tabs > input')) {
        el.classList.replace('nojs', 'js')
    }
}


function nxt_nav_init() {
    const observer = new IntersectionObserver((entries, observer) => {
        for (const entry of entries) {

            const toc_id = (entry.target.classList.contains('section'))
                           ? entry.target.id
                           : entry.target.previousElementSibling.id;

            const selector = '#side .toctree-l1 a[href="#' + toc_id + '"]'

            const anchor = document.querySelector(selector)

            if (anchor) {
                anchor.classList.toggle('nxt_active',
                                        entry.intersectionRatio > 0)
            }
        }
    })

    const sections = '#content > :not(#howto) div.section'

    for (const el of document.querySelectorAll(sections)) {
        observer.observe(el)
    }

    const tabs = '.nxt_toc > label + div'

    for (const el of document.querySelectorAll(tabs)) {
        observer.observe(el)
    }
}


function nxt_copy_init() {
    const template = document.createElement('template');

    /*
    <label class="nxt_copy_btn">
        <input type="radio" name="nxt_copy" onclick="nxt_copy(this)">
        <a title="Click to copy">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M320 448v40c0 13.255-10.745 24-24 24H24c-13.255 0-24-10.745-24-24V120c0-13.255 10.745-24 24-24h72v296c0 30.879 25.121 56 56 56h168zm0-344V0H152c-13.255 0-24 10.745-24 24v368c0 13.255 10.745 24 24 24h272c13.255 0 24-10.745 24-24V128H344c-13.2 0-24-10.8-24-24zm120.971-31.029L375.029 7.029A24 24 0 0 0 358.059 0H352v96h96v-6.059a24 24 0 0 0-7.029-16.97z" /></svg>
        </a>
        <a title="Copied to clipboard">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M336 64h-80c0-35.3-28.7-64-64-64s-64 28.7-64 64H48C21.5 64 0 85.5 0 112v352c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zM192 40c13.3 0 24 10.7 24 24s-10.7 24-24 24-24-10.7-24-24 10.7-24 24-24zm121.2 231.8l-143 141.8c-4.7 4.7-12.3 4.6-17-.1l-82.6-83.3c-4.7-4.7-4.6-12.3.1-17L99.1 285c4.7-4.7 12.3-4.6 17 .1l46 46.4 106-105.2c4.7-4.7 12.3-4.6 17 .1l28.2 28.4c4.7 4.8 4.6 12.3-.1 17z" /></svg>
        </a>
    </label>
    */

    /* Minified version of the above code. */
    template.innerHTML = '<label class=nxt_copy_btn><input type=radio name=nxt_copy onclick=nxt_copy(this)><a title="Click to copy"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M320 448v40c0 13.255-10.745 24-24 24H24c-13.255.0-24-10.745-24-24V120c0-13.255 10.745-24 24-24h72v296c0 30.879 25.121 56 56 56h168zm0-344V0H152c-13.255.0-24 10.745-24 24v368c0 13.255 10.745 24 24 24h272c13.255.0 24-10.745 24-24V128H344c-13.2.0-24-10.8-24-24zm120.971-31.029L375.029 7.029A24 24 0 00358.059.0H352v96h96v-6.059a24 24 0 00-7.029-16.97z"/></svg></a><a title="Copied to clipboard"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M336 64h-80c0-35.3-28.7-64-64-64s-64 28.7-64 64H48C21.5 64 0 85.5.0 112v352c0 26.5 21.5 48 48 48h288c26.5.0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zM192 40c13.3.0 24 10.7 24 24s-10.7 24-24 24-24-10.7-24-24 10.7-24 24-24zm121.2 231.8-143 141.8c-4.7 4.7-12.3 4.6-17-.1l-82.6-83.3c-4.7-4.7-4.6-12.3.1-17L99.1 285c4.7-4.7 12.3-4.6 17 .1l46 46.4 106-105.2c4.7-4.7 12.3-4.6 17 .1l28.2 28.4c4.7 4.8 4.6 12.3-.1 17z"/></svg></a></label>';

    const btn = template.content.childNodes[0];

    for (let el of document.getElementsByClassName('highlight')) {
        const pre = el.firstChild;
        const html = pre.innerHTML
        const pos = html.indexOf('\n')

        pre.innerHTML = html.slice(0, pos)
                        + '<span class="nxt_copy_ws">     </span>'
                        + html.slice(pos)

        el.parentElement.appendChild(btn.cloneNode(true))
    }

    document.body.addEventListener('copy', nxt_copy_reset)
}


function nxt_copy(btn) {
    const container = btn.closest('div')
    let text = container.querySelector('pre').innerText

    if (container.classList.contains('highlight-console')) {
        text = nxt_copy_console(text)
    }

    navigator.clipboard.writeText(text).then(function() {
        console.log(text.length + ' chars copied to clipboard')

    }, function() {
        nxt_copy_reset()
        console.log('clipboard write failed')
    })
}


function nxt_copy_console(text) {
    const result = []

    let heredoc = false
    let multi = false
    let single_quotes = 0
    let double_quotes = 0

    for (let line of text.split('\n')) {
        const trimmed = line.trim()

        if (!multi) {
            if (heredoc) {
                if (trimmed === heredoc) {
                    heredoc = false
                    line = trimmed
                }

                result.push(line)
                continue
            }

            switch (trimmed[0]) {
            case '$':
                line = trimmed.replace(/^\$\s*/, '')
                break
            case '#':
                line = trimmed.replace(/^#\s*/, '')
                break
            default:
                continue
            }

            line = line.replace(/\s+#.+$/, '')
        }

        const matches = trimmed.match(/<<\s*(\w+)/)
        if (matches) {
            heredoc = matches[1]
        }

        result.push(line)

        single_quotes += (line.match(/\'/g) || []).length
        double_quotes += (line.match(/\"/g) || []).length
        multi = (trimmed.substr(-1) === '\\'
                 || single_quotes & 1
                 || double_quotes & 1)
    }

    return result.join('\n')
}


function nxt_copy_reset() {
    const el = document.querySelector('.nxt_copy_btn input:checked')
    if (el) {
        el.checked = false
    }
}


function nxt_mobile_menu_init() {
    const btn = document.getElementById('mobile-menu-btn')
    const side = document.getElementById('side')
    const overlay = document.getElementById('side-overlay')
    if (!btn || !side) return

    function openMenu() {
        side.classList.add('side-open')
        overlay && overlay.classList.add('overlay-open')
        btn.setAttribute('aria-expanded', 'true')
        btn.textContent = '✕'
    }
    function closeMenu() {
        side.classList.remove('side-open')
        overlay && overlay.classList.remove('overlay-open')
        btn.setAttribute('aria-expanded', 'false')
        btn.textContent = '☰'
    }

    btn.addEventListener('click', () => {
        side.classList.contains('side-open') ? closeMenu() : openMenu()
    })
    overlay && overlay.addEventListener('click', closeMenu)

    // Close on Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && side.classList.contains('side-open')) closeMenu()
    })
}


/* ─────────────────────────────────────────────────────────────────────
 * Accessibility Widget
 * Settings are stored in localStorage under the key 'a11y_prefs'
 * as a JSON object: { text: '', contrast: '', font: '', spacing: '',
 *                     motion: '', links: '', color: '' }
 * Each value is either '' (default) or a CSS class name to apply to <html>.
 * ───────────────────────────────────────────────────────────────────── */

// All known a11y class names — cleaned up on reset
const A11Y_ALL_CLASSES = [
    'a11y-text-lg', 'a11y-text-xl', 'a11y-text-xxl',
    'a11y-contrast-light', 'a11y-contrast-dark',
    'a11y-dyslexic',
    'a11y-spacing',
    'a11y-no-motion',
    'a11y-highlight-links',
    'a11y-grayscale',
]

const A11Y_STORAGE_KEY = 'a11y_prefs'

function a11y_load_prefs() {
    try {
        return JSON.parse(localStorage.getItem(A11Y_STORAGE_KEY) || '{}')
    } catch (e) {
        return {}
    }
}

function a11y_save_prefs(prefs) {
    try {
        localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(prefs))
    } catch (e) { /* quota exceeded or incognito */ }
}

function a11y_apply_class(group, cls) {
    const html = document.documentElement
    // Remove all classes that belong to this group
    const buttons = document.querySelectorAll(`[data-a11y-group="${group}"]`)
    buttons.forEach(btn => {
        const c = btn.getAttribute('data-a11y-class')
        if (c) html.classList.remove(c)
    })
    // Add the new one
    if (cls) html.classList.add(cls)
}

function a11y_update_buttons(prefs) {
    document.querySelectorAll('.a11y-opt').forEach(btn => {
        const group = btn.getAttribute('data-a11y-group')
        const cls   = btn.getAttribute('data-a11y-class')
        const active = (prefs[group] || '') === (cls || '')
        btn.setAttribute('aria-pressed', active ? 'true' : 'false')
    })
}

// Dynamically load OpenDyslexic font from jsDelivr CDN once
function a11y_load_dyslexic_font() {
    if (document.getElementById('a11y-dyslexic-font')) return
    const style = document.createElement('style')
    style.id = 'a11y-dyslexic-font'
    style.textContent = `
@font-face {
    font-family: 'OpenDyslexic';
    src: url('https://cdn.jsdelivr.net/npm/opendyslexic@1.0.3/fonts/OpenDyslexic-Regular.woff2') format('woff2'),
         url('https://cdn.jsdelivr.net/npm/opendyslexic@1.0.3/fonts/OpenDyslexic-Regular.otf')  format('opentype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}
@font-face {
    font-family: 'OpenDyslexic Mono';
    src: url('https://cdn.jsdelivr.net/npm/opendyslexic@1.0.3/fonts/OpenDyslexicMono-Regular.woff2') format('woff2'),
         url('https://cdn.jsdelivr.net/npm/opendyslexic@1.0.3/fonts/OpenDyslexicMono-Regular.otf')  format('opentype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
}`
    document.head.appendChild(style)
}

function nxt_a11y_init() {
    const toggle  = document.getElementById('a11y-toggle')
    const panel   = document.getElementById('a11y-panel')
    const closeBtn = document.querySelector('.a11y-close')
    const resetBtn = document.getElementById('a11y-reset')
    if (!toggle || !panel) return

    let prefs = a11y_load_prefs()

    // Apply saved prefs on load
    Object.entries(prefs).forEach(([group, cls]) => {
        a11y_apply_class(group, cls)
        if (group === 'font' && cls === 'a11y-dyslexic') a11y_load_dyslexic_font()
    })
    a11y_update_buttons(prefs)

    // ── Open / Close panel ──────────────────────────────────────────────
    function openPanel() {
        panel.hidden = false
        toggle.setAttribute('aria-expanded', 'true')
        // Focus first interactive element in panel
        const first = panel.querySelector('button:not([hidden])')
        if (first) first.focus()
    }

    function closePanel() {
        panel.hidden = true
        toggle.setAttribute('aria-expanded', 'false')
        toggle.focus()
    }

    toggle.addEventListener('click', () => {
        panel.hidden ? openPanel() : closePanel()
    })

    closeBtn && closeBtn.addEventListener('click', closePanel)

    // Close on Escape when panel is open
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !panel.hidden) {
            e.stopPropagation()
            closePanel()
        }
    })

    // Close when clicking outside widget
    document.addEventListener('click', e => {
        const widget = document.getElementById('a11y-widget')
        if (!panel.hidden && widget && !widget.contains(e.target)) {
            closePanel()
        }
    })

    // Focus trap inside panel
    panel.addEventListener('keydown', e => {
        if (e.key !== 'Tab') return
        const focusable = Array.from(panel.querySelectorAll('button:not([disabled])'))
        if (!focusable.length) return
        const first = focusable[0]
        const last  = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
        }
    })

    // ── Toggle option buttons ────────────────────────────────────────────
    panel.querySelectorAll('.a11y-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.getAttribute('data-a11y-group')
            const cls   = btn.getAttribute('data-a11y-class') || ''

            prefs[group] = cls
            a11y_apply_class(group, cls)
            a11y_update_buttons(prefs)
            a11y_save_prefs(prefs)

            // Load dyslexic font on demand
            if (group === 'font' && cls === 'a11y-dyslexic') {
                a11y_load_dyslexic_font()
            }
        })
    })

    // ── Reset ────────────────────────────────────────────────────────────
    resetBtn && resetBtn.addEventListener('click', () => {
        prefs = {}
        A11Y_ALL_CLASSES.forEach(c => document.documentElement.classList.remove(c))
        a11y_update_buttons(prefs)
        a11y_save_prefs(prefs)
        // Announce to screen readers
        const msg = document.createElement('div')
        msg.setAttribute('role', 'status')
        msg.setAttribute('aria-live', 'polite')
        msg.className = 'sr-only'
        msg.textContent = 'Accessibility settings have been reset to default.'
        document.body.appendChild(msg)
        setTimeout(() => msg.remove(), 3000)
    })

    // ── Keyboard shortcut: Alt + A ───────────────────────────────────────
    document.addEventListener('keydown', e => {
        if (e.altKey && e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            panel.hidden ? openPanel() : closePanel()
        }
    })
}


function nxt_dom_ready() {
    nxt_scroll_init()
    nxt_tab_init()
    nxt_hash_change()
    nxt_search_init()
    nxt_mobile_menu_init()
    nxt_a11y_init()

    // Adjust search placeholder for non-Mac platforms
    const input = document.getElementById('nxt_search_input')
    if (input && !/Mac|iPhone|iPad/.test(navigator.platform || '')) {
        input.placeholder = input.placeholder.replace('⌘K', 'Ctrl+K')
    }

    if (IntersectionObserver) {
        nxt_nav_init()
    } else {
        console.log('IntersectionObserver API is not available')
    }

    if (navigator.clipboard) {
        nxt_copy_init()

    } else {
        console.log('Clipboard API is not available')
    }
}


function nxt_hash_change() {
    if (window.location.hash) {
        const selector = '.nxt_tabs > label' + window.location.hash

        const el = document.querySelector(selector)
        if (el) {
            el.previousElementSibling.checked = true
        }

        const d = document.getElementById(window.location.hash.substring(1)
            + '_')
        if (d && d.tagName.toLowerCase() === 'details') {
            if (!d.open) {
                d.scrollIntoView()
            }
        }
    }
}


window.addEventListener('hashchange', nxt_hash_change)

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', nxt_dom_ready)

} else {
    nxt_dom_ready()
}


/* Lunr.js full-text search */

let _nxt_search_index = null
let _nxt_search_docs = null
let _nxt_search_promise = null


function nxt_search_index_url() {
    const depth = window.location.pathname
        .replace(/\/$/, '')
        .split('/')
        .length - 1
    const prefix = depth > 0 ? '../'.repeat(depth) : './'
    return prefix + 'search_index.json'
}


function nxt_search_page_url(pagename) {
    // Convert a Sphinx pagename to a site-relative URL the same way
    // DirectoryHTMLBuilder does:
    //   "index"              → "/"
    //   "configuration/index"→ "/configuration/"
    //   "installation"       → "/installation/"
    if (pagename === 'index' || pagename === 'contents') return '/'
    const clean = pagename.replace(/\/index$/, '')
    return '/' + clean + '/'
}


function nxt_search_load_index() {
    if (_nxt_search_promise) return _nxt_search_promise
    _nxt_search_promise = fetch(nxt_search_index_url())
        .then(r => r.json())
        .then(pages => {
            _nxt_search_docs = {}
            pages.forEach(p => { _nxt_search_docs[p.id] = p })

            // Title gets 15x boost
            _nxt_search_index = lunr(function() {
                this.ref('id')
                this.field('title', { boost: 15 })
                this.field('body', { boost: 1 })
                pages.forEach(function(p) { this.add(p) }, this)
            })
        })
    return _nxt_search_promise
}


function nxt_search_highlight(text, query) {
    const words = query.trim().split(/\s+/).filter(Boolean)
    let snippet = text.slice(0, 160)
    words.forEach(w => {
        const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi')
        snippet = snippet.replace(re, '<mark>$1</mark>')
    })
    return snippet + (text.length > 160 ? '…' : '')
}


function nxt_search_render_results(results, query, container) {
    container.innerHTML = ''
    if (!results.length) {
        container.innerHTML = '<div class="nxt_search_none">No results found.</div>'
        container.classList.add('nxt_search_open')
        return
    }
    results.slice(0, 12).forEach(r => {
        const doc = _nxt_search_docs[r.ref]
        const url = nxt_search_page_url(r.ref)
        const item = document.createElement('div')
        item.className = 'nxt_search_item'

        const a = document.createElement('a')
        a.href = url

        const title = document.createElement('div')
        title.className = 'nxt_search_title'
        title.textContent = doc.title

        const snippet = document.createElement('div')
        snippet.className = 'nxt_search_snippet'
        snippet.innerHTML = nxt_search_highlight(doc.body, query)

        a.appendChild(title)
        a.appendChild(snippet)
        item.appendChild(a)
        container.appendChild(item)
    })
    container.classList.add('nxt_search_open')
}


function nxt_search_get_suggestions() {
    const suggestions = new Set()
    Object.values(_nxt_search_docs).forEach(doc => {
        suggestions.add(doc.title)
    })
    return Array.from(suggestions).sort().slice(0, 5)
}


function nxt_search_render_suggestions(container) {
    container.innerHTML = ''
    const suggestions = nxt_search_get_suggestions()
    if (!suggestions.length) return

    const ul = document.createElement('ul')
    ul.className = 'nxt_search_suggestion_list'
    suggestions.forEach(suggestion => {
        const li = document.createElement('li')
        li.className = 'nxt_search_suggestion_item'

        const a = document.createElement('a')
        a.href = 'javascript:void(0)'
        a.textContent = suggestion

        a.addEventListener('click', e => {
            e.preventDefault()
            document.getElementById('nxt_search_input').value = suggestion
            document.getElementById('nxt_search_input').dispatchEvent(new Event('input'))
        })

        li.appendChild(a)
        ul.appendChild(li)
    })
    container.appendChild(ul)
}


function nxt_search_init() {
    const input = document.getElementById('nxt_search_input')
    const container = document.getElementById('nxt_search_results')
    const suggestedContainer = document.getElementById('nxt_search_suggestions')
    if (!input || !container) return

    let timer = null

    document.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault()
            input.focus()
            input.select()
        }
    })

    input.addEventListener('focus', () => {
        nxt_search_load_index().then(() => {
            if (!input.value.trim()) {
                nxt_search_render_suggestions(suggestedContainer)
                suggestedContainer.classList.add('nxt_search_open')
            }
        })
    })

    input.addEventListener('input', () => {
        clearTimeout(timer)
        const q = input.value.trim()

        if (!q) {
            container.classList.remove('nxt_search_open')
            container.innerHTML = ''
            nxt_search_load_index().then(() => {
                nxt_search_render_suggestions(suggestedContainer)
                suggestedContainer.classList.add('nxt_search_open')
            })
            return
        }

        suggestedContainer.classList.remove('nxt_search_open')

        timer = setTimeout(() => {
            nxt_search_load_index().then(() => {
                let results = _nxt_search_index.search(q + '~1')  // fuzzy
                if (!results.length) results = _nxt_search_index.search(q)  // exact fallback
                nxt_search_render_results(results, q, container)
            })
        }, 200)
    })

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const active = container.querySelector('.nxt_search_item.nxt_active a')
                        || container.querySelector('.nxt_search_item a')
            if (active) { window.location.href = active.href }
        }
        if (e.key === 'Escape') {
            container.classList.remove('nxt_search_open')
            suggestedContainer.classList.remove('nxt_search_open')
            input.value = ''
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const items = Array.from(container.querySelectorAll('.nxt_search_item'))
            if (!items.length) return
            const cur = container.querySelector('.nxt_search_item.nxt_active')
            let idx = items.indexOf(cur)
            items.forEach(i => i.classList.remove('nxt_active'))
            if (e.key === 'ArrowDown') idx = Math.min(idx + 1, items.length - 1)
            else idx = Math.max(idx - 1, 0)
            items[idx] && items[idx].classList.add('nxt_active')
            items[idx] && items[idx].scrollIntoView({ block: 'nearest' })
        }
    })

    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !container.contains(e.target) && !suggestedContainer.contains(e.target)) {
            container.classList.remove('nxt_search_open')
            suggestedContainer.classList.remove('nxt_search_open')
        }
    })

    if ('requestIdleCallback' in window) {
        requestIdleCallback(nxt_search_load_index)
    }
}

