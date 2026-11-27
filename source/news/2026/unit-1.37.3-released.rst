.. meta::
   :og:description: FreeUnit 1.37.3 fixes security issues in the Java
                    module, in the router and in route rules with rewrite
                    and pass, uses variable values in rewrite and pass as
                    data, and adds Docker images for PHP 8.6.

:orphan:

.. _release-1-37-3:

########################
FreeUnit 1.37.3 Released
########################

FreeUnit 1.37.3 was released on **27 November 2026**. It is a security
release. Every user should upgrade.

The release fixes three groups of security issues, each with its own
advisory: the request path of the Java module, the WebSocket, timer and proxy
buffers of the router, and route rules that a ``rewrite`` or a ``pass`` with
variables could bypass. Users of a Java application are affected with no
special setting. The release also updates Wasmtime to 48.0.10, rustix to
1.1.6 and url to 2.5.9.

Unit now uses the value of a variable in ``rewrite`` and ``pass`` as data.
This can change the result of a working configuration. Read
:ref:`release-1-37-3-variables` before you upgrade.

There are Docker images for PHP 8.6, and Unit is packaged for Homebrew again.

.. _release-1-37-3-security:

Security Fixes
==============

.. _release-1-37-3-java:

Java Module Request Path
------------------------

These two issues affect Java applications with no special setting in Unit.
An instance with no Java application is not affected.

- **Servlet mapping.** The Java module took the path for the servlet mapping
  from the request URI as the client sent it. The module decoded the path,
  but it did not remove the ``.`` and ``..`` segments and did not merge
  repeated slashes. The servlet and filter mappings, the welcome files, the
  default servlet and the JSP servlet all used this path. A client was able
  to get the files of ``WEB-INF`` and ``META-INF``, and to read the files of
  the directory above the application directory. With a context path, the
  client was able to climb one more level for each segment of the context
  path. A client was also able to get the static file in place of a mapped
  servlet, and a filter with a prefix pattern did not run for such a
  request. A JSP file or a servlet below ``WEB-INF`` or ``META-INF`` ran on a
  direct request from a client.

  Now the module decodes the path once. It removes the ``.`` and ``..``
  segments and merges repeated slashes before the mapping. An encoded slash
  (``%2F``) separates segments as a ``/`` does. The module answers ``400``
  when the path climbs above the root, holds a NUL character, or is a target
  that ``java.net.URI`` refuses. Before, such a target got ``500`` with a
  stack trace. The module answers ``404`` when the first segment of the path
  is ``WEB-INF`` or ``META-INF``, in any letter case and for each servlet.
  This ``404`` uses the error page of the application. A forward or an
  include to these directories works as before.

  A relative path given to ``getRequestDispatcher()`` of the request now
  resolves against the path that the module mapped. ``getServletPath()`` and
  ``getPathInfo()`` now come from the resolved path. ``getRequestURI()``
  still returns the request URI as the client sent it.
- **A slash after a file name.** The default servlet opened the servlet path
  with ``java.io.File``, which drops a trailing ``/``. The servlet mapping
  compares the path with the slash. So a request for a file name followed by
  ``/`` matched no exact mapping, no suffix mapping and no filter with a
  suffix or an exact pattern, and the default servlet served the file. A
  client was able to get the source of a JSP file instead of its output, or
  the static file behind a path that has an exact servlet mapping. Now the
  default servlet answers ``404`` when the path ends with ``/`` and the file
  is not a directory. A directory with a trailing ``/`` is served as before.

Advisory: `GHSA-h635-72hj-3wfw <https://github.com/freeunitorg/freeunit/security/advisories/GHSA-h635-72hj-3wfw>`__.

.. _release-1-37-3-router:

WebSocket, Timer and Proxy Buffers in the Router
------------------------------------------------

The first two issues affect any application that accepts WebSocket
connections.

- **Unsent WebSocket messages.** The router process could crash when a
  WebSocket connection ended while messages of the application were still
  unsent, or when the send timeout ended a WebSocket request, also on a TLS
  listener. The router could also read memory that it had freed. The router
  did not release the memory of the unsent messages: shared memory of the
  application, and memory of the router for small messages. After enough
  such connections the application stopped answering. Now the router
  releases these messages when the request closes, and reads nothing more on
  a WebSocket connection that is closing.
- **Request header buffers of a WebSocket request.** At the upgrade of a
  WebSocket connection, the router released the buffers that hold the
  request header, but the request still read them until the connection
  closed. So the access log record of a WebSocket request could hold bytes
  of another request, and the router could read freed memory to write it.
  On a system with the musl C library, such as Alpine Linux, the router
  process ended. In some cases the router also lost a buffer of 2048 bytes
  for each connection and logged the alert ``freed pointer is out of pool``,
  or read a frame header from a wrong offset. Now the header buffers stay
  until the WebSocket connection closes. With the default settings, this is
  at most 2048 + 4 * 8192 = 34816 bytes for each open WebSocket connection.

  For this issue only, turning off the access log on an earlier version
  stopped the crash and the wrong record in tests. It does not stop the loss
  of the buffers.
- **WebSocket frame buffer on TLS.** The router process could crash on a TLS
  listener when the buffer for the rest of a WebSocket frame could not be
  allocated. This was possible with a ``max_frame_size`` of about 4 GiB or
  more. Now the router closes the WebSocket with status ``1011``.
- **Timers.** The timer code could run the handler of a timer that had
  expired and was armed again before its handler ran, while the timer was
  back in the timer tree. Under heavy load the router could then end a
  request that the application was still answering, and the client got a
  wrong ``503`` response. The router could also free a request whose timer
  was still linked, and use the freed memory. The handler now runs only for
  a timer that is out of the tree.
- **Proxy response header after a 1xx response.** The proxy could release
  the buffer of an upstream response header while it still parsed that
  header after an interim (1xx) response, and then read freed memory. Now
  the buffer stays until the header is complete. A final header that does not
  fit in the buffer still gets ``502``.

Advisory: `GHSA-hm9m-3c5h-jqp7 <https://github.com/freeunitorg/freeunit/security/advisories/GHSA-hm9m-3c5h-jqp7>`__.

.. _release-1-37-3-routes:

Route Rules with rewrite and pass
---------------------------------

- **Decoded variable values.** The router decoded the value of a variable in
  a ``rewrite`` or a ``pass`` template after it inserted the value. ``$uri``
  and ``$arg_*`` were decoded a second time, and ``$host`` was decoded at
  all. So the action could use another path, or another application, target,
  route or upstream, than the one that the route rules matched. After a
  ``rewrite``, a ``proxy`` action also sent a ``?`` or ``#`` that the new path
  held as data unencoded, so the upstream got another path and query than
  the router matched. The result of an njs ``rewrite`` or ``pass`` template
  was decoded in the same way. Now the router keeps the value of a variable
  as data, and a ``proxy`` upstream gets these bytes as ``%3F`` and ``%23``.
  These issues are related to the CR, LF and space in the rewritten proxy
  target that 1.37.2 fixed. See :ref:`release-1-37-3-variables` for what
  this changes in a configuration.
- **A rewrite result without a leading slash.** A ``rewrite`` result that did
  not start with ``/`` kept a leading ``..`` segment. So a ``share`` that
  joins a directory and ``$uri`` could serve a file outside that directory,
  and a later route rule on ``uri`` could fail to match. This needed a
  ``rewrite`` whose result can start with a value from the client, such as
  an argument or a header. Now a ``rewrite`` result that is empty or does not
  start with ``/`` gives status ``500``.
- **A fragment in the request target.** The request target kept a raw ``#``
  and the text after it, while the route rules matched only the path before
  the ``#``. A ``proxy`` upstream, an application and ``$request_uri`` got
  that fragment, so an upstream or an application could use another path
  than the one that the route rules matched. Unit no longer sends the
  fragment to a ``proxy`` upstream or to an application, and
  ``$request_uri`` does not hold it.
- **An empty host part in Host.** The router accepted a ``Host`` header field
  with an empty host part, and the value of ``$host`` was empty for such a
  request. The router also found the trailing dot of the host part by the
  last dot of the whole value. A dot in the port hid the trailing dot of the
  host part, and a host part of one dot stayed ``.``. A ``host`` route rule
  for the name without the dot did not match such a value. A ``share`` or a
  ``chroot`` template with ``$host`` as a whole path segment named the base
  directory. The router served the files below that directory, also the
  files of a host that a ``host`` route rule refused. Now the router looks at
  the last byte of the host part for the trailing dot. It answers ``400``
  when the host part is empty after the cut. A request without a ``Host``
  field is not changed; see :ref:`release-1-37-3-not-changed`.
- **Unencoded bytes in the request target.** A request target that contains
  an unencoded space, a control character such as HTAB, or DEL now gets a
  ``400`` response. Before, the unencoded space, DEL and the control
  characters other than NUL, CR and LF were accepted as part of the target.
  The control API uses the same parser and closes the connection on such a
  request. Percent-encoded spaces and control characters in paths and
  arguments remain supported.

Advisory: `GHSA-p2mm-qm5c-m9w7 <https://github.com/freeunitorg/freeunit/security/advisories/GHSA-p2mm-qm5c-m9w7>`__.
Thanks to GitHub user `6RUN0 <https://github.com/6RUN0>`__, who reported
this issue.

.. _release-1-37-3-security-other:

Other Security Fixes
--------------------

- The router formatted the ``Last-Modified`` header field of a static file
  with no range check of the modification time. A time outside the years
  1000 to 9999 gave a malformed date, and a time far outside this range could
  crash the router. Now Unit serves such a file without ``Last-Modified``. A
  date in ``If-Modified-Since`` or ``If-Range`` does not match such a file,
  and Unit ignores ``If-Unmodified-Since`` for it. Its ``ETag`` is still
  sent.
- The router, the discovery process, the prototype processes and the
  application processes of embedded language modules kept the listen socket
  of the control API open. Now only the main process and the controller keep
  it.
- Wasmtime, wasmtime-wasi and wasmtime-wasi-http move from 48.0.8 to
  48.0.10. 48.0.9 fixes RUSTSEC-2026-0566 through RUSTSEC-2026-0573. 48.0.10
  fixes RUSTSEC-2026-0587 (GHSA-f2pq-268w-886c), a WASI filesystem sandbox
  escape that affects Windows hosts only. Cranelift moves to 0.135.10 with
  Wasmtime, and the contrib C API pin is 48.0.10 too.
- rustix moves to 1.1.6 for RUSTSEC-2026-0486 in unitctl and in the
  WebAssembly component module. unitctl reaches the affected functions
  through the xattr crate.
- url moves to 2.5.9 for RUSTSEC-2026-0592 in the OpenTelemetry module, in
  unitctl and in the WebAssembly component module. No FreeUnit component
  calls the affected functions; the update clears the cargo audit.

The source lock of the vendored Wasmtime 48.0.10 C API keeps rustix 1.1.4
and url 2.5.7. Each of these exact versions has a documented audit exception;
the C API does not reach the affected functions.

.. _release-1-37-3-variables:

Variable Values in rewrite and pass
===================================

Unit now uses the value of a variable other than ``$request_uri`` in a
:ref:`rewrite <configuration-rewrite>` or a ``pass`` template as data. This
can change the result of a working configuration. These parts are not
changed: the literal text of a template, ``$request_uri``, the resolving of
``.`` and ``..`` segments, and the query string.

In a ``rewrite``:

- A ``%XX`` in a value is not decoded.
- A ``?`` or ``#`` in a value no longer ends the path or drops the rest of
  the template.
- A ``%`` that two hex digits do not follow no longer gives status ``500``.
- A NUL byte in a value now gives status ``500``.
- A ``rewrite`` that takes an encoded URI from a header, a cookie or an
  argument, such as ``$header_x_original_uri``, now gets that text as it is,
  not decoded.
- A result that is empty or does not start with ``/`` gives status ``500``.
- After a ``rewrite``, a ``proxy`` upstream gets a ``?`` or ``#`` of the new
  path as ``%3F`` or ``%23``. So a ``rewrite`` can no longer give the upstream
  a query of its own: the upstream gets the query of the request.

In a ``pass``:

- A ``%XX`` in a value is not decoded. A request whose value held an encoded
  name now gets status ``404``.
- A value that is percent-encoded on purpose, such as a cookie written with
  ``encodeURIComponent()``, is no longer decoded.
- A value can no longer select a name that holds a slash. Before, ``%2F`` in
  the value did that. The literal text is decoded as before, so
  ``routes/a%2Fb`` still names the route ``a/b``.

In an njs template:

- An njs ``rewrite`` or ``pass`` result is now used as data too. A ``%XX`` in
  it is not decoded, and a ``?`` or ``#`` in it no longer ends the path.
- A NUL byte in a ``rewrite`` result gives status ``500``.
- An njs ``pass`` can no longer select a name that holds a slash.
- To keep the old meaning, call ``decodeURIComponent()`` on text that is
  encoded on purpose.

Check these points in your configuration before you upgrade:

- Find each ``rewrite`` and ``pass`` that holds a variable other than
  ``$request_uri``, or an njs template.
- For each of them, check whether a value can hold a ``%XX``, a ``?`` or a
  ``#`` that the configuration expects Unit to decode or to treat as the end
  of the path.
- Start each ``rewrite`` template with a literal ``/``. Then its result
  always starts with ``/``.
- If a ``rewrite`` before a ``proxy`` action puts a query into the new path,
  the upstream now gets that ``?`` as ``%3F`` in the path, and it gets the
  query of the request.
- If a ``pass`` value selects a name that holds a slash, rename that entity
  so that its name has no slash.
- After the upgrade, look for status ``500`` responses and for the error log
  message ``"rewrite" result "..." does not start with "/"``.

.. _release-1-37-3-not-changed:

Not Changed in This Release
===========================

- **A request without a Host header field.** Such a request still has an
  empty ``$host``. A ``share`` or a ``chroot`` template with ``$host`` as a
  whole path segment, such as ``/www/$host$uri``, then names the base
  directory. Put a route step that refuses an empty host before such a
  template:

  .. code-block:: json

     {
         "match": {
             "host": ""
         },

         "action": {
             "return": 400
         }
     }

- **Path parameters in the Java module.** The module still does not remove
  path parameters (the text after ``;`` in a segment) before the servlet
  mapping. So a mapping or a filter with a prefix pattern does not match a
  path whose segment holds a path parameter. If your application has its own
  servlet on ``/`` or ``/*`` that removes path parameters, do not rely on a
  filter with a prefix pattern as the only access control for that servlet.
- **Dot segments in a rewrite value.** Unit still resolves the ``.`` and
  ``..`` segments in the result of a ``rewrite``, also when they come from
  the value of a variable. A value that follows a fixed prefix can leave
  that prefix.

.. _release-1-37-3-fixes:

Other Fixes
===========

- When the read of a response header from a proxied upstream ended without a
  complete header, for example after the timeout, the router did not free
  the header buffer and the memory of the request. Now the router frees them
  when it frees the upstream connection.
- With ``chunked_transform`` enabled, the router kept a buffer for each
  distinct number of bytes that followed a chunked request body on a
  connection. The router did not release the memory until it restarted. Now
  the buffer is released when the next request on the connection ends, or
  when the connection closes.
- On a listener with a fixed address, such as ``127.0.0.1:8080``, the next
  request on a keep-alive connection after a configuration update read the
  address of the listener from freed memory of the old configuration. So
  ``SERVER_ADDR``, ``SERVER_PORT`` and the ``destination`` route option could
  get a wrong value. During a configuration update under load, the router
  process could end. Now each request takes the address from its own
  configuration.
- A NUL byte after ``?`` or ``#`` in the ``location`` of a ``return`` action
  was sent raw in the ``Location`` header field, and the encoder read past
  the end of a constant string. Now the byte is sent as ``%00``.
- A ``Content-Length`` header field of a ``proxy`` upstream response that did
  not parse was sent to the client as it was, without other framing of the
  body. Unit no longer sends the field: the response is chunked for an
  HTTP/1.1 client and ends with the close of the connection for an HTTP/1.0
  client.
- The ``headers`` object of an njs template found a request header field
  only when the template wrote its name in the same letter case as the
  client. Otherwise the value was undefined. Now the name matches in any
  letter case, as for the ``$header_*`` variables.
- The prototype process of an application with ``rootfs`` isolation could
  crash when the mount table had 256 or more entries, and the application did
  not start.

.. _release-1-37-3-php:

PHP
===

- **Docker images for PHP 8.6.** ``php-8.6`` has the non-thread-safe build
  (NTS), like the images of PHP 8.3 to 8.5. ``php-8.6-zts`` has the
  thread-safe build (ZTS). The official ``cli`` image of PHP 8.6 is ZTS, and
  the official ``nts`` image has no embed SAPI, which the PHP module needs. So
  the NTS base is built from the official ``cli`` recipe without the ZTS
  options and published as ``ghcr.io/freeunitorg/php-nts``. Like the official
  PHP 8.6 images, both images have no ``pecl`` command and no ``mbstring``
  extension. The image check and the tests fail when an image or a test leg
  has the other build. See
  :ref:`installation-docker` for the list of image variants.
- With a thread-safe (ZTS) PHP, the working directory of a script followed a
  replaced symlink only after ``realpath_cache_ttl`` seconds, 120 by default.
  So a deploy that renamed a new symlink over the old one kept the requests
  in the old directory. The directory is now resolved on every request, as
  with a non-thread-safe PHP.
- A PHP worker did not run the per-child start of PHP after it forked from
  the prototype process, which PHP 8.5 and later need. So every worker of an
  application shared one Zend memory-manager heap key: a deterministic
  sequence across the workers, which weakened the heap-overflow check of
  PHP. A PHP built with debugging stopped each worker with an assertion at
  the end of its first request. The worker now runs this start step, as the
  PHP FPM, CGI and Apache processes do.

.. _release-1-37-3-homebrew:

Homebrew
========

Unit is packaged for Homebrew again. The official tap
`freeunitorg/homebrew-unit <https://github.com/freeunitorg/homebrew-unit>`__
builds unitd with njs, ships the released unitctl binaries, and carries the
language module formulas and the php-embed formulas. The tap follows the
FreeUnit releases. See :ref:`installation-macos`.

.. _release-1-37-3-upgrade:

Upgrade Notes
=============

Some behavior changes are visible to clients and operators:

- The value of a variable in ``rewrite`` and ``pass`` is used as data. Check
  your configuration as :ref:`release-1-37-3-variables` describes.
- A request target with an unencoded space, a control character or DEL now
  gets ``400``. A ``Host`` field with an empty host part gets ``400``.
- A proxy upstream and an application no longer get the ``#`` fragment of
  the request target, and ``$request_uri`` does not hold it.
- A Java application answers ``400`` for a path that climbs above the root,
  holds a NUL character or is refused by ``java.net.URI``. It answers ``404``
  for a path whose first segment is ``WEB-INF`` or ``META-INF``, and for a
  path that ends with ``/`` after the name of a file. ``getServletPath()``, ``getPathInfo()`` and a
  relative path in ``getRequestDispatcher()`` follow the resolved path.
- Each open WebSocket connection keeps its request header buffers until it
  closes: at most 34816 bytes with the default settings.
- A static file with a modification time outside the years 1000 to 9999 is
  served without ``Last-Modified``.
- A ``proxy`` upstream response with a ``Content-Length`` that does not parse
  reaches the client without that field.

Review the changelog for the complete list of changes and for the exact
wording of each entry.

Release Details and Contributors
================================

- `Published release notes and contributor acknowledgments
  <https://github.com/freeunitorg/freeunit/releases/tag/1.37.3>`_.
- `Complete 1.37.3 changelog
  <https://github.com/freeunitorg/freeunit/blob/1.37.3/CHANGES>`_.
- `unitctl changelog
  <https://github.com/freeunitorg/freeunit/blob/1.37.3/tools/unitctl/CHANGELOG.md>`_.
- `Changes since 1.37.2
  <https://github.com/freeunitorg/freeunit/compare/1.37.2...1.37.3>`_.
