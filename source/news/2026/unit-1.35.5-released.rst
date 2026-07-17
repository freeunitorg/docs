:orphan:

####################
Unit 1.35.5 Released
####################

FreeUnit 1.35.5 promotes chunked request-body transformation out of
experimental status, fixes a TLS busy-loop on peer-initiated close, plugs a
set of memory and file-descriptor leaks in the port machinery, and upgrades
njs.

**Proxy / HTTP**

- Chunked request bodies are now automatically converted to ``Content-Length``
  when forwarded upstream via a ``proxy`` action, for backends that do not
  accept ``Transfer-Encoding: chunked`` (e.g. Gitea). Resolves the client-side
  chunked, duplicate ``Transfer-Encoding``, and RFC 9112 framing issues.
- The ``chunked_transform`` setting is **no longer experimental** — enable it
  with ``{"settings": {"http": {"chunked_transform": true}}}``.

**TLS**

- Fixed a busy-loop in ``SSL_write`` on a peer-initiated close when the
  connection is aborted by the remote peer, which caused high CPU usage;
  the connection is now cleaned up properly.

**Reliability**

- Fixed a mem-pool retain leak in the cert/script-store IPC paths (router
  side) and fd/buffer leaks in the cert/script/socket/access-log reply paths
  and the controller config-store path (main process side) — all reachable
  when ``nxt_port_msg_alloc`` fails inside the port machinery.

**Tooling**

- Added ``unfreeze-sync.sh`` for automated migration of issues from
  ``nginx/unit`` to ``freeunitorg/freeunit`` with label mapping, deduplication,
  and dry-run preview.

**Dependencies**

- Upgraded contrib njs to 0.9.8.

**************
Full Changelog
**************

.. code-block:: none

  Changes with FreeUnit 1.35.5                                     29 May 2026
  
      *) Feature: automatically convert chunked request bodies to Content-Length
         when forwarding to upstream servers via proxy action. This enables
         compatibility with backends that do not support Transfer-Encoding:
         chunked (e.g., Gitea, servers requiring Content-Length). Fixes
         freeunitorg/freeunit#58, resolves nginx/unit#445 (client chunked),
         nginx/unit#1088 (duplicate TE), and nginx/unit#1278 (RFC 9112 epic).
  
      *) Change: chunked_transform feature is no longer experimental. Chunked
         request bodies can be accepted and transparently converted to
         Content-Length via configuration: { "settings": { "http":
         { "chunked_transform": true } } }
  
      *) Bugfix: fix TLS library busy-loop on peer-initiated close in SSL_write
         when connection is aborted by remote peer; prevents high CPU usage and
         ensures proper connection cleanup.
  
      *) Feature: add unfreeze-sync.sh script for automated migration of issues
         from nginx/unit to freeunitorg/freeunit with label mapping, deduplication,
         and dry-run preview support.
  
      *) Change: upgrade contrib njs to 0.9.8.
  
      *) Bugfix: fix mem-pool retain leak in cert/script-store IPC paths
         (router side) and fd/buffer leaks in cert/script/socket/access-log
         reply paths and the controller config-store path (main process
         side); all reachable when nxt_port_msg_alloc fails inside the
         port machinery.
  
  
