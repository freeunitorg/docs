.. warning::

   The **share** action in the configuration below serves any file that no
   earlier step sends elsewhere.  It serves a PHP file as source; it never
   runs it.  The **uri** patterns are globs and match case-sensitively, so
   **\*.php** does not match **/config.PHP**.  On a case-insensitive
   filesystem (macOS, Windows, or a Docker Desktop bind mount from either)
   that file exists, and the **share** returns it with the passwords in it.
   A file the patterns never name, such as **config.php.bak** or
   **settings.inc**, is served the same way.

   Add a **types** allow-list to the **share** action.  Keep the
   **fallback** where the configuration has one::

      "types": ["image/*", "text/css", "application/javascript", "font/*"]

   Unit compares this list with the MIME type it looks up from the file's
   extension.  The lookup is case-insensitive, so **/config.PHP** still
   resolves to **application/x-httpd-php** and is refused.  An extension
   Unit does not know, such as **.phtml** or **.inc**, has an empty type,
   and the allow-list refuses that too.  A refused request takes the
   share's **fallback** when there is one, and gets a 403 response when
   there is not.  Do not write the list as a refuse-list such as
   **["!application/x-httpd-php"]**: a negated pattern does not exclude an
   empty type.  See :ref:`MIME filtering <configuration-share-mime>` for
   the pattern syntax and the :ref:`MIME type table <configuration-mime>`
   for the limits of **types**, including the **index** file case.

   The list above is a starting point.  Add the types your site serves --
   **application/json**, **text/plain**, the XML types,
   **application/pdf**, **video/**\* -- or those files are not served.
