 .. meta::
   :og:description: Upload SSL/TLS certificates to FreeUnit to use
                    them with your listeners.

.. include:: include/replace.rst

.. _configuration-ssl:

####################
SSL/TLS certificates
####################

The **/certificates** section of the
:ref:`control API <configuration-api>`
handles TLS certificates that are used with Unit's
:ref:`listeners <configuration-listeners>`.

To set up SSL/TLS for a listener,
upload a **.pem** file with your certificate chain and private key to Unit,
and name the uploaded bundle in the listener's configuration;
next, the listener can be accessed via SSL/TLS.

.. note::

   For the details of certificate issuance in Unit,
   see an example in :doc:`howto/certbot`.
   For automatic renewal with an ACME client,
   see `Automatic renewal with an ACME client`_ below.

First, create a **.pem** file with your certificate chain and private key:

.. code-block:: console

   $ cat :nxt_ph:`cert.pem <Leaf certificate file>` :nxt_ph:`ca.pem <CA certificate file>` :nxt_ph:`key.pem <Private key file>` > :nxt_ph:`bundle.pem <Arbitrary certificate bundle's filename>`

Usually, your website's certificate
(optionally followed by the intermediate CA certificate)
is enough to build a certificate chain.
If you add more certificates to your chain,
order them leaf to root.

Upload the resulting bundle file to Unit's certificate storage
under a suitable name
(in this case, **bundle**), running the following command as root:

.. code-block:: console

   # curl -X PUT --data-binary @:nxt_ph:`bundle.pem <Certificate bundle's filename>` --unix-socket \
          :nxt_ph:`/path/to/control.unit.sock <Path to Unit's control socket in your installation>` http://localhost/certificates/:nxt_ph:`bundle <Certificate bundle name in Unit's configuration>`

       {
           "success": "Certificate chain uploaded."
       }

.. warning::

   Don't use **-d** for file upload with :program:`curl`;
   this option damages **.pem** files.
   Use the **--data-binary** option
   when uploading file-based data
   to avoid data corruption.

.. _configuration-ssl-replace:

******************
Replacing a bundle
******************

*(since 1.37.0)*

A **PUT** on a name that already exists replaces the bundle in place.
Unit writes the new bundle to a temporary file and renames it over the
old one. A crash never leaves a partial bundle on disk.

If a listener already uses the name, Unit applies the new bundle
immediately and answers with ``"success": "Certificate chain updated."``.
A connection that Unit already accepted finishes with the old
certificate. A new connection gets the new certificate. Unit does not
restart the application processes.

If no listener uses the name yet, Unit answers with
``"success": "Certificate chain uploaded."``, the same as for the
first upload.

If an upload carries the same certificates as the stored bundle, Unit
does not rewrite the file and does not reconfigure the listeners. The
response is the same as for a successful upload or update.

A bundle is one **PEM** body. It holds the server certificate, its
certificate chain, and the private key. Usually the server certificate
comes first and the private key comes last. Unit also accepts a bundle
where the private key comes first. Unit rejects a bundle larger than
1 MiB.

.. list-table::
    :header-rows: 1

    * - Response
      - Meaning

    * - ``400`` **Invalid certificate.**
      - The private key doesn't belong to the server certificate, or
        the server certificate isn't the first certificate in the
        bundle. A bundle with no key, or with no certificate, is also
        invalid. Unit keeps the old bundle.

    * - ``400`` **Invalid certificate name.**
      - The name starts with a dot, contains a slash, or is longer
        than 255 bytes.

    * - ``413`` **Certificate bundle is too large.**
      - The bundle is larger than 1 MiB.

    * - ``500`` **Failed to store certificate.**
      - Unit couldn't write the bundle to disk. Nothing changed.

    * - ``500`` **Certificate stored but not applied.**
      - The bundle is on disk, but Unit refused the listener
        configuration that names it, for example because a
        **conf_commands** option doesn't accept the new key type. Unit
        keeps serving the old certificate. Upload a working bundle
        again, or fix the configuration.

A **PUT** request waits while another configuration change is in
progress.

Internally, Unit stores the uploaded certificate bundles
along with other configuration data
in its **state** subdirectory;
the
:ref:`control API <configuration-api>`
exposes some of their properties
as **GET**-table JSON using **/certificates**:

.. code-block:: json

   {
       "certificates": {
           ":nxt_ph:`bundle <Certificate bundle name>`": {
               "key": "RSA (4096 bits)",
               "fingerprint": "5F:0A:3E:8B:1C:27:9D:44:B6:E1:72:C8:0D:35:9A:F4:6B:E8:21:7C:D3:90:4E:AB:15:66:F2:8D:3C:71:B9:02",
               "chain": [
                   {
                       "subject": {
                           "common_name": "example.com",
                           "alt_names": [
                               "example.com",
                               "www.example.com"
                           ],

                           "country": "US",
                           "state_or_province": "CA",
                           "organization": "Acme, Inc."
                       },

                       "issuer": {
                           "common_name": "intermediate.ca.example.com",
                           "country": "US",
                           "state_or_province": "CA",
                           "organization": "Acme Certification Authority"
                       },

                       "validity": {
                           "since": "Sep 18 19:46:19 2022 GMT",
                           "until": "Jun 15 19:46:19 2025 GMT"
                       }
                   },
                   {
                       "subject": {
                           "common_name": "intermediate.ca.example.com",
                           "country": "US",
                           "state_or_province": "CA",
                           "organization": "Acme Certification Authority"
                       },

                       "issuer": {
                           "common_name": "root.ca.example.com",
                           "country": "US",
                           "state_or_province": "CA",
                           "organization": "Acme Root Certification Authority"
                       },

                       "validity": {
                           "since": "Feb 22 22:45:55 2023 GMT",
                           "until": "Feb 21 22:45:55 2026 GMT"
                       }
                   }
               ]
           }
       }
   }

.. note::

   Query individual properties directly, such as the server
   certificate's SHA-256 fingerprint *(since 1.37.0)* or a certificate
   in the chain, running the following commands as root:

   .. code-block:: console

      # curl -X GET --unix-socket :nxt_ph:`/path/to/control.unit.sock <Path to Unit's control socket in your installation>` \
             http://localhost/certificates/:nxt_hint:`bundle <Certificate bundle name>`/fingerprint

          "5F:0A:3E:8B:1C:27:9D:44:B6:E1:72:C8:0D:35:9A:F4:6B:E8:21:7C:D3:90:4E:AB:15:66:F2:8D:3C:71:B9:02"

   .. code-block:: console

      # curl -X GET --unix-socket :nxt_ph:`/path/to/control.unit.sock <Path to Unit's control socket in your installation>` \
             http://localhost/certificates/:nxt_hint:`bundle <Certificate bundle name>`/chain/0/

   .. code-block:: console

      # curl -X GET --unix-socket :nxt_ph:`/path/to/control.unit.sock <Path to Unit's control socket in your installation>` \
             http://localhost/certificates/:nxt_hint:`bundle <Certificate bundle name>`/chain/0/subject/alt_names/0/

   The fingerprint format matches ``openssl x509 -fingerprint -sha256``:
   uppercase hexadecimal bytes with colons. A script can compare this
   value with a renewed certificate file to upload only when changed.

Next, add the uploaded bundle to a
:ref:`listener <configuration-listeners>`;
the resulting control API configuration may look like this:

.. code-block:: json

   {
       "certificates": {
           ":nxt_ph:`bundle <Certificate bundle name>`": {
               "key": "<key type>",
               "chain": [
                   "<certificate chain, omitted for brevity>"
               ]
           }
       },

       "config": {
           "listeners": {
               "*:443": {
                   "pass": "applications/wsgi-app",
                   "tls": {
                       "certificate": ":nxt_ph:`bundle <Certificate bundle name>`"
                   }
               }
           },

           "applications": {
               "wsgi-app": {
                   "type": "python",
                   "module": "wsgi",
                   "path": "/usr/www/wsgi-app/"
               }
           }
       }
   }

All done;
the application is now accessible via SSL/TLS:

.. code-block:: console

   $ curl -v :nxt_hint:`https://127.0.0.1 <Port 443 is conventionally used for HTTPS connections>`
       ...
       * TLSv1.2 (OUT), TLS handshake, Client hello (1):
       * TLSv1.2 (IN), TLS handshake, Server hello (2):
       * TLSv1.2 (IN), TLS handshake, Certificate (11):
       * TLSv1.2 (IN), TLS handshake, Server finished (14):
       * TLSv1.2 (OUT), TLS handshake, Client key exchange (16):
       * TLSv1.2 (OUT), TLS change cipher, Client hello (1):
       * TLSv1.2 (OUT), TLS handshake, Finished (20):
       * TLSv1.2 (IN), TLS change cipher, Client hello (1):
       * TLSv1.2 (IN), TLS handshake, Finished (20):
       * SSL connection using TLSv1.2 / AES256-GCM-SHA384
       ...

Finally, you can delete a certificate bundle
that you don't need anymore
from the storage, running the following command as root:

.. code-block:: console

   # curl -X DELETE --unix-socket :nxt_ph:`/path/to/control.unit.sock <Path to Unit's control socket in your installation>` \
          http://localhost/certificates/:nxt_hint:`bundle <Certificate bundle name>`

       {
           "success": "Certificate deleted."
       }

.. note::

   You can't delete a bundle that a listener still references, or a
   bundle that doesn't exist. A **DELETE** on a bundle still in use
   answers with
   ``400`` ``{"error": "Certificate is used in the configuration."}``.

.. _configuration-ssl-acme:

**************************************
Automatic renewal with an ACME client
**************************************

ACME is the protocol that certificate authorities such as Let's
Encrypt use to issue and renew certificates. Unit does not talk to a
certificate authority itself. An external ACME client, such as
:program:`lego` or :program:`certbot`, gets and renews the
certificate. After each renewal, the ACME client runs a deploy hook.
The hook uploads the new bundle through the control API, using the
:ref:`replace behavior <configuration-ssl-replace>` described above.

The hook needs only :program:`curl` and write access to the control
socket. It uploads the renewed bundle under the same name every time:

.. code-block:: sh

   #!/bin/sh
   # Deploy hook for certbot. lego uses it through the wrapper below.
   #   certbot sets RENEWED_LINEAGE, for example /etc/letsencrypt/live/example.org
   #   lego    sets CERT_FULLCHAIN, CERT_KEY and UNIT_CERT_NAME through the wrapper
   set -eu

   SOCK=${UNIT_CONTROL:-/var/run/unit/control.sock}
   FULLCHAIN=${CERT_FULLCHAIN:-${RENEWED_LINEAGE:-}/fullchain.pem}
   KEY=${CERT_KEY:-${RENEWED_LINEAGE:-}/privkey.pem}
   NAME=${UNIT_CERT_NAME:-$(basename "${RENEWED_LINEAGE:?set RENEWED_LINEAGE or UNIT_CERT_NAME}")}

   cat "$FULLCHAIN" "$KEY" \
       | curl -fsS --unix-socket "$SOCK" -X PUT --data-binary @- \
             "http://localhost/certificates/$NAME"

Install it as :file:`/usr/local/sbin/freeunit-deploy-hook`, mode
``0755``. Set ``UNIT_CONTROL`` when the control socket isn't
:file:`/var/run/unit/control.sock`. On Debian and Ubuntu packages it is
:file:`/var/run/unit/control.freeunit.sock`. With **-f**,
:program:`curl` exits with an error on any answer of 400 or above, so
the ACME client reports a failed upload.

Both clients need an HTTP-01 route to prove domain ownership, unless
you use a DNS challenge. HTTP-01 is the ACME challenge type where the
certificate authority fetches a token file over plain HTTP from
``http://<domain>/.well-known/acme-challenge/<token>``. The ACME
client writes the token file into a directory, and Unit serves that
directory with **share**:

.. code-block:: json

   {
       "listeners": {
           "*:80":  { "pass": "routes/http" },
           "*:443": { "pass": "routes/app", "tls": { "certificate": "example.org" } }
       },

       "routes": {
           "http": [
               {
                   "match": { "uri": "/.well-known/acme-challenge/*" },
                   "action": {
                       "share": "/var/lib/unit-acme$uri",
                       "chroot": "/var/lib/unit-acme/.well-known/acme-challenge/",
                       "fallback": { "return": 404 }
                   }
               },
               { "action": { "return": 301, "location": "https://$host$request_uri" } }
           ],

           "app": [ { "action": { "pass": "applications/app" } } ]
       }
   }

The router runs as the **--user** user. It must be able to read the
token files and to enter every directory above them. Leave out the
**\*:443** listener until the first bundle exists. Unit refuses a
configuration where a listener names a missing certificate.

lego
****

:program:`lego` is a single-binary ACME client. Every option follows
the **run** command:

.. code-block:: console

   $ lego run --email ops@example.org --accept-tos \
        --path /var/lib/lego --domains :nxt_ph:`example.org <Your domain name>` \
        --http --http.webroot /var/lib/unit-acme \
        --deploy-hook /usr/local/sbin/lego-freeunit

lego 5 has no **renew** command. The first **run** obtains the
certificate. A later **run** renews it only when it is due. A run that
finds nothing due exits ``0`` and changes nothing. **run** also takes
**--pre-hook**, **--deploy-hook** and **--post-hook**.

lego passes its own variables to the hook, not the certbot ones that
the hook above expects. Wrap it:

.. code-block:: sh

   #!/bin/sh
   cat > /usr/local/sbin/lego-freeunit <<'EOF'
   #!/bin/sh
   CERT_FULLCHAIN=$LEGO_HOOK_CERT_PATH CERT_KEY=$LEGO_HOOK_CERT_KEY_PATH \
   UNIT_CERT_NAME=$LEGO_HOOK_CERT_NAME exec /usr/local/sbin/freeunit-deploy-hook
   EOF
   chmod 0755 /usr/local/sbin/lego-freeunit

lego sets ``LEGO_HOOK_CERT_PATH``, ``LEGO_HOOK_CERT_KEY_PATH`` and
``LEGO_HOOK_CERT_NAME`` for the hook. ``LEGO_HOOK_CERT_NAME`` is the
first **--domains** value, so the Unit certificate must use that name.
For a wildcard certificate, use **--dns** *<provider>* instead of
**--http**. Unit then needs no challenge route.

lego has no timer of its own. A systemd timer that runs **lego run**
once a day is enough, because a run with nothing due changes nothing:

.. code-block:: ini

   # /etc/systemd/system/lego-renew.service
   [Unit]
   Description=Renew certificates with lego and deploy them to Unit

   [Service]
   Type=oneshot
   ExecStart=/usr/bin/lego run --email ops@example.org --accept-tos \
       --path /var/lib/lego --domains example.org \
       --http --http.webroot /var/lib/unit-acme \
       --no-random-sleep --deploy-hook /usr/local/sbin/lego-freeunit

.. code-block:: ini

   # /etc/systemd/system/lego-renew.timer
   [Unit]
   Description=Daily certificate renewal

   [Timer]
   OnCalendar=daily
   RandomizedDelaySec=1h
   Persistent=true

   [Install]
   WantedBy=timers.target

.. code-block:: console

   # systemctl enable --now lego-renew.timer

With cron instead of systemd:

.. code-block:: console

   17 3 * * * root /usr/bin/lego run --email ops@example.org --accept-tos \
       --path /var/lib/lego --domains example.org --http \
       --http.webroot /var/lib/unit-acme --no-random-sleep \
       --deploy-hook /usr/local/sbin/lego-freeunit

certbot
*******

:program:`certbot` sets the variables that the hook reads, so it needs
no wrapper:

.. code-block:: console

   # mkdir -p /etc/letsencrypt/renewal-hooks/deploy
   # ln -s /usr/local/sbin/freeunit-deploy-hook \
         /etc/letsencrypt/renewal-hooks/deploy/freeunit
   # certbot certonly --webroot -w /var/lib/unit-acme \
         -d :nxt_ph:`example.org <Your domain name>` -d www.example.org

certbot also accepts the hook on the command line, with
**--deploy-hook**. It sets ``RENEWED_LINEAGE`` and ``RENEWED_DOMAINS``
for the hook. The hook above reads ``RENEWED_LINEAGE``. The symlink
above makes certbot run the hook after every renewal, including the
ones that :file:`certbot.timer` runs automatically. Most Linux
distributions install and enable that timer with the certbot package,
so certbot needs no separate cron job or systemd timer.

.. note::

   The hook must run as a user that may write to the control socket.
   Don't give an application process access to the socket.

Renewal on Unit 1.36.1 and earlier
**********************************

Unit 1.36.1 and earlier answer a **PUT** on an existing name with
``400`` ``{"error": "Certificate already exists."}``. Renewal still
works there, by rotating the bundle name. Upload the renewed bundle
under a new name, point the listener at the new name, then delete the
old name.

.. code-block:: console

   # curl -X PUT --data-binary @:nxt_ph:`bundle.pem <Renewed certificate bundle>` --unix-socket \
          :nxt_ph:`/path/to/control.unit.sock <Path to Unit's control socket in your installation>` \
          http://localhost/certificates/:nxt_ph:`example.org-2026-10 <New bundle name, for example the domain and the month>`

       {
           "success": "Certificate chain uploaded."
       }

   # curl -X PUT -d '"example.org-2026-10"' --unix-socket \
          :nxt_ph:`/path/to/control.unit.sock <Path to Unit's control socket in your installation>` \
          'http://localhost/config/listeners/*:443/tls/certificate'

       {
           "success": "Reconfiguration done."
       }

   # curl -X DELETE --unix-socket :nxt_ph:`/path/to/control.unit.sock <Path to Unit's control socket in your installation>` \
          http://localhost/certificates/:nxt_ph:`example.org-2026-09 <Old bundle name>`

       {
           "success": "Certificate deleted."
       }

The order matters. Unit refuses to delete a bundle that a listener
still uses. New connections get the renewed certificate as soon as
the second call returns. Connections that Unit already accepted
finish with the old one.

A hook for this flow must know every listener that names the bundle.
It must send the second call once per listener. If the
**certificate** option of a listener is an array of names, send the
whole array with the new name in place of the old one. The hook
above does not do this. Use it only with in-place replacement.
