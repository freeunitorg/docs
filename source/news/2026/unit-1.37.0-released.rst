:orphan:

####################
Unit 1.37.0 Released
####################

FreeUnit 1.37.0 adds byte-range and conditional requests for static files,
certificate replacement without a restart, and a ``--hardening`` configure
option.  It hardens the messages between Unit's processes against a
compromised or faulty application, fixes HTTP content negotiation, and
removes code that was never built or never used.

**Security**

An application process is not trusted.  This release closes several ways in
which one could crash or confuse a privileged process:

- The router and libunit now read each value in shared memory once and check
  every offset against its buffer.  Before, an application could point the
  router at any address, and a sibling process could change a value after it
  was checked.
- A port limits how much memory the reassembly of fragmented messages can
  hold, and a shared memory queue stops after a bounded number of retries.
- The router accepts QUIT, a new configuration and its other control
  messages only from the main process or the controller, by the sender pid
  that the kernel gives.  This makes the attack harder, but does not stop
  it yet: an application can first send a false ``NEW_PORT``.  A later
  release checks ``NEW_PORT`` too.
- A shared memory segment id from the other process can no longer grow an
  array without limit.
- File descriptors sent with a failed or queued message are no longer
  leaked.
- Application processes no longer inherit the capabilities of a non-root
  unitd, for example from systemd ``AmbientCapabilities=``.
- The string form of the ``access_log`` ``format`` escapes the bytes that a
  variable expands to, the way nginx does.  Before, a request for
  ``/%0d%0a...`` could add a false record to the log.
- unitctl no longer depends on rustls-pemfile or on the HTTP/2 support of
  hyper.  This closes RUSTSEC-2025-0134 and RUSTSEC-2026-0258.

**Static files**

- A **share** answers a single-range ``Range`` request with ``206 Partial
  Content``, and an unsatisfiable one with ``416``.  ``If-Range`` is
  supported.
- A **share** answers ``If-None-Match`` and ``If-Modified-Since`` with
  ``304 Not Modified``, and ``If-Match`` and ``If-Unmodified-Since`` with
  ``412 Precondition Failed`` when they do not hold.
- A content-coded response carries a weak entity-tag.

See :ref:`configuration-share-caching`.

**HTTP**

- ``Accept-Encoding`` is read as RFC 9110 defines it.  ``*`` stands for each
  enabled compressor that the client did not name, a compressor below its
  ``min_length`` is not selected, and a request that refuses every coding Unit
  can send gets ``406 Not Acceptable``.  This is also true on a server with
  no compression configured.
- ``"limits": {"timeout"}`` now also bounds how long a request waits for an
  application process.
- The proxy recognises ``Transfer-Encoding: gzip, chunked`` and other
  spellings of ``chunked``, handles an upstream 1xx response, and no longer
  sends two ``Content-Length`` fields upstream.
- With telemetry on, the application gets a ``traceparent`` whose parent is
  FreeUnit's own span.

**Certificates and the control socket**

- ``PUT /certificates/<name>`` replaces an existing certificate bundle.  An
  external ACME client can renew a certificate with one request and no
  restart; see :ref:`configuration-ssl-acme`.
- When unitd runs as root, the control API now also accepts the user set
  with ``--control-user`` and a peer in the group set with
  ``--control-group``.  Before, such a user passed the socket permissions,
  but the controller then closed the connection.

**Processes and shutdown**

- Unit no longer waits 15 seconds at shutdown for a worker that got a QUIT
  before it was ready.
- At shutdown, a prototype that is exiting no longer forks a worker that
  nobody stops.
- A worker that answers a request and keeps running, for example after
  ``fastcgi_finish_request()`` in PHP, is counted as busy until it finishes.
  Before, the idle reaper could stop it while it still ran.
- A worker that served a WebSocket upgrade becomes idle again when the
  session ends.  Before, it stayed out of the idle queues and counted
  against ``processes.max`` until it died.
- A non-root unitd no longer exits when a syscall filter denies ``capget()``.

**Language modules**

- Java: a WebSocket text message is no longer split into 8 KiB frames, the
  asynchronous remote now sends, and a ``ByteBuffer`` slice sends its own
  bytes.
- Python ASGI: a WebSocket message larger than 1 MB is no longer refused;
  the limit is ``max_frame_size``.
- PHP: the TrueAsync code path, which never built, is removed.
- njs is updated to 1.0.1.

**Build**

- ``./configure --hardening=[off|default|strict]`` adds compiler and linker
  hardening flags.  The default is ``off``.
- Released binaries no longer contain the test hooks.  Before, the packages
  were built with ``--tests`` and carried them.
- The GnuTLS, CyaSSL and PolarSSL backends, the fiber implementation, the
  job cluster, ``nxt_mem_zone`` and other code that the build never used are
  removed.

**unitctl**

unitctl now reads and writes JSON only.  A JSON5, hjson or YAML file is
refused with a message that tells you how to convert it.  TLS support is a
Cargo feature, on by default; the static musl build does not have it.

**************
Full Changelog
**************

.. code-block:: none

   Changes with FreeUnit 1.37.0                                     01 Oct 2026

       *) Bugfix: a chunked request body that grew over "max_body_size"
          after the read that carried the request header got no response.
          The router closed the connection without a status line. Now it
          answers 413 and closes. A body that crossed the limit in the same
          read as the header already got 413. A later read that fails to
          allocate memory in the chunk parser, or to write the body to the
          temporary file, now answers 500 and closes in the same way. The
          400 for a malformed chunk in a later read now clears keepalive
          and closes the connection, like the other error paths. A short
          write of a body with a Content-Length to the temporary file now
          answers 500 instead of closing silently.

       *) Bugfix: the router could take a message of an application response
          before an earlier message of the same response. With a header over
          1024 bytes and a first body write of 16 to 1024 bytes, it parsed the
          body as the header, logged "response buffer too small for fields
          count", and answered 503. With a body write over 1024 bytes and a
          later smaller one, the client got the two parts in the wrong order,
          and nothing was logged. This needed two or more application
          processes or threads. The bug had appeared in 1.19.0. The fix is in
          libunit: an application of type "external", such as Go or
          Node.js, gets it when it is built with the new libunit.

       *) Bugfix: the router did not answer "Expect: 100-continue". A client
          that sent it, as curl and Guzzle do for large uploads, waited for its
          own timeout before it sent the body. For curl, that timeout is 1
          second. The router now sends "100 Continue" before it waits for the
          body, also when a part of the body came with the header. A request
          that the router refuses from its header gets its final status with no
          100. A proxied request no longer carries the Expect field to the
          upstream.

       *) Bugfix: the PHP module read the target index of a request after the
          request was released. libunit fills released request memory with
          0xA5, so the module called chdir(2) on every request to a "script"
          target. A request could also run in the directory of another
          target. This happened with 166 or more targets, and after
          fastcgi_finish_request() when the released memory already held a
          request for another target. The bug had appeared in 1.18.0.

       *) Bugfix: flush() in a PHP application did not send the response
          header. If the application had no output yet, or its output was
          in an output buffer, the client got the header only at the end of
          the request, and headers_sent() returned false after flush(). Now
          flush() sends the header. As in mod_php, flush() does not empty
          the output buffers; ob_flush() does. The PHP module has had no
          flush handler since 1.4.

       *) Bugfix: the router sent the header of a chunked HTTP/1.1 response
          without the empty line that ends it, and sent that line with the
          first body bytes. If an application sent the header and then
          waited before its body, the client could not use the header until
          the body began. Now the header ends at once. A complete response
          has the same bytes as before. $body_bytes_sent no longer counts the
          empty line.

       *) Change: the main process now writes the state files in a
          short-lived child process, so a slow fsync(2) no longer delays
          the start of application processes after a reconfiguration, or
          the exit of the main process. One store runs at a time; a newer
          configuration waits for it, and only the latest one waiting is
          stored. At exit, the main process waits for the store to finish;
          when a newer configuration waits, it stops the running store
          first. When the store fails, the main process logs an alert.

       *) Change: an uploaded certificate bundle is now also stored by that
          child process, so its two fsync(2) calls no longer stop the main
          process. The upload is still answered only when the bundle is on
          disk. A certificate deletion also runs in the child process, after
          every earlier store. A controller process that exits during a store
          is started again only when the store ends, so that it reads the
          stored files.

       *) Bugfix: a regular expression in the configuration could run for up
          to 10,000,000 match steps on one request. A match now stops after
          at most 100,000 steps and the request gets a 500 response. The
          error log then gets a warning with the pattern and the subject
          length, not the subject. In "compression" "types", a match that
          stops is not a match, and the response is not compressed. A
          repeated group takes about 2 steps per byte. So a subject much
          longer than 8 KiB can reach the limit and get a 500 response. Such
          a subject needs a "large_header_buffer_size" above its default of
          8192. With PCRE 1 and with PCRE2 before 10.30, a match also stops
          at 2,000 nested calls and does not overflow the thread stack.
          There, a repeated group on a subject of more than about 1,000
          bytes can get a 500 response.

       *) Security: the wasm module did not check the offset that the malloc
          handler of the guest returned. A negative or large offset put the
          request buffer outside the linear memory of the guest. The worker
          now refuses such an offset, or an offset that is not aligned, and
          exits at startup.

       *) Bugfix: an application with a rootfs created the missing
          directories of each mount destination with mkdir(), which follows
          symlinks. A symlink inside the rootfs could make unitd create empty
          directories outside it. The directories are now created without
          following symlinks. On a kernel without openat2() (older than 5.6)
          a rootfs with a symlinked component in a mount destination (for
          example usr -> real_usr) is now refused. A missing rootfs
          directory is now refused on every system. Builds without
          openat2(), such as on FreeBSD, created it before.

       *) Bugfix: with isolation.namespaces.cgroup and isolation.cgroup.path,
          the cgroup namespace of an application was rooted at the cgroup of
          the main process, not at the configured cgroup. The application saw
          its own cgroup as "/scope/python" instead of "/". The namespace is
          now created after the process is moved into its cgroup.

       *) Change: on macOS, a stored state file is now flushed with
          fcntl(F_BARRIERFSYNC), and its directory with fcntl(F_FULLFSYNC)
          after the rename, so the file also leaves the cache of the drive.
          Plain fsync(2) there does not flush that cache, and a power loss
          could lose a stored configuration.

       *) Security: the router and libunit read records from shared memory
          that the other process can still write, without enough checks. A
          buffer that was not a whole number of records was read past its
          end. In libunit, a segment id of UINT32_MAX wrapped the size of the
          segment array, a segment of any size was accepted, a duplicate
          segment id replaced a segment that buffers still used, and a field
          could point before the field array. The router trusted a busy chunk
          marker that the application can clear. All of these are now
          checked.

       *) Bugfix: after 2^32 RPC registrations the stream counter wrapped
          and handed out stream 0, which callers read as a failure. The
          registration stayed. Stream 0 is now skipped.

       *) Security: the wasm module read the base address of the linear
          memory of the guest only once, at startup. A guest with a 64-bit
          memory could grow it past 4 GiB, and wasmtime then moved it. The
          module then read and wrote the old address, and the worker crashed.
          The module now refuses a 64-bit memory. It also reads the base
          address again after the guest runs.

       *) Bugfix: an uploaded njs module was written into its file without
          truncating it, and without fsync(2). When a longer file of that
          name was already on disk, for example one that a failed write had
          left, the old tail stayed after the new module. The router read
          that file and the configuration failed. The upload was also
          answered with 200 when the write failed. Now the main process
          stores the module through a temporary file, flushes it and renames
          it, in its store child, and the upload is answered only when the
          module is on disk. A deletion also runs in the store child. A
          module name can no longer start with ".", and a module larger than
          16 MiB is answered with 413. Earlier versions accepted a name that
          starts with "."; such a module is no longer loaded or listed after
          the upgrade.

       *) Bugfix: at startup, a stored njs module that did not compile hid
          every stored module that was read after it. Those modules were
          missing from /js_modules and could not be used. Now only the module
          that does not compile is left out.

       *) Bugfix: a keep-alive TLS connection that was idle across a
          reconfiguration could use the TLS settings of the old configuration
          after they were freed, when it was closed. The connection now keeps
          the configuration until it is freed.

       *) Bugfix: a read or write that was already queued when a connection
          was closed could run on the closed connection: a write could call a
          missing error handler, and a read could read the closing socket and
          close the connection again. Such a queued handler now does
          nothing.

       *) Bugfix: a static file response that failed after the request was
          closed could close the file descriptor twice. The second close could
          close a descriptor that another connection had got in the
          meantime.

       *) Change: on Linux, the default number of router threads
          ("listen_threads") is now at most the CPU limit of the cgroup v2
          group of unitd and of its parent groups ("cpu.max"), rounded up to
          whole CPUs. Before, it was the number of CPUs that unitd could run
          on, so a container limited to 2 CPUs on a 64-CPU host started 64
          router threads. Now it starts 2. A limit of 1.5 CPUs also gives 2
          threads. An explicit "listen_threads" is not changed. With a private
          cgroup namespace, only the limits inside the namespace are seen. The
          limit is read once, when unitd starts. cgroup v1 is not read.

       *) Bugfix: a proxied request with a chunked body, or an HTTP/2 request
          without a content-length, was sent to the upstream with two
          Content-Length fields.

       *) Bugfix: with "limits": {"timeout"} set, a WebSocket session was
          closed about one timeout after the upgrade, because the request
          deadline stayed armed for every frame. The deadline now stops at the
          upgrade.

       *) Bugfix: a WebSocket client that sent PINGs and did not read the
          PONGs could make the router keep a PONG in memory for each PING.
          Now, while a PONG is not sent, the router keeps only the PONG for
          the most recent PING, and sends it after the queued PONG (RFC 6455
          Section 5.5.3).

       *) Bugfix: the router crashed when it validated a configuration that
          gave "compressors" in the object form.

       *) Change: with telemetry on, the application now gets a traceparent
          that names FreeUnit's own span as its parent, so the application's
          spans are children of FreeUnit's span. Before, the application got
          the client's traceparent unchanged.

       *) Security: an application process could send control messages to
          the router. It could make the router quit, load a configuration,
          restart applications, forget a process, redirect the error log, or
          reopen the access log. The router now checks the sender pid that
          the kernel gives. QUIT, CHANGE_FILE and ACCESS_LOG must come from
          main. REMOVE_PID must come from main or from a prototype. DATA,
          APP_RESTART and STATUS must come from the controller. The router
          closes the descriptors of a refused message and does not reply.

       *) Security: an application process could send a false NEW_PORT to
          the router, register its own pid as main or as the controller, and
          then pass the checks above. It could also get the port of main or
          of the controller with GET_PORT, attach a shared memory segment to
          another process with MMAP, make a debug router abort with GET_MMAP,
          and answer a pending request of the router with RPC_READY or
          RPC_ERROR, for example with a false certificate. The router now
          accepts NEW_PORT from main, from a prototype for an application
          port, and from an application for its own application port only.
          GET_PORT, GET_MMAP, MMAP and OOSM must come from the application
          that the message names, and GET_PORT gives out only ports of the
          router. RPC_READY and RPC_ERROR must come from main, the controller
          or a prototype. Every process now refuses a NEW_PORT message that is
          too short. Limits: the router does not check that an RPC reply comes
          from the process that got the request. The ports of the router
          threads get messages through a shared memory queue, which gives no
          sender pid, so the router does not check senders there.

       *) Bugfix: when unitd ran as root and the control socket was given to
          another user or group with --control-user or --control-group, that
          user passed the socket file permissions but the controller then
          closed the connection. The controller now also accepts the
          configured user, and a peer in the configured group.

       *) Bugfix: a worker that got a QUIT before it was ready did not act on
          it, and ran until it was killed 15 seconds later, so unitd was slow
          to exit. The worker now exits at once.

       *) Bugfix: at shutdown, the router could ask a prototype that was
          already exiting to start a new worker. The prototype then forked a
          worker that nobody stopped, and unitd did not exit. If the
          prototype was gone, the router logged a false alert. The prototype
          now refuses the start, and the router logs a gone prototype at the
          debug level.

       *) Change: a QUIT that fails because the worker already exited is now
          logged at the info level, not as an alert.

       *) Bugfix: when a router thread ran out of connections or file
          descriptors, the log got an "epoll_ctl() failed (2: No such file or
          directory)" alert every 100 milliseconds until a connection was
          freed.

       *) Bugfix: when a router thread could not allocate the listen event
          while a listener was added, a configuration request could wait
          forever, or a listening socket shared by several router threads
          could be closed too early. When the thread had no free connection
          slot instead, the listener never accepted connections. Now the
          request completes, and a listener without a free slot starts to
          accept connections when a slot is free.

       *) Bugfix: at shutdown, idle client connections were closed but not
          freed. They are now closed through their protocol handlers.

       *) Bugfix: on systems without accept4(), an accepted socket that could
          not be made non-blocking was closed and then still used.

       *) Security: an application could write an unexpected value into an
          entry of a shared memory queue. The router then retried that entry
          for ever. Each enqueue and dequeue now stops after one queue size
          of retries. The router refuses the message and writes an alert.

       *) Security: a port kept every fragment of a message until the last
          one arrived, so a peer process could make it hold memory without
          limit. A fragment that named a shared memory segment but carried no
          record also left a receive buffer in the stream while the same
          buffer was reused for the next read. Reassembly is now limited to
          64 streams, 128 MiB per stream and 256 MiB per port, a new stream
          drops the oldest one when 64 are open, and such a fragment is
          dropped. A port linked without a process no longer crashes a
          release build when it is freed.

       *) Bugfix: an application used a shared memory segment id from the
          other process to grow its array of segments without a limit. An id
          like 100000000 in one message made it allocate and fill an array of
          that many slots, so the process could run out of memory. It now
          refuses an id of 65536 or more. The router already refused such ids
          from applications; it now uses the same limit for the segments it
          creates.

       *) Bugfix: the proxy recognised an upstream Transfer-Encoding only when
          its value was exactly "chunked". "Chunked" or "gzip, chunked" was
          not recognised, so the body was framed by Content-Length or by
          connection close, and the chunk framing reached the client as body
          bytes. The value is now parsed as a list of codings, and coding
          names are compared without case. One "chunked" is decoded. Any
          other transfer coding, and chunked together with Content-Length,
          fails the request with 502: the proxy cannot decode such a body,
          and it never forwards Transfer-Encoding to the client. A response
          to HEAD, and any 204 or 304, is exempt from both 502s: it ends at
          the first empty line, so no Transfer-Encoding frames it. Before,
          such a response gave 502 when it carried chunked together with
          Content-Length.

       *) Change: ".svgz" added to the default MIME type list as
          "image/svg+xml". A share "types" rule that names image/svg+xml or
          image/* now matches a .svgz file; before, the file had no type and
          such a rule refused it.

       *) Feature: a static ".svgz" file is served as "image/svg+xml" with
          "Content-Encoding: gzip". Before, it had no Content-Type, and a
          browser did not show it. The stored gzip bytes are sent
          unchanged: compression does not code them again, the ETag stays
          strong, and a Range applies to the stored bytes. A client without
          gzip in Accept-Encoding also gets the gzip bytes, as with
          "AddEncoding gzip svgz" in Apache. A "mime_types" setting that
          maps ".svgz" to another type adds no coding. The ETag of a .svgz
          file ends in "-gzip", so a cache that stored the old response
          gets a full response, not a 304. A .svgz file never answers 304
          to If-Modified-Since, and a date in If-Range never resumes it, so
          a client that revalidates by date only downloads the file again
          each time.

       *) Feature: the "body_min_rate" and "send_min_rate" options in
          "settings/http" set a minimum client rate in bytes per second on
          HTTP/1 connections. The body_read_timeout and send_timeout timers
          start again after each read or write, so a client that sends or
          reads one byte before each timeout kept a connection for ever.
          After a grace time equal to the related timeout, a client below
          the rate gets 408 (body) or the connection closes (response). The
          rate is checked for each window of at least the grace time, so
          bytes sent early give no credit for a slow transfer later. The
          default is 0, which disables the check. For body_min_rate, 256 is
          a good value. send_min_rate counts the bytes that the kernel
          accepts into the socket send buffer. The kernel sizes this buffer
          to the link, so the rate is near the real download rate of the
          client. A floor above the bandwidth of honest slow clients stops
          their downloads; use a small value, for example 16384.

       *) Feature: the --hardening=[off|default|strict] configure option adds
          compiler and linker hardening flags. Each flag is probed, and a
          compiler that does not support a flag only loses that flag. The
          default is "off", so a build without the option does not change.

       *) Feature: "GET /certificates" shows the SHA-256 fingerprint of the
          server certificate of every bundle as "fingerprint", in the form
          "openssl x509 -fingerprint -sha256" prints it.

       *) Feature: "PUT /certificates/<name>" replaces an existing certificate
          bundle in place. Main writes the bundle to a temporary file and
          renames it over the old one, so a crash never leaves a partial
          bundle. When the current configuration names the bundle, the
          controller applies the configuration again before it answers. New
          handshakes get the new certificate; accepted connections finish
          with the old one. An external ACME client can renew a certificate
          with one request and no restart; see docs/acme.md. A bundle over
          1 MiB is refused with 413, and a name over 255 bytes with 400, for
          PUT and for DELETE. A bundle with the same certificates as the
          stored one is not stored again and causes no reconfiguration. The
          router opens bundles read-only.

       *) Bugfix: the router leaked the TLS contexts it had built for a new
          configuration when applying that configuration failed later, for
          example in a bundle of a later listener or in an application.

       *) Bugfix: with "isolation": {"namespaces": {"pid": true}}, a worker
          that died before it was fully started left its record, port and
          descriptor in the main process until the prototype exited. The
          prototype now reports such a worker to main, which drops them.

       *) Bugfix: the main process accepted a second WHOAMI from an
          application process, and a parent that is not a prototype. The
          process was then linked into its parent's list twice, which
          corrupted the list in main. Such a message is now refused.

       *) Bugfix: a request could reach the application with a truncated method
          or header name length. The application protocol stores method and
          field name lengths in a single byte. When a method exceeded 255
          bytes, the router wrapped the length. For PHP, Perl, and Ruby, header
          names carry the "HTTP_" prefix, causing names of 251 to 255 bytes to
          wrap. The router now refuses a method longer than 255 bytes with 501,
          and an overflowing header name with 431. Both are logged at "info".
          Other languages continue to accept header names up to 255 bytes.

       *) Bugfix: an upstream 1xx interim response ("100 Continue", "103 Early
          Hints") was relayed to the client as the response, with the final
          response relayed as its body. The proxy now drops interim responses
          (101 excepted) and relays the final one; more than ten of them, or
          one larger than the proxy header buffer, fails the request with 502.

       *) Change: a certificate bundle whose private key does not belong to
          its first certificate is now refused at upload with 400 "Invalid
          certificate.". Before, the bundle was stored, and the mismatch
          broke the next reconfiguration of every listener that named it.
          Certificate names that start with "." are reserved for the store's
          own files, and files with such names are ignored at startup.
          After an upgrade, a bundle already stored with a mismatched key is
          not loaded (an alert at startup) and leaves /certificates; its
          file stays in the state directory and cannot be deleted through
          the API, so remove it by hand.

       *) Bugfix: an application worker that served a WebSocket upgrade never
          became idle again. The router counts a session on the worker and
          keeps a worker with a session out of the idle queues, but nothing
          uncounted the session when it ended, so the process stayed out of
          them for good: its idle timer never ran and its slot counted against
          "processes": {"max"} until it died, which an application that serves
          WebSockets reaches one upgrade at a time. A session is now uncounted
          when it ends, whichever side ends it; the bug had appeared in 1.19.0.

       *) Bugfix: an application that answered a request and kept running was
          counted idle. PHP does this whenever a script calls
          fastcgi_finish_request(): the response goes out, the script runs on,
          and the router returned the worker's slot to "processes": {"max"} and
          let its idle timer reap a process that was still executing. Such a
          worker now reports itself busy until the work ends, so "max" bounds
          live processes and "/status" reports them as "detached". The same
          holds for a request whose "limits": {"timeout"} deadline has passed:
          the worker still running it is no longer returned to the idle pool
          either, and keeps counting against "max" until it answers or exits;
          the bug had appeared in 1.29.0.

       *) Change: "limits": {"timeout"} now also bounds how long a request waits
          for an application process, not only how long a worker may spend on
          it. A request that waited for capacity previously had no deadline at
          all. The default remains no timeout.

       *) Security: the router decoded the response an application returned
          in shared memory without checking it: the field count was read
          twice, and the name, value and body offsets were followed without a
          bounds check. An application could point the router anywhere.
          libunit read the request from shared memory more than once after
          checking it. A sibling process of the same application, which maps
          the same segment, could change a value in between. Both sides now
          read every value once and check every offset against the buffer.

       *) Security: the string form of "access_log" "format" wrote what a
          variable expanded to without escaping it.  "$uri" is the
          percent-decoded target, so a request for "/%0d%0a..." put a real
          CRLF in the log and the rest of the line read as a record of a
          request that never happened.  Bytes a variable expands to are now
          escaped the way nginx escapes them: the quote, the backslash, every
          byte below 0x20, 0x7F and every byte above it all become "\xHH".
          nginx emits no short forms, so a reader that already unescapes an
          nginx log reads this one. The text of the format itself is
          unchanged, so a tab or a quote an operator wrote still reaches the
          log as itself; an "njs" format is the exception, because it
          produces the whole record and all of it is escaped.  A value that
          carries a quote of its own now shows it escaped: an entity-tag
          logged through "$response_header_etag" reads \x22abc\x22 rather
          than "abc", and a non-ASCII path reads "\xD0\xBF..." rather than
          its bytes. A log parser that expected the raw bytes has to be
          updated, though "\xHH" is reversible and the bytes can be recovered
          from it.  The object form of "format" is unaffected by this change,
          but it is not a way to keep bytes either: it replaces anything that
          is not valid UTF-8 with U+FFFD before it serializes.

       *) Change: upgrade contrib njs to 1.0.1.

       *) Bugfix: a port that was closed and freed could leave a pending epoll
          or kqueue change behind it. The change is held by a pointer into the
          port, and is applied when the batch is committed -- at the top of the
          next poll at the latest, which is after the port's memory pool is
          released. The commit then read freed memory, and could also name a
          descriptor number the kernel had already handed to somebody else. A
          port now drops its pending changes before it is freed (#414).

       *) Bugfix: a process could stop hearing from a peer for good. When the
          wake-up that tells a peer to read the shared queue failed because
          the kernel could not allocate for it, the port treated the peer as
          dead: the wake-up was dropped and, since a later message raises one
          only when the queue was empty, no later message on that port raised
          one either. The wake-up is now kept and retried, and the retry no
          longer waits for a socket event that a socket that never filled up
          will not deliver (#392).

       *) Security: a port message that was queued because the peer's socket was
          not writable borrowed the descriptors it carried -- for NEW_PORT,
          another port's socket and queue -- so a port closed before the queue
          drained left the deferred sendmsg() naming a closed number, or an
          unrelated descriptor that had since reused it.  The queued copy now
          owns duplicates and closes them after the send (#388).

       *) Bugfix: the router died on the first request after a configuration
          that had a "compression" block was replaced by one that had none.
          The compression state was held in process globals allocated from the
          router configuration that parsed them, and a later configuration
          neither refilled nor cleared them, so the next request read a freed
          pool.  The state is now held per configuration and reached through
          the request, and the compressor a response is already using is kept
          with that response, so a body still being compressed when the
          configuration is replaced also finishes (#167).

       *) Bugfix: a static response that was subject to content negotiation now
          carries "Vary: Accept-Encoding". Without it a shared cache could store
          whichever representation it saw first and serve it to every client --
          gzip bytes to one that cannot decode them, or the uncompressed copy to
          one that could have had the small version. The header is sent on the
          identity response as well as the compressed one, since the identity
          response is the one a cache must not reuse for a client that accepts
          gzip.

       *) Change: removed the unused job cluster (nxt_job.c, nxt_job.h, and
          nxt_event_conn_job_sendfile.c). The offload path they implemented
          had no caller anywhere in the tree and its thread pool handoff was
          structurally unreachable, since the connection field it read was
          never assigned.

       *) Feature: byte-range requests for static files. A "share" action now
          answers a satisfiable single-range "Range: bytes=..." request with
          "206 Partial Content" and a matching "Content-Range", and an
          unsatisfiable one with "416 Range Not Satisfiable"; "Accept-Ranges:
          bytes" is now sent on a plain 200 as well. The three single-range
          forms are supported -- "A-B", "A-" and the suffix form "-N" -- with
          the end clamped to the last byte of the file; a multi-range request
          is ignored and answered with the full 200, as RFC 9110 permits.
          "If-Range" is honoured against the file's entity-tag (strong
          comparison) or its "Last-Modified" date, falling back to the full
          200 on a mismatch. Preconditions (RFC 9110 Sect. 13.2.2) are still
          evaluated first, so a 304 or 412 outcome wins over any Range. A
          response served from a Range is not content-coded; compression
          still applies to a full 200.
       *) Change: unitctl builds TLS support behind a "tls" Cargo feature, on by
          default.  The musl build turns it off, so the static binary no longer
          links a C TLS library and no longer accepts an "https://" control
          socket address; it refuses one with a message naming the feature.  A
          Unix socket or a plain "http://" address is unaffected, and a build
          with default features behaves as before.
       *) Change: unitctl sends a JSON configuration file as it was written.  It
          parsed the file and re-serialized it before, which kept the last of two
          object members with the same name and re-spelled numbers, so the server
          never saw what the operator wrote.  Unit now reports the duplicate
          itself, with the line and column of the file.  A file that is not
          valid UTF-8 is no longer refused by unitctl; Unit refuses it and names
          the member.  The
          "edit" command no longer accepts JSON5 comments in the temporary file.
       *) Change: unitctl no longer reads JSON5.  A ".json5" file is refused by
          name, with a message saying to convert it first; "json5 -o config.json
          config.json5" does that, and "jq" reformats ordinary JSON.  Nothing
          parsed JSON5 after the configuration upload path stopped parsing its
          input, so this removes a parser that only the refusal path still
          reached, and two crates with it.

       *) Feature: conditional requests for static files. A "share" action now
          answers a GET or HEAD carrying "If-None-Match" or "If-Modified-Since"
          with "304 Not Modified" when the file's validators still match, so a
          client that already holds the file is no longer sent it again. Unit
          emitted "ETag" and "Last-Modified" before, but ignored both when they
          came back. Entity-tag comparison is weak and "*" matches any
          representation; a present "If-None-Match" takes precedence over
          "If-Modified-Since", per RFC 9110. "If-Match" and
          "If-Unmodified-Since" are evaluated first and answer "412 Precondition
          Failed" when they do not hold.

       *) Change: a content-coded response now carries a weak entity-tag, so
          "If-Range" cannot resume a coded representation; "If-None-Match"
          revalidation is unaffected. Unit derives the tag from the file's mtime
          and size, which do not change with the content coding, so a gzip
          response and the identity one previously advertised the same strong
          validator -- 1.36.1 and earlier shipped that. RFC 9110 requires a
          strong validator to change whenever the selected representation
          changes, and nginx weakens the tag for the same reason.

       *) Security: a file descriptor is no longer leaked when a static request
          cannot be satisfied by any acceptable representation. A share with
          compression configured answered "406 Not Acceptable" without closing
          the file it had opened, so a single unauthenticated request carrying
          "Accept-Encoding: identity;q=0, *;q=0" cost the router a descriptor,
          and repeating it exhausted the table, stopping every application
          behind that router. Present since compression was added in 1.35.0:
          1.35.0, 1.35.1, 1.35.2, 1.35.3, 1.35.4, 1.35.5, 1.36.0 and 1.36.1
          are all affected.

       *) Security: a file descriptor sent to a port is no longer leaked when
          the message is dispatched and nothing takes ownership of it. An
          application holds the write end of the router's main port and the
          message header is unauthenticated, so a compromised application could
          attach a descriptor to messages the router does not expect one on --
          or to a fragment that never reaches a handler -- and consume the
          router's descriptor table, stopping every application behind it. A
          fragment stream that is started and never completed still retains its
          descriptor; that needs a bound on pending fragments and is tracked
          in freeunitorg/freeunit#343.

       *) Bugfix: unitctl gave up on a configuration it could not decode as
          UTF-8.  Unit stores the bytes it is given, so a configuration can
          hold bytes no UTF-8 decoder accepts; "unitctl execute" and "unitctl
          export" then failed with "JSON error [path=/config]" and left the
          operator no way to read or back up the configuration.  Both work
          now: the document is shown with the undecodable bytes replaced and
          the members they fall in named, and "export" stores the server's
          bytes verbatim.  "unitctl edit" refuses such a configuration rather
          than writing the replacements back over it.

       *) Bugfix: unitctl reordered the members of a configuration.  "unitctl
          edit" and "unitctl export" passed the document through an unordered
          map, so members came back in an arbitrary order and an edit rewrote
          the whole configuration even where nothing had changed.  The order
          the server sent is now kept.

       *) Change: two source files that the build never used have been
          removed.  src/nxt_job_cache_file.c is named nowhere in auto/, so no
          configuration ever compiled it, and nothing in the tree referenced
          it or its symbols.  src/nxt_source.h was removed because nothing
          includes it: of the 106 headers in src/, it was the only one with
          no #include anywhere in the tree.  Nothing observable changes.

       *) Change: the fiber implementation has been removed. It had not been
          compiled since 2017: the only allocation of the engine's fiber
          stack sat under "#if 0", so the pointer was always NULL and the
          setjmp() branch that tested it could not run. The thread, log and
          sprintf sites were already disabled. Nothing observable changes.

       *) Change: the nxt_dyld wrapper around dlopen()/dlsym()/dlclose() has
          been removed. It shipped in the initial import and was never called:
          the language module loader in src/nxt_application.c calls dlopen()
          and dlsym() itself and never used this wrapper. libnxt.a loses one
          object file; there are no other callers.

       *) Bugfix: do not exit when the capget() syscall is denied. A syscall
          filter that omits capget -- a systemd "SystemCallFilter=" allowlist,
          a hand-written seccomp profile -- made a non-root unitd fail to start
          with "failed to get process capabilities". Unit now warns and runs
          without assuming any capability: user and group switching and
          "rootfs" isolation are disabled for applications that do not enable
          the "credential" namespace, and applications run as unitd's own uid.
          Every other capget() failure remains fatal.

       *) Bugfix: the main process did not answer a START_PROCESS request it
          could not carry out -- an unknown router port, a sender that is not
          the router, or an allocation that failed -- so the start stayed
          pending. The application then parked every later start on a
          prototype that was not coming, and the requests waiting on it were
          never failed.

       *) Bugfix: a message that could not be sent because the receiving process
          had died was reported to the sender as sent. A sender that answers a
          request and then sends a fallback lost both, so an application could
          wait for an answer that nothing would ever deliver.

       *) Bugfix: eight places whose memory nothing else reclaims handed a
          message to a port and did not take it back when the port refused it.
          The port layer accepts a buffer only when it answers success, so on a
          refusal -- which happens when memory runs out, or when the receiving
          process has stopped reading a full shared queue -- the memory was
          lost. Two of them lost shared memory that no cleanup reclaims, so an
          application could lose the capacity to answer at all.

       *) Change: a websocket connection is now closed when a frame cannot be
          handed to the application. Such a frame was previously dropped in
          silence, leaving the peer's stream short a frame it was never told
          about -- which for a fragmented message the client cannot detect.

       *) Bugfix: a port could stop sending after it ran out of memory. When a
          write had to be retried later, the port asked its own thread to watch
          the socket again, and that request needed memory of its own. If it
          failed, nothing watched the socket and every later message waited in
          the queue until the port closed. The port now carries the request it
          needs, so it cannot fail for lack of memory.

       *) Bugfix: the port layer reported a message as sent when it had been
          neither sent nor queued. This happened when a socket answered
          EAGAIN and no memory was left to hold the message for a later
          attempt, so it takes memory pressure to reach. The sender then
          cleared the state that would have retried or reported it, so a
          request could wait for an answer that nothing would ever deliver.

       *) Bugfix: an application worker that died before it finished starting
          was reported to nobody, so the start it was forked for stayed pending
          forever. Once the application reached its "processes" maximum it
          started no further process, and because an application's "timeout"
          defaults to 0 the requests waiting on it hung instead of failing.

       *) Security: application processes no longer inherit unitd's
          capabilities. A unitd started as a non-root user that had been
          granted capabilities -- systemd "AmbientCapabilities=", file
          capabilities -- passed them through fork() to every application it
          ran, because switching between two nonzero uids does not clear them
          and a filtered capget() skips the switch entirely. Each forked
          process now empties its permitted, effective, inheritable and
          ambient sets once its credentials are final, before the worker
          serves any request. The language module's own startup still runs
          before the drop: the mount, pivot_root and chroot work for "rootfs"
          isolation happens after it and needs the capabilities that are being
          given up. Where a syscall filter denies capset() as well, an
          application start is now refused rather than allowed to proceed with
          capabilities still held: the request is answered 503 and the log
          names the denied syscall. A process with an empty permitted,
          effective and ambient set -- which is every process of a root unitd
          once it has switched away from uid 0, and every process of an
          unprivileged one that was granted no capabilities -- keeps behaving
          as before, since there is nothing an application could have
          inherited from it. Its inheritable set is emptied as well, which on
          its own is not counted and grants nothing without an execve() of a
          file carrying a matching capability. The
          main process is unchanged, since it needs CAP_NET_BIND_SERVICE to
          bind listening sockets on every reconfiguration; the router,
          controller and discovery processes warn and carry on rather than
          refuse, because they run no application code. Applications
          configured with "user": "root" are also unchanged, since a root
          process regains capabilities on the next execve() anyway. One
          configuration does lose something it previously kept: an
          application in a "credential" namespace began with a full
          capability set inside that namespace, because the default uid_map
          maps unitd's euid to the application's uid, so the setuid() is not
          a transition out of uid 0 and nothing cleared it. Those
          capabilities were valid only inside the namespace and Unit's own
          use of them is finished before the drop, but an application that
          relied on them now needs "user": "root".

       *) Security: unitctl no longer depends on rustls-pemfile or on hyper's
          "http2" feature. rustls-pemfile is unmaintained; the parser is replaced
          by rustls-pki-types, already in the dependency graph. PEM parsing
          behavior is unchanged: both parsers were run over 1884 PEM documents and
          produced zero differences. This closes RUSTSEC-2025-0134. Dropping the
          "http2" feature from hyper, hyper-rustls and hyper-util removes the h2
          and fnv crates as well, closing RUSTSEC-2026-0258, an unbounded empty
          DATA frame flood in h2 0.4.15. The control API speaks HTTP/1.1 only --
          unitd writes "HTTP/1.1" into every response line -- so HTTP/2 support
          was never usable against the server itself.

       *) Change: unitctl no longer offers HTTP/2 in the TLS handshake it makes to
          a remote control API. This follows from the "http2" feature removal
          above. A TLS-terminating proxy placed in front of a remote control API
          must now speak HTTP/1.1 to unitctl; one that only accepts HTTP/2 can no
          longer be reached.

       *) Change: unitctl no longer reads hjson or YAML, and no longer writes
          YAML.  Input piped to "/config" on stdin is parsed as JSON now, not
          hjson; hjson is a superset of JSON, so piping JSON still works, but
          comments and unquoted keys do not.  A ".hjson" or ".cjson" file is
          refused with "hjson is no longer supported: convert the file to JSON
          first", instead of being handed to the JSON parser, which reports a
          misleading error at the first comment.  A ".yaml" or ".yml" file is
          refused with "YAML is no longer supported: convert the file to JSON
          first, for example with "yq -o=json"".  Supported input formats are
          now json and pem.  "unitctl status -t yaml" is gone;
          --output-format now accepts json, json-pretty and text.  This removes
          the nu-json dependency and the 30 crates of Nushell utility code it
          pulled in for a tool that speaks one JSON control API.  It also
          removes serde_yaml and unsafe-libyaml; the latter is a c2rust
          transpile of libyaml with 218 unsafe functions and no RustSec
          advisory.
          tools/unitc is unaffected: it still converts configuration to and
          from YAML, using yq.

       *) Change: removed src/nxt_queue.c, the unused half of a queue utility
          library carried over from nginx.  It defined nxt_queue_sort() and
          nxt_queue_middle(), both exported but never called anywhere in the
          tree; src/nxt_queue.h and the nxt_queue_* macros it provides are
          unaffected and untouched.

       *) Change: nxt_mem_zone, a second allocator, is removed.  It was a
          zone allocator over a mapped region, distinct from nxt_mp, the
          pool allocator product code actually uses; nothing in the router,
          applications, or any language module called it.  Its only caller
          was its own unit test, run by "./build/tests"; that test is
          removed too, dropping the three "mem zone test passed" lines from
          the suite's output.  Upstream nginx/unit had already reached the
          same conclusion and deleted the file as part of an unrelated
          cleanup.

       *) Change: the entity-tag and last-modified date of a static file are
          now weak while the request falls inside the second the file was
          last written.  Both are derived from the whole-second modification
          time and the size, so a rewrite to the same size during that second
          changes neither, and RFC 9110 Sect. 8.8.1 reserves a strong
          validator for one that cannot miss a change.  "If-Match" and
          "If-Range" stop matching inside that window, so a range request
          conditioned on "If-Range" is answered with the full 200 rather than
          a slice keyed to a validator Unit cannot vouch for; an unconditional
          "Range" is unaffected.  "If-Match: *" is unaffected too, since "*"
          asks whether a representation exists, not whether a validator
          matches.  The tag keeps its format, so nothing already held in a
          cache is invalidated.

       *) Change: removed the GnuTLS, CyaSSL, and PolarSSL backends
          (nxt_gnutls.c, nxt_cyassl.c, nxt_polarssl.c) and their configure
          plumbing ("--gnutls", "--cyassl", "--polarssl").  None of the
          three ever built: they read a "c->u.ssltls" union member that
          does not exist, and reference types such as "nxt_ssltls_conf_t"
          and "nxt_event_conn_io_t" that predate a refactor still visible
          in the current tree, so passing the flag reaches a compiler
          error instead of a clean "unsupported".  CyaSSL was renamed
          wolfSSL and PolarSSL became mbedTLS, both in 2015, so the flags
          also target products that no longer exist under these names.
          The OpenSSL backend is unaffected; none of these files were
          ever part of a default build.

       *) Change: removed the PHP TrueAsync code path. It was written for a
          "zend_async_event_t" API expected in PHP 8.5 core, which did not ship
          it, so the configure probe never succeeded and the code sat behind
          "#if NXT_PHP_TRUEASYNC" in every build. It could not have compiled had
          the probe succeeded: it reads "async" and "entrypoint" members that
          "nxt_php_app_conf_t" does not have and calls "nxt_php_extension_init()",
          which no file in the tree defines. The probe, the "entrypoint" target
          key and the TrueAsync test suite are removed with it; a PHP application
          builds and behaves as before.

       *) Bugfix: the java module split every outgoing WebSocket text message
          larger than 8 KiB into 8 KiB frames, whatever "max_frame_size" was set
          to. A 64 KiB message arrived as eight frames and a 16 MiB one as about
          two thousand, each carrying its own frame header and costing its own
          message to the router, while every other language module sends a
          complete message as a single frame. A complete text message, from
          getBasicRemote() or getAsyncRemote(), is now encoded into a buffer of
          its own and sent as one frame; a message above
          "nginx.unit.websocket.MAX_SEND_BUFFER_SIZE", 16 MiB by default, still
          fragments. A Writer from getSendWriter() still sends each chunk it
          flushes as a frame of its own, but that chunk is now one frame instead
          of up to four. An OutputStream from getSendStream() still sends each
          8 KiB it fills as a frame of its own. This does not make the module
          honour "max_frame_size", which remains an inbound limit only.

       *) Bugfix: the java module sent nothing through the asynchronous
          WebSocket remote. Every send from getAsyncRemote() -- sendText(),
          sendBinary() and sendObject(), with a SendHandler or through the
          Future they return -- ended in a doWrite() that had no body, so no
          frame left, the handler was never called and Future.get() blocked
          for good; getBasicRemote() sends through another path and was not
          affected. Such a send now goes out as one from the blocking remote
          does, and its handler or future completes on the sending thread with
          the outcome, which is a failure once the session is closed (#434).
          Batching works as well: flushBatch() and setBatchingAllowed(false)
          threw instead of sending what was batched, and a batched frame from a
          buffer whose position was not 0 had a header that overstated its
          length and corrupted the frames after it.

       *) Bugfix: the java module sent the wrong bytes, or nothing, for a
          WebSocket message from a heap ByteBuffer that does not start at its
          array's first byte. The payload was read from the backing array at
          position(), ignoring arrayOffset(), so a buffer from
          ByteBuffer.wrap(a, off, n).slice() sent bytes from the start of the
          array instead of its own; and a read-only heap buffer threw
          ReadOnlyBufferException instead of being sent. Both the blocking and
          the asynchronous remote were affected (#486).

       *) Bugfix: the Python ASGI module refused a WebSocket message larger
          than 1 MB whatever "max_frame_size" was set to. The module carried a
          private 1 MB limit that no configuration ever wrote and charged the
          fragments of a message against it, while the configured value is
          checked by the router per frame: a 4 MB message was closed with 1009
          where "max_frame_size" was 32 MB, and at the default size a client
          that split a larger message into small frames was refused as well.
          Each frame is now limited by "max_frame_size" alone. The module
          only limits a connection to 10 MB of payload that the application
          has not received yet (fragments of a message in progress and
          complete messages waiting for receive()); a single frame larger
          than that is still accepted when nothing else is waiting. A
          fragmented message also left a count behind that lowered the limit
          applied to the next message.

       *) Bugfix: a byte-range request from a client that refused the identity
          coding is no longer answered with identity bytes.  A range is served
          as identity, so "Range" together with "Accept-Encoding:
          identity;q=0" returned a "206 Partial Content" carrying exactly the
          bytes the client said it would not take.  The range is now ignored
          and the full "200 OK" is sent in a coding the client does accept.
          Ignoring the range is all or nothing, so an unsatisfiable range from
          such a client is no longer answered with "416" either.  A request
          that accepts no coding at all is still "406 Not Acceptable", and a
          range from a client that does accept identity is still a 206.
          Several "Accept-Encoding" lines in one request are now read as the
          single comma-joined value RFC 9110 defines them to be; previously
          only the first was consulted.

       *) Bugfix: a response that no compressor applies to is no longer sent
          as identity to a client that refused the identity coding.  With a
          compressor configured, "Accept-Encoding: gzip, identity;q=0" was
          accepted because gzip was acceptable.  When the media type of the
          response was outside "types", or the response had no media type,
          the response was then sent uncompressed: the identity bytes that
          the request had refused.  Such a request now gets "406 Not
          Acceptable", with a "Range" header and without one.  A 406 from
          this negotiation carries "Vary: Accept-Encoding".  A 1xx, 204 or
          304 response is never negotiated, so an application that sends one
          of these with a "Content-Length" is not affected.  A response with
          no body, and a response that carries its own "Content-Encoding",
          are not affected either.

       *) Bugfix: "*" in "Accept-Encoding" now stands for each enabled
          compressor that the client did not name.  Before, it stood for the
          identity coding only.  "identity;q=0, *;q=1" was answered "406 Not
          Acceptable" with gzip enabled and applicable, because the wildcard
          could select only identity, and the same field refused identity.  A
          coding that the field names keeps its own weight.  The wildcard does
          not match it, and the named coding wins a tie: "gzip, *" now sends
          gzip.  Before, it sent the response uncompressed.

       *) Bugfix: a compressor below its own "min_length" is no longer selected
          before a compressor with a lower weight that can be applied.
          "min_length" belongs to each compressor.  With gzip at 1000 and
          deflate at 0, a 100-byte response was sent uncompressed, because
          gzip had the higher weight.  A client that refused the identity
          coding got the same uncompressed bytes.  Such a client now gets
          deflate.  When each compressor that the client accepts is below its
          "min_length", the client gets "406 Not Acceptable" instead of the
          bytes it refused.

       *) Change: a server with no compression configured now answers "406 Not
          Acceptable" to a request whose "Accept-Encoding" refuses the identity
          coding: "identity;q=0", or "*;q=0" with no more specific entry for
          identity.  Identity is the only coding that such a server has.
          Before, it sent the response, or the requested range of it, in the
          bytes that the client had refused.  To read that refusal, each
          response with a known length above zero now looks at its own
          "Content-Encoding" and at the request "Accept-Encoding".  Before,
          these checks ran only with a compressor configured.

       *) Bugfix: a malformed weight in "Accept-Encoding" is no longer read as a
          refusal.  The qvalue was converted with strtod(), which takes no digits
          at all from "identity;q=" and from "identity;q=abc" and reports zero,
          so either one answered "406 Not Acceptable" to a client that had
          refused nothing; "q=0x0" and "q=0e0" did the same.  An element whose
          weight does not match the grammar of RFC 9110 Sect. 12.4.2 is now
          ignored, as an element naming an unknown coding already was.  This
          also removes "q=nan", which passed the 0-to-1 range check -- a NaN
          compares false against both bounds -- and then outranked every real
          weight.

       *) Bugfix: a negotiation failure on "Accept-Encoding" was answered with
          "503 Service Unavailable" instead of "406 Not Acceptable" when the
          response came from an application.  The router treated every result of
          the acceptability check other than success as a server error; only the
          static path reported the 406.

       [PENDING https://github.com/freeunitorg/freeunit/pull/561. Keep the
       entry below only if that PR merges before the 1.37.0 tag. Then
       delete these three lines. If it misses the tag, delete the entry.]
       *) Bugfix: a "Content-Encoding" set with "response_headers" no longer
          makes the body coded twice.  With a compressor configured, the
          response was compressed first, and "response_headers" then replaced
          the "Content-Encoding" of the compressor.  So a share of "$uri.gz"
          with "Content-Encoding: gzip" sent gzip of the stored gzip file to a
          client that accepts gzip, with a weak ETag.  Now such a response is
          not compressed, as with a "Content-Encoding" from an application.
          This applies to static files and to application responses.  A
          "Content-Encoding" removed with null in "response_headers" also keeps
          the compressor out, so compressed bytes are no longer sent without a
          "Content-Encoding".  Such a response is identity, so a client that
          refused identity gets "406 Not Acceptable".

       *) Change: unitd, libunit.a and the language modules no longer contain
          the test hooks compiled under "#if (NXT_TESTS)".  "./configure
          --tests" used to define the macro for the whole build, and the deb
          and rpm packages pass "--tests", so every released package from 0.2
          to 1.36.1 carried them: the nxt_random_test() entry point in all of
          them, and in 1.36.0 and 1.36.1 the fault-injection branches and
          counters in nxt_mp.c, nxt_port_rpc.c and nxt_port_socket.c, two of
          which were exported symbols.  The hooks now go only into the test
          programs.  A build without "--tests" is unchanged.

       *) Change: update wasmtime to 48.0.5. The WebAssembly module moves from
          43.0.1, and the WebAssembly component module from 47.0.2. Version 48
          is a long-term support release of wasmtime. It fixes twelve wasmtime
          security advisories published on 24 September and 2 October 2026.
          Each one needs a hostile WebAssembly guest. With the features that
          FreeUnit builds, such a guest could panic the host, exhaust host
          memory, read uninitialized host memory, or corrupt the GC heap.
          Building the two modules now needs Rust 1.95.0 or newer.

       *) Bugfix: the PHP module checked that "script" is under "root" by
          comparing the first bytes of the two real paths. With "root":
          "/srv/app", a script in "/srv/app2" passed the check and was served.
          The script must now be in "root" or in a directory below it. A
          "script" that resolves to "root" itself is also rejected; it was
          served as an empty 200 response. The bug had appeared in 0.4.
