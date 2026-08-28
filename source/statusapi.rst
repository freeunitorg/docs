 .. meta::
   :og:description: Query global and per-application usage statistics
                    from FreeUnit.

.. include:: include/replace.rst

.. _configuration-stats:

****************
Status API
****************

Unit collects information about the loaded language models, as well as
instance- and app-wide metrics, and makes them available via the **GET**-only
**/status** section of the :ref:`control API <configuration-api>`:

.. list-table::
    :header-rows: 1

    * - Option
      - Description

    * - **modules**
      - Object;
        lists currently loaded language modules.

    * - **connections**
      - Object;
        lists per-instance connection statistics.

    * - **requests**
      - Object;
        lists per-instance request statistics.

    * - **telemetry**
      - Object;
        lists span export statistics for the configured
        OpenTelemetry exporter.
        Present only if Unit was built with OpenTelemetry support,
        the **/config/settings/telemetry**
        :ref:`option <configuration-stngs>` is set,
        and the exporter was initialised successfully
        (an initialisation error is reported in the log).

        *(since 1.36.1)*

    * - **applications**
      - Object;
        each option item lists per-app process and request statistics.

Example:

.. code-block:: json

   {
       "modules": {
           "python": [
               {
                   "version": "3.12.3",
                   "lib": "/opt/unit/modules/python.unit.so"
               },
               {
                   "version": "3.8",
                   "lib": "/opt/unit/modules/python-3.8.unit.so"
               }
           ],

           "php": {
              "version": "8.3.4",
              "lib": "/opt/unit/modules/php.unit.so"
           }
       },

       "connections": {
           "accepted": 1067,
           "active": 13,
           "idle": 4,
           "closed": 1050
       },

       "requests": {
           "total": 1307
       },

       "telemetry": {
           "spans": {
               "exported": 1200,
               "failed": 0
           }
       },

       "applications": {
           "wp": {
               "processes": {
                   "running": 14,
                   "starting": 0,
                   "idle": 4
               },

               "requests": {
                   "active": 10
               }
           }
       }
   }

Each item in the **modules** object lists one of the currently loaded language
modules, the installed version (or versions) of the module, and the path to the
module file:

.. list-table::
    :header-rows: 1

    * - Option
      - Description

    * - **name**
      - String;
        language module name.

    * - **version**
      - String;
        language module version. If multiple versions are loaded,
        the list contains multiple items.

    * - **lib**
      - String;
        path to the language module file.

The **connections** object offers the following Unit instance metrics:

.. list-table::
    :header-rows: 1

    * - Option
      - Description

    * - **accepted**
      - Integer;
        total accepted connections during the instance's lifetime.

    * - **active**
      - Integer;
        current active connections for the instance.

    * - **idle**
      - Integer;
        current idle connections for the instance.

    * - **closed**
      - Integer;
        total closed connections during the instance's lifetime.

Example:

.. code-block:: json

   "connections": {
       "accepted": 1067,
       "active": 13,
       "idle": 4,
       "closed": 1050
   }

.. note::

   For details of instance connection management,
   refer to
   :ref:`configuration-stngs`.

The **requests** object currently exposes a single instance-wide metric:

.. list-table::
    :header-rows: 1

    * - Option
      - Description

    * - **total**
      - Integer;
        total non-API requests during the instance's lifetime.

Example:

.. code-block:: json

   "requests": {
       "total": 1307
   }

The **telemetry** object reports the health of the OpenTelemetry span
exporter.
It is omitted entirely
unless Unit was built with OpenTelemetry support,
the **/config/settings/telemetry**
:ref:`option <configuration-stngs>` is set,
and the exporter was initialised successfully;
its absence is how you tell telemetry is off
rather than idle.
An exporter that could not be built -- an unusable endpoint or protocol --
leaves the object absent despite the option being set,
and reports the reason in the log.
Its single **spans** member exposes two counters:

.. list-table::
    :header-rows: 1

    * - Option
      - Description

    * - **exported**
      - Integer;
        spans the collector accepted.

    * - **failed**
      - Integer;
        spans whose export to the collector failed.

Both counters are cumulative
since the exporter was last built,
so changing any **telemetry** setting resets them to zero;
re-applying an identical configuration does not.
They count spans rather than export batches,
and count only spans an export was attempted for:
a span the **sampling_ratio** dropped
appears in neither.
Neither does a span the exporter discarded before attempting an export,
which is what happens once the export queue fills behind a stalled
collector -- so **failed** staying at zero
does not by itself prove that nothing was lost.

A healthy pipeline shows **exported** rising
while **failed** stays at zero.
A rising **failed** means telemetry is being lost
before it reaches the collector.

Example:

.. code-block:: json

   "telemetry": {
       "spans": {
           "exported": 1200,
           "failed": 0
       }
   }

Each item in **applications** describes an app
currently listed in the **/config/applications**
:ref:`section <configuration-applications>`:

.. list-table::
    :header-rows: 1

    * - Option
      - Description

    * - **processes**
      - Object;
        lists per-app process statistics.

    * - **requests**
      - Object;
        similar to **/status/requests**,
        but includes only the data for a specific app.

Example:

.. code-block:: json

   "applications": {
       "wp": {
           "processes": {
               "running": 14,
               "starting": 0,
               "idle": 4
           },

           "requests": {
               "active": 10
           }
       }
   }

The **processes** object exposes the following per-app metrics:

.. list-table::
    :header-rows: 1

    * - Option
      - Description

    * - **running**
      - Integer;
        current running app processes.

    * - **starting**
      - Integer;
        current starting app processes.

    * - **idle**
      - Integer;
        current idle app processes.

Example:

.. code-block:: json

   "processes": {
       "running": 14,
       "starting": 0,
       "idle": 4
   }

.. note::

   For details of per-app process management,
   refer to
   :ref:`configuration-proc-mgmt`.

PHP Status
==========

For PHP applications, Unit provides detailed statistics about the PHP runtime,
including opcache performance, JIT status, request counters, garbage collection,
and memory usage via the **/status/applications/<app-name>/php** endpoint:

.. code-block:: bash

   $ curl http://localhost:8443/status/applications/myapp/php

Example response:

.. code-block:: json

   {
       "opcache": {
           "enabled": 1,
           "hits": 12345,
           "misses": 234,
           "cached_scripts": 89,
           "memory_used": 4194304,
           "memory_free": 131072,
           "interned_strings_used": 262144,
           "interned_strings_free": 0
       },

       "jit": {
           "enabled": 0,
           "buffer_size": 0,
           "memory_used": 0
       },

       "requests": {
           "total": 5000,
           "active": 2,
           "rejected": 0
       },

       "gc": {
           "runs": 15,
           "last_run_time": 1234567890
       },

       "memory": {
           "peak": 8388608,
           "current": 2097152
       }
   }

The **opcache** object provides statistics from the Zend OPcache:

.. list-table::
    :header-rows: 1

    * - Option
      - Description

    * - **enabled**
      - Integer;
        ``1`` if opcache is enabled, ``0`` otherwise.
        In PHP 8.5+, opcache is always enabled.

    * - **hits**
      - Integer;
        total cache hits during the application's lifetime.

    * - **misses**
      - Integer;
        total cache misses during the application's lifetime.

    * - **cached_scripts**
      - Integer;
        number of scripts currently cached in opcache.

    * - **memory_used**
      - Integer;
        opcache memory usage in bytes.

    * - **memory_free**
      - Integer;
        free opcache memory in bytes.

    * - **interned_strings_used**
      - Integer;
        memory used by interned strings in bytes.

    * - **interned_strings_free**
      - Integer;
        free memory for interned strings in bytes.

The **jit** object provides information about the JIT compiler:

.. list-table::
    :header-rows: 1

    * - Option
      - Description

    * - **enabled**
      - Integer;
        ``1`` if JIT is enabled, ``0`` otherwise.

    * - **buffer_size**
      - Integer;
        JIT buffer size in bytes.

    * - **memory_used**
      - Integer;
        JIT memory usage in bytes.

.. note::

   JIT statistics are available in PHP 8.0+.
   JIT must be enabled via the ``opcache.jit`` INI setting.

The **requests** object provides per-application request counters:

.. list-table::
    :header-rows: 1

    * - Option
      - Description

    * - **total**
      - Integer;
        total requests processed by the application.

    * - **active**
      - Integer;
        currently active requests.

    * - **rejected**
      - Integer;
        total rejected requests.

The **gc** object provides garbage collection statistics:

.. list-table::
    :header-rows: 1

    * - Option
      - Description

    * - **runs**
      - Integer;
        total GC runs during the application's lifetime.

    * - **last_run_time**
      - Integer;
        timestamp of the last GC run.

The **memory** object provides memory usage statistics from the Zend allocator:

.. list-table::
    :header-rows: 1

    * - Option
      - Description

    * - **peak**
      - Integer;
        peak memory usage in bytes.

    * - **current**
      - Integer;
        current memory usage in bytes.

.. rubric:: Monitoring and Observability

PHP status metrics can be used for:

- **Performance monitoring**: Track opcache hit rates to ensure efficient caching
- **Capacity planning**: Monitor memory usage trends across workers
- **Debugging**: Identify GC frequency and memory pressure issues
- **Prometheus integration**: Export metrics for Grafana dashboards

Example Prometheus metrics export:

.. code-block:: text

   unit_php_opcache_hits{app="myapp"} 12345
   unit_php_opcache_misses{app="myapp"} 234
   unit_php_memory_peak{app="myapp"} 8388608
   unit_php_requests_total{app="myapp"} 5000

.. rubric:: Configuration

To enable opcache for PHP applications, configure INI options:

.. code-block:: json

   {
       "type": "php",
       "root": "/var/www/myapp",
       "options": {
           "admin": {
               "opcache.enable": "1",
               "opcache.memory_consumption": "128",
               "opcache.max_accelerated_files": "10000"
           }
       }
   }

For JIT support (PHP 8.0+):

.. code-block:: json

   {
       "options": {
           "admin": {
               "opcache.jit": "1255",
               "opcache.jit_buffer_size": "128M"
           }
       }
   }

.. seealso::

   - :ref:`PHP configuration <configuration-php>`
   - `PHP OPcache documentation <https://www.php.net/manual/en/book.opcache.php>`_
   - `PHP JIT documentation <https://www.php.net/manual/en/opcache.configuration.php>`_
