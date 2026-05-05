'use strict';

/*
 * Adapted Font Awesome icons, CC BY 4.0 License:
 * https://fontawesome.com
 * https://creativecommons.org/licenses/by/4.0/
 */


function nxt_scroll_init() {
    const h1 = document.querySelector('#side h1')

    if (window.scrollY > 50) {
        h1.classList.add('notrans', 'compact')
    }

    window.addEventListener('scroll', function() {
        h1.classList.remove('notrans')
        h1.classList.toggle('compact', window.scrollY > 50)
    })
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


function nxt_dom_ready() {
    nxt_scroll_init()
    nxt_tab_init()
    nxt_hash_change()
    nxt_search_init()

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
            const first = container.querySelector('.nxt_search_item a')
            if (first) { window.location.href = first.href }
        }
        if (e.key === 'Escape') {
            container.classList.remove('nxt_search_open')
            suggestedContainer.classList.remove('nxt_search_open')
            input.value = ''
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

