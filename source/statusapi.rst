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

The **modules** object has one member for each loaded language module.
The member name is the module name, such as **python** or **php**.
The member value is an object with the options below.
If several versions of a module are loaded,
the value is an array of these objects, one for each version:

.. list-table::
    :header-rows: 1

    * - Option
      - Description

    * - **version**
      - String;
        language module version.

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

.. note::

   A PHP runtime statistics endpoint is planned for a future release.
   Track progress at https://github.com/freeunitorg/freeunit/issues/43.
