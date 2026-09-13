.. |app| replace:: Drupal
.. |mod| replace:: PHP
.. |app-preq| replace:: prerequisites
.. _app-preq: https://www.drupal.org/docs/system-requirements
.. |app-link| replace:: core files
.. _app-link: https://www.drupal.org/docs/develop/using-composer/manage-dependencies#download-core

######
Drupal
######

To run the `Drupal <https://www.drupal.org>`_ content management system using
Unit:

#. .. include:: ../include/howto_install_unit.rst

#. .. include:: ../include/howto_install_prereq.rst

#. .. include:: ../include/howto_install_app.rst

#. .. include:: ../include/howto_change_ownership.rst

#. Next, :ref:`prepare <configuration-php>` the |app| configuration for Unit.
   The default **.htaccess** `scheme <https://github.com/drupal/drupal>`__
   in a |app| installation roughly translates into the following (use real
   values for **share** and **root**):

   .. code-block:: json

      {
          "listeners": {
              "*:80": {
                  "pass": "routes"
              }
          },

          "routes": [
              {
                  "match": {
                      ":nxt_hint:`uri <Denies access to certain types of files and directories best kept hidden, allows access to well-known locations according to RFC 5785.  Matched case-sensitively: the lowercase patterns do not cover uppercase names, and the five capitalised CVS entries do not cover lowercase ones>`": [
                          "!*/.well-known/*",
                          "/vendor/*",
                          "/core/profiles/demo_umami/modules/demo_umami_content/default_content/*",
                          "*.engine",
                          "*.inc",
                          "*.install",
                          "*.make",
                          "*.module",
                          "*.po",
                          "*.profile",
                          "*.sh",
                          "*.theme",
                          "*.tpl",
                          "*.twig",
                          "*.xtmpl",
                          "*.yml",
                          "*/.*",
                          "*/Entries*",
                          "*/Repository",
                          "*/Root",
                          "*/Tag",
                          "*/Template",
                          "*/composer.json",
                          "*/composer.lock",
                          "*/web.config",
                          "*sql",
                          "*.bak",
                          "*.orig",
                          "*.save",
                          "*.swo",
                          "*.swp",
                          "*~"
                      ]
                  },

                  "action": {
                      "return": 404
                  }
              },
              {
                  "match": {
                      ":nxt_hint:`uri <Allows direct access to core PHP scripts>`": [
                          "/core/authorize.php",
                          "/core/core.api.php",
                          "/core/globals.api.php",
                          "/core/install.php",
                          "/core/modules/statistics/statistics.php",
                          "~^/core/modules/system/tests/https?\\.php",
                          "/core/rebuild.php",
                          "/update.php",
                          "/update.php/*"
                      ]
                  },

                  "action": {
                      "pass": "applications/drupal/direct"
                  }
              },
              {
                  "match": {
                      ":nxt_hint:`uri <Denies access to PHP scripts other than index.php.  These are globs, matched case-sensitively: *.php does not match .PHP>`": [
                          "!/index.php*",
                          "*.php"
                      ]
                  },

                  "action": {
                      "return": 404
                  }
              },
              {
                  "action": {
                      ":nxt_hint:`share <Serves static files>`": ":nxt_ph:`/path/to/app/web <Path to the web/ directory; use a real path in your configuration>`$uri",
                      "fallback": {
                          "pass": ":nxt_hint:`applications/drupal/index <Funnels all requests to index.php>`"
                      }
                  }
              }
          ],

          "applications": {
              "drupal": {
                  "type": "php",
                  "targets": {
                      "direct": {
                          "root": ":nxt_ph:`/path/to/app/web/ <Path to the web/ directory; use a real path in your configuration>`"
                      },

                      "index": {
                          "root": ":nxt_ph:`/path/to/app/web/ <Path to the web/ directory; use a real path in your configuration>`",
                          "script": ":nxt_hint:`index.php <All requests are handled by a single script>`"
                      }
                  }
              }
          }
      }

   .. warning::

      The order of these routes matters.  Keep the **share**
      action last.  A **share** serves any file it can reach, PHP scripts
      included, as a plain download; it never hands them to the application.
      The steps above are what keep it from reaching them: the first
      **return: 404** hides configuration and library files, and the second
      rejects every **.php** URI other than **/index.php**.  If you reorder
      these steps, or add a "static files first" **share** ahead of them, a
      request for **/sites/default/settings.php** returns the file verbatim
      with your database password in the body.

      Do not try to fix a reordered configuration with **"types":
      ["!application/x-httpd-php"]** on the **share**.  A **types** mismatch
      does not resume routing at the next step: it takes the share's own
      **fallback**, which here is **applications/drupal/index**, so
      **/core/install.php** and **/update.php** would stop reaching the
      **direct** target.

      That exclusion also does less than it appears to.  It is matched against
      the MIME type Unit looks up from the file's extension, and an extension
      the table does not know produces no type at all, which no
      **application/x-httpd-php** pattern excludes.  **.php5**, **.phtml** and
      **.phps** are all served as source by a share that refuses **.php** --
      the last of those being one an administrator may place deliberately,
      expecting a source-highlighting handler.

      Drupal's PHP also lives in **.module**, **.inc**, **.install**,
      **.theme** and **.profile** files, and none of those is in the table
      either.  In the configuration above they are denied by the first
      **return: 404** step, on the URI.  That is the step doing the work, not
      **types** -- so a configuration that drops the deny list and relies on
      **types** instead serves all five as source.

      A bare **"!"** alongside it denies the empty type and closes that half:
      an empty pattern matches only a file whose extension is not in the
      table, so **text/css** and the rest are still served.  Measured on
      1.36.x: with **["!application/x-httpd-php"]** a **.phtml** file is
      served 200; with **["!application/x-httpd-php", "!"]** it is 404, and
      **.css** and **.png** are unchanged.

      It does nothing for the directory form.  With **index** set, the same
      two patterns still serve the index file's source for a request ending
      in **/**, because that path never reaches the **types** test at all.
      An allow-list behaves identically here.  Neither is a substitute for
      keeping the **share** last.

      If you want **types** on the trailing **share** as a safety net, write
      it as an allow-list of what the share is *for*, not as a list of what to
      refuse::

          "types": ["image/*", "text/css", "application/javascript", "font/*"]

      Add the types your own site serves -- **application/json**,
      **text/plain**, the XML types, **application/pdf**, **video/**\* and so
      on -- because an allow-list fails closed: a type you leave out is not
      served, it takes the share's **fallback**.  In the last position the **fallback**
      consequence above is what you want rather than a problem — a request
      that is not static takes **applications/drupal/index**, which is where
      a non-static path belongs.  This does not replace the route order; the
      **return: 404** steps are still what keep the share from reaching
      **settings.php** at all.

   .. warning::

      The **uri** patterns above are matched **case-sensitively**, so
      **\*.php** does not match **/sites/default/settings.PHP**.  Unit's MIME
      lookup, by contrast, is case-insensitive, so the **share** still serves
      that request as **application/x-httpd-php**.  On a case-insensitive
      filesystem — APFS on macOS, Docker Desktop bind mounts, SMB/CIFS — the
      file exists under that name and is returned in full, database password
      included.

      This is not limited to PHP.  Every pattern in a **uri** array is
      matched the same way, so the deny list above misses
      **/core/composer.JSON**, **/WEB.CONFIG**, an uppercase **.YML** and the
      rest; the trailing **share** then serves them.  The list is not
      uniformly lowercase either: **\*/Entries\***, **\*/Repository**,
      **\*/Root**, **\*/Tag** and **\*/Template** are capitalised, and
      those five match only that exact spelling — a lowercase **/cvs/root**
      is not denied.

      The dependable fix is to keep the document root on a case-sensitive
      filesystem, which is what a Linux production host gives you by
      default.  Unit has no per-route case-insensitivity switch: closing the
      gap in the configuration means replacing each glob with a regular
      expression, for example ``"~(?i)\\.php$"`` in place of ``"*.php"``,
      and doing that for one pattern only moves the exposure to the other
      31.  Rewriting all of them is an option, but treat the caveat, not the
      **.php** entry, as the thing to act on.

      This configuration comes from the upstream Unit documentation, which is
      archived and no longer updated, so copies of it in the wild still carry
      the original claim that the rule denies "any PHP scripts".  See
      `freeunit#323 <https://github.com/freeunitorg/freeunit/issues/323>`__.

   .. note::

      The difference between the **pass** targets is their usage of
      the **script** :ref:`setting <configuration-php>`:

      - The **direct** target runs the **.php** script from the
        URI or **index.php** if the URI omits it.

      - The **index** target specifies the **script** that Unit
        runs for *any* URIs the target receives.

#. .. include:: ../include/howto_upload_config.rst

   After a successful update, browse to http://localhost and `set up
   <https://www.drupal.org/docs/develop/using-composer/manage-dependencies#s-install-drupal-using-the-standard-web-interface>`_
   your |app| installation:

  .. image:: ../images/drupal.png
     :width: 100%
     :alt: Drupal on Unit - Setup Screen

************************
Cron and background work
************************

Applies to |app| 10 and later.  Two different code paths reach the same
result, so the version only changes which one you read.

From 11.4, |app| starts up through `symfony/runtime
<https://github.com/symfony/runtime>`__.  Its **HttpKernelRunner** sends the
response.  Then it calls `fastcgi_finish_request() <https://www.php.net/manual/function.fastcgi-finish-request.php>`__.  Only after that does it
call **$kernel->terminate()**.  See `drupal.org #3313404
<https://www.drupal.org/i/3313404>`__.

On |app| 10 and 11.0-11.3, **index.php** calls **$response->send()** and then
**$kernel->terminate()**.  **Response::send()** calls
**fastcgi_finish_request()** itself when that function exists, and the PHP
module provides it.

Either way, anything a module does in the terminate phase runs after the client
already has its response.

What this means on Unit
=======================

Unit's PHP module implements **fastcgi_finish_request()**.  When PHP calls it,
the module tells the router that the request is complete, and PHP goes on
running.  Two things follow.  Both were observed:

- The router counts the process as idle, so **processes.max** reports more
  capacity than you really have.

- The idle clock for the process starts.  The idle reaper
  (**idle_timeout**, default 15 seconds) can then send **QUIT** to the process
  and remove it while the job is still running.

The job itself still finishes, because Unit cannot interrupt a PHP script.  But
a request that is already queued to that process can end up with no process to
serve it, and Unit starts no replacement.  This was observed, not derived: in
one measurement such a request ran about 300 seconds later, when other traffic
started the application again.  It is tracked as `issue #321
<https://github.com/freeunitorg/freeunit/issues/321>`__, which also records the
conditions of that measurement.

Such a request waits; it does not fail.  No 503 arrived in that measurement.
Unit starts **limits.timeout** when it hands a request to a process.  A
request that is still waiting for a process has no timer running.
Note also that this option defaults to 0, which starts no timer at all.

.. _howto-drupal-automated-cron:

The **automated_cron** module
=============================

A stock |app| install enables **automated_cron**.  This module runs cron in the
terminate phase of a random visitor's request, at most once every **10800**
seconds (3 hours).  Core's cron service raises the time limit for that run to
240 seconds (**Environment::setTimeLimit(240)** in
**core/lib/Drupal/Core/Cron.php**).  With **"processes": {"max": 1}**, the site
is down for as long as the run takes.

Uninstall **automated_cron**, or set its interval to 0, and run cron outside
the request:

.. code-block:: console

   $ drush cron

Run this from a systemd timer or from system cron.  Handle queues the same way,
with **drush queue:run**.

If cron must stay in-request
============================

Two settings make the problem smaller:

- **"spare": 1** keeps one process warm.  The idle reaper then never looks at
  the last idle process.

- An **idle_timeout** longer than the slowest job.

Treat both as mitigations, not guarantees.  They come from a single observation
in a run that was measuring something else.  No controlled test confirmed them.

**"spare": 1** has a measured cost.  When the configuration changes, Unit logs
lines such as::

   [alert] sendmsg(...) failed (32: Broken pipe)

This is the prototype writing to a spare process that has already exited.  The
processes still exit 0 and no request is affected, so nothing breaks, but these
lines can trigger log-based alerts.

Bounding a job
==============

Use `pcntl_alarm() <https://www.php.net/manual/function.pcntl-alarm.php>`__ to bound a job.  `set_time_limit() <https://www.php.net/manual/function.set-time-limit.php>`__ does not bound it:
it does not stop a blocking sleep or a blocking I/O call.

**pcntl_alarm()** only schedules the **SIGALRM** signal.  Four things must also
be true for it to stop the job.

- The **pcntl** extension must be loaded.
- A handler must be registered with `pcntl_signal() <https://www.php.net/manual/function.pcntl-signal.php>`__.
- Signal delivery must be asynchronous, through `pcntl_async_signals(true) <https://www.php.net/manual/function.pcntl-async-signals.php>`__.
  Otherwise the handler runs only at the next tick.
- The handler must end the job itself.  A handler that returns does not stop
  anything: the job continues from where the signal interrupted it.

The third argument to **pcntl_signal()** is **restart_syscalls**.  When it is
**true**, the system resumes a call that a signal interrupted, and a blocking
call inside an extension or a database driver can run past the bound.  For
**SIGALRM** PHP already defaults it to **false**, so the example passes
**false** to state that rather than to change it.  Pass **false** explicitly
for any other signal you handle this way.

Release |app|'s cron lock in the handler.  If you do not, the lock stays held
and cron is skipped for up to 900 seconds.

Cancel the alarm when the job finishes normally.  An alarm that is still
pending fires during the next request on the same process.

A complete pattern::

   pcntl_async_signals(TRUE);

   pcntl_signal(SIGALRM, function () {
     \Drupal::lock()->release('cron');
     exit(1);
   }, FALSE);

   pcntl_alarm(240);

   try {
     \Drupal::service('cron')->run();
   }
   finally {
     pcntl_alarm(0);
   }

**exit()** ends the process.  Unit starts a new one for the next request.  To
keep the process, throw from the handler instead and catch the exception
outside the **try** block above, but only if every library in the job is
exception-safe.

What happens on deploy
======================

A running job survives idle reaping, a configuration **PUT**, and **SIGTERM**
to **unitd**.  In all three cases Unit sends **QUIT** as a port message, and a
process only reads its port between requests.  Unit never turns that
message into a signal for a process that has reported that it is ready.

So a job finishes by default.  But it has no timeout and no upper limit: a
runaway job keeps an orphaned process alive for as long as it runs.  That
process does not appear in **/status**, and it is no longer part of the
configuration.  Unit does not drain background jobs on deploy.  It only never
interrupts them.

.. warning::

   **docker stop** sends **SIGTERM** and then, after a grace period of 10
   seconds by default, **SIGKILL**.  The second signal does kill a running job.

.. warning::

   On |app| 11.4 and later, the runner skips **fastcgi_finish_request()** when
   debug mode is on (**APP_DEBUG**).  The request then stops detaching, with no
   error and no log line, and the visitor waits for the terminate phase again.

   On |app| 10 and 11.0-11.3 there is no such switch.  **index.php** calls
   **$response->send()**, which calls **fastcgi_finish_request()** whenever the
   function exists.  Debug mode does not change this.  On those versions the
   terminate phase always runs after the response, so the behaviour described
   above always applies.
