.. include:: ../include/replace.rst

.. |app| replace:: NextCloud
.. |mod| replace:: PHP
.. |app-preq| replace:: prerequisites
.. _app-preq: https://docs.nextcloud.com/server/latest/admin_manual/installation/source_installation.html#prerequisites-for-manual-installation
.. |app-link| replace:: core files
.. _app-link: https://docs.nextcloud.com/server/latest/admin_manual/installation/command_line_installation.html

#########
NextCloud
#########

To run the `NextCloud <https://nextcloud.com>`__ share and collaboration
platform using Unit:

#. .. include:: ../include/howto_install_unit.rst

#. .. include:: ../include/howto_install_prereq.rst

#. .. include:: ../include/howto_install_app.rst

   .. note::

      Verify the resulting settings in **/path/to/app/config/config.php**;
      in particular, check the `trusted domains
      <https://docs.nextcloud.com/server/latest/admin_manual/installation/installation_wizard.html#trusted-domains-label>`_
      to ensure the installation is accessible within your network:

    .. code-block:: php

       'trusted_domains' =>
       array (
         0 => 'localhost',
         1 => '*.example.com',
       ),

#. .. include:: ../include/howto_change_ownership.rst

#. Next, :ref:`put together <configuration-php>` the |app| configuration for
   Unit (use real values for **share** and **root**).  The following is
   based on NextCloud's own `guide
   <https://docs.nextcloud.com/server/latest/admin_manual/installation/nginx.html>`_:

   .. code-block:: json
      {
          "settings": {
              "http": {
                  "server_version": false,
                  "max_body_size": 1073741824,
                  "body_read_timeout": 300,
                  "header_read_timeout": 30,
                  "send_timeout": 60,
                  "idle_timeout": 180
              }
          },

          "listeners": {
              "*:80": {
                  "pass": "routes/nextcloud"
              }
          },

          "routes": {
              "nextcloud": [
                  {
                      "match": {
                          "uri": "/",
                          "headers": {
                              "User-Agent": "DavClnt*"
                          }
                      },
                      "action": {
                          "return": 302,
                          "location": "/remote.php/webdav$request_uri"
                      }
                  },

                  {
                      "match": {
                          "uri": "/"
                      },
                      "action": {
                          "rewrite": "/index.php$request_uri",
                          "pass": "applications/nextcloud/direct",
                          "response_headers": {
                              "Referrer-Policy":                   "no-referrer",
                              "X-Content-Type-Options":            "nosniff",
                              "X-Frame-Options":                   "SAMEORIGIN",
                              "X-Permitted-Cross-Domain-Policies": "none",
                              "X-Robots-Tag":                      "noindex, nofollow"
                          }
                      }
                  },

                  {
                      "match": {
                          "uri": "/robots.txt"
                      },
                      "action": {
                          "share": ": ":nxt_ph:`/path/to/app <Path to the application directory; use a real path in your configuration>`$uri"
                      }
                  },

                  {
                      "match": {
                          "uri": [
                              "/.well-known/carddav",
                              "/.well-known/caldav"
                          ]
                      },
                      "action": {
                          "return": 301,
                          "location": "/remote.php/dav/"
                      }
                  },

                  {
                      "match": {
                          "uri": [
                              "/.well-known/acme-challenge/*",
                              "/.well-known/pki-validation/*"
                          ]
                      },
                      "action": {
                          "share": ": ":nxt_ph:`/path/to/app <Path to the application directory; use a real path in your configuration>`$uri",
                          "fallback": {
                              "return": 404
                          }
                      }
                  },

                  {
                      "match": {
                          "uri": "/.well-known/*"
                      },
                      "action": {
                          "return": 301,
                          "location": "/index.php$request_uri"
                      }
                  },

                  {
                      "match": {
                          ":nxt_hint:`uri <Denies access to directories best kept private>`": [
                              "/build",  "/build/*",
                              "/tests",  "/tests/*",
                              "/config", "/config/*",
                              "/lib",    "/lib/*",
                              "/3rdparty", "/3rdparty/*",
                              "/templates", "/templates/*",
                              "/data",   "/data/*"
                          ]
                      },
                      "action": {
                          "return": 404
                      }
                  },

                  {
                      "match": {
                          ":nxt_hint:`uri <Denies access to files best kept private>`": [
                              "/.*",
                              "/autotest*",
                              "/occ*",
                              "/issue*",
                              "/indie*",
                              "/db_*",
                              "/console*"
                          ]
                      },
                      "action": {
                          "return": 404
                      }
                  },

                  {
                      "match": {
                          "uri": ["/ocs-provider", "/ocs-provider/"]
                      },
                      "action": {
                          "rewrite": "/ocs-provider/index.php",
                          "pass": "applications/nextcloud/direct"
                      }
                  },

                  {
                      "match": {
                          "uri": ["/updater", "/updater/"]
                      },
                      "action": {
                          "rewrite": "/updater/index.php",
                          "pass": "applications/nextcloud/direct"
                      }
                  },

                  {
                      "match": {
                          "uri": [
                              "/index.php",       "/index.php/*",
                              "/remote.php",      "/remote.php/*",
                              "/public.php",      "/public.php/*",
                              "/cron.php",
                              "/status.php",
                              "/ocs/v1.php",      "/ocs/v1.php/*",
                              "/ocs/v2.php",      "/ocs/v2.php/*",
                              "/ocs-provider/*.php",
                              "/core/ajax/update.php",
                              "/updater/*.php",   "/updater/*.php/*",
                              "*/richdocumentscode/proxy.php",
                              "*/richdocumentscode_arm64/proxy.php"
                          ]
                      },
                      "action": {
                          "pass": "applications/nextcloud/direct",
                          "response_headers": {
                              "Referrer-Policy":                   "no-referrer",
                              "X-Content-Type-Options":            "nosniff",
                              "X-Frame-Options":                   "SAMEORIGIN",
                              "X-Permitted-Cross-Domain-Policies": "none",
                              "X-Robots-Tag":                      "noindex, nofollow"
                          }
                      }
                  },

                  {
                      "match": {
                          "uri": [
                              "*.php",
                              "*.php/*"
                          ]
                      },
                      "action": {
                          "pass": "applications/nextcloud/index",
                          "response_headers": {
                              "Referrer-Policy":                   "no-referrer",
                              "X-Content-Type-Options":            "nosniff",
                              "X-Frame-Options":                   "SAMEORIGIN",
                              "X-Permitted-Cross-Domain-Policies": "none",
                              "X-Robots-Tag":                      "noindex, nofollow"
                          }
                      }
                  },

                  {
                      "match": {
                          "uri": "/remote/*"
                      },
                      "action": {
                          "rewrite": "/remote.php$request_uri",
                          "pass": "applications/nextcloud/direct"
                      }
                  },

                  {
                      "match": {
                          "uri": [
                              "*.css", "*.js", "*.mjs", "*.svg",
                              "*.gif", "*.ico", "*.jpg", "*.jpeg",
                              "*.png", "*.webp", "*.wasm", "*.tflite",
                              "*.map", "*.ogg", "*.flac",
                              "*.mp4", "*.webm"
                          ]
                      },
                      "action": {
                          "share": ": ":nxt_ph:`/path/to/app <Path to the application directory; use a real path in your configuration>`$uri",
                          "fallback": {
                              "pass": "applications/nextcloud/index",
                              "response_headers": {
                                  "Referrer-Policy":                   "no-referrer",
                                  "X-Content-Type-Options":            "nosniff",
                                  "X-Frame-Options":                   "SAMEORIGIN",
                                  "X-Permitted-Cross-Domain-Policies": "none",
                                  "X-Robots-Tag":                      "noindex, nofollow"
                              }
                          },
                          "response_headers": {
                              "Cache-Control":                     "public, max-age=15778463",
                              "Referrer-Policy":                   "no-referrer",
                              "X-Content-Type-Options":            "nosniff",
                              "X-Frame-Options":                   "SAMEORIGIN",
                              "X-Permitted-Cross-Domain-Policies": "none",
                              "X-Robots-Tag":                      "noindex, nofollow"
                          }
                      }
                  },

                  {
                      "match": {
                          "uri": [
                              "*.otf", "*.woff", "*.woff2"
                          ]
                      },
                      "action": {
                          "share": ": ":nxt_ph:`/path/to/app <Path to the application directory; use a real path in your configuration>`$uri",
                          "fallback": {
                              "pass": "applications/nextcloud/index"
                          },
                          "response_headers": {
                              "Cache-Control": "public, max-age=604800"
                          }
                      }
                  },

                  {
                      "action": {
                          "share": ": ":nxt_ph:`/path/to/app <Path to the application directory; use a real path in your configuration>`$uri",
                          "fallback": {
                              "pass": "applications/nextcloud/index",
                              "response_headers": {
                                  "Referrer-Policy":                   "no-referrer",
                                  "X-Content-Type-Options":            "nosniff",
                                  "X-Frame-Options":                   "SAMEORIGIN",
                                  "X-Permitted-Cross-Domain-Policies": "none",
                                  "X-Robots-Tag":                      "noindex, nofollow"
                              }
                          }
                      }
                  }
              ]
          },

          "applications": {
              "nextcloud": {
                  "type": "php",
                  "limits": {
                      "timeout": 600,
                      "requests": 2000
                  },
                  "processes": {
                      "max": 64,
                      "spare": 16,
                      "idle_timeout": 60
                  },
                  "targets": {
                      "direct": {
                          "root": ":nxt_ph:`/path/to/app/ <Path to the application directory; use a real path in your configuration>`"
                      },
                      "index": {
                          "root": ":nxt_ph:`/path/to/app/ <Path to the application directory; use a real path in your configuration>`",
                          "script": ":nxt_hint:`index.php <All requests are handled by a single script>`"
                      }
                  },
                  "environment": {
                      "modHeadersAvailable":     "true",
                      "front_controller_active": "true"
                  }
              }
          }
      }

   .. note::

      The difference between the **pass** targets is their usage of the
      **script** :ref:`setting <configuration-php>`:

      - The **direct** target runs the **.php** script from the URI or
        defaults to **index.php** if the URI omits it.

      - Other targets specify the **script** that Unit runs for *any* URIs
        the target receives.

#. .. include:: ../include/howto_upload_config.rst

#. Adjust Unit's **max_body_size** :ref:`option <configuration-stngs>` to
   avoid potential issues with large file uploads, for example, runnig the
   following command as root to set 10G limit:

   .. code-block:: console

      # curl -X PUT -d '{"http":{"max_body_size": 10737418240}}' --unix-socket \
             :nxt_ph:`/path/to/control.unit.sock <Path to Unit's control socket in your installation>` :nxt_hint:`http://localhost/config/settings <Path to the 'config/settings' section in Unit's control API>`

   After a successful update, browse to http://localhost and `set up
   <https://docs.nextcloud.com/server/latest/admin_manual/installation/installation_wizard.html>`_
   your |app| installation:

   .. image:: ../images/nextcloud.png
      :width: 100%
      :alt: NextCloud on Unit - Home Screen
