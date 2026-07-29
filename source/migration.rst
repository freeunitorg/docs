.. meta::
 :og:description: Migrate from archived Unit installations or community packages
 to the community-maintained FreeUnit fork, including maintainer guidance
 for updating downstream packaging recipes.

.. include:: include/replace.rst

#########
Migration
#########

This guide covers two audiences:

- **Users** running archived Unit or a community-maintained package
  who want to switch to **FreeUnit**, the community-maintained LTS fork.
- **Package maintainers** of community repositories (Alpine, Arch, Gentoo,
  *BSD, Nix, Remi, etc.) who need to rebase their recipes onto the
  ``freeunitorg/freeunit`` source tree.

.. note::
 FreeUnit is ABI-compatible with previous Unit builds.
 Functionally nothing changes — only the **package name**
 (``unit``/``nginx-unit`` → ``freeunit``) and the **upstream source URL**
 (``github.com/nginx/unit`` → ``github.com/freeunitorg/freeunit``).
 ``config.json``, runtime paths, CLI flags, and the control API stay as-is.

.. warning::
 **Official RPM/DEB packages for FreeUnit are coming soon.**
 As of April 2026, FreeUnit is distributed via:

 - :ref:`Docker official images <migration-docker>`
 - :ref:`Source builds <migration-source>`
 - Pre-built ``unitctl`` binaries from GitHub Releases

 Native package manager support (APT/YUM) is in active development.
 Track progress at: https://github.com/freeunitorg/freeunit/milestone/2

**For users** — pick one install path:

- Run our :ref:`Docker official images <migration-docker>`,
  prepackaged with varied language combinations.

- To fine-tune FreeUnit to your goals,
  download the :ref:`sources <migration-source>`,
  install the :ref:`toolchain <source-prereqs>`,
  and :ref:`build <migration-source-build>` a custom binary from scratch.

- For RHEL/Fedora users who want to keep Remi's PHP packages,
  try the :ref:`hybrid approach <migration-remi-hybrid>`
  (FreeUnit core + Remi PHP modules).

**For package maintainers** — rebase your recipe:

- Follow
  :ref:`Community Repository Maintainers <migration-community-repos>`
  below for per-distro steps (source URL, rename, ``provides``/
  ``obsoletes`` aliases, checksums).

.. note::
 The commands in this document starting with a hash (#) must be run as root or
 with superuser privileges.

.. _migration-community-repos:

***********************************
Community Repository Maintainers
***********************************

This section targets **downstream packagers** who maintain a Unit recipe
in a community repository (AUR, Alpine aports, Gentoo ::gentoo,
FreeBSD ports, Remi's RPM, etc.) and want to track FreeUnit going forward.

The rebase is mechanical:

#. Change the **source URL** from
   ``https://github.com/nginx/unit`` to
   ``https://github.com/freeunitorg/freeunit``.
#. Rename the **package** from ``unit`` (or ``nginx-unit``) to ``freeunit``.
   Rename subpackages accordingly
   (``unit-php`` → ``freeunit-php``, ``unit-python3`` → ``freeunit-python3``, …).
#. Keep the old name as a ``provides``/``replaces``/``obsoletes`` alias
   so existing installs upgrade cleanly.
#. Update signing/checksum metadata against the new release tarballs.
#. Verify runtime paths still match the table at the end of each tab —
   upstream does not enforce a layout, so distro defaults are preserved.

.. note::
 FreeUnit release tags follow the same ``1.X.Y`` scheme as archived Unit,
 starting from the last Unit release. Tarballs:
 ``https://github.com/freeunitorg/freeunit/archive/refs/tags/<TAG>.tar.gz``.

.. warning::
 These distributions are maintained by their respective communities,
 not the FreeUnit project.
 Packages may be outdated or lack security updates.

.. tabs::
 :prefix: community
 :toc:

 .. tab:: Alpine

 Recipe: ``community/unit/APKBUILD`` in
 `alpinelinux/aports <https://gitlab.alpinelinux.org/alpine/aports>`_.

 #. **Rename the aport**

    Move ``community/unit/`` to ``community/freeunit/`` and update
    ``APKBUILD``:

    .. code-block:: sh
     :caption: community/freeunit/APKBUILD

     pkgname=freeunit
     pkgver=1.35.3
     source="$pkgname-$pkgver.tar.gz::https://github.com/freeunitorg/freeunit/archive/refs/tags/$pkgver.tar.gz"
     builddir="$srcdir/freeunit-$pkgver"
     subpackages="$pkgname-openrc $pkgname-doc $pkgname-dev
      $pkgname-perl $pkgname-php83 $pkgname-python3 $pkgname-ruby"
     provides="unit=$pkgver-r$pkgrel"
     replaces="unit"

 #. **Refresh checksums**

    .. code-block:: console

     $ abuild checksum

 #. **Build and test**

    .. code-block:: console

     $ abuild -r

 #. **Submit an MR** to aports following the
    `Alpine contributing guide
    <https://wiki.alpinelinux.org/wiki/Creating_an_Alpine_package>`_.

 Runtime details (unchanged from the legacy ``unit`` aport):

 .. list-table::

  * - Control :ref:`socket`
    - **/run/control.unit.sock**

  * - Log :ref:`file`
    - **/var/log/unit.log**

  * - Non-privileged :ref:`user and group`
    - **unit**

 .. tab:: ALT

 Recipe: ``unit.spec`` in the Sisyphus
 `gears/u/unit
 <https://git.altlinux.org/gears/u/unit.git>`_ repository.

 #. **Clone the gear and branch it**

    .. code-block:: console

     $ git clone git://git.altlinux.org/gears/u/unit.git freeunit
     $ cd freeunit

 #. **Update the spec**

    .. code-block:: spec
     :caption: freeunit.spec

     Name:    freeunit
     Version: 1.35.3
     Source0: https://github.com/freeunitorg/freeunit/archive/refs/tags/%version.tar.gz
     Provides: unit = %EVR
     Obsoletes: unit < %EVR

    Rename subpackages the same way
    (``unit-perl`` → ``freeunit-perl``, ``unit-php`` → ``freeunit-php``, …).

 #. **Rebuild in the hasher**

    .. code-block:: console

     $ gear-rpm -bb
     $ hsh --init && hsh --build freeunit-*.src.rpm

 #. **Push to Sisyphus** via
    ``gear-commit`` + ``git push`` once a maintainer has reviewed.

 Runtime details (unchanged from the legacy ``unit`` gear):

 .. list-table::

  * - Control :ref:`socket`
    - **/run/unit/control.sock**

  * - Log :ref:`file`
    - **/var/log/unit/unit.log**

  * - Non-privileged :ref:`user and group`
    - **_unit** (mind the **_** prefix)

 .. tab:: Arch

 Recipe: ``PKGBUILD`` in the
 `nginx-unit AUR package
 <https://aur.archlinux.org/pkgbase/nginx-unit/>`_.

 Recommended path: publish a **new AUR package named** ``freeunit`` and
 keep ``nginx-unit`` around for a release or two pointing at the same
 tarball (``provides=('nginx-unit')``, ``conflicts=('nginx-unit')``).

 #. **Clone the AUR repo and rename**

    .. code-block:: console

     $ git clone ssh://aur@aur.archlinux.org/freeunit.git
     $ cd freeunit

 #. **Update PKGBUILD**

    .. code-block:: sh
     :caption: PKGBUILD

     pkgbase=freeunit
     pkgname=('freeunit' 'freeunit-php' 'freeunit-python' 'freeunit-nodejs')
     pkgver=1.35.3
     url='https://github.com/freeunitorg/freeunit'
     source=("freeunit-$pkgver.tar.gz::https://github.com/freeunitorg/freeunit/archive/refs/tags/$pkgver.tar.gz")
     provides=("nginx-unit=$pkgver")
     replaces=('nginx-unit')
     conflicts=('nginx-unit')

 #. **Refresh checksums and .SRCINFO**

    .. code-block:: console

     $ updpkgsums
     $ makepkg --printsrcinfo > .SRCINFO

 #. **Build in a clean chroot, then push**

    .. code-block:: console

     $ makepkg -s
     $ git commit -am "freeunit 1.35.3: rebase on freeunitorg/freeunit"
     $ git push

 .. warning::
  AUR packages are user-produced without pre-moderation.
  Audit the ``PKGBUILD`` and any ``.install`` scripts before publishing.

 Runtime details (unchanged from the legacy ``nginx-unit`` AUR package):

 .. list-table::

  * - Control :ref:`socket`
    - **/run/unit/control.sock**

  * - Log :ref:`file`
    - **/var/log/unit/unit.log**

  * - Non-privileged :ref:`user and group`
    - **nobody**

 .. tab:: Gentoo

 Recipe: ``www-servers/nginx-unit`` in the
 `::gentoo tree <https://github.com/gentoo/gentoo/tree/master/www-servers/nginx-unit>`_.

 Strategy: add ``www-servers/freeunit`` and last-rite ``nginx-unit`` by
 adding a dated block to ``profiles/package.mask`` (with a 30-day removal
 notice) once the replacement is stable.

 #. **Create the new package directory**

    .. code-block:: console

     $ git mv www-servers/nginx-unit www-servers/freeunit
     $ cd www-servers/freeunit
     $ git mv nginx-unit-1.34.2.ebuild freeunit-1.35.3.ebuild

 #. **Update the ebuild**

    .. code-block:: bash
     :caption: www-servers/freeunit/freeunit-1.35.3.ebuild

     EAPI=8
     DESCRIPTION="Dynamic application server, community LTS fork of NGINX Unit"
     HOMEPAGE="https://freeunit.org/"
     SRC_URI="https://github.com/freeunitorg/freeunit/archive/refs/tags/${PV}.tar.gz -> ${P}.tar.gz"
     S="${WORKDIR}/freeunit-${PV}"

     RDEPEND="!!<www-servers/nginx-unit-1.35"   # hard block, forces removal before merge

 #. **Regenerate Manifest**

    .. code-block:: console

     $ pkgdev manifest

 #. **Test**

    .. code-block:: console

     $ sudo ebuild freeunit-1.35.3.ebuild clean merge
     $ pkgcheck scan

 #. **Submit a PR** to
    `gentoo/gentoo <https://github.com/gentoo/gentoo>`_
    per the `Gentoo developer manual
    <https://devmanual.gentoo.org/>`_.

 Runtime details (unchanged from the legacy ``nginx-unit`` ebuild):

 .. list-table::

  * - Control :ref:`socket`
    - **/run/unit.sock**

  * - Log :ref:`file`
    - **/var/log/unit.log**

  * - Non-privileged :ref:`user and group`
    - **nobody**

 .. tab:: NetBSD

 Recipe: ``www/unit`` in
 `pkgsrc <https://github.com/NetBSD/pkgsrc/tree/trunk/www/unit>`_.

 #. **Copy the category directory**

    .. code-block:: console

     $ cd pkgsrc/www
     $ cp -R unit freeunit

 #. **Update the Makefile**

    .. code-block:: make
     :caption: www/freeunit/Makefile

     DISTNAME=       freeunit-1.35.3
     CATEGORIES=     www
     MASTER_SITES=   ${MASTER_SITE_GITHUB:=freeunitorg/freeunit/}
     GITHUB_TAG=     ${PKGVERSION_NOREV}
     HOMEPAGE=       https://freeunit.org/
     COMMENT=        Community LTS fork of NGINX Unit

     CONFLICTS+=     unit-[0-9]*
     SUPERSEDES+=    unit-[0-9]*

    Do the same for ``www/freeunit-perl``, ``www/freeunit-python*``,
    ``www/freeunit-ruby*``, ``devel/libfreeunit``.

 #. **Regenerate distinfo**

    .. code-block:: console

     $ make distinfo

 #. **Test-build**

    .. code-block:: console

     $ cd www/freeunit && make package

 #. **Commit and send-pr** via
    `pkgsrc-wip <https://pkgsrc.org/wip/>`_ first if the rename needs
    broader review.

 Runtime details (unchanged from the legacy ``www/unit`` pkgsrc entry):

 .. list-table::

  * - Control :ref:`socket`
    - **/var/run/unit/control.unit.sock**

  * - Log :ref:`file`
    - **/var/log/unit/unit.log**

  * - Non-privileged :ref:`user and group`
    - **unit**

 .. tab:: Nix

 Recipe: ``pkgs/servers/http/unit/default.nix`` in
 `NixOS/nixpkgs <https://github.com/NixOS/nixpkgs>`_.

 The NixOS module also lives at
 ``nixos/modules/services/web-servers/unit/default.nix`` —
 keep option names as aliases so existing configurations don't break.

 #. **Rename the derivation directory**

    .. code-block:: console

     $ git mv pkgs/servers/http/unit pkgs/servers/http/freeunit

 #. **Update default.nix**

    .. code-block:: nix
     :caption: pkgs/servers/http/freeunit/default.nix

     stdenv.mkDerivation (finalAttrs: {
       pname = "freeunit";
       version = "1.35.3";

       src = fetchFromGitHub {
         owner = "freeunitorg";
         repo  = "freeunit";
         rev   = finalAttrs.version;
         hash  = "sha256-...";
       };

       meta = with lib; {
         description = "Community LTS fork of NGINX Unit";
         homepage    = "https://freeunit.org/";
         license     = licenses.asl20;
       };
     })

 #. **Add an alias in ``pkgs/top-level/aliases.nix``**

    .. code-block:: nix

     unit = freeunit;  # renamed 2026-04, remove after 25.11

 #. **Update the NixOS module** to reference ``pkgs.freeunit`` and
    add a ``mkRenamedOptionModule`` entry for ``services.unit.*`` →
    ``services.freeunit.*``.

 #. **Refresh the hash and build**

    .. code-block:: console

     $ nix-prefetch-github --rev 1.35.3 freeunitorg freeunit  # writes SRI hash for fetchFromGitHub (unpacked)
     $ nix-build -A freeunit
     $ nixos-rebuild build-vm -I nixpkgs=.

 #. **Submit a PR** to nixpkgs.

 Runtime details (unchanged from the legacy ``unit`` derivation):

 .. list-table::

  * - Control :ref:`socket`
    - **/run/unit/control.unit.sock**

  * - Log :ref:`file`
    - **/var/log/unit/unit.log**

  * - Non-privileged :ref:`user and group`
    - **unit**

 .. tab:: OpenBSD

 Recipe: ``www/unit`` in the
 `OpenBSD ports tree
 <https://github.com/openbsd/ports/tree/master/www/unit>`_.

 #. **Create the new port**

    .. code-block:: console

     $ cd /usr/ports/www
     $ cp -R unit freeunit

 #. **Update the Makefile**

    .. code-block:: make
     :caption: www/freeunit/Makefile

     COMMENT =       community LTS fork of NGINX Unit
     GH_ACCOUNT =    freeunitorg
     GH_PROJECT =    freeunit
     GH_TAGNAME =    1.35.3
     DISTNAME =      freeunit-${GH_TAGNAME}
     PKGNAME =       freeunit-${GH_TAGNAME}

     PSEUDO_FLAVORS = no_nonfree
     FLAVORS =        php python ruby perl

    Subpackage ``PKGNAME``s follow: ``freeunit-php``, ``freeunit-python``,
    ``freeunit-perl``, ``freeunit-ruby``.

 #. **Regenerate distinfo**

    .. code-block:: console

     $ cd /usr/ports/www/freeunit && make makesum

 #. **Record the rename for ``pkg_add -u``**

    OpenBSD has no ports-wide ``MOVED`` file. Instead, add the old
    pkgstem as an ``@pkgpath`` line in the new port's ``pkg/PLIST``
    so :program:`pkg_add -u` auto-upgrades ``unit-*`` installs:

    .. code-block:: text
     :caption: www/freeunit/pkg/PLIST

     @pkgpath www/unit
     @pkgpath www/unit,-main

 #. **Test-build and submit the diff** to
    `ports@openbsd.org <mailto:ports@openbsd.org>`_
    per the `OpenBSD porter's handbook
    <https://www.openbsd.org/faq/ports/>`_.

 Runtime details (unchanged from the legacy ``www/unit`` port):

 .. list-table::

  * - Control :ref:`socket`
    - **/var/run/unit/control.unit.sock**

  * - Log :ref:`file`
    - **/var/log/unit/unit.log**

  * - Non-privileged :ref:`user and group`
    - **_unit**

 .. tab:: Remi's RPM

 Recipe: Remi Collet builds from his own infrastructure — see
 `blog.remirepo.net <https://blog.remirepo.net/>`_ for the canonical
 spec tree and contact path. Coordinate the rename with Remi directly
 rather than opening a PR to the GitHub mirror.

 The core package gets renamed; the PHP modules (``phpXX-unit-php``)
 stay as-is — they are ABI-compatible with FreeUnit and Remi's naming
 scheme is valuable to existing users.

 #. **Fork the spec to ``freeunit.spec``**

    .. code-block:: spec
     :caption: freeunit.spec

     %global         gh_owner   freeunitorg
     %global         gh_project freeunit

     Name:           freeunit
     Version:        1.35.3
     Release:        1%{?dist}
     Summary:        Community LTS fork of NGINX Unit
     URL:            https://freeunit.org/
     Source0:        https://github.com/%{gh_owner}/%{gh_project}/archive/refs/tags/%{version}.tar.gz

     Provides:       unit = %{version}-%{release}
     Obsoletes:      unit < %{version}-%{release}

     %prep
     %autosetup -n %{gh_project}-%{version}

    Leave ``--prefix=/usr`` in ``%configure`` so paths stay at
    ``/usr/sbin/unitd`` and ``/usr/lib64/unit/modules/`` for drop-in
    compatibility with ``phpXX-unit-php``.

 #. **Update ``phpXX-unit-php`` sub-specs**

    No rename required — only bump their
    ``BuildRequires: freeunit-devel >= %{version}`` /
    ``Requires: freeunit >= %{version}`` lines so they link against
    the renamed core.

 #. **Build and hand the SRPM to Remi**

    .. code-block:: console

     $ rpmbuild -ba freeunit.spec

    The upload path into ``rpms.remirepo.net`` is Remi-internal —
    don't invent one. Send the resulting SRPM to Remi via the contact
    on `blog.remirepo.net <https://blog.remirepo.net/>`_ for repo
    ingestion.

 #. **Verify the upgrade path**

    .. code-block:: console

     # dnf upgrade freeunit
     # /usr/sbin/unitd --version
     freeunit/1.35.3

 Runtime details (unchanged from the legacy ``unit`` RPM):

 .. list-table::

  * - Control :ref:`socket`
    - **/run/unit/control.sock**

  * - Log :ref:`file`
    - **/var/log/unit/unit.log**

  * - Non-privileged :ref:`user and group`
    - **nobody**

.. _migration-docker:

****************
Docker Migration
****************

FreeUnit provides official Docker images for easy deployment.

.. _migration-docker-steps:

====
Steps
====

#. **Pick a tag and reference it**

 Images are hosted on GitHub Container Registry (GHCR):
 https://github.com/freeunitorg/freeunit/pkgs/container/freeunit

 Tag format: :samp:`{VERSION}-{VARIANT}` (pinned) or
 :samp:`latest-{VARIANT}` (rolling). There is **no bare** ``latest`` tag.

 .. list-table::
  :header-rows: 1
  :widths: 35 65

  * - Variant
    - Description

  * - ``minimal``
    - No language modules. Base for custom images.

  * - ``wasm``
    - WebAssembly Components (WASI 0.2) via Wasmtime.

  * - ``go1.24`` ``go1.25`` ``go1.26``
    - Go (single-version images).

  * - ``jsc17`` ``jsc21``
    - Java (Eclipse Temurin OpenJDK LTS). Runs ``.war``/``.jsp`` apps.

  * - ``node20`` ``node22`` ``node24``
    - Node.js (single-version images).

  * - ``perl5.38`` ``perl5.40``
    - Perl (single-version images).

  * - ``php8.3`` ``php8.4`` ``php8.5``
    - PHP (single-version images).

  * - ``python3.12`` ``python3.12-slim``
    - Python 3.12, full and slim.

  * - ``python3.13`` ``python3.13-slim``
    - Python 3.13, full and slim.

  * - ``python3.14`` ``python3.14-slim``
    - Python 3.14, full and slim.

  * - ``ruby3.3`` ``ruby3.4``
    - Ruby (single-version images).

 Each tag is available for both ``amd64`` and ``arm64`` architectures
 via a multi-arch manifest.

 .. note::
  **Language version support policy:** FreeUnit supports each language
  variant for **1 year after the upstream language EOL**.
  When a variant is retired, it is removed from the matrix and noted
  in ``CHANGES.txt``. EOL dates: https://endoflife.date

 Reference the image in your ``Dockerfile`` or ``docker-compose.yml``:

 .. code-block:: docker
  :caption: Example — pinning PHP 8.4

  FROM ghcr.io/freeunitorg/freeunit:1.35.3-php8.4

 .. code-block:: docker
  :caption: Example — rolling latest Python 3.13

  FROM ghcr.io/freeunitorg/freeunit:latest-python3.13

#. **Verify the image**

 .. code-block:: console

  $ docker run --rm ghcr.io/freeunitorg/freeunit:latest-minimal unitd --version
  freeunit/X.Y.Z   # Example format; actual version may differ

 .. note::
  The ``freeunit/`` prefix confirms the community fork.

#. **Deploy**

 Pull the image and start your containers:

 .. code-block:: console

  # docker-compose pull
  # docker-compose up -d

.. _migration-docker-custom:

====
Custom Images
====

If you build custom images, use FreeUnit as your base:

.. code-block:: docker
 :caption: Dockerfile

 FROM ghcr.io/freeunitorg/freeunit:minimal AS unit-base

 # Your custom layers below
 COPY --from=unit-base /usr/lib/unit/modules /usr/lib/unit/modules
 # ... rest of your Dockerfile

.. note::
 All runtime paths, environment variables, and entrypoint behavior
 remain unchanged. Your existing Docker configuration works as-is.

.. _migration-source:

****************
Build FreeUnit from Source
****************

For bare-metal deployments or when you need maximum control,
build FreeUnit from source.

.. _migration-source-prereqs:

====
Prerequisites
====

FreeUnit compiles and runs on various Unix-like operating systems, including:

- FreeBSD || 10 or later
- Linux || 2.6 or later
- macOS || 10.6 or later
- Solaris || 11

App languages and platforms that FreeUnit can run:

- Go || 1.24 or later
- Java || 17 or later (via JSC)
- Node.js || 20 or later
- PHP || 8.3, 8.4, 8.5
- Perl || 5.38 or later
- Python || 3.12, 3.13, 3.14
- Ruby || 3.3 or later
- WebAssembly Components WASI || 0.2

Optional dependencies:

- OpenSSL 1.0.1 or later for :ref:`TLS` support
- PCRE (8.0+) or PCRE2 (10.23+) for :ref:`regex`
- Wasmtime for WebAssembly support

.. _migration-source-build:

====
Build and Install FreeUnit
====

#. **Clone the FreeUnit repository**

 .. code-block:: console

  $ git clone https://github.com/freeunitorg/freeunit
  $ cd freeunit

#. **Configure the FreeUnit build**

 Enable the modules you need:

 .. code-block:: console

  $ ./configure --openssl --otel \
       --modules=php:8.4,python:3.13,nodejs:22,go1.25,ruby3.4,perl5.40

 .. note::
  Run ``./configure --help`` to see all available options.
  For PHP, you can specify multiple versions: ``php:8.3,php:8.4,php:8.5``.
  Supported language versions as of April 2026:

  - **PHP**: 8.3, 8.4, 8.5
  - **Python**: 3.12, 3.13, 3.14
  - **Node.js**: 20, 22, 24
  - **Go**: 1.24, 1.25, 1.26
  - **Ruby**: 3.3, 3.4
  - **Perl**: 5.38, 5.40
  - **Java (JSC)**: 17, 21 (OpenJDK LTS for .war/.jsp applications)
  - **WebAssembly**: WASI 0.2

#. **Compile and install FreeUnit**

 .. code-block:: console

  $ make
  # make install   # or: sudo make install

 This installs:
 - ``unitd`` to ``/usr/local/sbin/``
 - ``unitctl`` to ``/usr/local/bin/``
 - Modules to ``/usr/local/lib/unit/modules/``
 - Default config directory: ``/usr/local/etc/unit/``

#. **Set up systemd service** (optional but recommended)

 Copy the provided unit file:

 .. code-block:: console

  # cp pkg/systemd/unit.service /etc/systemd/system/
  # systemctl daemon-reload
  # systemctl enable --now unit

#. **Verify the FreeUnit installation**

 .. code-block:: console

  $ unitd --version
  freeunit/X.Y.Z

.. _migration-runtime-compatibility:

*********************
Runtime Compatibility
*********************

FreeUnit preserves full compatibility with previous Unit builds:

.. list-table::

 * - Control socket
   - ``/run/unit/control.sock`` (unchanged)
 * - Log file
   - ``/var/log/unit/unit.log`` (unchanged)
 * - Configuration path
   - ``/etc/unit/config.json`` (unchanged)
 * - State directory
   - ``/var/lib/unit/`` (unchanged)
 * - User/group defaults
   - ``unit:unit`` or distribution default (unchanged)
 * - Systemd service name
   - ``unit.service`` (unchanged)

.. _migration-troubleshooting:

****************
Troubleshooting FreeUnit
****************

.. nxt_details:: FreeUnit fails to start after migration
 :hash: migration-start-fail

 If FreeUnit doesn't start after updating:

 #. Check the log:

    .. code-block:: console

     # journalctl -u unit -n 50
     # tail -f /var/log/unit/unit.log

 #. Verify module compatibility:

    .. code-block:: console

     # ls -la /usr/lib64/unit/modules/  # RHEL/Fedora
     # ls -la /usr/lib/unit/modules/    # Debian/Ubuntu

 #. Ensure matching versions:

    .. code-block:: console

     $ unitd --version
     $ rpm -qa | grep unit  # or: dpkg -l | grep unit

    All ``unit-*`` components should share the same version.

 #. Restart with debug output:

    .. code-block:: console

     # systemctl stop unit
     # unitd --no-daemon --control /run/unit/control.sock --log /var/log/unit/unit.log

.. nxt_details:: PHP module not detected in FreeUnit
 :hash: migration-php-module

 If your PHP application isn't recognized by FreeUnit:

 #. Confirm the module is installed or built:

    .. code-block:: console

     # rpm -qa | grep unit-php  # RHEL/Fedora (Remi packages)
     # ./configure --help | grep php  # Source build check

 #. Check module loading:

    .. code-block:: console

     # unitd --test-config /etc/unit/config.json

 #. Restart FreeUnit to reload modules:

    .. code-block:: console

     # systemctl restart unit

 #. Verify PHP SAPI in your app config:

    .. code-block:: json
     :caption: Example application config

     {
       "type": "php",
       "root": "/var/www/myapp",
       "index": "index.php",
       "script": "index.php"
     }

.. _migration-roll-back:

****************
Rollback Procedure
****************

If you need to revert to the previous setup:

#. **Stop FreeUnit**

 .. code-block:: console

  # systemctl stop unit

#. **Restore previous binary or image**

 .. tabs::
  :prefix: rollback-method

  .. tab:: Docker

   Revert the image tag in your ``docker-compose.yml`` or ``Dockerfile``:

   .. code-block:: docker

    FROM ghcr.io/freeunitorg/freeunit:1.35.0-php8.4   # Previous pinned version; replace variant to match your image

   Then redeploy:

   .. code-block:: console

    # docker-compose pull
    # docker-compose up -d

  .. tab:: Source build

   Rebuild the previous version from source:

   .. code-block:: console

    $ git clone https://github.com/freeunitorg/freeunit
    $ cd freeunit
    $ git checkout 1.35.0   # Or your previous version tag
    $ ./configure --openssl
    $ make
    # make install

  .. tab:: Community repositories

   Reinstall the original package from your distribution:

   .. tabs::
    :prefix: rollback-reinstall

    .. tab:: Alpine

     .. code-block:: console

      # apk add unit

    .. tab:: Arch

     .. code-block:: console

      $ yay -S unit

    .. tab:: Gentoo

     .. code-block:: console

      # emerge www-servers/unit

    .. tab:: Remi's RPM

     .. code-block:: console

      # dnf downgrade unit
      # or: dnf install unit-1.35.0-1.remi

#. **Restart**

 .. code-block:: console

  # systemctl start unit

.. note::
 Configuration files in ``/etc/unit/`` and application data
 in ``/var/lib/unit/`` are preserved during binary changes.

.. _migration-faq:

***
FAQ
***

**Q: Will my config.json break after migrating to FreeUnit?**

No. FreeUnit maintains 100% compatibility with previous Unit builds.
Your ``config.json`` works as-is.

**Q: Can I mix FreeUnit core with Remi's PHP modules?**

Yes. FreeUnit's core binary is ABI-compatible with Remi's
``phpXX-unit-php`` modules. This is the basis of the
:ref:`hybrid approach <migration-remi-hybrid>`.

**Q: How do I verify I'm running FreeUnit?**

Check the version string:

.. code-block:: console

 $ unitd --version
 freeunit/X.Y.Z   # Example format; actual version may differ

The ``freeunit/`` prefix confirms the community fork.

**Q: What if I need PHP 8.2 or older?**

FreeUnit provides modules for PHP 8.3, 8.4, and 8.5.
For older PHP versions, consider:

- Using Remi's modules with FreeUnit core (compatible)
- Building legacy modules from source with custom ``./configure`` flags
- Containerizing legacy apps with Docker using pinned base images

**Q: Is there a migration script for FreeUnit?**

A helper script is planned for a future release.
Track progress on our roadmap:
https://github.com/freeunitorg/freeunit/milestone/3

Until then, follow the manual steps above — they take <5 minutes.

**Q: Where is the GPG key for FreeUnit package verification?**

Official RPM/DEB packages for FreeUnit are not yet available.
When they are released, the public key will be published at:
http://freeunit.org/media/keys/6C68B7AA.asc

For source builds, verify commits via GitHub signatures:
https://github.com/freeunitorg/freeunit/commits/main

.. seealso::

 - :doc:`installation` — Install FreeUnit from scratch
 - :doc:`configuration` — Application configuration reference
 - :ref:`community` — Get help from the FreeUnit community