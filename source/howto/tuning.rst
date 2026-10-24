.. meta::
   :og:description: Tune Linux kernel sysctl limits (file descriptors, epoll
                    watches, TCP listen backlogs, ephemeral ports, AIO, VMAs,
                    and writeback ratios) and validate FreeUnit performance.

.. include:: ../include/replace.rst

.. _howto-tuning:

###################################
Host Kernel Tuning and Benchmarking
###################################

.. note::

   Commands in this guide starting with a hash (**#**) must be run as **root**
   or with superuser privileges.

High-concurrency deployments and performance benchmarks of FreeUnit are often
constrained by default operating system limits before they reach the capacity
of the server or hardware.  This guide explains how FreeUnit manages per-process
file descriptor limits, which Linux kernel **sysctl** parameters govern
high-concurrency operation, why each parameter affects correctness and tail
latency, and the methodology for validating tuning changes.


.. _tuning-nofile:

**********************************
Per-Process File Descriptor Limits
**********************************

At startup, FreeUnit's **router** and **controller** processes automatically
raise their soft file descriptor limit (:samp:`RLIMIT_NOFILE`, :samp:`rlim_cur`)
to match the hard limit (:samp:`rlim_max`), clamped to :samp:`1048576` on Linux
(the default :samp:`fs.nr_open`) and to :samp:`min(OPEN_MAX, rlim_max)` on
macOS.

- Container runtimes (such as Docker) and service managers commonly start
  daemons with a low soft limit (for example, :samp:`1024`) and a high hard
  limit (such as :samp:`524288` or :samp:`1048576`).  Raising :samp:`rlim_cur`
  in the router and controller prevents :samp:`accept4() failed (24: Too many
  open files)` (**EMFILE**) alerts once concurrent connections exceed 1,000.
- The **main**, **discovery**, and **application worker** processes intentionally
  keep the soft limit that **unitd** started with.  Application code or
  libraries that rely on **select(2)** therefore retain a descriptor ceiling
  compatible with :samp:`FD_SETSIZE` (:samp:`1024`).

To inspect the live limits of a running FreeUnit instance on Linux:

.. code-block:: console

   $ grep "Max open files" /proc/$(pgrep -f "unit: router")/limits
   Max open files            524288               524288               files

Once per-process descriptor limits are raised, host kernel tables and network
queues must be sized accordingly so the bottleneck does not shift to
system-wide file table exhaustion (**ENFILE**), **epoll** watch exhaustion
(**ENOSPC**), TCP listen queue drops, ephemeral port exhaustion
(**EADDRNOTAVAIL**), or virtual memory / writeback stalls.


.. _tuning-sysctl-parameters:

********************************
Host Kernel and sysctl Reference
********************************

The table below summarizes the ten primary Linux kernel parameters that affect
FreeUnit under high concurrency or heavy connection churn:

.. list-table::
   :header-rows: 1

   * - Parameter
     - Typical Default
     - Recommended (Bench / Prod)
     - Summary

   * - :samp:`fs.nr_open`
     - :samp:`1048576`
     - :samp:`>= 1048576`
     - Per-process kernel ceiling for :samp:`RLIMIT_NOFILE` (:samp:`rlim_max`).

   * - :samp:`fs.file-max`
     - ~10% of RAM
     - :samp:`>= 2097152`
     - System-wide open file table across all processes (**ENFILE** if exhausted).

   * - :samp:`fs.epoll.max_user_watches`
     - ~4% of lowmem
     - :samp:`>= 1048576`
     - Maximum file descriptors registered across **epoll** instances for one UID.

   * - :samp:`net.core.somaxconn`
     - :samp:`4096` (:samp:`128` on older kernels)
     - :samp:`8192` – :samp:`65535`
     - Upper bound on :samp:`listen(fd, backlog)` for completed TCP handshakes awaiting **accept4(2)**.

   * - :samp:`net.ipv4.tcp_max_syn_backlog`
     - :samp:`1024` – :samp:`4096`
     - :samp:`8192` – :samp:`65535`
     - Queue size for half-open :samp:`SYN_RECV` sockets before handshake completion.

   * - :samp:`net.core.netdev_max_backlog`
     - :samp:`1000`
     - :samp:`>= 16384`
     - Per-CPU ingress packet queue between NIC driver poll and :samp:`NET_RX_SOFTIRQ`.

   * - :samp:`net.ipv4.ip_local_port_range`
     - :samp:`32768 60999`
     - :samp:`10240 65535`
     - Ephemeral source port range for outbound proxy connections and local load generators.

   * - :samp:`fs.aio-max-nr`
     - :samp:`65536`
     - :samp:`262144` – :samp:`1048576`
     - System-wide concurrent Linux AIO context ring slots.

   * - :samp:`vm.max_map_count`
     - :samp:`65530`
     - :samp:`>= 262144`
     - Maximum virtual memory areas (**mmap(2)** VMA regions) per process.

   * - :samp:`vm.dirty_background_ratio` / :samp:`vm.dirty_ratio`
     - :samp:`10` / :samp:`20`
     - :samp:`5` / :samp:`15`
     - Page-cache dirty thresholds for background flusher threads vs. synchronous writeback stalls.


.. _tuning-sysctl-rationale:

***************************************************************
Why Each Parameter Affects FreeUnit Performance and Correctness
***************************************************************

- **fs.nr_open** (:samp:`>= 1048576`):
  Sets the maximum value that **setrlimit(RLIMIT_NOFILE)** accepts for both
  :samp:`rlim_max` and :samp:`rlim_cur`.  At startup, FreeUnit's
  :samp:`nxt_process_nofile_raise()` clamps the router and controller soft
  limit to :samp:`min(rlim_max, 1048576)`.  If :samp:`fs.nr_open` is lowered
  below :samp:`rlim_max` or below the desired concurrency ceiling, neither
  **systemd** (:samp:`LimitNOFILE=`), container runtimes (:samp:`--ulimit
  nofile`), nor **unitd** can raise the per-process descriptor table enough to
  hold client sockets, IPC port sockets, and static file descriptors.

- **fs.file-max** (:samp:`>= 2097152`):
  Bounds the kernel's global :samp:`struct file` allocation table across the
  entire host.  Once the router's soft :samp:`RLIMIT_NOFILE` is raised up to
  :samp:`524288` or :samp:`1048576`, a single host may run **unitd** (router,
  controller, and application worker processes) alongside reverse proxies,
  databases, or local load generators that hold their own sockets.  If
  :samp:`fs.file-max` is smaller than the combined open descriptors across all
  processes, **socket(2)**, **accept4(2)**, or **openat(2)** fails with
  :samp:`ENFILE (23: Too many open files in system)` even though each individual
  process is well below its own :samp:`RLIMIT_NOFILE`.

- **fs.epoll.max_user_watches** (:samp:`>= 1048576`):
  Limits the total number of file descriptors a single non-root UID can
  register across all **epoll** instances (each registered watch consumes roughly
  90–160 bytes of kernel slab memory).  In FreeUnit, every router worker thread
  runs its own **epoll** instance and registers every accepted client
  connection, listener socket, and IPC port descriptor via
  :samp:`epoll_ctl(EPOLL_CTL_ADD)`.  When :samp:`RLIMIT_NOFILE` permits hundreds
  of thousands of concurrent connections under the unprivileged **unitd** user,
  hitting :samp:`max_user_watches` causes **epoll_ctl(2)** to fail with
  :samp:`ENOSPC (28: No space left on device)`, resulting in dropped connections
  under high-concurrency keep-alive traffic.

- **net.core.somaxconn** (:samp:`8192` – :samp:`65535`):
  Silently truncates the *backlog* argument passed to **listen(2)** to
  :samp:`min(backlog, net.core.somaxconn)`.  Under burst connection arrival
  (short-lived connections or high-concurrency startup), if a router thread is
  busy draining an **epoll** batch and the completed-handshake accept queue
  fills past :samp:`somaxconn`, the kernel drops incoming ACKs or sends TCP
  **RST** (:samp:`TcpExtListenDrops` and :samp:`TcpExtListenOverflows`),
  producing failed requests and multi-millisecond p99 latency spikes even when
  CPU and file descriptors are plentiful.  Pair this kernel setting with the
  listener :ref:`backlog <configuration-listeners>` option in Unit's
  configuration.

- **net.ipv4.tcp_max_syn_backlog** (:samp:`8192` – :samp:`65535`):
  Bounds the per-listener queue of half-open (:samp:`SYN_RECV`) sockets waiting
  for the final ACK of the three-way handshake.  During high-rate connection
  churn or multi-core client bursts, a small SYN backlog overflows before
  connections ever reach the **accept4(2)** queue, triggering SYN cookies or
  SYN drops and distorting accept-path throughput and latency.

- **net.core.netdev_max_backlog** (:samp:`>= 16384`):
  Sizes each CPU's ingress packet queue (:samp:`softnet_data.input_pkt_queue`)
  when packets arrive faster than :samp:`NET_RX_SOFTIRQ` drains them.  On
  loopback and 10/25/100 GbE hosts handling hundreds of thousands of requests
  per second, the default 1,000-packet queue overflows during micro-bursts
  (visible as non-zero drops in the second column of
  :file:`/proc/net/softnet_stat`), causing TCP retransmissions and tail-latency
  spikes unrelated to application or router code.

- **net.ipv4.ip_local_port_range** (:samp:`10240 65535`):
  Expands the pool of ephemeral source ports from ~28,000 (:samp:`32768–60999`)
  to ~55,000.  Under rapid connect/close workloads (which cycle sockets through
  :samp:`TIME_WAIT`) and :ref:`upstream proxying <configuration-upstreams>`
  (where the router opens outbound connections to backends), a narrow port
  range causes **connect(2)** to fail with
  :samp:`EADDRNOTAVAIL (99: Cannot assign requested address)` or spend excessive
  kernel CPU scanning the inet hash table for a free four-tuple.

- **fs.aio-max-nr** (:samp:`262144` – :samp:`1048576`):
  Caps the total number of concurrent in-flight slots across kernel Linux AIO
  rings (**io_setup(2)**).  On hosts where FreeUnit serves static assets with
  asynchronous I/O or runs alongside storage/database services on the same
  machine, raising :samp:`RLIMIT_NOFILE` without raising :samp:`fs.aio-max-nr`
  causes **io_setup(2)** to fail with **EAGAIN** once concurrent async I/O
  contexts exceed :samp:`65536`.

- **vm.max_map_count** (:samp:`>= 262144`):
  Limits the number of distinct **mmap(2)** virtual memory areas (VMAs) a
  process may hold.  FreeUnit's router and application processes communicate
  over shared-memory port queues and pass request and response bodies via
  on-demand **mmap(2)** shared-memory segments; language runtimes (PHP
  OPcache/JIT, JVM, Python, Go, and Rust allocators) also allocate per-thread
  arenas and guard pages.  Under high concurrency, hitting the default
  :samp:`65530` VMA ceiling makes **mmap(2)** fail with **ENOMEM**, causing
  shared-memory allocation failures in the router or worker crashes.

- **vm.dirty_background_ratio** / **vm.dirty_ratio** (:samp:`5` / :samp:`15`):
  Controls when kernel flusher threads begin asynchronous page-cache writeback
  (:samp:`dirty_background_ratio`, default 10% of RAM) versus when threads
  calling **write(2)** are forced into synchronous disk I/O
  (:samp:`dirty_ratio`, default 20% of RAM).  On large-memory servers, 10–20%
  of RAM represents many gigabytes of buffered access logs or temporary request
  body files; when the kernel flushes that backlog at once or crosses
  :samp:`dirty_ratio`, router threads block in **write(2)**, introducing sharp
  p99 latency spikes.  Starting background writeback earlier (:samp:`5` /
  :samp:`15`) keeps disk flushing continuous and prevents synchronous stalls.


.. _tuning-sysctl-config:

Applying and Verifying sysctl Settings
======================================

Create :file:`/etc/sysctl.d/90-freeunit.conf` with the recommended profile:

.. code-block:: ini

   fs.nr_open = 1048576
   fs.file-max = 2097152
   fs.epoll.max_user_watches = 1048576
   fs.aio-max-nr = 524288
   net.core.somaxconn = 32768
   net.ipv4.tcp_max_syn_backlog = 32768
   net.core.netdev_max_backlog = 16384
   net.ipv4.ip_local_port_range = 10240 65535
   vm.max_map_count = 262144
   vm.dirty_background_ratio = 5
   vm.dirty_ratio = 15

Apply the configuration and verify that no listen overflows or softnet drops
occur under load:

.. code-block:: console

   # sysctl --system
   $ ulimit -Sn && ulimit -Hn
   $ nstat -az TcpExtListenOverflows TcpExtListenDrops
   $ awk '{print strtonum("0x"$2)}' /proc/net/softnet_stat


.. _tuning-methodology:

************************************
Tuning and Benchmarking Methodology
************************************

When evaluating kernel tuning or comparing two FreeUnit builds, small configuration
changes often move throughput or CPU cost by 1% to 5%, whereas uncontrolled host
noise (CPU frequency scaling, C-state wakeups, or thermal drift) can shift numbers
by 5% to 15%.  Use the methodology below to obtain trustworthy measurements.

Workload Matrix
===============

Do not tune or benchmark against a single concurrency level.  Evaluate five
complementary traffic patterns:

.. list-table::
   :header-rows: 1

   * - Workload Pattern
     - Typical Concurrency
     - What It Exercises

   * - Keep-alive, high concurrency
     - :samp:`c = 256`
     - Router throughput ceiling, **epoll** batching, and descriptor table scaling.

   * - Keep-alive, low concurrency
     - :samp:`c = 8`
     - Listener/port wake distribution, thundering-herd effects, and CPU C-state exit latency.

   * - Short-lived connections (:samp:`Connection: close`)
     - :samp:`c = 16`
     - **accept4(2)**, socket teardown, :samp:`somaxconn`, :samp:`tcp_max_syn_backlog`, and ephemeral port recycling.

   * - Upstream proxy keep-alive
     - :samp:`c = 64`
     - Client side of the router, outbound ephemeral ports, and socket buffer limits.

   * - Application worker keep-alive (e.g. PHP, Python, Go)
     - :samp:`c = 8` – :samp:`64`
     - Shared-memory IPC port queues, :samp:`vm.max_map_count`, and worker wakeup scheduling.

Measurement Rules
=================

1. **Track router CPU microseconds per request alongside RPS and tail latency.**
   Client-side requests per second (RPS) on keep-alive connections has a wider
   noise floor (often 2% to 5%), whereas router CPU microseconds per request
   (read from :file:`/proc/<pid>/task/<tid>/stat` or :file:`schedstat` across
   request-handling :samp:`unitd` threads) is typically stable to ~1%.  A tuning
   or code change that reduces CPU per request without moving RPS on a
   client-bottlenecked run is still a real improvement.

2. **Pin CPU cores and isolate SMT siblings.**
   Bind **unitd** and the load generator (such as **oha** or **wrk**) to
   disjoint physical CPU sets with **taskset(1)**, leave hyperthread siblings
   of the server cores idle, and set the CPU scaling governor to
   :samp:`performance` so frequency transitions and deep hardware sleep states
   (:samp:`C1E`, :samp:`C6`) do not confound low-concurrency measurements.

3. **Establish the A/A noise floor first.**
   Before comparing two configurations (*A* vs. *B*), run the exact protocol
   comparing configuration *A* against itself (*A/A*).  The observed delta plus
   its 95% confidence interval half-width defines the host's noise floor; only
   A/B deltas outside that band are statistically meaningful.

4. **Interleave runs in even or counterbalanced blocks.**
   Never measure all repetitions of *A* followed by all repetitions of *B*.
   Alternate order across even rounds (*A/B*, *B/A*) or use counterbalanced
   8-cell blocks (:samp:`X Y Y X Y X X Y` paired with a swapped run
   :samp:`Y X X Y X Y Y X`) so page-cache warm-up, allocator state, and thermal
   drift cancel out of the paired means and 95% confidence intervals.

5. **Reject runs with failed requests or log alerts.**
   A run in which the server drops connections (**EMFILE**, **ENFILE**, or
   listen backlog overflow) often reports artificially *higher* RPS and *lower*
   p99 latency because shed requests do no application work.  Require zero
   failed requests and zero **[alert]** lines in :file:`unit.log` for every
   measurement cell.
