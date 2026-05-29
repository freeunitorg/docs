:orphan:

####################
Unit 1.35.5 Released
####################

FreeUnit 1.35.5 promotes chunked-to-Content-Length request body conversion out
of experimental, fixes a TLS busy-loop on peer-initiated close, and plugs
several memory and file descriptor leaks in the port machinery.

**HTTP**

- Chunked request bodies are now automatically converted to ``Content-Length``
  when forwarding to upstream servers via the proxy action.  Enables
  compatibility with backends that do not support ``Transfer-Encoding:
  chunked`` (e.g. Gitea).
- The ``chunked_transform`` feature is no longer experimental.  Enable via
  configuration:

  .. code-block:: json

     { "settings": { "http": { "chunked_transform": true } } }

**TLS**

- Fixed busy-loop on peer-initiated close in ``SSL_write`` when the connection
  is aborted by the remote peer; prevents high CPU usage and ensures proper
  connection cleanup.

**Bugfixes**

- Fixed mem-pool retain leak in cert/script-store IPC paths (router side) and
  fd/buffer leaks in cert/script/socket/access-log reply paths and the
  controller config-store path (main process side); all reachable when
  ``nxt_port_msg_alloc`` fails inside the port machinery.

**Dependencies**

- contrib njs upgraded to 0.9.8.

**Tooling**

- Added ``unfreeze-sync.sh`` script for automated migration of issues from
  nginx/unit to freeunitorg/freeunit with label mapping, deduplication, and
  dry-run preview support.

**************
Full Changelog
**************

.. code-block:: none

  Changes with FreeUnit 1.35.5                                     29 May 2026

      *) Feature: automatically convert chunked request bodies to
         Content-Length when forwarding to upstream servers via proxy action.

      *) Change: chunked_transform feature is no longer experimental.

      *) Bugfix: fix TLS library busy-loop on peer-initiated close in SSL_write
         when connection is aborted by remote peer.

      *) Feature: add unfreeze-sync.sh script for automated migration of issues
         from nginx/unit to freeunitorg/freeunit.

      *) Change: upgrade contrib njs to 0.9.8.

      *) Bugfix: fix mem-pool retain leak in cert/script-store IPC paths and
         fd/buffer leaks in cert/script/socket/access-log reply paths and the
         controller config-store path; all reachable when nxt_port_msg_alloc
         fails inside the port machinery.
