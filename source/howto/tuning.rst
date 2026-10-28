.. meta::
   :og:description: Diagnose Linux resource limits affecting FreeUnit, apply
                    reversible changes, and run reproducible benchmarks.

.. include:: ../include/replace.rst

.. _howto-tuning:

#######################################
Host Kernel Tuning and Benchmarking
#######################################

.. _tuning-quick-navigation:

****************
Quick Navigation
****************

- Diagnose a performance or resource-limit problem:
  :ref:`symptom, measurement and action guide <tuning-decision-guide>` and the
  :ref:`initial diagnostic checklist <tuning-diagnostic-checklist>`.
- Inspect current process and kernel limits:
  :ref:`per-process limits <tuning-nofile>` and
  :ref:`read-only sysctl inventory <tuning-sysctl-config>`.
- Apply, verify or roll back a configuration change:
  :ref:`safe change procedure <tuning-sysctl-config>`.
- Run a reproducible benchmark: :ref:`benchmark methodology <tuning-methodology>`.

*******************************
Do I Need to Tune Anything?
*******************************

.. _tuning-decision-guide:

Usually, keep the existing settings until measurements identify a limit or
queue that prevents the required workload from meeting its latency and error
budget.  A higher limit permits more resource consumption; it does not by
itself increase throughput.  Production tuning should preserve reliability,
memory headroom, and predictable latency.  Controlled experiments belong in
:ref:`tuning-methodology`; benchmark settings are not production defaults.

Use this sequence: **inspect → diagnose → propose → apply with authorization
→ verify → roll back if necessary**.  Read-only examples below do not grant
permission to change a host.  Commands marked **modifying** require an approved
change window and sufficient privileges; service restarts may interrupt traffic.

.. list-table:: Symptom → measurement → likely cause → action → verification
   :header-rows: 1
   :widths: 18 28 26 28

   * - Symptom
     - Measurement
     - Likely cause / proposed action
     - Verify under the same offered load
   * - ``accept4()`` / ``open()``: ``EMFILE``
     - Live process limits and descriptor usage
     - :ref:`Process limit <tuning-nofile>`; check leaks before raising it
     - Descriptor headroom and no new ``EMFILE``
   * - ``ENFILE`` or epoll ``ENOSPC``
     - Host file handles or watches charged to the UID
     - :ref:`File / watch limits <tuning-sysctl-rationale>`
     - Error disappears without excessive kernel memory growth
   * - Connect latency or connection failures
     - Listen, SYN, softnet counter deltas; listener queues
     - :ref:`Queue pressure <tuning-somaxconn>`; locate the pressured stage
     - Fewer drops and improved connection latency, without worse p99
   * - Outbound ``EADDRNOTAVAIL``
     - Source addresses, destination tuples, port range, TCP states
     - :ref:`Port exhaustion <tuning-ports>` or invalid source address
     - Successful connects at the required connection rate
   * - ``mmap()``: ``ENOMEM``
     - VMA count, address-space and memory limits
     - :ref:`Mapping limit <tuning-maps>` or another memory constraint
     - Allocation succeeds and memory stays within budget
   * - Periodic latency spikes during writes
     - Dirty pages, writeback, storage latency, blocked threads
     - :ref:`Writeback pressure <tuning-dirty>` is a hypothesis to test
     - Lower tail latency without unsustainable I/O or reduced durability

Counter values are cumulative: compare before/after snapshots over a known
interval, not merely nonzero totals.  Inspect the namespace and processes that
actually serve the traffic.  CPU saturation, cgroup throttling, slow applications,
storage and network capacity can all cause poor performance without a sysctl
being too small.

.. _tuning-diagnostic-checklist:

*****************************
Initial Diagnostic Checklist
*****************************

Collect this read-only snapshot before considering tuning, in the host or network
namespace that serves the traffic.  Minimal images may omit ``ss``/``nstat``
(iproute2) or ``iostat`` (sysstat); :file:`/proc` access may need privileges.

Select one numeric PID from the process listing; never pass the multi-PID
``pgrep`` output to a single :file:`/proc` path:

.. code-block:: sh

   ps -eo pid,ppid,user,args | grep '[u]nit:'
   # Set pid to one numeric PID from the output above.
   cat /proc/"$pid"/limits
   find /proc/"$pid"/fd -mindepth 1 -maxdepth 1 -type l | wc -l
   cat /proc/sys/fs/file-nr
   sysctl net.core.somaxconn net.ipv4.tcp_max_syn_backlog \
          net.core.netdev_max_backlog net.ipv4.ip_local_port_range \
          vm.max_map_count
   ss -lnt
   nstat -az TcpExtListenOverflows TcpExtListenDrops
   ss -s
   cat /proc/net/softnet_stat
   grep -E '^(Dirty|Writeback):' /proc/meminfo

For TCP listeners, ``ss -lnt`` shows the accept queue in ``Recv-Q`` and the
backlog in ``Send-Q``; ``/proc/net/softnet_stat`` is per-CPU hexadecimal.
Counters are cumulative: compare timestamped snapshots over a known interval.
Optional: ``vmstat 1 5``; ``iostat -xz 1 5`` needs sysstat.

For interpretation and actions see :ref:`per-process limits <tuning-nofile>`,
the :ref:`sysctl reference <tuning-sysctl-parameters>`,
:ref:`accept queue <tuning-somaxconn>`, :ref:`SYN queue <tuning-syn-backlog>`,
:ref:`softnet <tuning-netdev>`, :ref:`ports <tuning-ports>`,
:ref:`VMAs <tuning-maps>` and :ref:`writeback <tuning-dirty>`.

.. _tuning-evidence:

***********************************
Evidence and Version Boundaries
***********************************

**Kernel behavior** below is supported by linked Linux documentation and man
pages.  Defaults, accounting, and exposed sysctls vary with kernel version,
distribution and container runtime: read the running system's values.
**FreeUnit implementation** statements are checked against upstream commit
`0f4fbe0c5 <https://github.com/freeunitorg/freeunit/tree/0f4fbe0c5fbe8ac0ca6d5dbd28bbdc6ade8ba1c6>`_.
These are source facts, not promises that every release contains them.
In particular, the router/controller soft-limit raise was introduced by
`7303a6ff4 <https://github.com/freeunitorg/freeunit/commit/7303a6ff4f97893f8db54c0ba83231c0fc505195>`_
and is absent from the 1.37.0 tag.  Check package backports and live limits.

**Operational recommendations** are conditional choices to test, not guaranteed
performance improvements.  A suggested explanation for a latency change remains
**a hypothesis requiring measurement** until correlated with the relevant
resource, error or trace.  The linked
`kernel I/O research <https://github.com/freeunitorg/freeunit-exp/pull/130>`_
distinguishes its upstream revision from its experimental fork base; neither
experimental code nor its measurements establish released behavior.


.. _tuning-nofile:

**************************************
Per-Process File Descriptor Limits
**************************************

**Control and scope (Linux):** ``RLIMIT_NOFILE`` is per process and inherited
across fork/exec.  Its soft limit is enforced; the hard limit bounds what an
unprivileged process may request.  It limits descriptor numbers (one greater
than the highest permitted number), not HTTP request concurrency directly.
Sockets, IPC, event descriptors, logs and open static files all need headroom.
Threads in a process normally share the descriptor table.

**Verified FreeUnit implementation:** In revisions containing the raise,
``nxt_process_setup()`` calls ``nxt_process_nofile_raise()`` for the **router**
and **controller** only.  On Linux, the target is
``max(current_soft, min(hard, 1048576))``; an already higher soft limit stays.
On macOS the candidate is also capped by ``OPEN_MAX``.  Failure logs a warning
and leaves the old limit in effect.  Main, discovery and application processes
keep the inherited limit unless other code changes it.  This avoids automatically
raising application limits for code using ``select()``; it does **not** guarantee
``FD_SETSIZE`` compatibility if the inherited soft limit is already too high.
The implementation is in
`nxt_process.c <https://github.com/freeunitorg/freeunit/blob/0f4fbe0c5fbe8ac0ca6d5dbd28bbdc6ade8ba1c6/src/nxt_process.c>`_.

**Read-only diagnosis:** Select one PID from the process listing, confirm its
role and instance, and set ``pid`` to that numeric PID.  Repeat for router,
controller and affected application workers; do not pass a multi-PID ``pgrep``
result to a single :file:`/proc` path.  Procfs access may require privileges.

.. code-block:: sh

   ps -eo pid,ppid,user,args | grep '[u]nit:'
   # After selecting a numeric PID:
   cat /proc/"$pid"/limits
   find /proc/"$pid"/fd -mindepth 1 -maxdepth 1 -type l | wc -l
   sysctl fs.nr_open

The descriptor count is a snapshot, not a peak or a check of the highest FD
number.  ``ulimit -Sn`` and ``ulimit -Hn`` describe the inspecting shell, not the
running daemon.  Correlate rising usage with ``EMFILE`` and investigate leaks.

**Action, trade-off and verification:** Raise service/container limits only if
legitimate demand approaches the limit and memory capacity supports it.  Raising
``fs.nr_open`` alone changes neither the hard nor soft limit of an existing
process.  Configure the launcher and restart/recreate FreeUnit to inherit new
limits; an application configuration reload does not replace the launcher's
limits.  Reinspect every affected process after restart and under load.
On older FreeUnit versions set both soft and hard limits appropriately.  Raising
the application soft limit above 1024 requires auditing any use of ``select()``.
See :ref:`tuning-environments` and
`getrlimit(2) <https://man7.org/linux/man-pages/man2/getrlimit.2.html>`_.

**Socket creation (pinned revision):** ``nxt_socket_create()`` requests
``SOCK_NONBLOCK`` when asked (or sets nonblocking mode afterward) and
``SOCK_CLOEXEC`` with an ``FD_CLOEXEC`` fallback.  The epoll accept4 path uses
``SOCK_NONBLOCK | SOCK_CLOEXEC``; the accept fallback sets flags separately.
Close-on-exec prevents inheritance across exec, not fork, and does not increase
capacity.  Some of these flags are recent changes absent from older releases;
see `nxt_socket.c <https://github.com/freeunitorg/freeunit/blob/0f4fbe0c5fbe8ac0ca6d5dbd28bbdc6ade8ba1c6/src/nxt_socket.c>`_.

**Accept recovery is not capacity:** At the pinned upstream revision,
``nxt_conn_accept_error()`` handles ``EMFILE``, ``ENFILE``, ``ENOBUFS`` and
``ENOMEM`` by logging an alert and invoking ``nxt_conn_accept_close_idle()``.
It schedules a pass closing up to ten idle connections and a 100 ms retry;
an active listener is disabled while waiting.  This can disrupt keep-alive and
connection latency; absence of a crash does not make an exhausted run valid.
See `nxt_conn_accept.c <https://github.com/freeunitorg/freeunit/blob/0f4fbe0c5fbe8ac0ca6d5dbd28bbdc6ade8ba1c6/src/nxt_conn_accept.c>`_.


.. _host-kernel-and-sysctl-reference:

.. _tuning-sysctl-parameters:

*************************************
Linux Kernel and sysctl Reference
*************************************

This is a diagnostic index, not a profile.  No universal numeric floors are
required by FreeUnit.  For a justified capacity floor use
``max(current_value, chosen_floor)``; do not lower a larger existing limit.
Queue sizes still need latency/memory evaluation.  Port ranges and dirty-page
thresholds are workload decisions, not monotonically better capacity limits.

.. list-table:: Controls and scope
   :header-rows: 1
   :widths: 30 25 45

   * - Parameter
     - Scope
     - Controls / diagnostic signal
   * - ``fs.nr_open``
     - Host ceiling; process rlimits remain separate
     - Allowed hard ``RLIMIT_NOFILE``; failed limit-setting
   * - ``fs.file-max``
     - Host
     - Allocated file handles; ``ENFILE``
   * - ``fs.epoll.max_user_watches``
     - UID accounting across epoll instances
     - Registered watches; ``epoll_ctl(EPOLL_CTL_ADD)``: ``ENOSPC``
   * - ``net.core.somaxconn``
     - Network namespace; cap applied at ``listen()``
     - Completed TCP connections waiting for accept
   * - ``net.ipv4.tcp_max_syn_backlog``
     - Network namespace setting; per-listener queue
     - Remembered incomplete handshakes, SYN pressure
   * - ``net.core.netdev_max_backlog``
     - Host setting; per-CPU backlog queues
     - Software input backlog; softnet drops
   * - ``net.ipv4.ip_local_port_range``
     - Network namespace
     - Automatic local port allocation for TCP/UDP
   * - ``vm.max_map_count``
     - Host setting; enforced per process
     - Virtual memory areas (VMAs); allocation failure near limit
   * - ``vm.dirty_background_ratio`` / ``vm.dirty_ratio``
     - Host policy with backing-device / cgroup writeback interactions
     - Dirty-page writeback and writer throttling

Do not infer namespace isolation from a ``net.*`` prefix alone.  Availability,
permissions and UID/user-namespace accounting depend on the kernel/runtime;
containers can share limits with other workloads.  See
:ref:`tuning-environments` before applying anything.

.. _why-each-parameter-affects-freeunit-performance-and-correctness:

.. _tuning-sysctl-rationale:

File Handles and epoll Watches: fs.nr_open, fs.file-max, fs.epoll.max_user_watches
======================================================================================

**Control and FreeUnit relevance:** ``fs.nr_open`` bounds hard-limit increases
(``setrlimit()`` may fail with ``EPERM`` above it, even for a privileged caller).
The upstream documented default is 1048576, not a live process limit.
``fs.file-max`` bounds allocated kernel file handles, not the sum of all FD
counts: duplicated and inherited descriptors can share an open file description.
There is no rule that it must be twice the router's hard limit, and it is a
count, not a percentage of RAM.  See
`Linux filesystem sysctls <https://docs.kernel.org/admin-guide/sysctl/fs.html>`_.

With Linux epoll selected, each router event engine creates an epoll instance.
Registered sockets and event descriptors consume watches, potentially including
the same listener in multiple instances; regular static-file FDs need not be
watched.  ``max_user_watches`` accounts registrations across instances for the
same real UID, including other services.  It is not a one-to-one counterpart
of router ``RLIMIT_NOFILE``.  Watch memory cost and the memory-derived default
are architecture/kernel dependent; see
`epoll(7) <https://man7.org/linux/man-pages/man7/epoll.7.html>`_.
FreeUnit logs failed ``epoll_ctl()`` changes and queues event error handling;
see `nxt_epoll_engine.c <https://github.com/freeunitorg/freeunit/blob/0f4fbe0c5fbe8ac0ca6d5dbd28bbdc6ade8ba1c6/src/nxt_epoll_engine.c>`_.

**Read-only diagnosis:**

.. code-block:: sh

   sysctl fs.nr_open fs.file-max fs.epoll.max_user_watches
   cat /proc/sys/fs/file-nr
   # For a selected process: inspect epoll interest lists where permitted.
   grep -H '^tfd:' /proc/"$pid"/fdinfo/*

``file-nr`` reports allocated, unused and maximum handles (the unused field is
normally zero on modern Linux).  Check kernel logs for
``VFS: file-max limit ... reached`` and FreeUnit logs for the exact syscall and
errno.  Count watches across all relevant processes/instances for the UID;
looking at one router is insufficient.  Listing fdinfo is non-atomic and may be
expensive at high concurrency.

**Action / avoid / verify:** Increase only the exhausted limit after ruling out
leaks and checking kernel-memory headroom.  No change is needed when demand is
well below it.  Higher ceilings permit larger memory consumption during overload;
monitor file handles, watches, memory, and error deltas at the same load after a
change.  A higher ``nr_open`` also needs launcher/process changes as described in
:ref:`tuning-nofile`.

.. _tuning-somaxconn:

TCP Accept Queue: net.core.somaxconn and Listener backlog
=============================================================

**Control and FreeUnit relevance:** On Linux, ``listen(fd, backlog)`` limits
completed connections waiting for accept, not established connections already
accepted or concurrent HTTP requests.  A nonnegative backlog is capped by
``somaxconn``.  FreeUnit maps an omitted or ``-1`` listener
:ref:`backlog <configuration-listeners>` to ``NXT_LISTEN_BACKLOG``: ``-1`` on
Linux.  Linux's unsigned comparison clamps that value to ``somaxconn`` at the
``listen()`` call; it is not a portable POSIX meaning of negative backlog.
See `nxt_listen_socket.h <https://github.com/freeunitorg/freeunit/blob/0f4fbe0c5fbe8ac0ca6d5dbd28bbdc6ade8ba1c6/src/nxt_listen_socket.h>`_,
`nxt_router.c <https://github.com/freeunitorg/freeunit/blob/0f4fbe0c5fbe8ac0ca6d5dbd28bbdc6ade8ba1c6/src/nxt_router.c>`_,
`Linux listen implementation <https://github.com/torvalds/linux/blob/v6.12/net/socket.c>`_
and `listen(2) <https://man7.org/linux/man-pages/man2/listen.2.html>`_.

**Read-only diagnosis** (run in the listener's network namespace):

.. code-block:: sh

   sysctl net.core.somaxconn net.ipv4.tcp_abort_on_overflow
   ss -lnt
   nstat -az TcpExtListenOverflows TcpExtListenDrops

For listening TCP sockets, ``ss`` shows current queued connections in ``Recv-Q``
and the configured backlog in ``Send-Q``.  Sample repeatedly during bursts.
Increasing ``ListenOverflows`` indicates accept-queue pressure;
``ListenDrops`` has broader causes, including allocation failures.  Namespace-wide
counters do not identify which listener dropped traffic.  Overflow handling
(retry/drop/reset) depends on kernel path and ``tcp_abort_on_overflow``; these
counters do not uniquely prove dropped final ACKs or an RST.  See
`Linux TCP counters <https://docs.kernel.org/networking/snmp_counter.html>`_.

**Action / avoid / verify:** If legitimate bursts outrun accept temporarily,
consider a larger listener backlog and cap, while fixing CPU starvation,
blocking work or resource errors slowing accept.  High keep-alive concurrency
alone is not evidence.  Bigger queues consume memory and may replace failures
with longer waits; they cannot repair sustained overload; do not enable
reset-on-overflow as a generic remedy.

``net.core.somaxconn`` caps what the kernel grants; the listener
:ref:`backlog <configuration-listeners>` is what FreeUnit requests.  Both apply
at ``listen()`` time and neither write resizes an existing socket.  At the inspected
revision, reconfiguration matches listeners by address and reuses the existing
socket without calling ``listen()`` again (see
`nxt_router.c <https://github.com/freeunitorg/freeunit/blob/0f4fbe0c5fbe8ac0ca6d5dbd28bbdc6ade8ba1c6/src/nxt_router.c>`__);
changing only ``backlog`` therefore has no effect until the listener is
recreated.  Arrange an authorized recreation: remove the listener (DELETE) and
add it back (PUT) with the intended backlog, then verify ``ss -lnt``; a
restart works too but is unnecessary if recreation is acceptable.  Removal closes the socket and
resets connections still queued for accept; the re-add can fail with
``EADDRINUSE`` while the old listener drains, so retry and never assume zero
downtime.  See :ref:`Control API <configuration-api>` and
:ref:`API manipulation <configuration-mgmt>`.  Then compare overflow deltas,
success rate and connect/p99 latency at matched load.

.. _tuning-syn-backlog:

Incomplete TCP Handshakes: net.ipv4.tcp_max_syn_backlog and SYN Cookies
===========================================================================

**Control and FreeUnit relevance:** The kernel remembers ``SYN_RECV`` requests
per listener before handing established sockets to FreeUnit.  This is distinct
from the accept queue.  The memory-scaled default and effective behavior depend
on kernel version, listener backlog and SYN-cookie mode.  Cookies can avoid
allocating remembered SYN requests; they do not enlarge the accept queue.
See `Linux TCP sysctls <https://docs.kernel.org/networking/ip-sysctl.html>`_.

**Read-only diagnosis:**

.. code-block:: sh

   sysctl net.ipv4.tcp_max_syn_backlog net.ipv4.tcp_syncookies
   ss -nt state syn-recv
   nstat -az TcpExtSyncookiesSent TcpExtTCPReqQFullDoCookies \
             TcpExtTCPReqQFullDrop TcpExtListenOverflows TcpExtListenDrops

Use counter deltas; some counters are unavailable on older kernels.  Cookie use
can hide pressure from the ``SYN_RECV`` snapshot.  ``ListenDrops`` alone does not
prove SYN-queue exhaustion.  Investigate packet loss, legitimate bursts and
attacks separately.

**Action / avoid / verify:** Consider a larger remembered-request limit for
measured legitimate SYN pressure with memory headroom; leave it alone when no
pressure is present.  Extra entries consume memory and can prolong resource
retention.  Keep SYN cookies as a fallback rather than a capacity plan, and do
not disable protection to improve a benchmark.  Verify handshake success and
latency plus cookie/drop deltas, separately from accept-queue counters.

.. _tuning-netdev:

Software Receive Backlog: net.core.netdev_max_backlog and softnet_stat
==========================================================================

**Control and FreeUnit relevance:** This host setting bounds per-CPU software
input backlog queues used by paths such as receive packet steering (RPS).
It is not the NIC ring size or a mandatory queue traversed by every NAPI packet.
FreeUnit consumes TCP sockets downstream; changing this setting does not change
its epoll batch size.  See
`network core sysctls <https://docs.kernel.org/admin-guide/sysctl/net.html>`_.

**Read-only diagnosis:**

.. code-block:: sh

   sysctl net.core.netdev_max_backlog
   cat /proc/net/softnet_stat
   ip -s link
   cat /proc/softirqs

``softnet_stat`` fields are hexadecimal, per CPU.  On Linux 6.12 the second
column is dropped packets and the third is ``time_squeeze`` (receive processing
exhausted its time/work budget).  The latter is not a drop count.  Validate the
layout and CPU identifiers for the running kernel; see
`net-procfs.c <https://github.com/torvalds/linux/blob/v6.12/net/core/net-procfs.c>`_.
Drops may involve flow limiting as well as backlog capacity.  Correlate deltas
with CPU/softirq load, NIC counters (``ethtool -S`` for the selected interface),
IRQ/RPS placement and actual traffic path.  Containers may expose host CPU
statistics; collect node-side evidence too.

**Action / avoid / verify:** Increase the backlog only when that queue is dropping
legitimate traffic and transient bursts are the cause.  Investigate CPU/IRQ
imbalance and sustained receive overload first.  More buffering costs memory and
queueing latency; it cannot improve a path that bypasses the queue.  Verify fewer
drops, retransmissions and failures without worse tail latency at equal load.

.. _tuning-ports:

Outbound Ports: ip_local_port_range, TIME_WAIT and TCP Four-Tuples
======================================================================

**Control and FreeUnit relevance:** ``net.ipv4.ip_local_port_range`` controls
automatic local port selection in the network namespace; accepted inbound
connections do not each need a new ephemeral local port.  FreeUnit upstream
proxy connections and load generators do.  TCP connections are identified by
source/destination addresses and ports (the **four-tuple**): the same source
port can serve different destinations, subject to binding/reuse rules.  A range
is not a universal host-wide cap on TCP connections.

**Read-only diagnosis** (also inspect the load-generator namespace):

.. code-block:: sh

   sysctl net.ipv4.ip_local_port_range net.ipv4.ip_local_reserved_ports \
          net.ipv4.ip_unprivileged_port_start
   ss -s
   ss -nt state time-wait
   ss -nt state established
   ip address show

Correlate ``connect()`` ``EADDRNOTAVAIL`` with source/destination tuples and
configured source addresses: an unavailable address is another cause.  ``bind()``
can report different errors.  The active closer usually holds ``TIME_WAIT``;
closing the application FD does not immediately free that tuple for unrestricted
reuse.  ``TIME_WAIT`` does not retain an application FD.  Many such sockets are
normal, not proof of exhaustion.  NAT/conntrack can impose separate limits.
See `connect(2) <https://man7.org/linux/man-pages/man2/connect.2.html>`_ and
`tcp(7) <https://man7.org/linux/man-pages/man7/tcp.7.html>`_.

**Action / avoid / verify:** Where protocol and application semantics permit,
reduce churn with persistent connections/pooling; verify the actual upstream
behavior rather than assuming a pool exists.  Widen the range only after checking
service-port reservations, firewall/NAT policy and source-address use.  Preserve
existing ``ip_local_reserved_ports`` entries if editing that separate list;
writing it replaces the list.  Neither ``max(current, floor)`` nor a fixed range
such as ``10240 65535`` is safe generic advice.  Do not adjust ``tcp_tw_reuse``
or ``tcp_fin_timeout`` as a generic port-exhaustion fix (the latter does not set
``TIME_WAIT`` lifetime).  Verify successful connections and latency at the target
churn rate and enough duration to reach steady TCP-state occupancy.

.. _tuning-maps:

Virtual Memory Areas: vm.max_map_count and FreeUnit Shared Memory
=====================================================================

**Control and FreeUnit relevance:** A VMA is a contiguous virtual address region
with common mapping properties.  ``vm.max_map_count`` limits VMAs per process,
not mapped bytes or total RAM.  FreeUnit uses mapped queues and shared segments
for router/application IPC.  Normal-build data segments contain 10 MiB of data
plus a header and are reused; neither requests nor connections map one-to-one
to VMAs.  Mapping splits/merges, runtimes, libraries and allocators also affect
VMA count.  Do not assert which dominates without inspecting the process.

At the pinned revision, ``NXT_PORT_MMAPS_MAX`` bounds segment IDs per peer and
direction, not Linux VMAs.  It cannot be compared directly to ``max_map_count``.
See `nxt_port_memory_int.h <https://github.com/freeunitorg/freeunit/blob/0f4fbe0c5fbe8ac0ca6d5dbd28bbdc6ade8ba1c6/src/nxt_port_memory_int.h>`_,
`nxt_port_memory.c <https://github.com/freeunitorg/freeunit/blob/0f4fbe0c5fbe8ac0ca6d5dbd28bbdc6ade8ba1c6/src/nxt_port_memory.c>`_
and `nxt_unit.c <https://github.com/freeunitorg/freeunit/blob/0f4fbe0c5fbe8ac0ca6d5dbd28bbdc6ade8ba1c6/src/nxt_unit.c>`_.
Allocation failures are logged and propagated through the affected path; do not
assume every ``ENOMEM`` has the same request outcome or guarantees worker survival.

**Read-only diagnosis:**

.. code-block:: sh

   sysctl vm.max_map_count
   wc -l /proc/"$pid"/maps
   cat /proc/"$pid"/limits
   grep -E 'VmSize|VmRSS|VmData' /proc/"$pid"/status

**Action / avoid / verify:** Increase only for legitimate VMA usage near the
limit, after ruling out leaks, ``RLIMIT_AS``, address-space fragmentation and
host/cgroup memory pressure.  A low VMA count argues against this change.
Higher limits permit more mapping metadata and memory use.  Verify allocations,
VMA/RSS peaks, memory events and application errors under representative traffic.
See `Linux VMA limit <https://docs.kernel.org/admin-guide/sysctl/vm.html#max-map-count>`_.

.. _tuning-dirty:

Dirty Pages: vm.dirty_background_ratio, vm.dirty_ratio and Byte Thresholds
==============================================================================

**Control and FreeUnit relevance:** Background thresholds initiate writeback;
foreground thresholds can throttle dirtying tasks.  Ratios use available
free/reclaimable memory, not simply total installed RAM.  Each ratio has a byte
counterpart (``dirty_background_bytes`` / ``dirty_bytes``); setting one disables
its counterpart.  Writeback also depends on time, backing devices and cgroups.
See `Linux writeback controls <https://docs.kernel.org/admin-guide/sysctl/vm.html#dirty-background-bytes>`_.

Buffered logs and file-backed request storage can create dirty pages; reading
hot static files and shared-memory IPC do not imply equivalent disk writeback.
A blocked ``write()`` is not necessarily doing synchronous disk I/O, and an
observed p99 spike is not proof of dirty throttling.

**Read-only diagnosis:**

.. code-block:: sh

   sysctl vm.dirty_background_ratio vm.dirty_ratio \
          vm.dirty_background_bytes vm.dirty_bytes \
          vm.dirty_expire_centisecs vm.dirty_writeback_centisecs
   grep -E '^(Dirty|Writeback):' /proc/meminfo
   vmstat 1 10
   iostat -xz 1 10

``iostat`` needs sysstat.  Correlate storage latency, dirty/writeback levels,
I/O pressure and blocked-thread evidence; use kernel writeback tracing in a
controlled experiment if attribution remains uncertain.

**Action / avoid / verify:** No generic ``5/15`` ratio recommendation is justified.
Lower thresholds can smooth some workloads but increase writeback frequency and
throttle writers earlier; higher thresholds can permit larger dirty bursts.
Neither guarantees lower latency or durability.  Consider byte thresholds when
an explicit dirty-memory budget is useful; ensure storage can sustain the write
rate.  Leave policy unchanged without evidence of writeback-related latency.
Compare tail latency, write throughput, storage utilization and dirty levels;
restore both ratio/byte pairs in their original active mode if the trade-off
fails.  Coordinate with node owners because this affects other writers.


.. _how-kernel-parameters-and-rlimit-nofile-correlate:

.. _tuning-correlations:

*************************************************
Capacity Planning Across Processes and Queues
*************************************************

Limits interact, but they do not form a chain of mandatory equalities.  Estimate
actual peak demand and validate it at the required traffic rate:

- Budget descriptors **per process**, watches **per accounting UID across
  instances**, and allocated file handles **across the host**.  Include IPC,
  listeners, outbound sockets and unrelated services.  A same-host load generator
  adds its own sockets and CPU/memory demand.
- Separate receive backlog, remembered SYNs and completed accept queues.  Not all
  packets traverse the software input backlog, and SYN cookies change handshake
  accounting.  Enlarging one queue does not require enlarging all others.
- Outbound tuple occupancy depends on destination diversity, binding, connection
  lifetime and churn; FD capacity alone cannot predict port exhaustion.
- VMA count, resident memory and dirty pages are different resources.  Measure
  each rather than deriving them from the connection limit.

Production acceptance should specify a target offered load, response/error
budget, p95/p99 limit and memory headroom.  Increase one justified limit at a
time.  If failures disappear but latency or resource use breaches that budget,
the change has not met its goal.


.. _tuning-environments:

************************************************
Service, Container and Kubernetes Deployment
************************************************

**Bare metal / VM:** Inspect and modify the kernel actually running FreeUnit.
A VM has its own kernel, but hypervisor contention, steal time, virtual NICs and
storage can dominate results.  Sysctls do not reserve CPU or memory.  Do not use
a container's apparent RAM/CPU count as proof of its cgroup allocation.

**systemd:** Determine the actual service name from the deployment.  Read-only
inspection (replace ``unit.service`` if necessary):

.. code-block:: sh

   systemctl show unit.service -p MainPID -p LimitNOFILE -p LimitNOFILESoft
   systemctl cat unit.service

If FD evidence warrants a change, prepare a dedicated drop-in with
``[Service]`` and ``LimitNOFILE=soft:hard``, using reviewed numeric values at
least as large as the existing limits.  This is a **modifying, potentially
disruptive** operation: reload systemd's unit definitions, then restart the
service in an approved window.  ``daemon-reload`` alone does not change running
rlimits.  Restore/remove only that drop-in and reload/restart to undo it.
Check child-process limits in procfs.  Audit application ``select()`` use before
raising soft limits above 1024; see
`systemd.exec <https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#LimitNOFILE=>`_.

**Docker / OCI:** Rlimits come from runtime configuration and launcher defaults,
not the image's build-time shell.  Docker supports ``--ulimit nofile=soft:hard``;
OCI runtimes expose corresponding process rlimits.  Inspect live limits rather
than assuming Docker/containerd defaults.  Recreate containers with reviewed
limits to apply changes and with the recorded prior configuration to roll back.
Only supported namespaced sysctls can be set via Docker ``--sysctl``; host
networking and rootless operation impose additional restrictions.  Host
``fs.*`` / ``vm.*`` changes need node administration, not a privileged container
as a shortcut.  See
`Docker run reference <https://docs.docker.com/reference/cli/docker/container/run/>`_.

**Kubernetes:** Pod ``securityContext.sysctls`` supports only namespaced controls
allowed by the installed Kubernetes version, admission policy and kubelet.
Unsafe sysctls require explicit node allowlisting; ``hostNetwork`` restricts
network sysctls.  A ``net.*`` name is not evidence that a pod can set it.
Host settings such as ``fs.file-max``, ``vm.max_map_count`` and receive backlog
policy are node-wide changes requiring the node operator.  Do not give an
unprivileged pod commands to modify them.  Kubernetes has no general PodSpec
``ulimit`` field: investigate runtime/node launcher rlimits and inspect actual
FreeUnit processes.  CPU, memory and PID cgroup limits are distinct from
rlimits/sysctls; higher kernel ceilings do not remove CPU throttling or memory
limits.  Roll out pod/runtime changes in stages and retain the old specification.
See `Kubernetes sysctl guidance <https://kubernetes.io/docs/tasks/administer-cluster/sysctl-cluster/>`_
for the version-specific safe list and restrictions.


.. _applying-and-verifying-sysctl-settings:

.. _tuning-sysctl-config:

**********************************************************
Inspecting, Applying, Verifying and Reverting a Change
**********************************************************

Read-only Inventory and Change Proposal
===========================================

Read settings in the intended host/network namespace; do not apply this inventory
as a configuration file:

.. code-block:: sh

   sysctl fs.nr_open fs.file-max fs.epoll.max_user_watches \
          net.core.somaxconn net.ipv4.tcp_max_syn_backlog \
          net.core.netdev_max_backlog net.ipv4.ip_local_port_range \
          net.ipv4.ip_local_reserved_ports vm.max_map_count \
          vm.dirty_background_ratio vm.dirty_ratio \
          vm.dirty_background_bytes vm.dirty_bytes

Record current values, effective process/listener limits, relevant existing
configuration files, namespace, workload and baseline counters.  Propose only
the identified parameter, expected benefit, resource budget, authorization and
rollback conditions.  Numeric examples are illustrative, not required minimums.
For capacity floors choose ``max(current_value, justified_floor)``.  Do not use
that rule for port endpoints, ratios or byte thresholds.

Temporary Runtime Trial (Modifying; Authorization Required)
===============================================================

The following **Bash** example trials only ``somaxconn`` after accept-queue
pressure has been established.  ``8192`` is an illustrative experiment floor,
not a production recommendation.  Run in the correct network namespace and
retain the printed old value outside this shell for rollback.  It writes only
if the current value is smaller:

.. code-block:: bash

   key=net.core.somaxconn
   old=$(sysctl -n "$key") || exit 1
   floor=8192
   target=$(( old > floor ? old : floor ))
   printf 'Recorded %s=%s; proposed value=%s\n' "$key" "$old" "$target"
   # Modifying: execute only after authorization for this trial.
   if (( target > old )); then
       sudo sysctl -w "$key=$target" || exit 1
   fi
   sysctl "$key"

Stop on errors; do not compensate by granting container privileges.  The sysctl
write only changes the cap for future ``listen()`` calls: update the listener
:ref:`backlog <configuration-listeners>` if needed, then recreate the listener
as described in :ref:`tuning-somaxconn` and verify ``ss -lnt``.  Runtime changes
normally last until reset, reboot or namespace destruction; configuration
management may overwrite them sooner.

Repeat the representative load and compare error/counter **deltas**, connect
latency, p95/p99, successful throughput and resource peaks.  Success requires
both the expected diagnostic improvement and the production acceptance budget;
an unrelated throughput increase is insufficient evidence.  Roll back for no
repeatable benefit, regressions, excessive resource use or new errors.

**Rollback (modifying):** In the same namespace, restore the recorded old value
(``sudo sysctl -w "$key=$old"`` in the same Bash session).  If the session has
ended, use the saved numeric value rather than an unset variable.  Recreate the
listener as above and verify its backlog again.  Restoring a sysctl alone does
not restore launch limits or existing listener sizing.  Do not overwrite a
concurrent operator change; coordinate before restoration.

Persistent Configuration After a Successful Trial (Modifying)
=================================================================

Review existing :file:`sysctl.d` files and configuration-management precedence.
Persist only approved values in a dedicated managed file, preserving any
pre-existing file.  Write the evaluated ``target``, not a generic literal floor;
re-evaluate current values before deployment to another host.  A static file
does not implement ``max(current, floor)`` on future boots: future higher
vendor/operator values can still be overridden, so configuration management must
reconcile them.  For container namespaces use the runtime/pod's supported
configuration rather than assuming a host file changes existing namespaces.

``sudo sysctl -p /etc/sysctl.d/90-freeunit.conf`` loads just the reviewed file
and changes runtime state; verify each key afterward.  In contrast,
``sysctl --system`` reloads multiple configuration files and can apply unrelated
changes.  It is not a narrowly scoped apply or rollback command.  See
`sysctl(8) <https://man7.org/linux/man-pages/man8/sysctl.8.html>`_.

For rollback, restore the prior managed file (or remove only the newly created
one) **and** explicitly restore the saved runtime values; deleting a file does
not undo an applied value.  Verify effective values and service behavior, and
check persistence during a scheduled restart/reboot.  Restore original active
ratio/byte modes together if writeback controls were changed.


.. _tuning-and-benchmarking-methodology:

.. _tuning-methodology:

***************************************
Reproducible Performance Benchmarks
***************************************

Benchmark controls isolate causes; they are not production tuning advice.
Run A/A (the same build/configuration against itself) before A/B (one intended
change).  Record raw runs, full commands and failures so another operator can
reproduce the comparison.  No universal noise percentage or precision applies
to every host or metric.

.. _workload-matrix:

Workload Matrix and Required Run Manifest
=============================================

These concurrency values are starting points, not server sizing rules.  Cross
the static rows with **1 KiB, 12 KiB, 16 KiB, 128 KiB and 4 MiB** bodies; record
exact byte counts (KiB = 1024 bytes).  Test proxy/application rows separately.

.. list-table:: Suggested scenarios
   :header-rows: 1

   * - Workload
     - Concurrent connections
     - Primary investigation
   * - Static GET, persistent HTTP/1.1
     - 8 and 256
     - Wakeups at low load; CPU/throughput and FD demand at higher load
   * - Static GET, ``Connection: close``
     - 16
     - Connection rate, accept/teardown and client tuple occupancy
   * - Proxy GET, persistent client connections
     - 64
     - Outbound behavior; record upstream connection reuse separately
   * - Application GET, persistent connections
     - 8 and 64
     - Worker/runtime CPU, scheduling and IPC

For **every cell**, fix and archive:

- HTTP version, plaintext/TLS, TLS version/cipher/session reuse, keep-alive/close,
  pipelining and (if applicable) multiplexed streams per connection.  Do not
  equate request concurrency with connection count for multiplexed protocols.
- Method, endpoint, request body/headers, expected status and exact response
  body size/hash; compression, routing, caching and logging settings.  Separate
  generated responses from disk-backed static files and hot from cold cache.
- Client tool/version and complete invocation, threads, connection count,
  outstanding requests, timeouts, offered rate and closed-loop versus rate-driven
  load.  Record connection reuse actually observed.
- Warm-up and measurement durations, repetitions, ordering and state reset.
  An illustrative starting protocol is **10 s warm-up, 30 s measurement and
  eight paired repetitions per cell**, for A/A and A/B alike.  Extend it for
  thermal, cache, JIT, writeback or TCP-state steady state and adequate tail samples.
- Server/client CPU IDs and physical-core/SMT topology, thread/worker counts,
  affinity, NUMA placement, IRQ placement, cgroup CPU/memory limits, RAM, NIC/link
  and storage, loopback versus separate hosts, power/frequency/idle policy.
- Kernel/distribution, libc implementation/version (glibc or musl), FreeUnit
  release **and commit/patches**, build flags, language/TLS libraries, server and
  application configuration, sysctls and live process limits for each variant.

Keep the same warm-up, cache policy and idle/rest interval for all slots.  For
cold-cache tests define a repeatable isolated-host method and measure storage
I/O; do not run host-wide ``drop_caches`` on production.  Warm-cache tests must
preload/serve the same corpus and check that it fits the intended cache budget.
Application JITs and compression caches also need controlled state.

Static Bodies: pread()/writev() Versus sendfile()
=====================================================

At the pinned upstream revision, the ordinary uncompressed static-body path
uses up to two 128 KiB memory buffers, filled by ``nxt_file_read()`` / ``pread()``.
Memory buffers on plaintext connections reach ``writev()``; the existence of
``nxt_conn_io_sendfile()`` does not mean the static handler selects it.
See `nxt_http_static.c <https://github.com/freeunitorg/freeunit/blob/0f4fbe0c5fbe8ac0ca6d5dbd28bbdc6ade8ba1c6/src/nxt_http_static.c>`_,
`nxt_file.c <https://github.com/freeunitorg/freeunit/blob/0f4fbe0c5fbe8ac0ca6d5dbd28bbdc6ade8ba1c6/src/nxt_file.c>`_
and `nxt_conn_write.c <https://github.com/freeunitorg/freeunit/blob/0f4fbe0c5fbe8ac0ca6d5dbd28bbdc6ade8ba1c6/src/nxt_conn_write.c>`_.
TLS, compression and experimental branches may select different paths.
Confirm the actual build/path with source and a short trace/profile outside
measurement runs; tracing itself adds overhead.

Small bodies emphasize syscall/header and scheduling overhead; larger ones
expose copying, buffer refills, cache/storage and network bandwidth costs.
The 12/16 KiB pair samples nearby sizes without assuming a universal crossover;
128 KiB relates to the inspected buffer size, and 4 MiB requires repeated
transfers.  ``sendfile()`` can avoid user-space body copies, but cache state,
TLS/kTLS, headers, batching, kernel and hardware determine the trade-off.
The experimental results linked from :ref:`tuning-evidence` are hypotheses
for replication, not a universal 16 KiB transport threshold or evidence about a
shipped release.

CPU Affinity, CPUFreq and CPUIdle
=====================================

Use ``lscpu -e`` to identify physical cores and SMT siblings.  Pin server and
client to disjoint physical cores, leave server SMT siblings idle, and record
NUMA/IRQ placement.  ``taskset`` constrains scheduling but does not reserve cores
or isolate interrupts.  Apply affinity to the full server process/thread tree,
including application workers; verify it rather than pinning only the main PID.
Separate client/server hosts are preferable for network capacity tests; loopback
measures a different path and shares host resources.  Do not run builds, other
benchmarks or heavy monitoring on measured cores.

**CPUFreq** controls performance/frequency policy.  A ``performance`` governor
may reduce frequency ramp effects but does not guarantee a fixed frequency;
driver, turbo, thermal and power limits still matter.  **CPUIdle** controls idle
states; that governor does not disable deep C-states.  Sleeping-thread wakeup
latency is a possible low-concurrency effect to measure, not a guaranteed cause.
See `CPUFreq <https://docs.kernel.org/admin-guide/pm/cpufreq.html>`_ and
`CPUIdle <https://docs.kernel.org/admin-guide/pm/cpuidle.html>`_.

On an authorized isolated benchmark host, record existing settings before
changing governor or disabling idle states (for example with ``cpupower``), and
restore them afterward.  Such changes affect power, temperature and other
workloads; first measure with production policy.  A temporary PM QoS constraint
via :file:`/dev/cpu_dma_latency` is another option: write a signed 32-bit latency
in microseconds (four zero bytes for zero) and keep the FD open for the trial;
closing it releases that request.  Support/permissions depend on the platform.
See `PM QoS <https://docs.kernel.org/power/pm_qos_interface.html>`_.

.. _measurement-rules:

A/A Noise, Counterbalanced A/B and Statistical Interpretation
=================================================================

1. Run the **entire protocol as A/A** first, including restarts and resets.
   Inspect run-to-run spread, order effects and drift.  A nonzero A/A contrast
   suggests bias/noise that must be explained before interpreting similar A/B
   effects.  Repeat the null check if host conditions change.
2. Counterbalance A/B order.  An example is ``A B B A B A A B`` plus a swapped
   ``B A A B A B B A`` block, with identical slot preparation.  Pair/block the
   analysis accordingly.  Counterbalancing reduces order bias; it does not
   guarantee cache or thermal drift cancels.  Randomized balanced blocks are
   another option if their ordering and seeds are recorded.
3. Report per-run results, the estimated paired/block effect and its **95%
   confidence interval**, with the calculation method and independent sample
   count.  Requests within one run are not independent run repetitions.  Use an
   analysis appropriate to paired runs and autocorrelation; preserve raw data.
4. Observed run-to-run variability is not a confidence interval.  A CI describes
   uncertainty in an estimated effect under assumptions; timer precision is
   another matter.  There is no universal rule that A/A delta plus CI half-width
   defines a significance boundary for A/B.  A CI excluding zero is not proof of
   causality or practical value.  Set a practically useful effect and resource/
   latency budgets beforehand; add repetitions if uncertainty is too wide.

CPU Time, Throughput, Latency and Failed Requests
=====================================================

Report successful RPS and bytes/s, p50/p95/p99 latency, attempted/completed
requests, status distribution, timeouts, resets and connection errors together.
Verify expected response status and body size; a fast error response is not
successful work.  Latency of successful requests alone hides shed load.  Reject
capacity-comparison cells with unexpected failures, overflow drops or FreeUnit
alerts; investigate and repeat.  Overload experiments may intentionally include
errors, but must report them as a separate result with the offered rate.

Measure **CPU microseconds per successful request** over the same steady interval:
``1e6 * delta_CPU_seconds / successful_requests``.  Sum router thread user/system
time from :file:`/proc/<pid>/task/<tid>/stat` (convert ticks using
``getconf CLK_TCK``), counting each thread once, or use an appropriate process
CPU accounting tool.  Do not add a process aggregate to its threads.  If using
``schedstat``, distinguish execution nanoseconds from run-queue wait and note
kernel/accounting availability.  See
`proc_pid_stat(5) <https://man7.org/linux/man-pages/man5/proc_pid_stat.5.html>`_
and `scheduler statistics <https://docs.kernel.org/scheduler/sched-stats.html>`_.
Track worker and total service CPU separately;
router CPU excludes application and some interrupt/softirq work.  Thread exits,
PID changes and in-flight requests at interval boundaries need explicit handling.
There is no guaranteed 1% precision for this metric.

Check client CPU, NIC bandwidth, retransmissions, port/FD headroom and scheduling.
If adding client cores or a second generator increases throughput, the previous
run did not establish the server ceiling.  CPU cost improvements without an RPS
change can be useful, but require the same validated work and interval; a
client bottleneck does not prove the cause.  Large bodies can saturate the link
before CPU.  Closed-loop clients reduce offered traffic as responses slow and
can hide queueing (coordinated omission); use a rate-driven tool with appropriate
latency accounting for a latency-at-fixed-arrival-rate question.  Archive the
method, raw output and counter snapshots, including excluded runs and reasons.
