"""
Sphinx extension: generate a lunr.js-compatible search index.

At build time this collects all HTML pages and writes
``search_index.json`` to the output directory.  The JSON file is an
array of objects:

  { "id": "<pagename>", "title": "<plain-text title>", "body": "<plain text>" }

The ``id`` is the Sphinx ``pagename`` (e.g. ``"configuration/index"``).
The client-side JS converts it to a URL with :func:`pageUrl`.

Usage (conf.py):
    extensions += ['lunr_search']
"""

import json
import re

from pathlib import Path

from sphinx.application import Sphinx
from sphinx.util import logging as sphinx_logging

logger = sphinx_logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TAG_RE   = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")

# Maximum body characters stored per page (keeps the JSON manageable).
_MAX_BODY = 5_000


def _strip_html(html: str) -> str:
    text = _TAG_RE.sub(" ", html)
    return _SPACE_RE.sub(" ", text).strip()


def _normalize_title(pagename: str, title: str) -> str:
    """Normalize and clean up page title, fallback to pagename if needed."""
    title = title.strip()
    if not title or title == "/" or title in ("<no title>", "&lt;no title&gt;"):
        if pagename in ("index", "contents"):
            title = "Home"
        else:
            parts = pagename.split('/')
            title = " ".join(p.replace('-', ' ').title() for p in parts if p)
    return title


# ---------------------------------------------------------------------------
# Extension state
# ---------------------------------------------------------------------------

class _State:
    def __init__(self) -> None:
        self.pages: list[dict] = []

    def reset(self) -> None:
        self.pages.clear()


_state = _State()


# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------

def _on_env_before_read_docs(app, env, docnames):  # noqa: unused args
    _state.reset()


def _on_html_page_context(app, pagename, templatename, context, doctree):
    # Skip the Sphinx search page itself and the root index redirect.
    if pagename == "search":
        return

    raw_title = context.get("title", "") or ""
    body = context.get("body", "") or ""

    if not body:
        return

    title = _normalize_title(pagename, _strip_html(raw_title))
    text = _strip_html(body)[:_MAX_BODY]

    _state.pages.append({
        "id": pagename,
        "title": title,
        "body": text,
    })


def _on_build_finished(app, exception):
    if exception:
        return

    out_path = Path(app.outdir) / "search_index.json"
    out_path.write_text(
        json.dumps(_state.pages, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    logger.info(f"lunr_search: wrote {len(_state.pages)} entries → {out_path}")


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

def setup(app: Sphinx) -> dict:
    app.connect("env-before-read-docs", _on_env_before_read_docs)
    app.connect("html-page-context", _on_html_page_context)
    app.connect("build-finished", _on_build_finished)

    return {
        "version": "1.0",
        "parallel_read_safe": True,
    }

