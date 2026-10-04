:orphan:

####################
Unit 1.37.0 Released
####################

FreeUnit 1.37.0 adds byte-range requests and conditional requests for static
files. It also adds certificate replacement without a restart and the
``--hardening`` configure option. The release makes the messages between the
processes of Unit safer against a faulty or compromised application. It
corrects HTTP content negotiation. It removes code that the build never used.

**Security**

Unit does not trust an application process. This release closes several ways
in which an application process could crash or confuse a privileged process:

- The router and libunit now read each value in shared memory one time. They
  check each offset against its buffer. Before, an application could point
  the router at any address. A sibling process could change a value after
  the check.
- A port limits the memory that it uses to put fragmented messages together.
  A shared memory queue stops after a limited number of retries.
- The router accepts QUIT, a new configuration and other control messages
  only from the main process or the controller. It uses the sender pid that
  the kernel gives. This makes an attack harder, but it does not stop the
  attack yet. An application can first send a false ``NEW_PORT``. A later
  release will also check ``NEW_PORT``.
- A shared memory segment id from the other process can no longer make an
  array grow without a limit.
- Unit no longer leaks the file descriptors that it sends with a failed or
  queued message.
- Application processes no longer inherit the capabilities of a non-root
  unitd. An example is the systemd option ``AmbientCapabilities=``.
- The string form of ``format`` in ``access_log`` escapes the bytes that a
  variable expands to, as nginx does. Before, a request for ``/%0d%0a...``
  could add a false record to the log.
- unitctl no longer depends on rustls-pemfile or on the HTTP/2 support of
  hyper. This closes RUSTSEC-2025-0134 and RUSTSEC-2026-0258.

**Static files**

- A **share** answers a request with one ``Range`` with ``206 Partial
  Content``. It answers a range that cannot be satisfied with ``416``.
  ``If-Range`` works.
- A **share** answers ``If-None-Match`` and ``If-Modified-Since`` with
  ``304 Not Modified``. If ``If-Match`` or ``If-Unmodified-Since`` does not
  hold, the **share** answers ``412 Precondition Failed``.
- A response with a content coding has a weak entity-tag.

For more information, see :ref:`configuration-share-caching`.

**HTTP**

- Unit reads ``Accept-Encoding`` as RFC 9110 defines it. The value ``*``
  stands for each enabled compressor that the client did not name. Unit does
  not select a compressor that is below its ``min_length``. If a request
  refuses each coding that Unit can send, Unit answers ``406 Not
  Acceptable``. This is also true for a server that has no compression.
- ``"limits": {"timeout"}`` now also limits the time that a request waits
  for an application process.
- The proxy recognizes ``Transfer-Encoding: gzip, chunked`` and other
  spellings of ``chunked``. It handles a 1xx response from the upstream
  server. It no longer sends two ``Content-Length`` fields to the upstream
  server.
- If telemetry is on, the application gets a ``traceparent``. The parent in
  it is the own span of FreeUnit.

**Certificates and the control socket**

- ``PUT /certificates/<name>`` replaces an existing certificate bundle. An
  external ACME client can renew a certificate with one request and without
  a restart. For more information, see :ref:`configuration-ssl-acme`.
- If unitd runs as root, the control API now also accepts the user that
  ``--control-user`` sets. It also accepts a peer in the group that
  ``--control-group`` sets. Before, such a user passed the socket
  permissions, but then the controller closed the connection.

**Processes and shutdown**

- At shutdown, Unit no longer waits 15 seconds for a worker that got a QUIT
  before it was ready.
- At shutdown, a prototype that exits no longer forks a worker that nobody
  stops.
- Unit counts a worker as busy until it finishes if the worker answers a
  request and continues to run. An example is ``fastcgi_finish_request()``
  in PHP. Before, the idle reaper could stop the worker while it still ran.
- A worker that served a WebSocket upgrade becomes idle again when the
  session ends. Before, it stayed out of the idle queues. It counted against
  ``processes.max`` until it died.
- A non-root unitd no longer exits when a syscall filter denies ``capget()``.

**Language modules**

- Java: Unit no longer splits a WebSocket text message into frames of 8 KiB.
  The asynchronous remote now sends data. A ``ByteBuffer`` slice sends its
  own bytes.
- Python ASGI: Unit no longer refuses a WebSocket message that is larger than
  1 MB. The limit is ``max_frame_size``.
- PHP: the TrueAsync code path is removed. It never built.
- njs is updated to 1.0.1.

**Build**

- ``./configure --hardening=[off|default|strict]`` adds compiler and linker
  hardening flags. The default is ``off``.
- The released binaries no longer have the test hooks. Before, the packages
  were built with ``--tests`` and had the hooks.
- The GnuTLS, CyaSSL and PolarSSL backends are removed. The fiber
  implementation, the job cluster, ``nxt_mem_zone`` and other code that the
  build never used are also removed.

**unitctl**

unitctl now reads and writes JSON only. It refuses a JSON5, hjson or YAML
file. The message tells you how to convert the file. TLS support is a Cargo
feature. It is on by default. The static musl build does not have it.

**************
Full Changelog
**************

.. code-block:: none

   Changes with FreeUnit 1.37.0                                     01 Oct 2026

       *) Security: the router and libunit read records from shared memory.
          The other process can write to this memory at any time. The code did
          not check the records enough. A buffer that was not a whole number of
          records was read past its end. In libunit, the segment id UINT32_MAX
          wrapped the size of the segment array. A segment of any size was
          accepted. A duplicate segment id replaced a segment that buffers
          still used. A field could point before the field array. The router
          trusted a busy chunk marker that the application can clear. The code
          now checks all of these.

       *) Bugfix: a keep-alive TLS connection could use freed TLS settings.
          This happened when the connection was idle during a reconfiguration
          and then closed. The connection now keeps the configuration until the
          connection is freed.

       *) Bugfix: a read or a write could run on a closed connection. This
          happened when the read or write was already queued at the time of the
          close. A write could call a missing error handler. A read could read
          the closing socket and close the connection a second time. A queued
          handler of this type now does nothing.

       *) Bugfix: a static file response could close a file descriptor two
          times. This happened when the response failed after the request was
          closed. The second close could close a descriptor that another
          connection had got in the meantime.

       *) Bugfix: Unit sent two Content-Length fields to the upstream server.
          This happened for a proxied request with a chunked body, and for an
          HTTP/2 request without a content-length.

       *) Bugfix: with "limits": {"timeout"} set, Unit closed a WebSocket
          session about one timeout after the upgrade. The request deadline
          stayed armed for every frame. The deadline now stops at the upgrade.

       *) Bugfix: the router crashed when it validated a configuration with
          "compressors" in the object form.

       *) Change: with telemetry on, the application now gets a traceparent
          that names the span of FreeUnit as its parent. The spans of the
          application are now children of the span of FreeUnit. Before, the
          application got the traceparent of the client without a change.

       *) Security: an application process could send control messages to the
          router. It could make the router quit, load a configuration, restart
          applications, forget a process, redirect the error log, or reopen the
          access log. The router now checks the sender pid that the kernel
          gives. QUIT, CHANGE_FILE and ACCESS_LOG must come from main.
          REMOVE_PID must come from main or from a prototype. DATA, APP_RESTART
          and STATUS must come from the controller. For a refused message, the
          router closes the descriptors and does not reply. This makes the
          attack harder, but it does not stop the attack yet. The router reads
          the pid of main and of the controller from the ports that NEW_PORT
          registers. An application can still send a false NEW_PORT first. A
          later change will check NEW_PORT.

       *) Bugfix: the controller closed the connection of an authorized user.
          This happened when unitd ran as root and the control socket belonged
          to another user or group (--control-user or --control-group). The
          user passed the permission check of the socket file, but the
          controller then closed the connection. The controller now accepts the
          configured user, and a peer in the configured group.

       *) Bugfix: a worker that got QUIT before it was ready did not stop. It
          ran until Unit killed it 15 seconds later, so unitd was slow to exit.
          The worker now exits at once.

       *) Bugfix: at shutdown, the router could ask a prototype to start a new
          worker when the prototype was already exiting. The prototype then
          forked a worker that nobody stopped, and unitd did not exit. If the
          prototype was gone, the router wrote a false alert. The prototype now
          refuses the start. The router writes a gone prototype at the debug
          level.

       *) Change: a QUIT that fails because the worker already exited is now
          logged at the info level. Before, Unit logged it as an alert.

       *) Security: an application could write an unexpected value into an
          entry of a shared memory queue. The router then retried that entry
          without end. Each enqueue and each dequeue now stops after one queue
          size of retries. The router refuses the message and writes an alert.

       *) Security: a port kept every fragment of a message until the last
          fragment arrived. A peer process could make the port hold memory
          without limit. A fragment that named a shared memory segment but had
          no record also left a receive buffer in the stream. The next read
          reused the same buffer. Reassembly now has these limits: 64 streams,
          128 MiB for each stream, and 256 MiB for each port. A new stream
          drops the oldest stream when 64 streams are open. Unit drops a
          fragment of this type. A release build no longer crashes when it
          frees a port that is linked without a process.

       *) Bugfix: an application used a shared memory segment id from the other
          process to grow its array of segments without a limit. An id such as
          100000000 in one message made the application allocate and fill an
          array of that size. The process could run out of memory. The
          application now refuses an id of 65536 or more. The router already
          refused such ids from applications. The router now uses the same
          limit for the segments that it creates.

       *) Bugfix: the proxy did not recognize some values of the upstream
          Transfer-Encoding. It recognized only the exact value "chunked".
          "Chunked" and "gzip, chunked" were not recognized. The proxy then
          framed the body by Content-Length or by connection close. The chunk
          framing reached the client as body bytes. The proxy now parses the
          value as a list of codings and compares coding names without case.
          The proxy decodes one "chunked" coding. The proxy cannot decode any
          other transfer coding, or chunked together with Content-Length. In
          these cases the request fails with 502. The proxy never sends
          Transfer-Encoding to the client. A response to HEAD, and any 204 or
          304 response, does not cause these 502 errors. Such a response ends
          at the first empty line, so no Transfer-Encoding frames it. Before,
          such a response caused a 502 when it had chunked together with
          Content-Length.

       *) Feature: the --hardening=[off|default|strict] configure option adds
          compiler and linker hardening flags. Unit probes each flag. A
          compiler that does not support a flag loses only that flag. The
          default is "off", so a build without the option does not change.

       *) Feature: "PUT /certificates/<name>" replaces an existing certificate
          bundle in place. The main process writes the bundle to a temporary
          file and renames it over the old file. A crash never leaves a partial
          bundle. If the current configuration names the bundle, the controller
          applies the configuration again before it answers. New handshakes get
          the new certificate. Accepted connections finish with the old
          certificate. An external ACME client can renew a certificate with one
          request and no restart. For more information, see "Automatic
          renewal with an ACME client" in the certificates page. Unit refuses
          a bundle of more than 1 MiB with 413. The router opens bundles
          read-only.

       *) Bugfix: with "isolation": {"namespaces": {"pid": true}}, a worker
          that died before it fully started left its record, port and
          descriptor in the main process. They stayed there until the prototype
          exited. The prototype now reports such a worker to main, and main
          drops them.

       *) Bugfix: the main process accepted a second WHOAMI from an application
          process. It also accepted WHOAMI from a parent that is not a
          prototype. Main then linked the process into the list of its parent
          two times, and this corrupted the list. Main now refuses such a
          message.

       *) Bugfix: a request could reach the application with a wrong length of
          the method or of a header name. The application protocol stores these
          lengths in one byte. When a method was longer than 255 bytes, the
          router wrapped the length. For PHP, Perl and Ruby, header names get
          the prefix "HTTP_". Because of this, names of 251 to 255 bytes
          wrapped. The router now refuses a method of more than 255 bytes with
          501. It refuses a header name that overflows with 431. Unit logs both
          at the "info" level. Other languages continue to accept header names
          of up to 255 bytes.

       *) Bugfix: the proxy sent an upstream 1xx interim response ("100
          Continue", "103 Early Hints") to the client as the response. It sent
          the final response as the body of the interim response. The proxy now
          drops interim responses (101 is an exception) and sends the final
          response. If the upstream sends more than ten interim responses, or
          one that is larger than the proxy header buffer, the request fails
          with 502.

       *) Change: Unit now refuses a certificate bundle whose private key does
          not belong to the first certificate. The upload fails with 400
          "Invalid certificate.". Before, Unit stored the bundle. The next
          reconfiguration of every listener that named the bundle then failed.
          Certificate names that start with "." are now reserved for the files
          of the store. Unit ignores files with such names at startup. After an
          upgrade, Unit does not load a stored bundle that has a mismatched
          key. Unit writes an alert at startup, and the bundle leaves
          /certificates. The file stays in the state directory. You cannot
          delete it through the API, so remove it by hand.

       *) Bugfix: an application worker that served a WebSocket upgrade never
          became idle again. The router counts a session on the worker. It
          keeps a worker that has a session out of the idle queues. Nothing
          removed the session from the count when the session ended. The
          process stayed out of the idle queues. Its idle timer never ran. Its
          slot counted against "processes": {"max"} until the process died. An
          application that serves WebSockets reached this limit one upgrade at
          a time. Unit now removes the session from the count when the session
          ends, whichever side ends it. This bug began in 1.19.0.

       *) Bugfix: the router counted an application as idle when the
          application had answered a request but was still running. PHP does
          this each time a script calls fastcgi_finish_request(). The response
          goes out and the script continues. The router returned the slot of
          the worker to "processes": {"max"}. The idle timer could then end a
          process that was still running. Such a worker now reports itself busy
          until the work ends. As a result, "max" limits the live processes, and
          "/status" reports them as "detached". The same rule applies when the
          "limits": {"timeout"} deadline of a request has passed. The worker
          that still runs the request does not return to the idle pool. It
          counts against "max" until it answers or exits. This bug began in
          1.29.0.

       *) Change: "limits": {"timeout"} now also limits how long a request
          waits for an application process. Before, it limited only the time
          that a worker spends on the request. A request that waited for
          capacity had no deadline. The default is still no timeout.

       *) Security: the router decoded the response of an application in shared
          memory without a check. It read the field count two times. It
          followed the offsets of names, values and the body without a bounds
          check. An application could point the router to any address. Also,
          libunit read the request from shared memory more than once after it
          checked the request. A sibling process of the same application maps
          the same segment, and it could change a value between the reads. Both
          sides now read each value once and check each offset against the
          buffer.

       *) Security: the string form of "format" in "access_log" wrote the
          expanded value of a variable without escaping. "$uri" is the
          percent-decoded target. A request for "/%0d%0a..." put a real CRLF in
          the log. The rest of the line then looked like the record of a
          request that never happened. Unit now escapes the bytes that a
          variable expands to, in the same way as nginx. The quote, the
          backslash, each byte below 0x20, 0x7F and each byte above it become
          "\xHH". nginx writes no short forms. A reader that unescapes an nginx
          log can read this log. The text of the format is not changed. A tab
          or a quote that the operator wrote in the format still reaches the log
          as it is. An "njs" format is an exception, because it produces the
          whole record, and Unit escapes all of it. A value that has its own
          quote now shows the quote escaped. For example, an entity-tag that is
          logged through "$response_header_etag" reads \x22abc\x22 and not
          "abc". A non-ASCII path reads "\xD0\xBF..." and not its bytes. A log
          parser that expects the raw bytes must change. You can recover the
          bytes from "\xHH". This change does not affect the object form of
          "format". The object form does not keep the bytes either. It replaces
          each byte that is not valid UTF-8 with U+FFFD before it serializes.

       *) Change: the contrib njs is now version 1.0.1.

       *) Bugfix: a port that was closed and freed could leave a pending epoll
          or kqueue change. A pointer into the port holds the change. Unit
          applies the change when it commits the batch. This is at the top of
          the next poll at the latest, and that is after the memory pool of the
          port is released. The commit then read freed memory. It could also
          name a descriptor number that the kernel had given to another user. A
          port now drops its pending changes before Unit frees it (#414).

       *) Bugfix: a process could stop hearing from a peer for ever. The
          wake-up tells a peer to read the shared queue. When this wake-up
          failed because the kernel could not allocate memory, the port treated
          the peer as dead. The port dropped the wake-up. A later message
          raises a wake-up only when the queue was empty. So no later message
          on that port raised a wake-up. Unit now keeps the wake-up and tries
          it again. The new try does not wait for a socket event. A socket that
          never filled up does not give such an event (#392).

       *) Security: a port message was queued when the socket of the peer was
          not writable. The queued message borrowed the descriptors that it
          carried. For NEW_PORT, these are the socket and the queue of another
          port. If a port closed before the queue drained, the deferred
          sendmsg() named a closed number, or an unrelated descriptor that
          reused it. The queued copy now owns duplicates of the descriptors and
          closes them after the send (#388).

       *) Bugfix: the router died on the first request after a configuration
          that had a "compression" block was replaced by one that had none. The
          compression state was held in process globals. The router
          configuration that parsed them allocated them. A later configuration
          did not refill or clear the globals, so the next request read a freed
          pool. Unit now holds the state for each configuration and reaches it
          through the request. A response keeps the compressor that it already
          uses. A body that is still in compression when the configuration is
          replaced also finishes (#167).

       *) Bugfix: a static response that is subject to content negotiation now
          has "Vary: Accept-Encoding". Without this header, a shared cache could
          store the first representation that it saw and serve it to every
          client. A client that cannot decode gzip could get gzip bytes. A
          client that accepts gzip could get the uncompressed copy instead of
          the small version. Unit sends the header on the identity response and
          on the compressed response. A cache must not reuse the identity
          response for a client that accepts gzip.

       *) Change: Unit removed the unused job cluster (nxt_job.c, nxt_job.h and
          nxt_event_conn_job_sendfile.c). The offload path that they implemented
          had no caller in the tree. Its thread pool handoff could not run,
          because nothing assigned the connection field that it read.

       *) Feature: byte-range requests for static files. A "share" action now
          answers a satisfiable single-range "Range: bytes=..." request with
          "206 Partial Content" and a matching "Content-Range". It answers an
          unsatisfiable request with "416 Range Not Satisfiable". Unit now sends
          "Accept-Ranges: bytes" also on a plain 200. Unit supports the three
          single-range forms: "A-B", "A-" and the suffix form "-N". The end is
          limited to the last byte of the file. Unit ignores a multi-range
          request and answers with the full 200, as RFC 9110 permits. Unit
          checks "If-Range" against the entity-tag of the file (strong
          comparison) or against its "Last-Modified" date. If they do not match,
          Unit sends the full 200. Unit checks preconditions (RFC 9110 Sect.
          13.2.2) first. Because of this, a 304 or 412 result has priority over
          any Range. Unit does not content-code a response that it serves from
          a Range. Compression still applies to a full 200.

       *) Change: unitctl builds TLS support behind a "tls" Cargo feature. The
          feature is on by default. The musl build turns it off. The static
          binary then does not link a C TLS library. It does not accept an
          "https://" control socket address, and it refuses one with a message
          that names the feature. A Unix socket or a plain "http://" address
          works as before. A build with the default features does not change.

       *) Change: unitctl sends a JSON configuration file as the operator wrote
          it. Before, unitctl parsed the file and serialized it again. This kept
          the last of two object members with the same name, and it changed the
          spelling of numbers. The server never saw what the operator wrote.
          Unit now reports the duplicate itself, with the line and column in
          the file. unitctl no longer refuses a file that is not valid UTF-8.
          Unit refuses it and names the member. The "edit" command no longer
          accepts JSON5 comments in the temporary file.

       *) Change: unitctl no longer reads JSON5. unitctl refuses a ".json5"
          file by name, with a message that tells you to convert the file
          first. To convert it, use "json5 -o config.json config.json5". To
          reformat ordinary JSON, use "jq". After the configuration upload path
          stopped parsing its input, only the refusal path used the JSON5
          parser. This change removes that parser and two crates.

       *) Feature: conditional requests for static files. A "share" action
          now answers a GET or HEAD request with "304 Not Modified". The
          request must carry "If-None-Match" or "If-Modified-Since", and the
          validators of the file must still match. A client that already has
          the file does not get it again. Unit sent "ETag" and "Last-Modified"
          before, but it ignored them when they came back. The comparison of
          entity-tags is weak, and "*" matches any representation. If
          "If-None-Match" is present, it has priority over "If-Modified-Since"
          (RFC 9110). Unit evaluates "If-Match" and "If-Unmodified-Since"
          first. If they do not hold, Unit answers "412 Precondition Failed".

       *) Change: a response with a content coding now has a weak entity-tag.
          As a result, "If-Range" cannot resume a coded representation.
          "If-None-Match" revalidation is not affected. Unit makes the tag
          from the mtime and the size of the file. These values do not change
          with the content coding. In 1.36.1 and earlier, a gzip response and
          the identity response had the same strong validator. RFC 9110
          requires a strong validator to change when the selected
          representation changes. nginx also makes the tag weak for this
          reason.

       *) Security: a file descriptor is no longer leaked when no acceptable
          representation exists for a static request. A share with
          compression answered "406 Not Acceptable" but did not close the
          file that it had opened. One unauthenticated request with
          "Accept-Encoding: identity;q=0, *;q=0" used one descriptor of the
          router. When an attacker repeated the request, the descriptor table
          became full, and every application behind the router stopped. The
          fault exists since compression was added in 1.35.0. These versions
          are affected: 1.35.0, 1.35.1, 1.35.2, 1.35.3, 1.35.4, 1.35.5,
          1.36.0 and 1.36.1.

       *) Security: a file descriptor that was sent to a port is no longer
          leaked when nothing takes ownership of it. An application has the
          write end of the main port of the router. The message header is not
          authenticated. A compromised application could attach a descriptor
          to a message that does not expect one, or to a fragment that never
          reaches a handler. Then the descriptor table of the router became
          full, and every application behind it stopped. A fragment stream
          that starts and does not complete still keeps its descriptor. This
          needs a limit on pending fragments. The issue is
          https://github.com/freeunitorg/freeunit/issues/343.

       *) Bugfix: unitctl stopped when it could not decode a configuration as
          UTF-8. Unit stores the bytes that it gets. A configuration can hold
          bytes that no UTF-8 decoder accepts. Then "unitctl execute" and
          "unitctl export" failed with "JSON error [path=/config]". The
          operator could not read or back up the configuration. Both commands
          now work. They show the document with replacements for the bytes
          that cannot be decoded, and they name the members that hold these
          bytes. "unitctl export" stores the bytes of the server without a
          change. "unitctl edit" refuses such a configuration. It does not
          write the replacements back.

       *) Bugfix: unitctl changed the order of the members of a configuration.
          "unitctl edit" and "unitctl export" sent the document through an
          unordered map. The members came back in a random order, and an edit
          rewrote the whole configuration, also where nothing changed. The
          command now keeps the order that the server sent.

       *) Change: two source files that the build did not use are removed.
          The name src/nxt_job_cache_file.c is not in auto/, so no
          configuration compiled it. Nothing in the tree used it or its
          symbols. src/nxt_source.h is the only header of the 106 headers in
          src/ that no file includes. Nothing that you can observe changes.

       *) Change: the fiber implementation is removed. It was not compiled
          since 2017. The only allocation of the fiber stack of the engine
          was under "#if 0". The pointer was always NULL, so the setjmp()
          branch that tested it could not run. The thread, log and sprintf
          sites were already disabled. Nothing that you can observe changes.

       *) Change: the nxt_dyld wrapper for dlopen(), dlsym() and dlclose() is
          removed. It was in the first import and nothing called it. The
          language module loader in src/nxt_application.c calls dlopen() and
          dlsym() itself. libnxt.a has one object file less. No other code
          used the wrapper.

       *) Bugfix: unitd no longer exits when the capget() syscall is denied.
          A syscall filter can omit capget, for example a systemd
          "SystemCallFilter=" allowlist or a seccomp profile that you wrote.
          Then a unitd that did not run as root failed to start with "failed
          to get process capabilities". Unit now writes a warning and runs
          without capabilities. For an application that does not enable the
          "credential" namespace, Unit disables the user and group switching
          and the "rootfs" isolation. These applications run with the uid of
          unitd. Every other capget() failure is still fatal.

       *) Bugfix: the main process did not answer a START_PROCESS request that
          it could not do. The reasons were an unknown router port, a sender
          that is not the router, or a failed allocation. The start stayed
          pending. The application then held every later start for a
          prototype that did not come. The requests that waited for the
          prototype never failed.

       *) Bugfix: Unit told the sender that a message was sent when the
          receiving process was dead and the message was not sent. A sender
          that answers a request and then sends a fallback lost both
          messages. An application could wait for an answer that nothing
          delivered.

       *) Bugfix: eight places did not take back a message when the port
          refused it. No other code frees the memory of these messages. The
          port layer accepts a buffer only when it answers success. A port
          refuses a message when memory is full, or when the receiving process
          does not read a full shared queue. In this case the memory was
          lost. Two of the places lost shared memory that no cleanup frees.
          An application could lose the capacity to answer.

       *) Change: Unit now closes a WebSocket connection when it cannot give a
          frame to the application. Before, Unit dropped such a frame and
          did not tell anyone. The stream of the peer then lacked a frame. For
          a fragmented message, the client cannot detect this.

       *) Bugfix: a port could stop sending after it ran out of memory. When a
          write must be tried again later, the port asked its own thread to
          watch the socket again. This request needed memory of its own. If
          the request failed, nothing watched the socket. Every later message
          stayed in the queue until the port closed. The port now holds the
          request that it needs, so the request cannot fail for lack of
          memory.

       *) Bugfix: the port layer reported that a message was sent when it was
          not sent and not queued. This happened when a socket answered
          EAGAIN and no memory was left to keep the message for a later
          attempt. A fault of this type needs memory pressure. The sender then
          cleared the state that could retry or report the message. A request
          could wait for an answer that nothing delivered.

       *) Bugfix: an application worker that died before it finished the start
          was not reported. The start that Unit made it for stayed pending
          for ever. When the application reached its "processes" maximum, it
          did not start more processes. The default of the "timeout" of an
          application is 0. Because of this, the requests that waited for the
          application hung and did not fail.

       *) Security: application processes no longer inherit the capabilities
          of unitd. A non-root unitd can have capabilities, for example from
          the systemd option "AmbientCapabilities=" or from file
          capabilities. Unit passed them through fork() to every application.
          A switch between two nonzero uids does not clear them, and a
          filtered capget() skips the switch. Each forked process now empties
          its permitted, effective, inheritable and ambient sets. It does this
          when its credentials are final and before the worker serves a
          request.

          The startup of the language module runs before the drop. The mount,
          pivot_root and chroot work for the "rootfs" isolation runs after
          the startup. This work needs the capabilities that Unit drops.

          If a syscall filter also denies capset(), Unit now refuses the
          start of the application. The request gets the answer 503, and the
          log names the denied syscall. Before, the application started with
          the capabilities.

          These cases do not change:

          - A process has an empty permitted, effective and ambient set. This
            is each process of a root unitd after it switches away from uid
            0. It is also each process of an unprivileged unitd that has no
            capabilities. Such a process has nothing to inherit. Unit also
            empties its inheritable set. This does not count as a change. It
            grants nothing without an execve() of a file that has a matching
            capability.
          - The main process keeps its capabilities. It needs
            CAP_NET_BIND_SERVICE to bind the listening sockets at each
            reconfiguration.
          - The router, controller and discovery processes write a warning and
            continue. They do not run application code.
          - An application with "user": "root" does not change. A root
            process gets the capabilities again at the next execve().

          One configuration loses a capability set. An application in a
          "credential" namespace started with a full capability set in this
          namespace. The default uid_map maps the euid of unitd to the uid of
          the application. For this reason the setuid() is not a transition
          out of uid 0, and nothing cleared the set. These capabilities were
          valid only in the namespace. Unit finishes its own use of them
          before the drop. If your application needs them, set "user":
          "root".

       *) Security: unitctl no longer depends on rustls-pemfile or on the
          "http2" feature of hyper. rustls-pemfile is not maintained. The
          parser is now rustls-pki-types, which is already in the dependency
          graph. The PEM parsing does not change. We ran both parsers on 1884
          PEM documents and found zero differences. This closes
          RUSTSEC-2025-0134. We also removed the "http2" feature from hyper,
          hyper-rustls and hyper-util. This removes the crates h2 and fnv.
          It closes RUSTSEC-2026-0258, a flood of empty DATA frames without a
          limit in h2 0.4.15. The control API uses only HTTP/1.1. unitd writes
          "HTTP/1.1" in each response line. For this reason HTTP/2 could not
          work with the server.

       *) Change: unitctl no longer offers HTTP/2 in the TLS handshake with a
          remote control API. This is a result of the removal of the "http2"
          feature above. If a TLS-terminating proxy is in front of a remote
          control API, the proxy must speak HTTP/1.1 to unitctl. unitctl
          cannot reach a proxy that accepts only HTTP/2.

       *) Change: unitctl no longer reads hjson or YAML, and it no longer
          writes YAML.

          - Unitctl reads the input that you pipe to "/config" on stdin as
            JSON, not as hjson. hjson is a superset of JSON, so JSON input
            still works. Comments and unquoted keys do not work.
          - Unitctl refuses a ".hjson" or ".cjson" file with the message
            "hjson is no longer supported: convert the file to JSON first".
            Before, it gave the file to the JSON parser. That parser reported
            a wrong error at the first comment.
          - Unitctl refuses a ".yaml" or ".yml" file with the message "YAML is
            no longer supported: convert the file to JSON first, for example
            with "yq -o=json"".
          - The supported input formats are json and pem.
          - "unitctl status -t yaml" does not exist. --output-format accepts
            json, json-pretty and text.

          This removes the nu-json dependency and the 30 crates of Nushell
          utility code that it needed. This code was too large for a tool that
          speaks one JSON control API. The change also removes serde_yaml and
          unsafe-libyaml. unsafe-libyaml is a c2rust transpile of libyaml with
          218 unsafe functions. It has no RustSec advisory.

          tools/unitc does not change. It still converts the configuration to
          and from YAML with yq.

       *) Change: src/nxt_queue.c is removed. It is the unused half of a queue
          utility library from nginx. It defined nxt_queue_sort() and
          nxt_queue_middle(). Both are exported, but nothing in the tree
          called them. src/nxt_queue.h and the nxt_queue_* macros do not
          change.

       *) Change: nxt_mem_zone is removed. It is a second allocator. It is a
          zone allocator over a mapped region. The product code uses nxt_mp,
          a pool allocator. Nothing in the router, in the applications or in
          a language module called nxt_mem_zone. Only its own unit test called
          it. "./build/tests" ran this test. The test is also removed, so the
          output of the suite no longer has the three lines "mem zone test
          passed". The upstream project nginx/unit already deleted the file in
          an unrelated cleanup.

       *) Change: the entity-tag and the last-modified date of a static file
          are now weak while the request is in the second of the last write
          of the file. Unit makes both values from the modification time in
          whole seconds and from the size. A rewrite to the same size in
          the same second changes neither value. RFC 9110 Sect. 8.8.1 allows
          a strong validator only when it cannot miss a change.

          In this window, "If-Match" and "If-Range" do not match. A range
          request with "If-Range" gets the full answer 200. Before, it got a
          slice that used a validator that Unit could not guarantee. A
          "Range" request without a condition does not change. "If-Match: *"
          does not change. The value "*" asks if a representation exists, and
          it does not ask if a validator matches. The tag keeps its format, so
          no cache loses its content.

       *) Change: the GnuTLS, CyaSSL and PolarSSL backends are removed. These
          are the files nxt_gnutls.c, nxt_cyassl.c and nxt_polarssl.c. The
          configure options "--gnutls", "--cyassl" and "--polarssl" are also
          removed. None of the three backends ever built. They read a member
          "c->u.ssltls" of a union that does not exist. They use types such as
          "nxt_ssltls_conf_t" and "nxt_event_conn_io_t". These types are from
          before a refactor that is still visible in the tree. With one of
          the options, the compiler stopped with an error. It did not report a
          clean "unsupported". In 2015 CyaSSL became wolfSSL and PolarSSL
          became mbedTLS. For this reason the options named products that no
          longer exist under these names. The OpenSSL backend does not change.
          No default build used these files.

       *) Change: the PHP TrueAsync code path is removed. It was for an API
          "zend_async_event_t" that PHP 8.5 did not put in its core. The
          configure probe never succeeded. In each build the code was behind
          "#if NXT_PHP_TRUEASYNC". It could not compile, also if the probe
          succeeded. It reads the members "async" and "entrypoint", which
          "nxt_php_app_conf_t" does not have. It calls
          "nxt_php_extension_init()", which no file in the tree defines. The
          probe, the "entrypoint" target key and the TrueAsync test suite are
          removed. A PHP application builds and runs as before.

       *) Bugfix: the java module split each outgoing WebSocket text message
          that was larger than 8 KiB into frames of 8 KiB. It did this for any
          value of "max_frame_size". A message of 64 KiB arrived as eight
          frames. A message of 16 MiB arrived as about two thousand frames.
          Each frame had its own header and its own message to the router.
          Every other language module sends a complete message as one frame.

          The module now encodes a complete text message in its own buffer
          and sends it as one frame. This is true for getBasicRemote() and
          getAsyncRemote(). A message that is larger than
          "nginx.unit.websocket.MAX_SEND_BUFFER_SIZE" is still fragmented. The
          default of this value is 16 MiB.

          Other senders do not change in the way they split data:

          - A Writer from getSendWriter() sends each flushed chunk as one
            frame. Before, a chunk was up to four frames.
          - An OutputStream from getSendStream() sends each 8 KiB that it
            fills as one frame.

          The module still does not use "max_frame_size". This value is a
          limit for inbound frames only.

       *) Bugfix: the java module sent nothing through the asynchronous
          WebSocket remote. This is true for each send from getAsyncRemote():
          sendText(), sendBinary() and sendObject(), with a SendHandler or
          with the Future that they return. Each send ended in a doWrite()
          that had no body. No frame left. The handler was not called, and
          Future.get() blocked for ever. getBasicRemote() uses a different
          path and was not affected.

          Such a send now works like a send from the blocking remote. The
          handler or the future completes on the sending thread with the
          result. The result is a failure when the session is closed (#434).

          Batching also works now. flushBatch() and setBatchingAllowed(false)
          threw an exception and did not send the batched data. A batched
          frame from a buffer with a position that was not 0 had a header
          with a length that was too large. This corrupted the frames after
          it.

       *) Bugfix: the java module sent wrong bytes, or no bytes, for a
          WebSocket message from a heap ByteBuffer that does not start at the
          first byte of its array. The module read the payload from the
          backing array at position() and ignored arrayOffset(). A buffer
          from ByteBuffer.wrap(a, off, n).slice() sent bytes from the start of
          the array, not its own bytes. A read-only heap buffer threw
          ReadOnlyBufferException and was not sent. The blocking remote and
          the asynchronous remote were both affected (#486).

       *) Bugfix: the Python ASGI module refused a WebSocket message larger
          than 1 MB for any value of "max_frame_size". The module had a
          private limit of 1 MB that no configuration wrote. It counted the
          fragments of a message against this limit. The router checks the
          configured value for each frame. A message of 4 MB was closed with
          1009 when "max_frame_size" was 32 MB. With the default size, a
          client that split a large message into small frames was also
          refused. A fragmented message also left a count that lowered the
          limit for the next message.

          "max_frame_size" now limits each frame alone. The module limits a
          connection to 10 MB of payload that the application did not receive
          yet. This payload is the fragments of a message in progress and the
          complete messages that wait for receive(). If nothing else waits,
          the module still accepts a single frame that is larger than 10 MB.

       *) Bugfix: Unit no longer answers a byte-range request with identity
          bytes when the client refused the identity coding. Unit serves a
          range as identity. A request with "Range" and with
          "Accept-Encoding: identity;q=0" got "206 Partial Content" with the
          bytes that the client refused. Unit now ignores the range and sends
          the full "200 OK" in a coding that the client accepts.

          Unit ignores the range completely. Because of this, a client that
          refuses identity and sends a range that cannot be satisfied no
          longer gets "416". These cases do not change:

          - A request that accepts no coding still gets "406 Not Acceptable".
          - A range from a client that accepts identity still gets a 206.

          Unit now reads many "Accept-Encoding" lines in one request as one
          value, joined with commas. RFC 9110 defines this. Before, Unit read
          only the first line.

       *) Bugfix: Unit no longer sends a response as identity to a client that
          refused the identity coding when no compressor applies to the
          response. With a compressor, "Accept-Encoding: gzip, identity;q=0"
          was accepted because gzip was acceptable. If the media type of the
          response was not in "types", or the response had no media type, Unit
          sent the response without compression. These are the identity bytes
          that the request refused.

          Such a request now gets "406 Not Acceptable". This is true with a
          "Range" header and without it. A 406 from this negotiation has
          "Vary: Accept-Encoding".

          Unit does not negotiate these responses:

          - A 1xx, 204 or 304 response. An application can send one of these
            with a "Content-Length". It is not affected.
          - A response with no body.
          - A response that has its own "Content-Encoding".

       *) Bugfix: "*" in "Accept-Encoding" now stands for each enabled
          compressor that the client did not name. Before, it stood only for
          the identity coding. With gzip enabled and applicable,
          "identity;q=0, *;q=1" got "406 Not Acceptable". The wildcard could
          select only identity, and the same field refused identity.

          A coding that the field names keeps its own weight. The wildcard
          does not match it. The named coding wins a tie. For example, "gzip,
          *" now sends gzip. Before, it sent the response without compression.

       *) Bugfix: Unit no longer selects a compressor that is below its own
          "min_length" before a compressor with a lower weight that it can
          apply. Each compressor has its own "min_length". For example, gzip
          has 1000 and deflate has 0. Before, a response of 100 bytes was sent
          without compression, because gzip had the higher weight. A client
          that refused the identity coding got the same bytes without
          compression. This client now gets deflate. If each compressor that
          the client accepts is below its "min_length", the client gets "406
          Not Acceptable". Before, it got the bytes that it refused.

       *) Change: a server that has no compression now answers "406 Not
          Acceptable" when "Accept-Encoding" refuses the identity coding. The
          refusal is "identity;q=0", or "*;q=0" with no more specific entry
          for identity. Such a server has only the identity coding. Before,
          it sent the response, or the requested range, in the bytes that the
          client refused.

          To read the refusal, Unit now looks at two values for each response
          with a known length above zero. These are its own "Content-Encoding"
          and the "Accept-Encoding" of the request. Before, Unit did these
          checks only with a compressor.

       *) Bugfix: Unit no longer reads a malformed weight in "Accept-Encoding"
          as a refusal. Unit converted the qvalue with strtod(). For
          "identity;q=" and "identity;q=abc", strtod() takes no digits and
          gives zero. Each of them got "406 Not Acceptable", but the client
          refused nothing. "q=0x0" and "q=0e0" did the same.

          Unit now ignores an element when its weight does not match the
          grammar of RFC 9110 Sect. 12.4.2. It already ignored an element with
          an unknown coding. This change also removes "q=nan". A NaN is
          false in both comparisons of the range check from 0 to 1, so it
          passed the check. It then had a higher rank than each real weight.

       *) Bugfix: Unit answered "503 Service Unavailable" instead of "406 Not
          Acceptable" when a negotiation of "Accept-Encoding" failed for a
          response from an application. The router treated each result of the
          acceptability check other than success as a server error. Only the
          static path reported the 406.

       *) Change: unitd, libunit.a and the language modules no longer have the
          test hooks that the build compiled under "#if (NXT_TESTS)".
          "./configure --tests" defined the macro for the whole build. The deb
          and rpm packages pass "--tests". For this reason each released
          package from 0.2 to 1.36.1 had the hooks. All of them had the
          nxt_random_test() entry point. In 1.36.0 and 1.36.1 they also had
          the fault-injection branches and counters in nxt_mp.c,
          nxt_port_rpc.c and nxt_port_socket.c. Two of these were exported
          symbols. The hooks are now only in the test programs. A build
          without "--tests" does not change.
