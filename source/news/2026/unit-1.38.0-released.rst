.. meta::
   :og:description: FreeUnit 1.38.0 adds schedules, WASI 0.3 support for
                    WebAssembly components, the libunit 1.38 ABI surface,
                    credential redaction in the access log, and UTF-8 mode
                    for route regexes.

:orphan:

.. _release-1-38-0:

########################
FreeUnit 1.38.0 Released
########################

FreeUnit 1.38.0 was released on **10 November 2026**. It adds **schedules**:
FreeUnit itself can send a periodic internal request to an application, like
cron, with no client and no sidecar process. The WebAssembly component module
runs **WASI 0.3** components beside the unchanged WASI 0.2 path. This is the
release where the **libunit ABI** changes, so an external application that is
linked against libunit must be rebuilt. The access log writes credential
headers as ``REDACTED`` unless ``log_credentials`` opts in, and route regexes
match in UTF-8 mode with PCRE2 10.48 or later.

.. _release-1-38-0-schedules:

Schedules
=========

A new top-level ``schedules`` object makes FreeUnit send a periodic internal
request to an application. A schedule has a ``pass`` that names an application
target (routes and upstreams are not supported), a ``uri`` that is sent as a
``GET``, and an ``interval`` in seconds. The optional keys are ``jitter``,
``timeout``, ``overlap`` (``skip``), ``headers`` and ``run_on_start``.

.. code-block:: json

   "schedules": {
       "drupal-cron": {
           "pass": "applications/drupal",
           "uri": "/cron/KEY",
           "interval": 300,
           "jitter": 15,
           "timeout": 240,
           "overlap": "skip",
           "headers": { "Host": "example.org" }
       }
   }

A run is a normal application request. It counts in ``/status`` under
``requests.total``, goes through ``limits`` and the application queue, and is
recorded in the access log. ``/status/schedules`` shows the counters of each
schedule. When a run passes its ``timeout``, FreeUnit stops waiting for it; the
application process continues and counts against ``processes`` until it
answers or exits. The configuration is validated by building the same request
that a run uses, so a bad ``uri`` or header fails when the configuration is
applied, not on every run.

.. _release-1-38-0-wasi:

WASI 0.3 components
===================

The ``wasm-wasi-component`` module runs components that export
``wasi:http/handler@0.3.0``. A component that exports the WASI 0.2
``wasi:http/incoming-handler@0.2.x`` interface runs on the unchanged 0.2 path.
The module checks the exports of a component once, when it loads it, so no
configuration key selects the path. The 0.3 path uses the asynchronous
component model and the wasmtime-wasi p3 interfaces. Outbound HTTP from a
guest stays disabled on both paths.

WASI 0.3 requires Wasmtime 48.0.8, the pin of this release. The ``wasip3``
0.9.0 crate is the last release on WASI 0.3.0; a newer ``wasip3`` targets
WASI 0.3.2, which Wasmtime 48 does not implement.

.. _release-1-38-0-libunit:

libunit 1.38 ABI
================

This is the release where the libunit ABI may change. libunit carries a
protocol number, ``NXT_UNIT_PROTOCOL_VERSION`` 1. The main process writes
``<version>/<number>`` as the first field of ``NXT_UNIT_INIT``, and libunit
refuses a daemon whose version or protocol number differs, with a separate
"protocol mismatch" alert. A daemon without the number counts as protocol 0.
``nxt_unit_callbacks_t`` is frozen at 12 members, and
``nxt_unit_init_t.size`` is appended after ``max_processes``; it holds the size
of the struct as the caller built it, and 0 means the 1.38 layout.

An external application linked against libunit must be rebuilt against 1.38.
A statically linked copy keeps its own protocol and refuses a daemon that
speaks another. The exported ``nxt_lib_stop()`` function had no caller in the
tree and is removed from the interface.

On Linux, an idle libunit context now waits for a message in an epoll set with
``EPOLLEXCLUSIVE`` on the shared port when the application has 4 or more
processes, so one ``READ_QUEUE`` wakes one idle context instead of every idle
context. With fewer processes it still waits in ``poll()``. The read order and
the behaviour do not change.

.. _release-1-38-0-security:

Security Fixes
==============

- **Credential headers in the access log.** An access log format could name a
  header that carries a credential: ``Authorization``,
  ``Proxy-Authorization``, ``Cookie`` or ``Set-Cookie``, through
  ``$header_<name>`` or ``$response_header_<name>``. Such a variable is now
  written as ``REDACTED``. The new boolean option ``log_credentials`` of
  ``access_log`` keeps the value; it is false by default. This replaces the
  warning that 1.37.1 wrote when such a format was configured.

No new security advisory accompanies this release. The advisories published
with 1.37.2 remain in effect for the versions they name.

.. _release-1-38-0-changes:

Changes
=======

- **Route regexes in UTF-8 mode.** With PCRE2 10.48 or later, ``.`` and a
  character class match one whole UTF-8 character, not one byte, and ``\xHH``
  is a code point, so ``\xff`` matches U+00FF (the bytes C3 BF) and not the
  byte FF. An invalid UTF-8 byte in a request gives no error, but no pattern
  item matches it, so ``.*`` does not go past it: ``~^/api/.*$`` does not
  match ``/api/%FF``, and ``!~^/admin/.*$`` matches ``/admin/%FF``. PCRE 1
  and PCRE2 before 10.48 still match bytes, so the same configuration can
  route such a request differently on two builds.
- **Internal refactorings.** The weekday and month abbreviations are shared,
  the HTTP/1 request field hash becomes protocol-neutral, and the libunit
  wake wait lives in one function. No user-visible behaviour change beyond the
  items above.

.. _release-1-38-0-fixes:

Fixes
=====

- **A request behind a graceful ``QUIT``.** When a graceful ``QUIT`` arrived
  on the read port while the shared port was readable, the context could go
  offline without taking the request that the router had just queued, so that
  request waited for the next doorbell or for another context's one-second
  wait. The context now takes one request before it returns the rung.

.. _release-1-38-0-upgrade:

Upgrade Notes
=============

- **Rebuild external libunit applications against 1.38.** The protocol
  number, the frozen callbacks table and the appended
  ``nxt_unit_init_t.size`` are the 1.38 interface. A daemon that does not
  speak the same protocol is refused with an alert, and a statically linked
  libunit keeps the protocol of its own build.
- **Schedules are opt-in.** No existing configuration gains a schedule. Add a
  top-level ``schedules`` object to use them; a run is an ordinary request and
  counts against the application's ``processes``, ``limits`` and queue.
- **WASI 0.3 needs no configuration change.** Detection is by the component's
  exports; WASI 0.2 components keep their path.
- **Regex routing can change with PCRE2 10.48 or later.** Patterns that relied
  on byte matching for invalid UTF-8, especially negative patterns, can match
  differently. The change is described above.
- **Access log formats that name credential headers now write ``REDACTED``.**
  Set ``log_credentials`` to true only where the log file is protected
  accordingly.

.. _release-1-38-0-details:

Release Details
===============

- Full details in `CHANGES
  <https://github.com/freeunitorg/freeunit/blob/1.38.0/CHANGES>`__.
- The libunit ABI notes for embedders are in `docs/libunit-abi.md
  <https://github.com/freeunitorg/freeunit/blob/1.38.0/docs/libunit-abi.md>`__.
- unitctl changes: `tools/unitctl/CHANGELOG.md
  <https://github.com/freeunitorg/freeunit/blob/1.38.0/tools/unitctl/CHANGELOG.md>`__.
- Compare with 1.37.2: `1.37.2...1.38.0
  <https://github.com/freeunitorg/freeunit/compare/1.37.2...1.38.0>`__.
