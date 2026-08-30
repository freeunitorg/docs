:orphan:

####################
Unit 1.36.1 Released
####################

FreeUnit 1.36.1 is a maintenance release. It hardens the inter-process
message paths against a compromised or malformed peer, fixes a set of HTTP
framing and memory-lifetime bugs, makes OpenTelemetry usable in production,
raises the TLS build floor to OpenSSL 1.1.1 while adding OpenSSL 4.0 support,
and fixes a case where session tickets were silently switched off.

**Inter-process message hardening**

A worker that is already compromised could previously use the port protocol
to crash or exhaust a privileged process. Shared-memory segment identifiers,
geometry, and chunk ranges arriving from a peer are now validated before use;
a ``CHANGE_FILE`` message can no longer claim an out-of-range log file slot;
a short shared-memory object handed over as a port queue is refused where it
is handed over rather than faulting at a later access; and the descriptors a
forged or malformed message leaves behind are closed on every path instead of
accumulating until the receiver runs out.

- A ``NEW_PORT`` announcing a port that already exists no longer replaces a
  live port's queue mapping.
- A stale ``SCM_RIGHTS`` control message is no longer replayed in libunit.
- The router closes the engine port when a worker thread exits, ending a
  descriptor leak on every ``listen_threads`` decrease.

**HTTP**

- Chunked messages carrying a trailer section are parsed per RFC 9112 7.1.2
  instead of being rejected, and the request body buffer stays alive across
  framing boundaries.
- An application response that disagrees with itself about its length is
  rejected rather than desynchronizing the connection.
- Response buffers adopted from the port are released on the error path.

**OpenTelemetry**

- ``/status`` reports span export health as
  ``"telemetry": {"spans": {"exported": N, "failed": M}}``, present only when
  telemetry is configured — its absence is how a client tells telemetry is
  off rather than idle.
- ``sampling_ratio`` now saves the work it promises: attribute assembly is
  skipped for spans the sampler drops, where previously it bought back only
  the exporter and nothing on the request path.
- Spans are no longer lost at the edges of a request's life, the pipeline is
  flushed before the router exits, and the exporter is rebuilt only when the
  telemetry settings actually changed.
- ``http.response.status_code`` and ``http.request.body.size`` are emitted as
  OTLP integers rather than strings, as the semantic conventions specify.
  **Collectors matching these attributes as strings must be adapted.** The
  redundant free-form "Unit Attribute" span event was removed.

**TLS**

- **Session tickets were silently disabled** when Unit was built against
  OpenSSL 3.x with deprecated APIs turned off: the feature guard tested a
  control that is itself deprecated, so the build quietly took the
  unsupported branch. The ticket key callback now uses the ``EVP_MAC`` API.
- The TLS code builds against OpenSSL 4.0.
- **Building with TLS now requires OpenSSL 1.1.1 or later.** The pre-1.1.0
  compatibility code is removed. The floor stays at 1.1.1 rather than 3.x
  because platforms FreeUnit packages for still ship a vendor-patched 1.1.1 —
  most prominently RHEL 8, which Red Hat maintains into 2029.

**Other**

- Configuration validation errors now say where they are, with an RFC 6901
  JSON Pointer to the member or array element that failed validation — or to
  the containing object when the failure is an unknown parameter — and a
  suggestion for a mistyped name.
- The ``if`` option of a route ``match`` object, available since 1.33.0, is
  now documented and covered by the test suite.
- The memory pool allocation cursor is kept aligned by rounding, fixing
  SIGBUS crashes on 32-bit ARM.
- wasmtime is updated from 36.0.12 to 47.0.2, and the WebAssembly component
  module no longer permits guest outbound HTTP.
- The Java module bundles Apache Tomcat 9.0.121.

**************
Full Changelog
**************

.. code-block:: none

   Changes with FreeUnit 1.36.1                                     28 Aug 2026

       *) Feature: configuration validation errors now say where they are. A
          rejected configuration request carries an RFC 6901 JSON Pointer in
          the "path" member of "location": it points at the member whose value
          failed validation, or at the containing object when the failure is an
          unknown parameter, whose name the message itself already carries; ""
          is the document root. On an unknown parameter whose name is a close
          and unambiguous typo of a known one, the intended name is reported in
          a top-level "suggestion" member. The addition is strictly additive:
          the existing response fields and the error message wording are
          unchanged, and each new member is omitted where it does not apply.

       *) Feature: the /status API reports OpenTelemetry span export health as
          "telemetry": {"spans": {"exported": N, "failed": M}} -- the spans the
          collector accepted, and the spans whose export failed. Both are
          reported because a failure count alone cannot distinguish a healthy
          pipeline from one that has never exported anything. The object is
          omitted entirely unless Unit was built with OpenTelemetry support,
          "/config/settings/telemetry" is set, and the exporter was built
          successfully, so its absence is how a client tells telemetry is off
          rather than idle. The counters are cumulative since the exporter was
          last built, so changing any telemetry setting restarts them, while
          re-applying an identical configuration does not.

       *) Bugfix: validate the shared memory segment identifier and geometry an
          application process supplies in its NXT_PORT_MSG_MMAP message. The
          router checked only the pid fields, then used the peer-authored
          header id directly as an array index and mapped the descriptor at
          whatever length fstat() reported; a compromised or faulty application
          could drive an out-of-range write and an oversized mapping.

       *) Bugfix: bounds-check the router-supplied chunk identifier and size in
          libunit before consuming them, so an out-of-range size can no longer
          make every serialized-pointer check in the arrival-time validation
          block pass and be read out of bounds in the application process.

       *) Bugfix: do not replay a stale SCM_RIGHTS control message in libunit
          when the embedder's port_recv callback returns without receiving
          anything. The out parameter carrying the control-data length was
          stored unconditionally, so a descriptor from an earlier message could
          be adopted a second time.

       *) Bugfix: check the shared memory buffer allocation when forwarding a
          websocket frame. Exhausting the outgoing shared memory crashed the
          router with a NULL dereference; every other caller already checked.

       *) Bugfix: keep the chunked request body buffer alive across framing
          reads. A buffer drained without producing a data slice was handed to
          its completion handler while the parser still referenced it, a
          use-after-free reachable from an ordinary chunked request.

       *) Bugfix: parse the HTTP/1.1 trailer section (RFC 9112 7.1.2) instead
          of erroring on the first byte after the terminal chunk. In the proxy
          response relay this aborted an already-streaming response and
          truncated the body at a racy point; chunked requests carrying a
          trailer were rejected the same way. Trailer field names and values
          are validated as they are parsed.

       *) Bugfix: reject an application response that disagrees with itself
          about its own body length. A duplicate Content-Length was neither
          detected nor parsed, so every such header was forwarded verbatim and
          the body was framed by the advertised length instead of chunked.

       *) Bugfix: release the response buffers adopted from the port on the
          error paths of the router's response handler, and drain them from the
          request output chain when the failure happens after they were linked
          into it. Both leaked the chain the handler had taken ownership of.

       *) Bugfix: keep the memory pool cursor aligned in nxt_mp_get() by
          rounding the requested size up to the maximum alignment rather than
          flooring it. The small allocation path is a bump allocator with no
          per-allocation alignment step, so any request whose size was not a
          multiple of that alignment left the page cursor misaligned, and
          allocations from that page kept violating the documented alignment
          guarantee until a later size happened to bring the cursor back into
          step, which crashed with SIGBUS on strict alignment targets such as
          32-bit ARM.

       *) Bugfix: serialize the process reference count on the runtime process
          mutex and take a reference during cross-thread process lookups. The
          count was mutated non-atomically from every engine thread and a
          lookup returned an unreferenced process, so a router worker could
          operate on an nxt_process_t -- including its shared memory segments
          and its mutex -- that the main thread had already torn down.

       *) Bugfix: keep the socket and timer tasks of a connection scoped to
          that connection, so a work item cannot run against a task belonging
          to a different connection.

       *) Change: remove the dead chunk-tracking bitmap from the shared memory
          segment header. Its trailing fields ran past the header area and
          aliased the payload of the segment's first chunk, which was harmless
          only because nothing read or wrote them; the field offsets a peer of
          either vintage uses are unchanged, so old and new builds still
          interoperate. A static assertion now pins the header struct inside
          the area reserved for it.

       *) Change: the shared memory chunk range check is now a single shared
          implementation used by both the router and libunit, with the chunk
          count computed so that a peer-supplied size in the top of the 32-bit
          range cannot wrap to zero chunks and be accepted.

       *) Change: recycle connection structures through a per-engine freelist,
          embed the static file context in the request, recycle static file
          buffer descriptors through a thread-local freelist, and resolve the
          first eight routing variables and the first sixteen request and
          response header fields from arrays embedded in the request. Each
          avoids or reuses an allocation on a per-connection or per-request hot
          path.

       *) Change: the WebAssembly component module no longer supports
          guest-initiated outbound HTTP. Serving Unit never needed it, and the
          feature that provided it linked an entire TLS stack -- rustls,
          tokio-rustls, webpki-roots and rustls-webpki -- into the module. A
          guest that only imports wasi:http/outgoing-handler, as the
          wasi:http/proxy world requires, still instantiates and runs; an
          actual outbound call now fails with HttpRequestDenied.

       *) Change: update wasmtime from 36.0.12 to 47.0.2 in the WebAssembly
          component module, keeping outbound HTTP denied and the TLS stack out
          of the dependency graph.

       *) Change: the "if" option of a route "match" object, added in 1.33.0,
          is now described in the OpenAPI specification and covered by the test
          suite. A request matches the step only when the condition is true;
          the condition uses the same syntax as the "if" option of the access
          log: it is false when it renders to an empty string, "0", "false",
          "null", or "undefined", and true otherwise, and a leading "!" negates
          the result. Variables test for the presence of a value ("$arg_foo"),
          njs template strings express comparisons and regular expressions
          ("`${uri == '/admin'}`", "`${/^\/admin/.test(uri)}`").

       *) Change: build against OpenSSL 4.0, which constified the return types
          of the X509 name accessors and deprecated
          X509_NAME_get_text_by_NID(); SNI certificate matching and the
          "certificates" control API now read the certificate name through
          X509_NAME_get_index_by_NID() and the entry accessors instead, and a
          new CI job builds and runs the C test suite against OpenSSL 4.0 with
          deprecated APIs disabled, so it fails on any new use of a deprecated
          function rather than only on a removal.

       *) Change: OpenSSL 1.1.1 or later is now required to build with
          "--openssl"; configure fails with an explicit message on older
          releases. Builds against OpenSSL 1.0.x have not worked since 1.35.2,
          when the TLS module started to use OpenSSL_version_num(); the
          unreachable pre-1.1.0 compatibility code is removed.

       *) Bugfix: close the engine port when a router worker thread exits.
          Lowering settings/listen_threads deletes engines, and the thread exit
          handler only dropped a port reference, and the runtime held another,
          so nothing ever called nxt_port_close(): every deleted engine leaked
          its socket pair and its queue descriptor, three per engine, for the
          life of the router. The count only ever rose, so a configuration that
          raises and lowers the thread count walked the router towards its
          descriptor limit.

       *) Bugfix: close the descriptors a forged or malformed port message
          leaves behind. A message carries up to two descriptors whatever its
          type normally uses, and the dispatcher reclaims nothing once a
          handler has returned. The main process kept the second descriptor on
          the whoami path, the router lost both when a conf data message named
          no reply port, and a PROCESS_READY naming an unknown process closed
          neither. A peer that is already compromised could exhaust the
          descriptor table of the receiving process -- the main process on the
          whoami path -- by repeating any of them.

       *) Bugfix: bound the log file slot a CHANGE_FILE message claims, and
          stop leaking the descriptor it carries. The slot index arrived from a
          peer and was used to walk the runtime's log file list without a range
          check, and a message whose payload was shorter than the index was
          read past its end. The rejection paths now close what the message
          attached, and nxt_file_redirect() releases the descriptor when dup2()
          fails rather than only on success -- which also ends a leak of one
          descriptor per unrotatable log file on every SIGUSR1.

       *) Bugfix: a NEW_PORT or PROCESS_READY message carrying a shared-memory
          queue shorter than the queue type faulted the receiving process
          (main, the prototype, or the router) with SIGBUS on first access; the
          object size is now checked before mapping, a short queue is refused
          with a warning, and the router no longer leaks the descriptor of a
          queue it refuses.

       *) Bugfix: a NEW_PORT message announcing a port that already existed, or
          one that could not be created, left an uninitialized stack value
          behind; the controller dereferenced it unconditionally on every
          NEW_PORT, and main and the router relied on a NULL check that could
          not catch non-NULL garbage. The result is now cleared explicitly
          whenever no port is created.

       *) Bugfix: close the file descriptors a NEW_PORT or MMAP message left
          behind instead of leaking them. The discovery and application
          prototype processes kept every port queue descriptor open for the
          life of the process, the main process kept the queue descriptor of
          any port it had not just created, the router lost it on ports it does
          not map a queue for, the controller never closed it, and the mmap
          handler leaked its second descriptor on every path and returned
          closing nothing at all when the first was missing; a message type
          with no handler also went uncollected. A NEW_PORT for a port that
          already has a queue now refuses the new descriptor instead of mapping
          it over the live queue and leaking the mapping it replaced, which had
          let a repeated announcement re-point an established port at memory of
          the sender's choosing.

       *) Bugfix: session tickets were silently disabled when Unit was built
          against an OpenSSL 3.x library compiled with the deprecated 3.0 API
          removed (OPENSSL_NO_DEPRECATED_3_0), because the feature guard tested
          for a control macro that is itself declared only under that API and
          so was never defined; the session ticket key callback now registers
          through SSL_CTX_set_tlsext_ticket_key_evp_cb() and keys an EVP_MAC
          context on OpenSSL 3.0 and later, independent of the deprecated
          HMAC_CTX API.

       *) Bugfix: stop building OpenTelemetry span attributes for spans the
          sampler has already dropped. set_attribute() on a non-recording span
          discards its argument, but the argument was built first -- the
          sprintf round-trips, the pool allocations and two owned strings per
          attribute -- and nothing asked whether the span was recording.
          Lowering sampling_ratio therefore bought back the exporter and
          nothing on the request path. The sampler's verdict is now read once
          when the span is created and the attribute stages consult it, which
          removes most of telemetry's request-path cost at a low sampling
          ratio. Context propagation is deliberately outside that check: the
          traceparent must reach the peer and the application whatever the
          sampling decision was.

       *) Bugfix: do not attach the traceparent to an OpenTelemetry span as a
          "Unit Attribute" event. It duplicated the trace and span identifiers
          the span context already carries, nothing consumed it, and it was
          added twice on a request that took the error path with a trace it had
          started itself, because the error path re-runs header propagation.

       *) Bugfix: OpenTelemetry spans were lost at the edges of a request's
          life. A request that ended before its span was collected -- an error
          path, a dropped connection -- left the span allocated and never
          exported it; the span is now tied to the memory pool that holds it
          and is exported with an error status when that pool is released, so
          an abandoned request appears in the trace instead of vanishing.

       *) Bugfix: flush the OpenTelemetry span pipeline before the router
          exits. Exit and reload discarded the pipeline with up to 4096 spans
          still queued, losing every span produced since the last export. The
          pipeline is now flushed with a 2 second bound, so a slow or
          unreachable collector delays shutdown by at most that long rather
          than either hanging it or costing the queued spans.

       *) Bugfix: rebuild the OpenTelemetry exporter only when the telemetry
          settings have changed. Every configuration change rebuilt it, so
          adding a route or changing an application stalled reconfiguration
          against an unreachable collector even though it did not touch
          "/config/settings/telemetry". The exporter is now rebuilt only when
          the endpoint, protocol, sampling ratio or batch size actually differs
          from the running one.

       *) Change: the OpenTelemetry span attributes "http.response.status_code"
          and "http.request.body.size" are now emitted as OTLP integer values,
          as the HTTP semantic conventions specify, instead of strings. A
          collector or query that matches these attributes as strings must be
          adapted; one that reads them as integers, or that relied on the
          convention rather than on Unit's previous output, needs no change.

       *) Change: the work a traced request does on the request path is
          reduced: attribute keys are no longer copied onto the heap per
          request, the two attributes above no longer round-trip through
          strings, and a span stage now crosses into the tracer once instead of
          once per attribute. Together with the sampling fix above, the
          telemetry overhead of a request measured 27% lower at
          "sampling_ratio" 1.0 and 53% lower at 0.1.

       *) Change: the Java module now bundles Apache Tomcat 9.0.121 (from
          9.0.110) and ClassGraph 4.8.186 (from 4.8.181). The upstream Tomcat
          9.0.121 release fixes CVE-2026-66299 (unbounded buffer for
          undelivered WebSocket messages, a memory exhaustion by a slow
          client), CVE-2026-73180, CVE-2026-68569, CVE-2026-66422 and
          CVE-2026-65927. FreeUnit bundles only the servlet, JSP and EL API
          jars, Jasper and the Tomcat utility jars -- not catalina, the
          WebSocket implementation or the example webapps -- so the bump keeps
          the jars it ships on a supported release.
