.. meta::
   :og:description: FreeUnit 1.37.2 fixes security issues, compresses
                    responses of unknown length with bounded compressor
                    state, tightens HTTP parsing, and fixes WebSocket,
                    application queue and TLS shutdown bugs.

:orphan:

.. _release-1-37-2:

########################
FreeUnit 1.37.2 Released
########################

FreeUnit 1.37.2 was released on **9 November 2026**. It fixes these security
issues: the Wasmtime advisories RUSTSEC-2026-0420 through RUSTSEC-2026-0424,
the way the ``unitc``, ``setup-unit`` and ``unitctl`` tools find a running
unitd, and the request line that the proxy sends after a ``rewrite``. The
prototype and discovery processes now check the sender of two process
messages. The release compresses application responses of unknown length and
bounds the memory of each compressor, parses chunk extensions, ``Connection``
options and upstream status lines strictly, and fixes WebSocket, application
queue and TLS shutdown bugs. The PHP module builds with PHP 8.7, and there are
Docker images for Python 3.15.

.. _release-1-37-2-security:

Security Fixes
==============

- **Wasmtime 48.0.8.** Wasmtime, wasmtime-wasi and wasmtime-wasi-http move
  to 48.0.8 for RUSTSEC-2026-0420 through RUSTSEC-2026-0424. Cranelift moves
  to 0.135.8 with Wasmtime, and the contrib C API pin is 48.0.8 too. The
  WebAssembly modules get the fix when they are built from this release.
- **unitd discovery in the tools.** ``unitc`` and ``setup-unit`` found a
  running unitd by its process title alone and trusted the command line and
  files of whatever matched. A local user could run a process titled
  ``unit: main``, so that an operator who ran the tool as root would run that
  user's program: ``unitc`` built a command from the title, ``setup-unit``
  passed it to ``eval``. ``unitc`` also sourced a cache file that the user
  could plant in the world-writable ``/tmp``. The tools now trust only a
  ``unit: main`` owned by the superuser or by the user who runs them, and
  ``unitc`` reads and creates its ``/tmp`` cache only as a regular file that it
  owns, refusing a symlink. ``unitctl`` applies the same owner rule when it
  discovers a running unitd.
- **Rewritten proxy targets.** When a ``rewrite`` action changed the URI of a
  proxied request, the router sent the rewritten target to the upstream
  without re-encoding it. A rewrite that interpolated the decoded request
  path, for example ``$uri``, could place a raw CR, LF or space into the
  target. That could inject a header into the upstream request, or smuggle a
  second request to the upstream.
  The router now percent-encodes the rewritten target by its actual content
  before it builds the upstream request line. Only configurations that
  combine :ref:`rewrite <configuration-rewrite>` with
  :ref:`proxy <configuration-proxy>` are affected.

The release also hardens how Unit's processes accept messages from each other.
The prototype and discovery processes now accept ``NEW_PORT`` and
``REMOVE_PID`` only from the main process, as the main process already does for
these two types on its main port. An application worker inherits the port of
the prototype that forked it, so it could write to that port and forge either
type to corrupt the process records that the prototype keeps. A message of
either type is now dropped, and the descriptors it carries are closed, unless
its sender is the main process; the sender is validated by ``SCM_CREDENTIALS``
where the platform provides it, otherwise by the pid in the message header.

.. _release-1-37-2-compression:

Compression Changes
===================

- A response of unknown length, such as a streamed application response or
  the output of a PHP script that sends no ``Content-Length``, is now
  compressed. ``min_length`` applies only to a response of known length. A
  client that refuses identity and accepts no configured coding gets ``406``.
- The gzip and deflate compressors now use the zlib defaults, a 32 KiB window
  and memLevel 8, instead of a 512-byte window. For a response of known
  length both shrink to fit it, as in nginx. Responses are smaller and cost
  less CPU. A compressed stream of unknown length uses a 4 KiB window and
  memLevel 6, about 54 KiB of zlib state.
- The Brotli compressor now uses a window of at most 512 KiB (19 bits) and
  gets a known length as a size hint; before, a response at quality 11 could
  hold about 43 MB of state. The zstd compressor shrinks its window to a
  known length. The coded bytes stay valid for any client.
- Each open compressed response of unknown length holds the state of its
  compressor until the response ends: about 54 KiB for gzip, 1.7 MB for zstd and 6 MB for Brotli.
- The Brotli compressor reports an error when its output buffer is too small
  for a flush, instead of returning a cut stream. No case was found where the
  buffers that Unit allocates are too small. The last part now ends the
  stream with a last meta-block, so a coded body can be up to 2 bytes shorter
  than before.
- A ``206`` application response is no longer compressed, as in nginx: its
  ``Content-Range`` counts the bytes of the uncompressed body. A client that
  refuses identity gets ``406``.
- A response that Unit compresses no longer keeps ``Accept-Ranges``, whether
  it came from the static handler, the application or ``response_headers``.
- A ``compression`` object without ``compressors`` is now refused, with the
  reason. Before, it passed validation and turned compression off for the
  whole configuration with no log line.

For more information, see :ref:`configuration-compression`.

.. _release-1-37-2-http:

HTTP Parsing and Routing
========================

- A chunk extension that is not valid syntax (RFC 9112, Section 7.1.1), for
  example a bare ``;``, a name that is not a token or a NUL byte, was
  accepted, and a bare LF in an extension made the request hang. Such a
  chunked request body now gets ``400``, and a chunked response from an
  upstream server is refused in the same way. Valid extensions are still
  ignored.
- The router searched the ``Connection`` request header for each option as a
  substring, and in one field line ``keep-alive`` won over ``close``. An
  option now counts only as a whole token of the comma-separated list, in any
  letter case, and ``close`` wins in any order. ``X-Closer`` no longer closes
  the connection, and ``Keep-Alive-Extension`` no longer keeps an HTTP/1.0
  connection open. The ``Transfer-Encoding`` request header now takes
  ``chunked`` in any letter case; before, ``Chunked`` got ``501``.
- The proxy read the status code of an upstream response at a fixed offset,
  so ``HTTP/1.1 2049 OK`` was read as ``204``. The status code must now have
  one space before it and a space or the line end after it, and a CR is valid
  only before the LF. Other status lines get ``502``.
- ``response_headers`` now refuses ``Content-Length`` in any letter case and
  ``Transfer-Encoding``, because Unit sets the body length of a response
  itself. A stored configuration from an earlier version with these names
  still loads: Unit logs a warning and does not send these fields, and the
  control API refuses updates until they are removed.
- A route regular expression was matched with a fresh PCRE2 match context for
  each request. From PCRE2 10.41 the backtracking frames of the match, up to
  the 16 MB heap limit, came from the request's memory pool, which never
  frees memory, so a crafted request held them until the request ended. One
  bounded match object now serves each router thread and reuses its frame
  memory across requests. A pattern that reaches a match limit is logged
  once, so a flood of crafted requests cannot flood the log. No limit value
  changes.
- A ``host`` match pattern written in Unicode, such as ``münchen.example``,
  matched only a ``Host`` header sent as raw UTF-8, not the punycode form a
  browser sends. Each non-ASCII label is now converted to punycode when the
  configuration is loaded, so the pattern matches the punycode form and no
  longer the raw one. The control API refuses a pattern that cannot be
  converted: a wildcard inside a non-ASCII label, invalid UTF-8, or a label
  over 63 bytes in punycode. Only ASCII case is folded: write the pattern in
  lowercase Unicode in NFC. An uppercase non-ASCII letter or a decomposed
  character is not normalized, so the pattern never matches what a browser
  sends; a warning is logged for it.
- A request to a ``pass`` with variables that named a missing application
  target could crash the router; it now gets ``404``. Every request to a
  ``pass`` with variables that named an application also took memory from
  the configuration pool until the next reconfiguration.
- With ``body_temp_path`` set, the router read the path from memory that it
  had released after it applied the configuration, so a request body larger
  than ``body_buffer_size`` could get ``500``.
- A control API ``PUT`` whose path descended one step past a scalar
  configuration member, for example
  ``/config/settings/http/body_read_timeout/x``, crashed the controller. It
  now gets ``404``, as delete and append already did.
- In a build with njs, a configuration update that failed before the new
  configuration was created, for example on a shared memory error, released
  an njs VM that was never compiled and crashed the router.

.. _release-1-37-2-websocket:

WebSocket
=========

- When the router got no shared memory for a WebSocket frame from the
  client, or could not hand the frame to the application, it closed the
  connection without a CLOSE frame, and the client saw an EOF or a reset. The
  router now sends a CLOSE frame with code ``1011`` before it closes the
  connection, unless a CLOSE frame already went to the client. The shared
  memory failure is logged at alert level once per connection.
- An ASGI application that sent a WebSocket close frame and then raised an
  exception could make the client see a closed connection without the close
  frame. A message above the 10 MiB buffer limit made the client see EOF
  instead of close code ``1009`` when the close frame was still queued. The
  router now writes the queued close frame before it closes the connection.
- A proxy route crashed the router when the upstream answered a WebSocket
  handshake with ``101`` and the client then sent a frame. The proxy cannot
  pass WebSocket, so it now answers ``502`` and logs a warning.
- A route whose action was a configured ``"return": 101`` crashed the router
  when a client sent a WebSocket handshake and a frame in the same write.
  Such a ``101`` is sent as a plain response now; only an application
  response can switch the client connection to WebSocket.
- A client frame sent in the same write as an application WebSocket handshake
  could run the route action a second time for the same request and leave an
  application prototype process behind. The frame now reaches the application
  as the first WebSocket frame.
- An ASGI application that read ``scope["subprotocols"]`` by iterating it or by
  an index other than 0 could crash its worker when the
  ``Sec-WebSocket-Protocol`` header had an empty segment (a leading, trailing
  or doubled comma). The tuple no longer keeps an empty slot.
- The Python WSGI and ASGI modules took a response header whose name had the
  same hash as ``Content-Length`` as the body length, and ASGI took a request
  header with the same hash as ``Sec-WebSocket-Protocol`` as the WebSocket
  subprotocols. The name is now compared too, in any letter case.

.. _release-1-37-2-applications:

Applications and Queues
=======================

- A request taken from the shared application queue could be dropped with
  nobody left to answer it. The router can reuse a queue slot for a new
  request as soon as the worker returns the old one, and the worker could
  then fail to claim the message it had just read. The worker now claims the
  message before its slot goes back to the free list. The fix is in libunit.
- With the default ``"limits": {"timeout": 0}``, a request that an
  application process took from the queue and never acknowledged, for example
  because the process was killed, waited without end, and the application kept
  a reference that blocked its prototype from being stopped after a
  reconfiguration. Such a request is now answered ``503`` after about 10
  seconds; a request still waiting in the queue waits as before.
- When the last process of an application died, requests that it had taken from
  the queue but not yet started were never answered when the timeout was the
  default ``0``; when a timeout was set, they got an error after it. They are
  now given to the new process. A request that the dead process had already
  started is answered ``503`` at once and is never run twice.
- Requests to an application could wait without end when an application process
  asked the router for the port of a router thread that no longer existed:
  the router did not answer. The router now answers the refusal, and libunit
  ends the requests that waited for the port. The fix needs the new libunit.
- When an application process exited while it waited for shared memory, the
  router could send the shared memory notice to the closed port. It logged a
  "Bad file descriptor" error, or another process that got the same
  descriptor number quit with "too many port socket messages".
- The router could crash when ``idle_timeout`` expired before the ``408``
  response could be written, for example when a TLS client sent a ClientHello
  and then stopped.
- A response header name longer than 255 bytes from a Python, PHP, Perl or
  Node.js application was sent truncated to its length modulo 256, with no log
  line (a 300-byte name became a 44-byte one). Such a response now fails with
  an error in the log: ``500`` from PHP, ``503`` from Python and Perl. In
  Node.js, ``setHeader()`` throws a ``TypeError``; if the application does not
  catch it, the worker exits and the client gets ``503``. The Ruby, Java, Go
  and WebAssembly modules already refused such a name.
- A PHP worker kept serving after ``php_request_startup()`` failed, for
  example when a multipart request body ran PHP out of memory. The next
  requests ran on top of the failed request's state and got ``503`` or an
  empty ``200``, and with some PHP versions the worker answered ``503`` to
  every request until it was stopped. The worker now logs an alert and exits
  with code 1 after it sends the error, and the router starts a replacement
  worker when the application needs one. A request body that PHP cannot
  parse within ``memory_limit`` now costs one worker restart for each such
  request.
- A Java application received an incorrect ``String`` for a request header,
  URI or query string with bytes that are not valid UTF-8 or with a 4-byte
  UTF-8 character. It also read back a response header value that it had set
  only up to a NUL. A value that is all valid UTF-8 is now decoded as
  UTF-8, and any other value as ISO-8859-1, one char for each byte.

.. _release-1-37-2-tls:

TLS
===

When a TLS session was still initializing while the connection closed, usually
after a fatal TLS error such as a record that does not decrypt, the router
still called ``SSL_shutdown()``, which OpenSSL refuses in that state, and
logged ``SSL_shutdown() failed`` at alert level for every such connection. The
router now closes such a connection without ``SSL_shutdown()``, and a fatal
error is logged once, where it happened. A session that completed its handshake
still sends ``close_notify``.

.. _release-1-37-2-modules:

Language Modules, Build and Images
==================================

- The PHP module now builds with PHP 8.7, which removed five members of
  ``sapi_module_struct``. The module names the members that it sets, so a
  member that PHP removes no longer shifts the others.
- Docker images for Python 3.15.
- The WebAssembly component module now builds Wasmtime with
  ``parallel-compilation``, so Cranelift compiles the functions of a component
  on several threads when it loads. The first start of a large component is
  about 4 times faster with several CPUs available, measured on an 8-vCPU VM.
  It uses more CPU at startup, and the module is about 150 KB larger.
- contrib njs is upgraded to 1.0.2, which fixes memory-safety bugs in the njs
  engine.
- unitctl moves to sysinfo 0.40.1 with its default features off, so the musl
  and aarch64 builds no longer need ``statx()``. See the `unitctl changelog
  <https://github.com/freeunitorg/freeunit/blob/1.37.2/tools/unitctl/CHANGELOG.md>`_.

.. _release-1-37-2-upgrade:

Upgrade Notes
=============

Several fixes are in libunit. Rebuild Go and Node.js applications, and any
other application of type ``external``, against the new libunit to receive
them: the claim of a queued request before its slot is freed, and the end of
requests that waited for a router thread port that no longer exists. An
application built against an older libunit keeps the old behavior.

Some behavior changes are visible to clients and operators:

- A chunked request body with a malformed chunk extension now gets ``400``
  instead of being accepted; a chunked upstream response with one gets
  ``502``.
- ``Connection`` options are matched as whole tokens, so a header name that
  merely contains ``close`` or ``keep-alive`` no longer changes the
  connection. ``Transfer-Encoding: Chunked`` is now accepted.
- Application responses of unknown length are now compressed when
  ``compression`` is configured. ``min_length`` no longer applies to them, a
  ``206`` is never compressed, ``Accept-Ranges`` is removed from a compressed
  response, and a client that refuses identity with no acceptable coding gets
  ``406``. Each open compressed stream holds its compressor state; review the
  memory figures above if many clients stream at once with zstd or Brotli.
- A stored configuration that names ``Content-Length`` or
  ``Transfer-Encoding`` in ``response_headers``, or that has a ``compression``
  object without ``compressors``, still loads with a warning, but the control
  API refuses further updates until it is corrected.
- A Unicode ``host`` pattern now matches the punycode form of the name and no
  longer the raw UTF-8 form. A stored pattern that cannot be converted (a
  wildcard inside a non-ASCII label, invalid UTF-8, or a label over 63 bytes
  in punycode) is kept with a warning and compared as written, so unitd still
  starts after an upgrade. Other stored patterns are converted when they load.
  Unit does not lowercase non-ASCII letters or normalize to NFC; it only logs
  a warning, so fix such a pattern by hand.
- Run ``unitc`` and ``setup-unit`` as root or as the user who owns unitd.
  The tools, and the unitd discovery of ``unitctl``, no longer trust a
  ``unit: main`` process owned by another user who is not root.
- With ``"limits": {"timeout": 0}``, a request that a worker claimed and
  never acknowledged now gets ``503`` after about 10 seconds instead of
  waiting without end.
- A PHP worker exits after a failed request startup, and the router starts
  a replacement; a request body that PHP cannot parse within ``memory_limit``
  costs one worker restart.
- A response header name over 255 bytes from a Python, PHP, Perl or Node.js
  application is now an error instead of a silently truncated name.
- A route regular expression that reaches a match limit is logged once per
  pattern, not once per request, and the ``SSL_shutdown() failed`` alert
  after a fatal TLS error is gone. Log-based alerting that counted these
  lines will see fewer of them.
- The WebAssembly component module uses more CPU when a component loads and
  is about 150 KB larger.

Review the changelog for the complete list of changes and for the exact
wording of each entry.

Release Details and Contributors
================================

- `Published release notes and contributor acknowledgments
  <https://github.com/freeunitorg/freeunit/releases/tag/1.37.2>`_.
- `Complete 1.37.2 changelog
  <https://github.com/freeunitorg/freeunit/blob/1.37.2/CHANGES>`_.
- `Changes since 1.37.1
  <https://github.com/freeunitorg/freeunit/compare/1.37.1...1.37.2>`_.
