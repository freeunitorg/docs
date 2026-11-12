.. meta::
   :og:description: Run a fixed PHP script from OPcache without opening the
                    script file on every request, with the settings that
                    enable it and the cases where Unit still opens the file.

.. include:: ../include/replace.rst

.. _howto-php-opcache:

#######################################################
PHP OPcache Without Opening the Script on Every Request
#######################################################

Usually, Unit's PHP module opens the script file of a fixed **script**
target on every request, even when OPcache already holds the compiled
script.  When timestamps are not validated, Unit can skip the open: the
request makes a stat and an access call on the script file in place of
the open, two fstat calls, an lseek and the close.

.. note::
   This behavior is available in FreeUnit 1.38 and later.  See the
   `change <https://github.com/freeunitorg/freeunit/pull/781>`_ for the
   implementation and the tests.

.. _php-opcache-requirements:

************
Requirements
************

Unit skips the open when all of these hold:

- The application has a fixed :ref:`script <configuration-php>` target.
  A target derived from the request is not covered.
- PHP 8.1 or later.
- OPcache is loaded and enabled in **php.ini**.
- **opcache.validate_timestamps** is off.
- **opcache.revalidate_path** is off.
- **opcache.restrict_api** is empty.
- **open_basedir** is empty.
- The script is cached.  The first request compiles and caches it; the
  later requests can skip the open.  OPcache does not cache a file that
  changed in the last **opcache.file_update_protection** seconds (2 by
  default).  Right after a deploy, requests open the file until that time
  has passed.

.. _php-opcache-config:

*************
Configuration
*************

Enable OPcache in **php.ini**.  OPcache is on by default when the
extension is loaded, because **opcache.enable** defaults to 1.  Do not set
**opcache.enable** in **options.admin**: PHP refuses it there, and Unit
logs ``setting PHP option "opcache.enable: 1" failed``.

Set the other settings in the application's **options.admin** object or in
its **php.ini**:

.. code-block:: json

   {
       "applications": {
           "app": {
               "type": "php",
               "script": ":nxt_hint:`index.php <All requests are handled by a single script>`",
               "root": ":nxt_ph:`/path/to/app <Path to the app's root directory; use a real path in your configuration>`",
               "options": {
                   "admin": {
                       "opcache.validate_timestamps": "0",
                       "opcache.revalidate_path": "0"
                   }
               }
           }
       }
   }

The same two settings in **php.ini**, with **opcache.enable** set
explicitly:

.. code-block:: ini

   opcache.enable=1
   opcache.validate_timestamps=0
   opcache.revalidate_path=0

Do not set **open_basedir** or **opcache.restrict_api** for the
application.  Either one sends every request to the open path; an
**open_basedir** check would also cost as much as the open, more for a
deep path.

.. _php-opcache-open:

************************
When Unit Opens the File
************************

Unit takes the usual open path when:

- The target is derived from the request.
- PHP is older than 8.1.
- OPcache is not loaded or not enabled.
- **opcache.validate_timestamps** or **opcache.revalidate_path** is on.
- **opcache.restrict_api** or **open_basedir** is set.
- The script is not in the cache.
- The file is not a regular readable file.

A request that misses the cache after Unit decided to use OPcache also
opens the file and answers as the open path does:

- After an **opcache_invalidate()** of the script or a cache restart, the
  request that misses opens and compiles the script; the next request
  caches it.
- An **auto_prepend_file** that invalidates the script, or changes the
  OPcache settings, can also make the compile miss.
- A removed script answers 404; one that the worker cannot read answers
  403; a FIFO answers 404.  The status is sent and the body stays empty,
  as without OPcache.
- If the prepend sends the response headers before the miss, the status
  cannot change: the response keeps the prepend's output (200) and the
  script adds no body.

.. _php-opcache-deploy:

******************************
Deploying with No Revalidation
******************************

**opcache.validate_timestamps=0** means OPcache does not check the
script's timestamp on a request.  A changed script is not compiled again
until the cache is invalidated or restarted, so deploy as with any such
configuration: restart the application or Unit, or call
**opcache_reset()**.  The optimization does not change this behavior; it
only skips the open of a script that OPcache already holds.

With the default **opcache.validate_timestamps=1**, the open path is
used and there is no gain; the request opens the file as before.

.. _php-opcache-measurements:

************
Measurements
************

A warm request to a fixed script makes a stat and an access call in place
of the open, two fstat calls, an lseek and the close: five file system calls
become two on x86_64 with glibc, and four become two on aarch64 with musl.

In the benchmark for this change (8 vCPU, PHP 8.4, two workers, a hello
script, five alternating 15-second rounds after warmup), a fixed script
with **opcache.validate_timestamps=0** gained 23% at 32 connections and
7% at one connection; the default settings showed no difference.  Use
:ref:`the benchmark methodology <tuning-methodology>` for your own
measurements.

.. _php-opcache-references:

**********
References
**********

- The `change <https://github.com/freeunitorg/freeunit/pull/781>`_ and
  its tests.
- The `OPcache manual <https://www.php.net/manual/en/book.opcache.php>`_.
- The PHP application :ref:`configuration <configuration-php>`.
- The :ref:`benchmark methodology <tuning-methodology>`.
