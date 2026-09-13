.. |app| replace:: WordPress
.. |mod| replace:: PHP 8.1+
.. |app-preq| replace:: prerequisites
.. _app-preq: https://developer.wordpress.org/advanced-administration/before-install/
.. |app-link| replace:: core files
.. _app-link: https://wordpress.org/download/

#########
WordPress
#########

To run the `WordPress <https://wordpress.org>`__ content management system
using Unit:

#. .. include:: ../include/howto_install_unit.rst

   |app| core supports older PHP versions, but 8.1 is the lowest branch that
   still receives security fixes; current |app| releases recommend 8.3 or
   later.  The PHP version Unit's module was built against is what your site
   runs on.

#. .. include:: ../include/howto_install_prereq.rst

#. .. include:: ../include/howto_install_app.rst

#. Update the **wp-config.php** `file
   <https://developer.wordpress.org/advanced-administration/wordpress/wp-config/>`_
   with your database settings and other customizations.

#. .. include:: ../include/howto_change_ownership.rst

#. Next, :ref:`prepare <configuration-php>` the |app| configuration for Unit
   (use real values for **share** and **root**):

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
                      ":nxt_hint:`uri <Denies access to dotfiles, editor and backup leftovers, and files WordPress ships but never needs to serve; allows well-known locations per RFC 5785>`": [
                          "!*/.well-known/*",
                          "*/.*",
                          "/wp-config*.php",
                          "/readme.html",
                          "/license.txt",
                          "*.bak",
                          "*.orig",
                          "*.save",
                          "*.swo",
                          "*.swp",
                          "*.sql",
                          "*~"
                      ]
                  },

                  "action": {
                      "return": 404
                  }
              },
              {
                  "match": {
                      ":nxt_hint:`uri <Denies PHP execution in the trees that accept uploads or need no direct entry points>`": [
                          "/wp-content/*.php",
                          "/wp-content/*.php/*",
                          "/wp-includes/*.php",
                          "/wp-includes/*.php/*"
                      ]
                  },

                  "action": {
                      "return": 404
                  }
              },
              {
                  "match": {
                      "uri": [
                          "*.php",
                          "*.php/*",
                          "/wp-admin/"
                      ]
                  },

                  "action": {
                      "pass": "applications/wordpress/direct"
                  }
              },
              {
                  "action": {
                      ":nxt_hint:`share <Serves matching static files>`": ":nxt_ph:`/path/to/app <Path to the application directory; use a real path in your configuration>`$uri",
                      ":nxt_hint:`types <Serves only what the share is for; an unmapped extension fails closed>`": [
                          "image/*",
                          "text/css",
                          "application/javascript",
                          "font/*"
                      ],
                      "fallback": {
                          "pass": "applications/wordpress/index"
                      }
                  }
              }
          ],

          "applications": {
              "wordpress": {
                  "type": "php",
                  "targets": {
                      "direct": {
                          "root": ":nxt_ph:`/path/to/app/ <Path to the application directory; use a real path in your configuration>`"
                      },

                      "index": {
                          "root": ":nxt_ph:`/path/to/app/ <Path to the application directory; use a real path in your configuration>`",
                          "script": "index.php"
                      }
                  }
              }
          }
      }

   .. warning::

      The order of the routes above is load-bearing.  The steps that return
      404 must stay *before* the **share** action: **.php** is a known
      :ref:`MIME type <configuration-share-mime>`, so a **share** that is
      allowed to serve PHP files emits them as source text instead of running
      them.  Reorder these steps, or add a "static files first" **share**
      ahead of them, and a request for **/wp-config.php** hands the client
      your database password — unless the **types** option is there to refuse
      it.  Keep both: the ordering and the **types** guard.

      URI patterns are **case-sensitive**.  On a case-insensitive filesystem
      (macOS, Windows, a casefolded **ext4** directory) a request for
      **/WP-CONFIG.PHP** matches none of the deny steps and reaches the
      **share**.  There **types** does hold, because Unit's MIME lookup is
      case-insensitive even though URI matching is not, so the extension
      still resolves.  Note what "holds" means: the request is not denied,
      it falls through to **index.php** like any other unmatched URI.
      Nothing leaks, but do not read a 404 into it.

      Do not lean on **types** further than that.  It is matched against the
      MIME type Unit derives from the extension, and only **.php** is in the
      built-in table — **.phtml**, **.php5**, **.inc** and **.module** are
      not.  An extension Unit has no type for produces an empty value, and a
      negated pattern does not exclude an empty value, so a refuse-list of
      the **"!application/x-httpd-php"** shape serves every one of them as
      source.  The allow-list above fails closed instead: an extension Unit
      has never heard of does not match, so it is not served.  In the
      trailing position the **fallback** is what you want for anything that
      is not static.

      The **wp-content** step matters just as much.  Without it, the
      **\*.php** step below runs *any* PHP file under the document root,
      including anything written into **wp-content/uploads/** by a plugin, a
      theme, or an attacker who reached the media library.

      One gap no **types** rule closes: **types** is not applied when the
      share path resolves to a **directory**.  Unit then takes the filename
      from the share's own **index** option and serves it without testing
      its type, so a share carrying **"index": "index.php"** — a common
      addition to a WordPress configuration — answers a request for a
      directory with the *source* of that **index.php**.  Measured on
      1.36.x: **/sub/index.php** is refused by the allow-list while
      **/sub/** returns 200 with the file's contents and a
      **Content-Type: application/x-httpd-php** header.  The configuration
      above does not set **index** on the share and so is not affected;
      leave it unset, and let the route table decide what reaches PHP.

   .. note::

      The difference between the **pass** targets is their usage of the
      **script** :ref:`setting <configuration-php>`:

      - The **direct** target runs the **.php** script from the URI or
        defaults to **index.php** if the URI omits it.

      - The **index** target specifies the **script** that Unit runs
        for *any* URIs the target receives.

   .. note::

      If your site does not use the XML-RPC interface (Jetpack, the mobile
      apps, and some remote publishing clients do), add **/xmlrpc.php** to
      the first deny list: it is a standing brute-force amplification target.

      Restricting **/wp-admin/\*** with a **source** :ref:`match
      <configuration-routes-matching>` is worth doing whenever the admins
      come from known addresses — but exclude
      **!/wp-admin/admin-ajax.php** and **!/wp-admin/admin-post.php** from
      that match.  Many themes and plugins call those two from logged-out
      visitors, and blocking them breaks the public front end.

      Denying PHP under all of **wp-content** is stricter than WordPress's
      own hardening guide, which only covers **wp-content/uploads**.  It is
      the right default, but a few plugins still ship directly-addressed PHP
      endpoints; if one of yours does, allow it by name in the same list —
      a negated pattern such as **!/wp-content/plugins/some-plugin/api.php**
      takes precedence over the positive patterns around it.

   .. note::

      This recipe is for a single-site installation.  Sub-directory multisite
      additionally needs the **/<site>/wp-{admin,includes,content}/** and
      **/<site>/files/** rewrites that **.htaccess** performs; sub-domain
      multisite works as written.

#. .. include:: ../include/howto_upload_config.rst

   After a successful update, browse to http://localhost and `set up
   <https://developer.wordpress.org/advanced-administration/before-install/howto-install/>`_
   your |app| installation:

   .. image:: ../images/wordpress.png
      :width: 100%
      :alt: WordPress on Unit - Setup Screen

   .. note::

      The resulting URI scheme will affect your WordPress configuration;
      updates may require `extra steps
      <https://wordpress.org/documentation/article/changing-the-site-url/>`_.

Production notes
****************

The configuration above covers the request path.  A few settings outside it
account for most of the surprises a live |app| site runs into:

- **Media uploads fail with a 413.**  The global
  :ref:`settings.http.max_body_size <configuration-stngs>` defaults to 8 MB
  and is independent of PHP's own **upload_max_filesize**.  Raise both:

  .. code-block:: json

     {
         "settings": {
             "http": {
                 "max_body_size": 104857600
             }
         },

         "applications": {
             "wordpress": {
                 "options": {
                     "admin": {
                         "memory_limit": "256M",
                         "upload_max_filesize": "100M",
                         "post_max_size": "100M"
                     }
                 }
             }
         }
     }

  PHP settings go in the **options** object :ref:`described
  <configuration-php-options>` in the PHP reference; values must be strings.

- **Redirect loops behind a TLS-terminating proxy.**  |app| builds its URLs
  from the scheme it sees, so a proxied site loops between **http://** and
  **https://** unless the listener is told whom to trust:

  .. code-block:: json

     {
         "listeners": {
             "127.0.0.1:8080": {
                 "pass": "routes",
                 "forwarded": {
                     "client_ip": "X-Forwarded-For",
                     "protocol": "X-Forwarded-Proto",
                     "source": [":nxt_ph:`192.0.2.1 <Address of your proxy; use a real value>`"]
                 }
             }
         }
     }

  See the :ref:`forwarded <configuration-listeners-forwarded>` reference; the
  **source** option is required, and a wide one hands clients control of both
  headers.

- **Long imports, updates and migrations.**  Unit imposes no per-request
  time limit by default, so PHP's **max_execution_time** is what governs.
  If you do set the application's :ref:`limits <configuration-proc-mgmt>`
  **timeout**, understand what it does: it measures silence between response
  messages, and when it fires the client gets a 503 while the PHP process
  keeps running to completion.  Keep it above **max_execution_time**, or a
  long import returns an error to the browser and finishes anyway.

  Slow *downloads* are a different knob: **settings.http.send_timeout**
  (30 seconds by default) is what drops clients pulling large media over a
  thin link.

- **Scheduled tasks.**  |app|'s default WP-Cron only runs when a visitor
  arrives, which is unreliable on a low-traffic site and a per-request tax on
  a busy one.  Unit has no built-in scheduler, so set **DISABLE_WP_CRON** in
  **wp-config.php** and drive it from outside — a systemd timer or a
  container sidecar running :program:`wp cron event run --due-now`.

- **Serving TLS directly.**  If Unit is the edge, upload a bundle and
  reference it from the listener; see :ref:`SSL/TLS and certificates
  <configuration-ssl>`.
