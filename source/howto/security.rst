Security Checklist
##################

At its core, Unit has security as one of its top priorities; our development
follows the appropriate best practices focused on making the code robust and
solid.  However, even the most hardened system requires proper setup,
configuration, and maintenance.

This guide lists the steps to protect your Unit from installation to individual
app configuration.

.. note::
   The commands in this document starting with a hash (#) must be run as root or
   with superuser privileges.

.. _security-update:

*********************
Update Unit Regularly
*********************

**Rationale**: Each release introduces `bug fixes and new
features </CHANGES.txt>`_ that improve your installation's security.

**Actions**: Follow our latest `news
<https://mailman.nginx.org/mailman3/lists/unit.nginx.org/>`_ and upgrade to new
versions shortly after they are released.

.. nxt_details:: Details
   :hash: sec-updates

   Specific upgrade steps depend on your installation method:

   - The recommended option is to use our official :ref:`packages
     <installation-precomp-pkgs>` or Docker :ref:`images
     <installation-docker>`; with them, it's just a matter of updating
     **unit-*** packages with your package manager of choice or
     switching to a newer image.

   - If you use a third-party installation :ref:`method
     <installation-community-repos>`, consult the maintainer's documentation
     for details.

   - If you install Unit from :ref:`source files <source>`,
     rebuild and reinstall Unit and its modules from scratch.


.. _security-socket-state:

***********************
Secure Socket and State
***********************

**Rationale**: Your :ref:`control socket and state directory
<source-dir>` provide unlimited access to Unit's configuration, which
calls for stringent protection.

**Actions**: Default configuration in our :ref:`official packages
<installation-precomp-pkgs>` is usually sufficient; if you use another
installation method, ensure the control socket and the state directory are
safe.

.. nxt_details:: Control Socket
   :hash: sec-socket

   If you use a UNIX control socket, ensure it is available to **root**
   only:

   .. subs-code-block:: console

      $ unitd -h

            ...
            --control ADDRESS    set address of control API socket
                                 default: "unix::nxt_ph:`/default/path/to/control.unit.sock <Build-time setting, can be overridden>`"

      $ ps ax | grep unitd

            ... unit: main v|version| [... --control :nxt_ph:`/path/to/control.sock <Make sure to check for runtime overrides>` ...]

      # ls -l :nxt_ph:`/path/to/control.unit.sock <If it's overridden, use the runtime setting>`

            srw------- 1 root root 0 ... /path/to/control.unit.sock

   UNIX domain sockets aren't network accessible; for remote access, use
   :ref:`NGINX <nginx-secure-api>` or a solution such as SSH:

   .. code-block:: console

      $ ssh -N -L :nxt_hint:`./here.sock <Local socket>`::nxt_ph:`/path/to/control.unit.sock <Socket on the Unit server; use a real path in your command>` root@:nxt_hint:`unit.example.com <Unit server hostname>` &

   .. code-block:: console

      $ curl --unix-socket :nxt_hint:`./here.sock <Use the local socket to configure Unit>`

            {
                "certificates": {},
                "config": {
                    "listeners": {},
                    "applications": {}
                }
            }

   If you prefer an IP-based control socket, avoid public IPs; they expose the
   :ref:`control API <configuration-api>` and all its capabilities.  This means
   your Unit instance can be manipulated by whoever is physically able to
   connect:

   .. code-block:: console

      # unitd --control 203.0.113.14:8080

   .. code-block:: console

      $ curl 203.0.113.14:8080

            {
                "certificates": {},
                "config": {
                    "listeners": {},
                    "applications": {}
                }
            }

   Instead, opt for the loopback address to ensure all access is local to your
   server:

   .. code-block:: console

      # unitd --control 127.0.0.1:8080

   .. code-block:: console

      $ curl 203.0.113.14:8080

          curl: (7) Failed to connect to 203.0.113.14 port 8080: Connection refused

   However, any processes local to the same system can access the local socket,
   which calls for additional measures.  A go-to solution would be using NGINX
   to :ref:`proxy <nginx-secure-api>` Unit's control API.


.. nxt_details:: State Directory
   :hash: sec-state

   The state directory stores Unit's internal configuration between launches.
   Avoid manipulating it or relying on its contents even if tempted to do so.
   Instead, use only the control API to manage Unit's configuration.

   Also, the state directory should be available only to **root** (or the
   user that the **main** :ref:`process <security-apps>` runs as):

   .. subs-code-block:: console

      $ unitd -h

            ...
            --state DIRECTORY    set state directory name
                                 default: ":nxt_ph:`/default/path/to/unit/state/ <Build-time setting, can be overridden>`"

   .. subs-code-block:: console

      $ ps ax | grep unitd

            ... unit: main v|version| [... --state :nxt_ph:`/path/to/unit/state/ <Make sure to check for runtime overrides>` ...]

   .. subs-code-block:: console

      # ls -l :nxt_ph:`/path/to/unit/state/ <If it's overridden, use the runtime setting>`

            drwx------ 2 root root 4096 ...


.. _security-ssl:

*****************
Configure SSL/TLS
*****************

**Rationale**: To protect your client connections in production scenarios,
configure SSL certificate bundles for your Unit installation.

**Actions**: For details, see :ref:`configuration-ssl` and :doc:`certbot`.


.. _security-routes:

***********************
Error-Proof Your Routes
***********************

**Rationale**: Arguably, :ref:`routes <configuration-routes>` are the most
flexible and versatile part of the Unit configuration.  Thus, they must be as
clear and robust as possible to avoid loose ends and gaping holes.

**Actions**: Familiarize yourself with the :ref:`matching
<configuration-routes-matching>` logic and double-check all :ref:`patterns
<configuration-routes-matching-patterns>` that you use.

.. nxt_details:: Details
   :hash: sec-routes

   Some considerations:

   - Mind that :ref:`variables <configuration-variables>` contain arbitrary
     user-supplied request values; variable-based **pass** values in
     :ref:`listeners <configuration-listeners>` and :ref:`routes
     <configuration-routes-action>` must account for malicious requests, or the
     requests must be properly filtered.

   - Create :ref:`matching rules <configuration-routes-matching>` to
     formalize the restrictions of your Unit instance and the apps it runs.

   - Configure :ref:`shares <configuration-static>` only for directories and
     files you intend to make public.


.. _security-apps:

****************
Protect App Data
****************

**Rationale**: Unit's architecture involves many processes that operate
together during app delivery; improper process permissions can make sensitive
files available across apps or even publicly.

**Actions**: Properly configure your app directories and shares: apps and the
router process need access to them.  Still, avoid loose rights such as the
notorious **777**, instead assigning them on a need-to-know basis.

.. nxt_details:: File Permissions
   :hash: sec-files

   To configure file permissions for your apps, check Unit's build-time and
   run-time options first:

   .. subs-code-block:: console

      $ unitd -h

            ...
            --user USER          set non-privileged processes to run as specified user
                                 default: ":nxt_ph:`unit_user <Build-time setting, can be overridden>`"

            --group GROUP        set non-privileged processes to run as specified group
                                 default: user's primary group

   .. subs-code-block:: console

      $ ps ax | grep unitd

            ... unit: main v|version| [... --user :nxt_ph:`unit_user <Make sure to check for runtime overrides>` --group :nxt_ph:`unit_group <Make sure to check for runtime overrides>` ...]

   In particular, this is the account the router process runs as.  Use this
   information to set up permissions for the app code or binaries and shared
   static files.  The main idea is to limit each app to its own files and
   directories while simultaneously allowing Unit's router process to access
   static files for all apps.

   Specifically, the requirements are as follows:

   - All apps should run as different users so that the permissions can be
     configured properly.  Even if you run a single app, it's reasonable to
     create a dedicated user for added flexibility.

   - An app's code or binaries should be reachable for the user the app runs
     as; the static files should be reachable for the router process.  Thus,
     each part of an app's directory path must have execute permissions
     assigned for the respective users.

   - An app's directories should not be available to other apps or
     non-privileged system users. The router process should be able to access
     the app's static file directories.  Accordingly, the app's directories
     must have read and execute permissions assigned for the respective users.

   - The files and directories that the app is designed to update should
     be writable only for the user the app runs as.

   - The app code should be readable (and executable in case of :ref:`external
     <modules-ext>` apps) for the user the app runs as; the static content
     should be readable for the router process.

   A detailed walkthrough to guide you through each requirement:

   #. If you have several independent apps, running them with a single user
      account poses a security risk.  Consider adding a separate system user
      and group per each app:

      .. code-block:: console

         # :nxt_hint:`useradd <Add user account without home directory>` -M app_user

      .. code-block:: console

         # groupadd app_group

      .. code-block:: console

         # :nxt_hint:`usermod <Deny interactive login>` -L app_user

      .. code-block:: console

         # :nxt_hint:`usermod <Add user to the group>` -a -G app_group app_user

      Even if you run a single app, this helps if you add more apps or need to
      decouple permissions later.

   #. It's important to add Unit's non-privileged user account to *each* app
      group:

      .. code-block:: console

         # usermod -a -G app_group unit_user

      Thus, Unit's router process can access each app's directory and serve
      files from each app's shares.

   #. A frequent source of issues is the lack of permissions for directories
      inside a directory path needed to run the app, so check for that if in
      doubt.  Assuming your app code is stored at **/path/to/app/**:

      .. code-block:: console

         # ls -l /

               :nxt_hint:`drwxr-xr-x <Permissions are OK>`  some_user some_group  path

      .. code-block:: console

         # ls -l /path/

               :nxt_hint:`drwxr-x--- <Permissions are too restrictive>`  some_user some_group  to

      This may be a problem because the **to/** directory isn't owned by
      **app_user:app_group** and denies all permissions to non-owners (as
      the **---** sequence tells us), so a fix can be warranted:

      .. code-block:: console

         # :nxt_hint:`chmod <Add read/execute permissions for non-owners>` o+rx /path/to/

      Another solution is to add **app_user** to **some_group**
      (assuming this was not done before):

      .. code-block:: console

         # usermod -a -G some_group app_user

   #. Having checked the directory tree, assign ownership and permissions for
      your app's directories, making them reachable for Unit and the app:

      .. code-block:: console

         # :nxt_hint:`chown <Assign ownership for the app code>` -R app_user:app_group :nxt_ph:`/path/to/app/ <Path to the application directory; use a real path in your command>`

      .. code-block:: console

         # :nxt_hint:`chown <Assign ownership for the static files>` -R app_user:app_group :nxt_ph:`/path/to/static/app/files/ <Can be outside the app directory tree; use a real path in your command>`

      .. code-block:: console

         # find :nxt_ph:`/path/to/app/ <Path to the application directory; use a real path in your command>` -type d -exec :nxt_hint:`chmod <Add read/execute permissions to app code directories for user and group>` u=rx,g=rx,o= {} \;

      .. code-block:: console

         # find :nxt_ph:`/path/to/static/app/files/ <Can be outside the app directory tree; use a real path in your command>` -type d -exec :nxt_hint:`chmod <Add read/execute permissions to static file directories for user and group>` u=rx,g=rx,o= {} \;

   #. If the app needs to update specific directories or files, make sure
      they're writable for the app alone:

      .. code-block:: console

         # :nxt_hint:`chmod <Add write permissions for the user only; the group shouldn't have them>` u+w :nxt_ph:`/path/to/writable/file/or/directory/ <Repeat for each file or directory that must be writable>`

      In case of a writable directory, you may also want to prevent non-owners
      from messing with its files:

      .. code-block:: console

         # :nxt_hint:`chmod <Sticky bit prevents non-owners from deleting or renaming files>` +t :nxt_ph:`/path/to/writable/directory/ <Repeat for each directory that must be writable>`

      .. note::

         Usually, apps store and update their data outside the app code
         directories, but some apps may mix code and data.  In such a case,
         assign permissions on an individual basis, making sure you understand
         how the app uses each file or directory: is it code, read-only
         content, or writable data.

   #. For :ref:`embedded <modules-emb>` apps, it's usually enough to make the
      app code and the static files readable:

      .. code-block:: console

         # find :nxt_ph:`/path/to/app/code/ <Path to the application's code directory; use a real path in your command>` -type f -exec :nxt_hint:`chmod <Add read rights to app code for user and group>` u=r,g=r,o= {} \;

      .. code-block:: console

         # find :nxt_ph:`/path/to/static/app/files/ <Can be outside the app directory tree; use a real path in your command>` -type f -exec :nxt_hint:`chmod <Add read rights to static files for user and group>` u=r,g=r,o= {} \;

   #. For :ref:`external <modules-emb>` apps, additionally make the app code or
      binaries executable:

      .. code-block:: console

         # find :nxt_ph:`/path/to/app/ <Path to the application directory; use a real path in your command>` -type f -exec :nxt_hint:`chmod <Add read and execute rights to app code for user and group>` u=rx,g=rx,o= {} \;

      .. code-block:: console

         # find :nxt_ph:`/path/to/static/app/files/ <Can be outside the app directory tree; use a real path in your command>` -type f -exec :nxt_hint:`chmod <Add read rights to static files for user and group>` u=r,g=r,o= {} \;

   #. To run a single app, :doc:`configure <../configuration/index>` Unit as follows:

      .. code-block:: json

         {
             "listeners": {
                 ":nxt_hint:`*:80 <Or another suitable socket address>`": {
                     "pass": "routes"
                 }
             },

             "routes": [
                 {
                     "action": {
                         "share": ":nxt_ph:`/path/to/static/app/files/ <Router process needs read and execute permissions to serve static content from this directory>`$uri",
                         "fallback": {
                             "pass": "applications/app"
                         }
                     }
                 }
             ],

             "applications": {
                 "app": {
                     "type": "...",
                     "user": "app_user",
                     "group": "app_group"
                 }
             }
         }

   #. To run several apps side by side, :doc:`configure <../configuration/index>`
      them with appropriate user and group names.  The following
      configuration distinguishes apps based on the request URI, but you can
      implement another scheme such as different listeners:

      .. code-block:: json

         {
             "listeners": {
                 ":nxt_hint:`*:80 <Or another suitable socket address>`": {
                     "pass": "routes"
                 }
             },

             "routes": [
                 {
                     "match": {
                         "uri": ":nxt_hint:`/app1/* <Arbitrary matching condition>`"
                     },

                     "action": {
                         "share": ":nxt_ph:`/path/to/static/app1/files/ <Router process needs read and execute permissions to serve static content from this directory>`$uri",
                         "fallback": {
                             "pass": "applications/app1"
                         }
                     }
                 },

                 {
                     "match": {
                         "uri": ":nxt_hint:`/app2/* <Arbitrary matching condition>`"
                     },

                     "action": {
                         "share": ":nxt_ph:`/path/to/static/app2/files/ <Router process needs read and execute permissions to serve static content from this directory>`$uri",
                         "fallback": {
                             "pass": "applications/app2"
                         }
                     }
                 }
             ],

             "applications": {
                 "app1": {
                     "type": "...",
                     "user": "app_user1",
                     "group": "app_group1"
                 },

                 "app2": {
                     "type": "...",
                     "user": "app_user2",
                     "group": "app_group2"
                 }
             }
         }

   .. note::

      As usual with permissions, different steps may be required if you use
      ACLs.

.. nxt_details:: App Internals
   :hash: sec-app-internals

   Unfortunately, quite a few web apps are built in a manner that mixes their
   source code, data, and configuration files with static content, which calls
   for complex access restrictions.  The situation is further aggravated by the
   inevitable need for maintenance activities that may leave a footprint of
   extra files and directories unrelated to the app's operation.  The issue has
   several aspects:

   - Storage of code and data at the same locations, which usually happens by
     (insufficient) design.  You neither want your internal data and code files
     to be freely downloadable nor your user-uploaded data to be executable as
     code, so configure your routes and apps to prevent both.

   - Exposure of configuration data.  Your app-specific settings, **.ini**
     or **.htaccess** files, and credentials are best kept hidden from
     prying eyes, and your routing configuration should reflect that.

   - Presence of hidden files from versioning, backups by text editors, and
     other temporary files.  Instead of carving your configuration around
     these, it's best to keep your app free of them altogether.

   If these can't be avoided, investigate the inner workings of the app to
   prevent exposure, for example:

   .. code-block:: json

         {
             "routes": {
                 "app": [
                     {
                         "match": {
                             ":nxt_hint:`uri <Handles requests that target PHP scripts to avoid having them served as static files>`": [
                                 "*.php",
                                 "*.php/*"
                             ]
                         },

                         "action": {
                             "pass": "applications/app/direct"
                         }
                     },
                     {
                         "match": {
                             ":nxt_hint:`uri <Protects files and directories best kept hidden>`": [
                                 ":nxt_hint:`!/sensitive/* <Restricts access to a directory with sensitive data>`",
                                 ":nxt_hint:`!/data/* <Restricts access to a directory with sensitive data>`",
                                 ":nxt_hint:`!/app_config_values.ini <Restricts access to a specific file>`",
                                 ":nxt_hint:`!*/.* <Restricts access to hidden files and directories>`",
                                 ":nxt_hint:`!*~ <Restricts access to temporary files>`"
                             ]
                         },

                         "action": {
                             ":nxt_hint:`share <Serves valid requests with static content>`": ":nxt_ph:`/path/to/app/static <Path to the application's static file directory; use a real path in your configuration>`$uri",
                             ":nxt_hint:`types <Limits file types served from the share>`": [
                                 "image/*",
                                 "text/*",
                                 "application/javascript"
                             ],

                             ":nxt_hint:`fallback <Relays all requests not yet served to a catch-all app target>`": {
                                 "pass": "applications/app/index"
                             }
                         }
                     }
                 ]
             }
         }

   However, this does not replace the need to set up file permissions; use both
   :ref:`matching rules <configuration-routes-matching>` and per-app user
   permissions to manage access.  For more info and real-life examples, refer
   to our app :doc:`howtos <index>` and the 'File Permissions' callout above.

.. nxt_details:: Unit's Process Summary
   :hash: sec-processes

   .. _security-processes:

   Unit's processes are detailed `elsewhere
   <https://www.nginx.com/blog/introducing-nginx-unit/>`_, but here's a
   synopsis of the different roles they have:

   .. list-table::
      :header-rows: 1

      * - Process
        - Privileged?
        - User and Group
        - Description

      * - Main
        - Yes
        - Whoever starts the **unitd** executable; by default,
          **root**.
        - Runs as a daemon, spawning Unit's non-privileged and app processes;
          requires numerous system capabilities and privileges for operation.

      * - Controller
        - No
        - Set by :option:`!--user` and :option:`!--group` options at
          :ref:`build <source-config-src>` or :ref:`execution
          <source-startup>`; by default, **unit**.
        - Serves the control API, accepting reconfiguration requests,
          sanitizing them, and passing them to other processes for
          implementation.

      * - Discovery
        - No
        - Set by :option:`!--user` and :option:`!--group` options at
          :ref:`build <source-config-src>` or :ref:`execution
          <source-startup>`; by default, **unit**.
        - Discovers the language modules in the module directory at startup,
          then quits.

      * - Router
        - No
        - Set by :option:`!--user` and :option:`!--group` options at
          :ref:`build <source-config-src>` or :ref:`execution
          <source-startup>`; by default, **unit**.
        - Serves client requests, accepting them, processing them on the spot,
          passing them to app processes, or proxying them further; requires
          access to static content paths you configure.

      * - App processes
        - No
        - Set by per-app **user** and **group**
          :ref:`options <configuration-applications>`; by default,
          :option:`!--user` and :option:`!--group` values.
        - Serve client requests that are routed to apps; require access to
          paths and namespaces you configure for the app.

   You can check all of the above on your system when Unit is running:

   .. subs-code-block:: console

      $ ps aux | grep unit

            ...
            root   ... unit: main v|version|
            unit   ... unit: controller
            unit   ... unit: router
            unit   ... unit: "front" application

   The important outtake here is to understand that Unit's non-privileged
   processes don't require running as **root**.  Instead, they should have
   the minimal privileges required to operate, which so far means the ability
   to open connections and access the application code and the static files
   shared during routing.


.. _security-logs:

***************************
Prune Debug and Access Logs
***************************

**Rationale**: Unit stores potentially sensitive data in its general and access
logs; their size can also become a concern if debug mode is enabled.

**Actions**: Secure access to the logs and ensure they don't exceed the allowed
disk space.

.. nxt_details:: Details
   :hash: sec-logs

   Unit can maintain two different logs:

   - A general-purpose log that is enabled by default and can be switched to
     debug mode for verbosity.

   - An access log that is off by default but can be enabled via the control
     API.

   If you enable debug-mode or access logging, rotate these logs with tools
   such as :program:`logrotate` to avoid overgrowth.  A sample
   :program:`logrotate` `configuration
   <https://man7.org/linux/man-pages/man8/logrotate.8.html#CONFIGURATION_FILE_DIRECTIVES>`_:

   .. code-block:: none

      :nxt_ph:`/path/to/unit.log <Use a real path in your configuration>` {
          daily
          missingok
          rotate 7
          compress
          delaycompress
          nocreate
          notifempty
          su root root
          postrotate
              if [ -f :nxt_ph:`/path/to/unit.pid <Use a real path in your configuration>` ]; then
                  :nxt_hint:`/bin/kill <Signals Unit to reopen the log>` -SIGUSR1 `cat :nxt_ph:`/path/to/unit.pid <Use a real path in your configuration>``
              fi
          endscript
      }

   To figure out the log and PID file paths:

   .. subs-code-block:: console

      $ unitd -h

            ...
            --pid FILE           set pid filename
                                 default: ":nxt_ph:`/default/path/to/unit.pid <Build-time setting, can be overridden>`"

            --log FILE           set log filename
                                 default: ":nxt_ph:`/default/path/to/unit.log <Build-time setting, can be overridden>`"

      $ ps ax | grep unitd

            ... unit: main v|version| [... --pid :nxt_ph:`/path/to/unit.pid <Make sure to check for runtime overrides>` --log :nxt_ph:`/path/to/unit.log <Make sure to check for runtime overrides>` ...]

   Another issue is the logs' accessibility.  Logs are opened and updated by
   the :ref:`main process <security-apps>` that usually runs as **root**.
   However, to make them available for a certain consumer, you may need to
   enable access for a dedicated user that the consumer runs as.

   Perhaps, the most straightforward way to achieve this is to assign log
   ownership to the consumer's account.  Suppose you have a log utility running
   as **log_user:log_group**:

   .. code-block:: console

      # :nxt_hint:`chown <Assign ownership to the log user>` log_user:log_group :nxt_ph:`/path/to/unit.log <If it's overridden, use the runtime setting>`

   .. code-block:: console

      # :nxt_hint:`curl <Enable access log in the Unit configuration at the given path>` -X PUT -d '":nxt_ph:`/path/to/access.log <Use a real path in your configuration>`"'  \
             --unix-socket :nxt_ph:`/path/to/control.unit.sock <Path to Unit's control socket>` \
             http://localhost/config/access_log

            {
                "success": "Reconfiguration done."
            }

   .. code-block:: console

      # :nxt_hint:`chown <Assign ownership to the log user>` log_user:log_group :nxt_ph:`/path/to/access.log <Use a real path in your command>`

   If you change the log file ownership, adjust your :program:`logrotate`
   settings accordingly:

   .. code-block:: none

      :nxt_ph:`/path/to/unit.log <Use a real path in your configuration>` {
          ...
          su log_user log_group
          ...
      }

   .. note::

      As usual with permissions, different steps may be required if you use
      ACLs.


.. _security-seccomp-docker:

*******************************
Docker: Seccomp Profile (AF_ALG)
*******************************

**Rationale**: CVE-2026-31431 is a local privilege escalation in the Linux
kernel ``algif_aead`` component, reachable via the ``AF_ALG`` socket interface
(domain 38).  It affects kernels 4.14 and later and requires only local user
access — including from within a container.  FreeUnit images ship a seccomp
profile that blocks the direct ``socket(AF_ALG, ...)`` call at the kernel level
regardless of whether the host kernel is patched (see the caveat below for the
``socketcall(2)`` multiplexer path).

**Actions**: Pass the bundled profile at ``docker run`` time:

.. code-block:: console

   # docker run --security-opt seccomp=pkg/docker/seccomp-no-af-alg.json \
         ghcr.io/freeunitorg/freeunit:latest-php8.4

The profile is also included inside every image at
``/usr/share/unit/seccomp-no-af-alg.json`` for reference.  To extract it
without cloning the repository:

.. code-block:: console

   # CNAME=$(docker create ghcr.io/freeunitorg/freeunit:latest-minimal)
   # docker cp "$CNAME":/usr/share/unit/seccomp-no-af-alg.json ./seccomp-no-af-alg.json
   # docker rm "$CNAME"
   # docker run --security-opt seccomp=./seccomp-no-af-alg.json \
         ghcr.io/freeunitorg/freeunit:latest-php8.4

.. note::

   The profile uses ``defaultAction: SCMP_ACT_ALLOW`` with a single explicit
   deny rule, for AF_ALG (38).  The ``SCMP_ACT_ALLOW`` default is intentional:
   libseccomp ORs multiple ``NE`` conditions on the same argument index,
   making an ``SCMP_ACT_ERRNO``-default approach unreliable for this use
   case.  The profile is deliberately single-purpose — passing it via
   ``--security-opt`` replaces Docker's default profile entirely, so it
   blocks AF_ALG and nothing else.

.. warning::

   The profile filters the direct ``socket(2)`` syscall only — it does **not**
   filter the ``socketcall(2)`` multiplexer.  On i386, s390x, and other
   architectures that route socket creation through ``socketcall`` — and on
   x86-64 through the i386 ``int $0x80`` entry — a process can still open an
   ``AF_ALG`` socket, so this seccomp profile alone does not fully block
   CVE-2026-31431 on those paths.  Close them with an AppArmor (``deny network
   alg``) or SELinux (``alg_socket``) rule, or with the host-level workaround
   below, which disables the vulnerable ``algif_aead`` module outright and is
   effective regardless of architecture.  See :ref:`security-isolation-docker`
   for the full cross-LSM analysis.

**Host-level workaround** (unpatched kernels, applies outside Docker too):

.. code-block:: console

   # echo "install algif_aead /bin/false" > /etc/modprobe.d/disable-algif.conf
   # rmmod algif_aead 2>/dev/null || true

**Verify** the profile is active (AF_ALG socket must be denied):

.. code-block:: console

   # docker run --rm \
         --security-opt seccomp=pkg/docker/seccomp-no-af-alg.json \
         ghcr.io/freeunitorg/freeunit:latest-minimal \
         python3 -c "import socket; socket.socket(socket.AF_ALG, socket.SOCK_SEQPACKET)"
   # Expected: PermissionError: [Errno 1] Operation not permitted


.. _security-isolation:

***************************
Add Restrictions, Isolation
***************************

**Rationale**: If the underlying OS allows, Unit provides features that create an
additional level of separation and containment for your apps, such as:

- Share :ref:`path restrictions <configuration-share-path>`
- Namespace and file system root :ref:`isolation
  <configuration-proc-mgmt-isolation>`

**Actions**: For more details, see our blog posts on `path restrictions
<https://www.nginx.com/blog/nginx-unit-updates-for-summer-2021-now-available/#Static-Content:-Chrooting-and-Path-Restrictions>`__,
`namespace <https://www.nginx.com/blog/application-isolation-nginx-unit/>`_ and
`file system <https://www.nginx.com/blog/filesystem-isolation-nginx-unit/>`_
isolation.

.. _security-isolation-docker:

.. nxt_details:: Running Isolation in a Container (Docker)
   :hash: sec-isolation-docker

   To set up its :ref:`namespaces <configuration-proc-mgmt-isolation>`,
   **rootfs**, and mounts, Unit's **isolation** feature calls a handful of
   privileged syscalls in the app process: **unshare(2)** (for
   **CLONE_NEWUSER**, **CLONE_NEWPID**, **CLONE_NEWNET**, **CLONE_NEWUTS**,
   **CLONE_NEWNS**, and **CLONE_NEWCGROUP**), **mount(2)**, **umount2(2)**,
   `pivot_root(2)
   <https://man7.org/linux/man-pages/man2/pivot_root.2.html>`__,
   **chroot(2)** (used for a **rootfs** configured without a mount
   **namespace**), and **openat2(2)** (to resolve mount targets beneath
   **rootfs** without following symlinks out of it).

   Under Docker's *default* container settings these operations fail with
   **EPERM**.  Three independent layers gate them, and an **isolation**
   config with a **rootfs** must satisfy all three:

   **1. Capability.**  Default containers drop **CAP_SYS_ADMIN**, which
   **unshare(CLONE_NEW*)**, **mount**, **umount2**, and **pivot_root** all
   require; grant it with **--cap-add SYS_ADMIN**.  A **rootfs** bind-mounts
   the language runtime, **procfs**, and **tmpfs** by default (the
   **automount** option), so **mount** and **openat2** are used even for a
   chroot-only **rootfs** — not only when a mount **namespace** is requested.

   **2. Seccomp.**  Docker's default profile denies most syscalls
   (``defaultAction: SCMP_ACT_ERRNO``) but allows **unshare**, **mount**,
   and **umount2** once the container holds **CAP_SYS_ADMIN**, plus
   **chroot** and **openat2** (the latter only on Docker 20.10.10 and
   newer).  The one syscall it never allows is **pivot_root**, so a
   **rootfs** that pivots (one with a mount **namespace**,
   ``"namespaces": {"mount": true}``) stays blocked.  Two ways to unblock
   **pivot_root**:

   - *Preferred* — copy Docker's default profile and add a **pivot_root**
     ``allow`` rule, keeping its whole denylist intact.  Check that the
     profile you copy carries the :ref:`AF_ALG mitigation
     <security-seccomp-docker>` (see below).
   - *Simplest* — run the bundled ``seccomp-no-af-alg.json`` itself.  It
     permits every isolation syscall and denies AF_ALG, but because it is
     ``defaultAction: SCMP_ACT_ALLOW`` it forfeits the rest of Docker's
     default seccomp denylist — so prefer it only where the capability and
     AppArmor layers already constrain the container.

   Whether a copied default profile denies AF_ALG depends on the Docker
   version it came from.  **Docker 29.4.2** and newer allow ``socket`` only
   for domains outside the 38–40 range — three rules, ``arg0 < 38``,
   ``arg0 == 39``, ``arg0 > 40`` — which denies both AF_ALG (38) and
   AF_VSOCK (40).  Older profiles allow ``socket`` under a single
   ``arg0 != AF_VSOCK`` condition, which leaves AF_ALG reachable.  If yours
   is the older shape, **replace** that ``socket`` rule with the three range
   rules; appending an AF_ALG deny rule beside it does *not* work, because
   seccomp evaluation is first-match-wins and the inherited allow rule still
   matches AF_ALG (`moby#52494
   <https://github.com/moby/moby/pull/52494>`__).  Copying from a 29.4.2+
   profile avoids the edit entirely.

   Avoid **--security-opt seccomp=unconfined** (turns off all filtering,
   AF_ALG deny included) and **--privileged** (every capability, no seccomp).

   **3. AppArmor.**  On hosts with AppArmor enabled — the default on Debian
   and Ubuntu — Docker also applies its **docker-default** profile, which
   mediates mount operations independently of capabilities and seccomp: it
   denies **mount** and grants no **pivot_root** rule (only **umount**), so
   both stay blocked.  A **rootfs** therefore still fails with **EPERM** — at
   **mount** for its automounts, and, when it pivots, at **pivot_root** too.
   Allow **both** with a custom AppArmor profile (preferred), or relax the
   policy with **--security-opt apparmor=unconfined** (blunter, comparable to
   **seccomp=unconfined**).  A **mount** or **pivot_root** denial while the
   capability and seccomp are already in place points at AppArmor.

   Combining the three, the *simplest* working recipe for a pivoting
   **rootfs** — the bundled profile plus a relaxed AppArmor policy, with the
   trade-offs noted above — is:

   .. code-block:: console

      # docker run --cap-add SYS_ADMIN \
            --security-opt seccomp=pkg/docker/seccomp-no-af-alg.json \
            --security-opt apparmor=unconfined \
            ghcr.io/freeunitorg/freeunit:latest-minimal

   For a hardened setup, swap in a Docker-default-derived seccomp profile
   (gate 2) and a custom AppArmor profile (gate 3) instead of the bundled
   profile and ``apparmor=unconfined``.

   .. note::

      On **Docker 29.4.3** and newer, relaxing AppArmor also relaxes part of
      the AF_ALG mitigation.  29.4.2 denied the ``socketcall(2)`` multiplexer
      in seccomp, but 29.4.3 reverted that (it broke i386 workloads) and
      moved AF_ALG coverage for that path to its AppArmor (``deny network
      alg``) and SELinux rules.  Neither Docker's current default profile nor
      the bundled ``seccomp-no-af-alg.json`` filters ``socketcall``, so with
      **apparmor=unconfined** a process can reach AF_ALG through it —
      including from a 64-bit binary via the i386 ``int $0x80`` entry.  A
      custom AppArmor profile that keeps ``deny network alg`` closes this;
      ``apparmor=unconfined`` does not.

      On SELinux hosts, don't assume the SELinux half covers it either: the
      ``alg_socket`` rule applies only if the daemon runs with
      ``selinux-enabled: true`` (in ``daemon.json`` or via
      ``--selinux-enabled``), which is **not** the default.  Without it, and
      with AppArmor absent or unconfined, the ``socketcall`` path to AF_ALG
      stays open whichever of these seccomp profiles you use.

   A chroot-only **rootfs** drops the ``"namespaces": {"mount": true}``
   requirement, so **pivot_root** is never called.  With the automounts left
   at their defaults it still uses **mount**, so it needs the same
   capability, a seccomp policy allowing **mount**/**openat2**, and, on
   AppArmor hosts, the AppArmor step above.

   Turning *all three* automounts off, however, removes every **mount** —
   and with it every reason to widen the container:

   .. code-block:: json

      {
          "rootfs": ":nxt_ph:`/path/to/rootfs <Path to the prepared root file system>`",
          "automount": {
              "language_deps": false,
              "tmpfs": false,
              "procfs": false
          }
      }

   That leaves **chroot(2)** as the only privileged call, and Docker's
   defaults already allow it: **CAP_SYS_CHROOT** is in the default capability
   set, and the default seccomp profile permits **chroot** for containers
   holding it.  Such a **rootfs** needs no extra **docker run** flags —
   no **SYS_ADMIN**, no seccomp or AppArmor changes.  The trade-off is that
   the **rootfs** must already contain the language runtime, since
   **language_deps** is what bind-mounts it in.

   .. note::

      For any **isolation** config that mounts or unshares — that is,
      everything above except the automounts-off case — **--cap-add
      SYS_ADMIN** is required regardless of the seccomp and AppArmor choices:
      a permissive profile alone doesn't grant the capability, so the app
      still fails with **EPERM** if only the seccomp or AppArmor option is
      changed.

   .. note::

      This friction is specific to Docker's default confinement, not to
      **isolation** itself.  On bare metal — for example, Debian Trixie,
      which leaves unprivileged user namespaces enabled by default — Unit's
      **isolation** feature works with no special flags, since there's no
      seccomp profile, AppArmor policy, or dropped capability standing in
      the way.
