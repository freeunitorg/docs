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
                      ":nxt_hint:`uri <Denies access to certain types of files and directories best kept hidden, allows access to well-known locations according to RFC 5785.  Matched case-sensitively, so these patterns only cover lowercase names>`": [
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

      The order of the routes above is load-bearing.  Keep the **share**
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

   .. warning::

      The **uri** patterns above are matched **case-sensitively**, so
      **\*.php** does not match **/sites/default/settings.PHP**.  Unit's MIME
      lookup, by contrast, is case-insensitive, so the **share** still serves
      that request as **application/x-httpd-php**.  On a case-insensitive
      filesystem — APFS on macOS, Docker Desktop bind mounts, SMB/CIFS — the
      file exists under that name and is returned in full, database password
      included.

      This is not limited to PHP.  Every pattern in a **uri** array is
      matched the same way, so the 32-entry deny list above, which is
      lowercase throughout, misses **/core/composer.JSON**,
      **/WEB.CONFIG**, an uppercase **.YML** and the rest; the trailing
      **share** then serves them.

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
