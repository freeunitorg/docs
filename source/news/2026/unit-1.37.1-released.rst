.. meta::
   :og:description: FreeUnit 1.37.1 adds optional PCRE2 JIT and USDT tracing,
                    fixes HTTP, compression and application queues, and
                    hardens PHP image builds.

:orphan:

.. _release-1-37-1:

########################
FreeUnit 1.37.1 Released
########################

FreeUnit 1.37.1 was released on **30 October 2026**. It adds optional PCRE2
just-in-time compilation and USDT tracing probes. It fixes HTTP/1.1 parsing,
response compression, WebSocket ordering and application queue failures,
updates Wasmtime to 48.0.7, and hardens the PHP image build and release checks.

Both new build options are **off by default**. Their availability in a binary
or image depends on how it was built; upgrading alone does not enable them.

.. _release-1-37-1-regex-jit:

Optional PCRE2 JIT for Configuration Regexes
============================================

``./configure --regex-jit`` enables attempts to compile configuration regular
expressions to native code with PCRE2. This is regex JIT, not PHP's OPcache
JIT. It requires regex support and the PCRE2 backend; PCRE 1 is unchanged.

Compilation takes place while loading the configuration. A library or pattern
without usable JIT falls back to interpreted matching. JIT stack exhaustion
retries the match once in the interpreter, preserving the remaining
whole-search callout budget; match-limit failures are not retried.

JIT has different resource-limit behavior from the interpreter and is not a
ReDoS fix. It does not promise a throughput improvement for every workload.
Measure representative routes before enabling it in production. See the
`PCRE2 JIT implementation and limitations
<https://github.com/freeunitorg/freeunit/blob/1.37.1/docs/pcre2-jit.md>`_.

.. _release-1-37-1-usdt:

Optional USDT Probes for Requests, Queues and Processes
=======================================================

``./configure --usdt`` adds User Statically Defined Tracing (USDT) probes under
the ``freeunit`` provider for use with bpftrace, perf and SystemTap. The build
requires ``sys/sdt.h``, commonly supplied by ``systemtap-sdt-dev`` or
``systemtap-sdt-devel``. Tracing permissions and tool support depend on the
host platform.

The probes cover request start/completion, port messages, application queue
activity and process creation. Without the option, they are omitted. In an
enabled build, probe instructions are no-ops until a tracer attaches, while
probe arguments are still evaluated. Tracing itself can add overhead.

The ``tools/usdt/`` scripts summarize request status and queue residency.
The queue-dequeue probe lives in libunit, so queue tracing also needs the
appropriate language module or external application binary. See the
`USDT probe reference and scripts
<https://github.com/freeunitorg/freeunit/blob/1.37.1/docs/usdt.md>`_.

Other Release Highlights
========================

- HTTP and compression fixes cover pipelined and chunked request bodies,
  duplicate headers, corrupt compressed responses and zstd streaming output.
- Application queue notifications, request-slot wraparound and shared-memory
  buffer handling are corrected. WebSocket frames retain their order while
  waiting for shared memory; full application queues apply backpressure.
- The control API waits for the state-store result before answering a
  configuration PUT or a certificate/njs-module DELETE. A failed configuration
  store returns 500 even though the new configuration continues running;
  restarting loads the previously stored configuration.
- The router and controller can raise their soft file-descriptor limit toward
  the inherited hard limit. Application processes retain their launch limit.
  See :doc:`../../howto/tuning` for diagnosis and limit-setting guidance.
- Wasmtime and its contrib C API pin move to 48.0.7. unitctl's webpki dependencies
  are updated. The tagged changelog records remaining dependency audit exceptions.
- Lost access-log records are counted in ``/status/access_log/lost`` when an
  access log is configured. The next successful record reports the loss.
- Changes cover reproducible builds, 32-bit layouts, macOS shared-memory page
  rounding, PHP script handling and other language-module bugs.

PHP Image Hardening and Upgrade Notes
=====================================

The 1.37.1 PHP image build writes ``session.upload_progress.enabled = 0`` to an
ini fragment. Release checks verify the PHP version, upload-progress setting,
Brotli package version and FreeUnit version. These checks are additional
hardening; they do not establish that every PHP deployment is immune to
PHP-runtime vulnerabilities. Use patched PHP or verified distribution backports
and verify the settings of the actual application workers.

Image publication is separate from the source release. Check that the final
image tag or digest you deploy contains the expected versions and settings;
do not assume a floating tag was updated merely because 1.37.1 was tagged.
See the `PHP image checks
<https://github.com/freeunitorg/freeunit/blob/1.37.1/pkg/community/PHP.CVE.md>`_.

Rebuild Go and Node.js applications against the new libunit to receive the
applicable IPC and queue fixes. ``--zstd`` now requires zstd 1.4.0 or later,
and configure requires working ``__thread`` support. The Node.js 20 Docker
image is retired. Programs outside FreeUnit that use the component-model C API
from the packaged ``libwasmtime.so`` need review: that unused API is removed
from the core wasm runtime build; the separate wasm-wasi-component module is
unaffected.

Review the tagged changelog for configuration-validation changes, remaining
request-timeout limitations and platform-specific upgrade details.

Release Details and Contributors
================================

- `Published release notes and contributor acknowledgments
  <https://github.com/freeunitorg/freeunit/releases/tag/1.37.1>`_.
- `Complete 1.37.1 changelog
  <https://github.com/freeunitorg/freeunit/blob/1.37.1/CHANGES>`_.
- `Changes since 1.37.0
  <https://github.com/freeunitorg/freeunit/compare/1.37.0...1.37.1>`_.
