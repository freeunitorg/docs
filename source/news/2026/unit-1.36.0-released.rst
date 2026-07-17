:orphan:

####################
Unit 1.36.0 Released
####################

FreeUnit 1.36.0 is a security and correctness hardening release. It closes a
set of local privilege-boundary and memory-safety issues (covered by two
security advisories), adds a graceful ``SIGQUIT`` stop that drains in-flight
requests before exit, and upgrades the WebAssembly runtime.

**Security hardening**

- **Config validation:** reject empty values and embedded NUL bytes in
  configuration strings later used as NUL-terminated C strings (``user``,
  ``group``, ``working_directory``, ``stdout``/``stderr``, ``executable``,
  the per-language application targets, ``access_log``, the TLS certificate,
  the njs ``js_module``, and PHP ``options.file``) and in pathname unix
  socket addresses — closing a silent-truncation target confusion.
- **Static serving:** reject embedded NUL bytes in templated ``share`` and
  ``chroot`` paths after variable resolution, before ``open()``/``openat2()``.
- **Isolation:** mount rootfs automount destinations through ``/proc/self/fd``
  on the ``openat2``-validated descriptor, closing a symlink-swap TOCTOU that
  could escape the rootfs.
- **Proxy:** treat a duplicate upstream ``Content-Length`` as inconsistent
  (drop both, read to EOF) to prevent a response-smuggling desync, and keep
  downstream keep-alive disabled afterward so an HTTP/1.1 client cannot reuse
  the connection past the re-framed response.
- **libunit:** bound the request header-fields region against the shared
  memory message size, validate serialized pointers and cached header
  indexes, and range-check the Java ``InputStream.read()`` binding —
  preventing out-of-bounds access on malformed requests.
- **Controller:** fix a debug-build crash and an accepted-fd leak on
  control-connection close and failure paths.
- **OpenTelemetry:** restart a malformed W3C ``traceparent`` instead of
  failing the request with HTTP 500, and zero-initialize injected trace
  fields (garbage flag bits could otherwise drop the header at random).
- **Go module:** fix a libunit port-fd double-close race.

Two advisories were published with this release (CVEs pending):

- `GHSA-768w-qrh2-jjvh <https://github.com/freeunitorg/freeunit/security/advisories/GHSA-768w-qrh2-jjvh>`_
  — control-socket peer-authentication bypass, cgroup-namespace TOCTOU, and
  mount-destination TOCTOU (CVSS 8.8).
- `GHSA-g6v8-r577-76jm <https://github.com/freeunitorg/freeunit/security/advisories/GHSA-g6v8-r577-76jm>`_
  — WebSocket out-of-bounds read and cross-frame data disclosure (CVSS 7.5).

Both are fixed in 1.36.0 and backported to the 1.34.x LTS line.

**Graceful shutdown**

- ``SIGQUIT`` now performs a graceful stop: application workers drain their
  in-flight requests before exiting. ``SIGTERM`` remains the fast exit.

**Dependencies**

- wasm-wasi-component wasmtime crates upgraded 35.0.0 → 36.0.12, clearing the
  sandbox-escape advisories.

**************
Full Changelog
**************

.. code-block:: none

  Changes with FreeUnit 1.36.0                                     16 Jul 2026
  
      *) Bugfix: the controller crashed in debug builds when a control-socket
         connection closed after the active-connection tracking change, and
         leaked the accepted file descriptor when a control connection failed
         during initialization or body allocation; connection tracking and
         teardown now route through the engine's tracking macros and the
         close path.
  
      *) Bugfix: ignore a malformed incoming "traceparent" header and restart
         the trace per W3C Trace Context instead of rejecting the request
         with HTTP 500; the malformed header is dropped instead of being
         forwarded alongside the restarted one, and context accepted from a
         valid duplicate is preserved. Values are now validated in full
         (segment lengths, lowercase hex, no all-zero ids, no "ff" version),
         so content-invalid values restart the trace instead of being
         re-emitted verbatim. An inbound "tracestate" is dropped together
         with the rejected context (kept when the traceparent is inherited).
         The injected "traceparent" fields are now zero-initialized; garbage
         flag bits could get the header randomly dropped from proxied
         requests and responses.
  
      *) Bugfix: reject empty values and embedded NUL bytes in configuration
         strings that are later used as NUL-terminated C strings ("user",
         "group", "working_directory", "stdout", "stderr", "executable", and
         the per-language application targets) and in pathname unix socket
         addresses, closing a silent-truncation target confusion.
  
      *) Bugfix: reject empty values and embedded NUL bytes in the remaining
         configuration strings used as NUL-terminated C strings outside
         application options: the "access_log" path (string and object
         forms), the TLS "certificate" and njs "js_module" store names, and
         the PHP "options.file" php.ini path.
  
      *) Bugfix: reject an embedded NUL byte in a templated static-serving
         path ("share" and "chroot") after it is resolved from
         request-controlled variables and before it reaches open()/openat2(),
         preventing a silent truncation that could serve a different file
         than the resolved path.
  
      *) Bugfix: mount rootfs automount destinations onto the openat2
         validated descriptor via "/proc/self/fd" instead of re-resolving the
         path, closing a check-to-use window in which a destination component
         could be swapped for a symlink escaping the rootfs.
  
      *) Bugfix: treat duplicate upstream "Content-Length" headers in a
         proxied response as inconsistent — both headers are dropped and the
         body is read to EOF instead of trusting either length, preventing a
         response-smuggling desynchronization.
  
      *) Bugfix: keep downstream keepalive disabled after a duplicate or invalid
         upstream "Content-Length"; a clean upstream close no longer re-enables
         it, so an HTTP/1.1 client cannot reuse the connection past the re-framed
         response. The complete body still ends with its terminal chunk — body
         truncation is now tracked separately from the inconsistent flag.
  
      *) Bugfix: bound the request-header fields region against the shared
         memory message size in libunit, validate every field name/value
         serialized pointer and the cached header-field indexes before use,
         and range-check off/len in the Java InputStream read() binding,
         preventing out-of-bounds access on a malformed request.
  
      *) Bugfix: fix a libunit port-fd double-close race in the Go language
         module: getUnixConn() wrapped the raw shared-port descriptor (which
         net.FileConn dups) and a deferred Close() closed the original
         descriptor number while libunit still owned it, an intermittent
         double-close that raised an EBADF alert or, worse, closed an
         unrelated reused live descriptor. Go now dup(2)s the descriptor and
         wraps only the dup, so libunit remains the sole owner and closer;
         libunit additionally holds a port reference across the out-of-mutex
         add_port callback window so a concurrent destroy cannot free the
         port mid-callback.
  
      *) Feature: SIGQUIT now performs a graceful stop — application workers
         drain in-flight requests before exiting; SIGTERM remains the fast
         exit that drops them.
  
      *) Change: upgrade the wasm-wasi-component wasmtime crates from 35.0.0
         to 36.0.12, clearing the wasmtime sandbox-escape advisories, with the
         accompanying WasiView/WasiHttpView source migration.
  
      *) Change: upgrade contrib njs to 1.0.0.
  
      *) Feature: two-phase listener close — reconfiguration disarms a removed
         listener first and releases its descriptor only after pending accept
         references drain, instead of resetting them.
  
      *) Change: the event engine now tracks in-flight connections on a
         dedicated active connections queue, symmetric with idle tracking —
         groundwork for graceful connection draining; connection accounting
         in the "/status" API is exact on all close paths.
  
      *) Change: broaden the regression test suite — proxy Content-Length and
         chunked-response relay framing, OpenTelemetry 5xx tracing and inbound
         traceparent handling, and Java ServletInputStream bounds — and run
         the C unit-test suite in CI, which was previously compiled but never
         executed.
  
      *) Bugfix: authorize privileged IPC message types by the kernel-validated
         sender PID (SCM_CREDENTIALS), close any received descriptors on every
         rejected privileged message, and cap port queue item size at the slot
         data bound.
  
      *) Bugfix: reject control characters (CR, LF, NUL, DEL) in "set_headers"
         names and values at configuration load, including the literal
         segments of templated values.
  
      *) Bugfix: handle buffer-allocation failure in the port read handlers
         with an orderly teardown instead of a NULL-pointer dereference, route
         a connection write error after a partial send to the error handler
         immediately, and free the timer batching array on engine teardown.
  
      *) Feature: upgrade the OpenTelemetry Rust crates from 0.24 to 0.32 and
         rewrite the OTLP trace exporter on the stable, dedicated-thread batch
         span processor (blocking reqwest client, no tokio runtime).
  
      *) Feature: W3C traceparent header inheritance now correctly propagates
         the upstream sampling decision; the sampler wraps TraceIdRatioBased
         inside ParentBased so that remote parent trace flags are honoured.
  
      *) Feature: add fake_otlp mock OTLP collector (test/fake_otlp/) and the
         test_otel.py test suite covering span export, traceparent
         propagation, sampling, and configuration validation over both the
         OTLP/HTTP and OTLP/gRPC transports.
  
      *) Feature: reintroduce OTLP/gRPC trace export. Both transports are
         compiled into every "--otel" build and the
         "settings/telemetry/protocol" option selects "http" (OTLP/HTTP) or
         "grpc" (OTLP/gRPC) at runtime, as in upstream Unit. gRPC uses tonic
         over a small tokio runtime; v1 is plaintext h2c only (no TLS to the
         collector, like the HTTP path).
  
      *) Change: rename the default OTel service name from "NGINX Unit" to
         "FreeUnit".
  
      *) Bugfix: add validation bounds for "batch_size" (1-65536) and
         "sampling_ratio" (0-1) in the OpenTelemetry configuration; previously
         invalid values were silently rejected without an error message.
  
      *) Bugfix: replace eprintln! error output in the OTel Rust layer with
         the C log callback (nxt_otel_log_cb), so errors flow through the
         standard Unit logging infrastructure.
  
      *) Bugfix: remove unreachable Protocol::HttpJson dead-code arm from the
         OTel exporter; only HttpBinary was ever selected.
  
      *) Bugfix: fix a rootfs automount reload race: sever the worker's mount
         namespace propagation (MS_REC|MS_PRIVATE) before mounting and let a
         per-worker automount be reaped with the namespace instead of being
         unmounted from the host, so a configuration reload no longer races the
         previous worker generation's teardown against the new prototype's
         procfs mount (freeunitorg/freeunit#83).
  
      *) Bugfix: validate that a loaded TLS private key matches its certificate
         at config time, and guard the wildcard-name SAN matcher against a
         zero-length SAN entry.
  
      *) Bugfix: correct IPv4 /32 CIDR fallthrough, symmetric URI/pattern
         decoding, the PCRE2 match-data ovector size, and short port-range
         parsing in HTTP routing; document the case-insensitive host matcher
         and the capset stance.
  
      *) Bugfix: tighten file-descriptor and CLOEXEC lifetime — CLOEXEC-protect
         accepted sockets and pipe ends, close the pipe end on
         nxt_fd_nonblocking() failure and the source fd on compression mmap
         failure, and narrow the accept4() fallback to ENOSYS.
  
      *) Bugfix: tighten WebSocket frame-bound checks — reject truncated
         extended-length frames in libunit, validate the 64-bit extended-length
         MSB (RFC 6455), fix a no-op frame-size decrement that could copy bytes
         beyond the declared payload, bound the Java sendWsFrame JNI arguments,
         and guard pending_payload_len overflow in the Python ASGI handler.
  
      *) Bugfix: bounds-check peer-supplied shared-memory offsets — range-check
         chunk_id and chunk_id+nchunks in incoming mmap messages, close a
         lookup/dereference window on the incoming-mmap handler, reject
         response-buffer size overflow, and validate request sptr offsets
         before use.
  
      *) Bugfix: bounds-check app-supplied arguments across the language
         bindings (PHP header skip / realpath / PATH_INFO; Python WSGI and ASGI
         checks; Perl ERRSV scrub; Java InputStream.readLine off/len; WASM
         guest offsets).
  
      *) Bugfix: tighten isolation boundaries — require a matching peer UID
         (root or Unit's own effective UID) on the unix control socket, so the
         "control-user", "control-group", and "control-mode" permissions are
         defense-in-depth rather than a means to delegate control-API access;
         resolve mount destinations with openat2(RESOLVE_BENEATH); and resolve
         relative cgroup paths against the child's /proc/<pid>/cgroup.
  
      *) Bugfix: reject embedded NUL bytes in the "rootfs" and cgroup "path"
         isolation options, and validate "rootfs" as an absolute path other
         than "/" at configuration time.
  
      *) Bugfix: fix an ineffective truncation guard when building the
         cgroup.procs pathname: snprintf()'s return value overwrote the
         original directory length before the bounds comparison, so a long
         cgroup directory path could overflow the check. The append now
         preserves the original length and fails with ENAMETOOLONG when
         "/cgroup.procs" plus the trailing NUL cannot fit.
  
      *) Bugfix: fail cgroup setup when the per-process pool allocation that
         caches the created directory for cleanup fails; the directory is now
         removed and setup errors out, rather than moving the process into a
         cgroup that could never be cleaned up — a cgroup directory leak under
         memory pressure.
  
      *) Bugfix: reject a "rootfs" that lexically resolves to "/" (such as
         "/.", "/..", or "/foo/.."); chroot("/") is a no-op and would silently
         defeat rootfs isolation.
  
      *) Bugfix: cap JSON parser depth and element counts in the controller,
         scrub PHP TrueAsync exception state before the prototype fork, and bind
         the Ruby rack.input / rack.errors handles to their originating request.
  
      *) Bugfix: bound proxy Content-Length and URI/string helpers — truncate a
         proxied response body that exceeds its Content-Length and close the
         connection, flag invalid or oversized upstream Content-Length, fix an
         nxt_is_complex_uri_encoded() off-by-one, and reject over-long lengths
         in nxt_rmemstrn().
  
      *) Feature: enforce the runtime/OS end-of-life policy automatically — the
         unit-eol-check tool now fails when a shipped variant has outlived its
         support window (supported_until past EOL + grace), and a new
         eol-check GitHub workflow validates pkg/eol.json against endoflife.date
         on every relevant pull request and weekly on a schedule.
  
