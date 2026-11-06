.. meta::
   :og:description: Current WebAssembly support in FreeUnit: application
                    types, JIT compilation, configuration, Wasmtime pins,
                    and known limitations.

.. include:: include/replace.rst

############
WebAssembly
############

FreeUnit runs WebAssembly through
`Wasmtime <https://wasmtime.dev/>`_.
This page describes the **current** behavior:
what ships today, not planned features.
For the full option tables and examples, see
:ref:`configuration-wasm`.

Two application types are available:


.. list-table::
   :header-rows: 1
   :widths: 28 36 36

   * - Type
     - Runtime
     - When to choose it
   * - **wasm**
     - Wasmtime **C API**
       (``wasm.unit.so``)
     - Classic binary ``.wasm`` modules with
       explicit host handlers
       (request / malloc / free and optional
       init / end hooks).
       Deprecated; keep it only for existing
       ``unit-wasm`` SDK modules or other modules
       that export those symbols.
   * - **wasm-wasi-component**
     - Wasmtime **Rust** crate
       (``wasm_wasi_component.unit.so``)
     - WASI 0.2
       `components <https://component-model.bytecodealliance.org/>`_
       that implement the
       ``wasi:http/proxy`` world.
       Preferred for new work;
       available since Unit 1.32.


The **wasm** application type, the older **unit-wasm** module, is
deprecated since Unit 1.32.0. It still works, but new applications should
use **wasm-wasi-component**.


**********************
How compilation works
**********************

Both modules compile guest code with Wasmtime's
**Cranelift** backend.
There is no ahead-of-time (AOT) path in FreeUnit today.
The **wasm** module compiles once per application,
when its prototype process starts.
Application processes are forked from that
prototype and inherit the compiled module,
so a new wasm worker does not compile again.
The **wasm-wasi-component** module compiles
in each application process.

**wasm** (C API)
  ``nxt_wasmtime_init()`` creates a default engine
  (``wasm_engine_new()``),
  reads the module file as raw bytes,
  and calls ``wasmtime_module_new()``.
  That API accepts **binary Wasm only**
  (not text ``.wat``).
  FreeUnit does not call
  ``wasmtime_module_deserialize()``
  and does not load precompiled ``.cwasm`` artifacts.

**wasm-wasi-component** (Rust)
  ``GlobalState::new()`` builds a
  ``Config`` with the component model enabled
  (and epoch interruption when
  **execution_timeout** is set),
  creates an ``Engine``,
  then loads the guest with
  ``Component::from_file()``.
  Compilation also happens here, once per
  application process start;
  the result is then pre-instantiated for
  per-request stores.

**Wasmtime cache**
  The C API library is built with the
  ``wasmtime-internal-cache`` crate linked in
  (it pulls ``zstd`` into the audit graph),
  but FreeUnit never configures a cache
  directory or enables the cache on the
  engine.
  Because the cache is never enabled,
  **wasm** compiles from the on-disk module
  when the prototype starts, and
  **wasm-wasi-component** compiles from the
  on-disk component in each application
  process.


**************
Configuration
**************

Shared options
==============

Both types accept the common application options
(:ref:`common options <configuration-apps-common>`)
and an **access** object whose only member,
**filesystem**,
is an array of host directories
preopened into the guest
(WASI preopens).
There is no separate ``preopen_dir`` option name;
use ``access.filesystem``.


type: wasm
==========

Required:

- **module**: path to the binary ``.wasm`` file
- **request_handler**: export that handles a request
- **malloc_handler**: export used to allocate the
  shared request buffer
- **free_handler**: export used to free that buffer

Optional handlers:
**module_init_handler**,
**module_end_handler**,
**request_init_handler**,
**request_end_handler**,
**response_end_handler**.

See the option table under
:ref:`configuration-wasm`.


type: wasm-wasi-component
=========================

Required:

- **component**: path to the Wasm component
  (``.wasm``)

Optional:

- **access.filesystem**: host directories
  preopened read-write for the guest
- **execution_timeout**: seconds a component may
  run for one request before Unit stops it
  (default ``0``, no limit).
  Implemented with Wasmtime **epoch interruption**;
  the budget covers guest time including host
  calls.
  To bound what the client waits for, use
  **limits.timeout** instead.

Guest-initiated outbound HTTP is not supported:
``wasmtime-wasi-http`` is built without the
``default-send-request`` feature,
and outbound calls fail with a defined error.


*****************
Wasmtime versions
*****************

FreeUnit pins Wasmtime **48.0.8** (LTS line)
in two places that must stay aligned:

- C API source tarball:
  ``pkg/contrib/src/wasmtime/version``
  (``WASMTIME_VERSION := 48.0.8``),
  fetched from the FreeUnit packages mirror
- Rust crate:
  ``src/wasm-wasi-component/Cargo.lock``
  (``wasmtime``, ``wasmtime-wasi`` and
  ``wasmtime-wasi-http`` at the same version)

Wasmtime 48 is an LTS line with 24 months of
upstream support
(`release process
<https://docs.wasmtime.dev/stability-release.html>`_).
FreeUnit tracks the pin under
`Dependency Support in EOL.md
<https://github.com/freeunitorg/freeunit/blob/master/EOL.md>`_.
WebAssembly as a language row in the runtime
matrix is marked **no EOL**.

Pin checks
==========

The ``Audit (cargo)`` workflow
(``.github/workflows/audit.yml``)
has three jobs:

- **locks** lists every tracked ``Cargo.lock``.
- **audit** runs ``cargo audit`` on each of those
  locks in a matrix,
  including the ``wasm-wasi-component`` lock.
- **pins** checks the source tarball pins
  and audits the archived Wasmtime C API lock
  against the allowlist.

Findings that cannot be fixed by a pin bump are
listed with an exact package version in
``pkg/contrib/wasmtime-lock-audit.allow.json``;
any other linked finding fails the job.
A version bump forces the allowlist to be
reviewed again.


************
Limitations
************

- **Cranelift** is required for today's JIT path
  (the Rust module enables the ``cranelift``
  feature explicitly).
- **WASI** is required:
  the C API always links WASI
  (``wasmtime_linker_define_wasi``),
  and the component module uses
  ``wasmtime-wasi`` / ``wasmtime-wasi-http``.
- **No AOT / deserialize** and **no configured
  compile cache**:
  **wasm** pays Cranelift compile cost once,
  when the prototype starts;
  **wasm-wasi-component** pays it in every
  application process.
- **pin-utils 0.1.0**
  (RUSTSEC-2026-0441, unmaintained)
  remains in the **vendored Wasmtime C API**
  lock through ``futures-util``
  (via ``wasmtime-wasi`` / ``wasi-io``).
  FreeUnit does not call its macros.
  The allowlist accepts the finding for this
  exact version.
  The archived lock still carries ``pin-utils``
  through at least Wasmtime 50.0.1,
  so a pin bump alone does not remove it.
  The Rust module's own ``Cargo.lock`` currently
  resolves ``futures-util`` without ``pin-utils``.
- The C API build already turns
  **component-model**,
  **component-model-async**,
  and **wasi-http** off
  (the ``wasm`` module only loads core modules).
  Further feature narrowing is still open work.


*****
Plans
*****

Short TODO list, not available yet:

- AOT / precompiled modules (``.cwasm`` /
  deserialize) for production startups
- Enable and configure the Wasmtime compile
  **cache** so restarts reuse artifacts
- Narrow remaining unused C API features further
  where the linked graph still pays for them

When any of these land,
this page and
:ref:`configuration-wasm`
will be updated together.
