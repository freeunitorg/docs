.. meta::
   :og:description: Download official packages,
                    use third-party repositories,
                    or configure a custom build from source.

.. include:: include/replace.rst

############
Installation
############

.. warning::
   **Official FreeUnit RPM/DEB packages are coming soon.**
   As of April 2026, FreeUnit is distributed via Docker images,
   source builds, and pre-built ``unitctl`` binaries from GitHub Releases.
   The ``packages.nginx.org/unit/*`` repositories described below
   belong to the archived NGINX Unit project and will not receive further
   updates — use them only to migrate off.
   See the :doc:`migration` guide for the current install paths
   and for maintainer instructions on rebasing community packages.

You can install FreeUnit in four alternative ways:

- Choose from our official :ref:`binary packages <installation-precomp-pkgs>`
  for a few popular systems (**coming soon** — see the
  :doc:`migration guide <migration>` for the current status
  and :ref:`Docker <migration-docker>` / :ref:`Source <migration-source>`
  install paths).

- If your preferred OS or language version
  is missing from the official package list,
  try :ref:`third-party repositories <installation-community-repos>`.
  Be warned, though: we don't maintain them.
  Packagers updating those recipes should follow the
  :ref:`maintainer guide <migration-community-repos>`.

- Run our :ref:`Docker official images <migration-docker>`,
  prepackaged with varied language combinations.

- To fine-tune FreeUnit to your goals,
  download the :ref:`sources <source>`,
  install the :ref:`toolchain <source-prereq-build>`,
  and :ref:`build <source-config-src>` a custom binary from scratch;
  just make sure you know what you're doing.

.. note::
   The commands in this document starting with a hash (#) must be run as root or
   with superuser privileges.


.. _source-prereqs:

*************
Prerequisites
*************

Unit compiles and runs on various Unix-like operating systems, including:

- FreeBSD |_| 10 or later
- Linux |_| 2.6 or later
- macOS |_| 10.6 or later
- Solaris |_| 11

It also supports most modern instruction set architectures, such as:

- ARM
- IA-32
- PowerPC
- MIPS
- S390X
- x86-64

App languages and platforms that Unit can run
(including several versions of the same language):

- Go |_| 1.6 or later
- Java |_| 8 or later
- Node.js |_| 8.11 or later
- PHP |_| 5, 7, 8
- Perl |_| 5.12 or later
- Python |_| 2.6, 2.7, 3
- Ruby |_| 2.0 or later
- WebAssembly Components WASI |_| 0.2

Optional dependencies:

- OpenSSL 1.1.1 or later for :ref:`TLS <configuration-ssl>` support

- PCRE (8.0 or later) or PCRE2 (10.23 or later)
  for :ref:`regular expression matching
  <configuration-routes-matching-patterns-regex>`

- The
  `njs <https://nginx.org/en/docs/njs/>`__
  scripting language

- Wasmtime for WebAssembly Support


.. _installation-precomp-pkgs:

*****************
Official packages
*****************

.. warning::
   **Official FreeUnit RPM/DEB packages are coming soon.**
   The repositories, keys, and package names documented in this section
   (``packages.nginx.org/unit/*``, ``nginx-keyring.gpg``, ``unit``,
   ``unit-php``, …) refer to the **archived NGINX Unit** project and
   are kept here for reference only. Until FreeUnit's native packages
   land, install via :ref:`Docker <migration-docker>` or a
   :ref:`source build <migration-source>`.
   Progress: https://github.com/freeunitorg/freeunit/milestone/2

Historically, official precompiled Unit binary packages
have been available for:

- Amazon |_| Linux :ref:`AMI <installation-amazon-ami>`,
  Amazon |_| Linux |_| :ref:`2 <installation-amazon-20lts>`,
  Amazon |_| Linux |_| :ref:`2023 <installation-amazon-2023>`

- Debian |_| :ref:`11 <installation-debian-11>`,
  :ref:`12 <installation-debian-12>`

- Fedora |_| :ref:`41 <installation-fedora-41>`

- RHEL |_| :ref:`8 <installation-rhel-8x>`,
  :ref:`9 <installation-rhel-9x>`

- Ubuntu |_| :ref:`16.04 <installation-ubuntu-1604>`,
  :ref:`18.04 <installation-ubuntu-1804>`,
  :ref:`20.04 <installation-ubuntu-2004>`,
  :ref:`22.04 <installation-ubuntu-2204>`,
  :ref:`24.04 <installation-ubuntu-2404>`

The packages include core executables,
developer files,
and support for individual languages.
We also maintain a Homebrew :ref:`tap <installation-macos-homebrew>` for
macOS users and a :ref:`module <installation-nodejs-package>` for Node.js
at the `npm <https://www.npmjs.com/package/unit-http>`_ registry.

.. note::

   For details of packaging custom modules
   that install alongside the official Unit,
   see :ref:`here <modules-pkg>`.

.. nxt_details:: Repo installation script
   :hash: repo-install

   .. warning::

      This script targets the archived NGINX Unit repositories
      (``packages.nginx.org/unit/*``) and is **not** compatible with FreeUnit.
      Use the manual steps below for each distribution,
      or install via :ref:`Docker <installation-docker>` /
      :ref:`source build <source>`.

   The original script is archived at
   `github.com/nginx/unit/tree/master/tools
   <https://github.com/nginx/unit/tree/master/tools>`__ for reference only.


.. _installation-precomp-amazon:

============
Amazon Linux
============

.. tabs::
   :prefix: amazon

   .. tab:: 2023

      Supported architecture: x86-64.

      #. To configure Unit's repository,
         create the following file named
         **/etc/yum.repos.d/unit.repo**:

         .. code-block:: ini

            [unit]
            name=unit repo
            baseurl=https://packages.nginx.org/unit/amzn/2023/$basearch/
            gpgkey=https://unit.nginx.org/keys/nginx-keyring.gpg
            gpgcheck=1
            enabled=1

      #. Install the core package
         and other packages you need:

         .. code-block:: console

            # yum install unit

         .. code-block:: console

            # yum install :nxt_hint:`unit-devel <Required to install the Node.js module>` unit-jsc17 unit-perl  \
                  unit-php unit-python39 unit-python311 unit-wasm

         .. code-block:: console

            # systemctl restart unit  # Necessary for Unit to pick up any changes in language module setup

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <sec-socket>`
           - **/var/run/unit/control.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**


   .. tab:: 2.0 LTS

      Supported architecture: x86-64.

      #. To configure Unit's repository,
         create the following file named
         **/etc/yum.repos.d/unit.repo**:

         .. code-block:: ini

            [unit]
            name=unit repo
            baseurl=https://packages.nginx.org/unit/amzn2/$releasever/$basearch/
            gpgkey=https://unit.nginx.org/keys/nginx-keyring.gpg
            gpgcheck=1
            enabled=1

      #. Install the core package
         and other packages you need:

         .. code-block:: console

            # yum install unit

         .. code-block:: console

            # yum install :nxt_hint:`unit-devel <Required to install the Node.js module>` unit-jsc8 unit-perl  \
                  unit-php unit-python27 unit-python37 unit-wasm

         .. code-block:: console

            # systemctl restart unit  # Necessary for Unit to pick up any changes in language module setup

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <sec-socket>`
           - **/var/run/unit/control.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**


   .. tab:: AMI

      .. warning::

         Unit's 1.22+ packages aren't built for Amazon Linux AMI.
         This distribution is obsolete;
         please update.

      Supported architecture: x86-64.

      #. To configure Unit's repository,
         create the following file named
         **/etc/yum.repos.d/unit.repo**:

         .. code-block:: ini

            [unit]
            name=unit repo
            baseurl=https://packages.nginx.org/unit/amzn/$releasever/$basearch/
            gpgkey=https://unit.nginx.org/keys/nginx-keyring.gpg
            gpgcheck=1
            enabled=1

      #. Install the core package
         and other packages you need:

         .. code-block:: console

            # yum install unit

         .. code-block:: console

            # yum install :nxt_hint:`unit-devel <Required to install the Node.js module>` unit-jsc8 unit-perl unit-php  \
                  unit-python27 unit-python34 unit-python35 unit-python36

         .. code-block:: console

            # systemctl restart unit  # Necessary for Unit to pick up any changes in language module setup

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <sec-socket>`
           - **/var/run/unit/control.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**


.. _installation-precomp-deb:

======
Debian
======

.. tabs::
   :prefix: debian

   .. tab:: 12

      Supported architectures: arm64, x86-64.

      #. Download and save NGINX's signing key:

         .. code-block:: console

            # curl --output /usr/share/keyrings/nginx-keyring.gpg  \
                  https://unit.nginx.org/keys/nginx-keyring.gpg

         This eliminates the
         "packages cannot be authenticated"
         warnings
         during installation.

      #. To configure Unit's repository,
         create the following file named
         **/etc/apt/sources.list.d/unit.list**:

         .. code-block:: none

            deb [signed-by=/usr/share/keyrings/nginx-keyring.gpg] https://packages.nginx.org/unit/debian/ bookworm unit
            deb-src [signed-by=/usr/share/keyrings/nginx-keyring.gpg] https://packages.nginx.org/unit/debian/ bookworm unit

      #. Install the core package
         and other packages you need:

         .. code-block:: console

            # apt update

         .. code-block:: console

            # apt install unit

         .. code-block:: console

            # apt install :nxt_hint:`unit-dev <Required to install the Node.js module>` unit-jsc17 unit-perl  \
                  unit-php unit-python3.11 unit-ruby unit-wasm

         .. code-block:: console

            # systemctl restart unit  # Necessary for Unit to pick up any changes in language module setup


      Runtime details:

      .. list-table::

         * - Control :ref:`socket <sec-socket>`
           - **/var/run/control.unit.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**


   .. tab:: 11

      Supported architectures: arm64, x86-64.

      #. Download and save NGINX's signing key:

         .. code-block:: console

            # curl --output /usr/share/keyrings/nginx-keyring.gpg  \
                  https://unit.nginx.org/keys/nginx-keyring.gpg

         This eliminates the
         "packages cannot be authenticated"
         warnings
         during installation.

      #. To configure Unit's repository,
         create the following file named
         **/etc/apt/sources.list.d/unit.list**:

         .. code-block:: none

            deb [signed-by=/usr/share/keyrings/nginx-keyring.gpg] https://packages.nginx.org/unit/debian/ bullseye unit
            deb-src [signed-by=/usr/share/keyrings/nginx-keyring.gpg] https://packages.nginx.org/unit/debian/ bullseye unit

      #. Install the core package
         and other packages you need:

         .. code-block:: console

            # apt update

         .. code-block:: console

            # apt install unit

         .. code-block:: console

            # apt install :nxt_hint:`unit-dev <Required to install the Node.js module>` unit-jsc11 unit-perl  \
                  unit-php unit-python2.7 unit-python3.9 unit-ruby unit-wasm

         .. code-block:: console

            # systemctl restart unit  # Necessary for Unit to pick up any changes in language module setup


      Runtime details:

      .. list-table::

         * - Control :ref:`socket <sec-socket>`
           - **/var/run/control.unit.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**


.. _installation-precomp-fedora:

======
Fedora
======

.. tabs::
   :prefix: fedora

   .. tab:: 41

      Supported architecture: x86-64.

      #. To configure Unit's repository,
         create the following file named
         **/etc/yum.repos.d/unit.repo**:

         .. code-block:: ini

            [unit]
            name=unit repo
            baseurl=https://packages.nginx.org/unit/fedora/$releasever/$basearch/
            gpgkey=https://unit.nginx.org/keys/nginx-keyring.gpg
            gpgcheck=1
            enabled=1

      #. Install the core package
         and other packages you need:

         .. code-block:: console

            # dnf install unit
            # dnf install :nxt_hint:`unit-devel <Required to install the Node.js module>` unit-jsc17 unit-perl  \
                  unit-php unit-python312 unit-ruby
            # systemctl restart unit  # Necessary for Unit to pick up any changes in language module setup

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <sec-socket>`
           - **/var/run/unit/control.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**


.. _installation-precomp-centos:
.. _installation-precomp-rhel:

====================
RHEL and derivatives
====================

.. tabs::
   :prefix: rhel

   .. tab:: 9.x

      Supported architecture: x86-64.

      #. To configure Unit's repository,
         create the following file named
         **/etc/yum.repos.d/unit.repo**:

         .. code-block:: ini

            [unit]
            name=unit repo
            baseurl=https://packages.nginx.org/unit/rhel/$releasever/$basearch/
            gpgkey=https://unit.nginx.org/keys/nginx-keyring.gpg
            gpgcheck=1
            enabled=1

      #. Install the core package
         and other packages you need:

         .. code-block:: console

            # yum install unit

         .. code-block:: console

            # yum install :nxt_hint:`unit-devel <Required to install the Node.js module and build Go apps>` unit-go unit-jsc8 unit-jsc11  \
                  unit-perl unit-php unit-python39 unit-wasm

         .. code-block:: console

            # systemctl restart unit  # Necessary for Unit to pick up any changes in language module setup

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <sec-socket>`
           - **/var/run/unit/control.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**


   .. tab:: 8.x

      Supported architecture: x86-64.

      #. To configure Unit's repository,
         create the following file named
         **/etc/yum.repos.d/unit.repo**:

         .. code-block:: ini

            [unit]
            name=unit repo
            baseurl=https://packages.nginx.org/unit/rhel/$releasever/$basearch/
            gpgkey=https://unit.nginx.org/keys/nginx-keyring.gpg
            gpgcheck=1
            enabled=1

      #. Install the core package
         and other packages you need:

         .. code-block:: console

            # yum install unit

         .. code-block:: console

            # yum install :nxt_hint:`unit-devel <Required to install the Node.js module>` unit-jsc8 unit-jsc11  \
                  unit-perl unit-php unit-python27 unit-python36 unit-python38 unit-python39 unit-wasm

         .. code-block:: console

            # systemctl restart unit  # Necessary for Unit to pick up any changes in language module setup

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <sec-socket>`
           - **/var/run/unit/control.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**

.. note::

   Use these steps
   for binary-compatible distributions:
   AlmaLinux,
   CentOS,
   Oracle Linux,
   or Rocky Linux.


.. _installation-precomp-ubuntu:

======
Ubuntu
======

.. tabs::
   :prefix: ubuntu

   .. tab:: 24.04

      Supported architectures: arm64, x86-64.

      #. Download and save NGINX's signing key:

         .. code-block:: console

            # curl --output /usr/share/keyrings/nginx-keyring.gpg  \
                  https://unit.nginx.org/keys/nginx-keyring.gpg

         This eliminates the
         "packages cannot be authenticated"
         warnings
         during installation.

      #. To configure Unit's repository,
         create the following file named
         **/etc/apt/sources.list.d/unit.list**:

         .. code-block:: none

            deb [signed-by=/usr/share/keyrings/nginx-keyring.gpg] https://packages.nginx.org/unit/ubuntu/ noble unit
            deb-src [signed-by=/usr/share/keyrings/nginx-keyring.gpg] https://packages.nginx.org/unit/ubuntu/ noble unit

      #. Install the core package
         and other packages you need:

         .. code-block:: console

            # apt update

         .. code-block:: console

            # apt install unit

         .. code-block:: console

            # apt install :nxt_hint:`unit-dev <Required to install the Node.js module and build Go apps>` unit-go unit-jsc11 unit-jsc17 unit-jsc21 \
                          unit-perl unit-php unit-python3.12 unit-ruby unit-wasm

         .. code-block:: console

            # systemctl restart unit  # Necessary for Unit to pick up any changes in language module setup

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <sec-socket>`
           - **/var/run/control.unit.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**


   .. tab:: 22.04

      Supported architectures: arm64, x86-64.

      #. Download and save NGINX's signing key:

         .. code-block:: console

            # curl --output /usr/share/keyrings/nginx-keyring.gpg  \
                  https://unit.nginx.org/keys/nginx-keyring.gpg

         This eliminates the
         "packages cannot be authenticated"
         warnings
         during installation.

      #. To configure Unit's repository,
         create the following file named
         **/etc/apt/sources.list.d/unit.list**:

         .. code-block:: none

            deb [signed-by=/usr/share/keyrings/nginx-keyring.gpg] https://packages.nginx.org/unit/ubuntu/ jammy unit
            deb-src [signed-by=/usr/share/keyrings/nginx-keyring.gpg] https://packages.nginx.org/unit/ubuntu/ jammy unit

      #. Install the core package
         and other packages you need:

         .. code-block:: console

            # apt update

         .. code-block:: console

            # apt install unit

         .. code-block:: console

            # apt install :nxt_hint:`unit-dev <Required to install the Node.js module and build Go apps>` unit-go unit-jsc11 unit-jsc16 unit-jsc17 unit-jsc18  \
                          unit-perl unit-php unit-python2.7 unit-python3.10 unit-ruby unit-wasm

         .. code-block:: console

            # systemctl restart unit  # Necessary for Unit to pick up any changes in language module setup

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <sec-socket>`
           - **/var/run/control.unit.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**


   .. tab:: 20.04

      Supported architectures: arm64, x86-64.

      #. Download and save NGINX's signing key:

         .. code-block:: console

            # curl --output /usr/share/keyrings/nginx-keyring.gpg  \
                  https://unit.nginx.org/keys/nginx-keyring.gpg

         This eliminates the
         "packages cannot be authenticated"
         warnings
         during installation.

      #. To configure Unit's repository,
         create the following file named
         **/etc/apt/sources.list.d/unit.list**:

         .. code-block:: none

            deb [signed-by=/usr/share/keyrings/nginx-keyring.gpg] https://packages.nginx.org/unit/ubuntu/ focal unit
            deb-src [signed-by=/usr/share/keyrings/nginx-keyring.gpg] https://packages.nginx.org/unit/ubuntu/ focal unit

      #. Install the core package
         and other packages you need:

         .. code-block:: console

            # apt update

         .. code-block:: console

            # apt install unit

         .. code-block:: console

            # apt install :nxt_hint:`unit-dev <Required to install the Node.js module>` unit-jsc11 unit-perl  \
                  unit-php unit-python2.7 unit-python3.8 unit-ruby unit-wasm

         .. code-block:: console

            # systemctl restart unit  # Necessary for Unit to pick up any changes in language module setup

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <sec-socket>`
           - **/var/run/control.unit.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**


   .. tab:: 18.04

      .. warning::

         Unit's 1.31+ packages aren't built for Ubuntu 18.04.
         This distribution is obsolete;
         please update.

      Supported architectures: arm64, x86-64.

      #. Download and save NGINX's signing key:

         .. code-block:: console

            # curl --output /usr/share/keyrings/nginx-keyring.gpg  \
                  https://unit.nginx.org/keys/nginx-keyring.gpg

         This eliminates the
         "packages cannot be authenticated"
         warnings
         during installation.

      #. To configure Unit's repository,
         create the following file named
         **/etc/apt/sources.list.d/unit.list**:

         .. code-block:: none

            deb [signed-by=/usr/share/keyrings/nginx-keyring.gpg] https://packages.nginx.org/unit/ubuntu/ bionic unit
            deb-src [signed-by=/usr/share/keyrings/nginx-keyring.gpg] https://packages.nginx.org/unit/ubuntu/ bionic unit

      #. Install the core package
         and other packages you need:

         .. code-block:: console

            # apt update

         .. code-block:: console

            # apt install unit

         .. code-block:: console

            # apt install :nxt_hint:`unit-dev <Required to install the Node.js module>` unit-jsc8 unit-jsc11 unit-perl  \
                  unit-php unit-python2.7 unit-python3.6 unit-python3.7 unit-ruby

         .. code-block:: console

            # systemctl restart unit  # Necessary for Unit to pick up any changes in language module setup

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <sec-socket>`
           - **/var/run/control.unit.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**


   .. tab:: 16.04

      .. warning::

         Unit's 1.24+ packages aren't built for Ubuntu 16.04.
         This distribution is obsolete;
         please update.

      Supported architectures: arm64, i386, x86-64.

      #. Download and save NGINX's signing key:

         .. code-block:: console

            # curl --output /usr/share/keyrings/nginx-keyring.gpg  \
                  https://unit.nginx.org/keys/nginx-keyring.gpg

         This eliminates the
         "packages cannot be authenticated"
         warnings
         during installation.

      #. To configure Unit's repository,
         create the following file named
         **/etc/apt/sources.list.d/unit.list**:

         .. code-block:: none

            deb [signed-by=/usr/share/keyrings/nginx-keyring.gpg] https://packages.nginx.org/unit/ubuntu/ xenial unit
            deb-src [signed-by=/usr/share/keyrings/nginx-keyring.gpg] https://packages.nginx.org/unit/ubuntu/ xenial unit

      #. Install the core package
         and other packages you need:

         .. code-block:: console

            # apt update

         .. code-block:: console

            # apt install unit

         .. code-block:: console

            # apt install :nxt_hint:`unit-dev <Required to install the Node.js module>` unit-jsc8 unit-perl unit-php  \
                  unit-python2.7 unit-python3.5 unit-ruby

         .. code-block:: console

            # systemctl restart unit  # Necessary for Unit to pick up any changes in language module setup

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <sec-socket>`
           - **/var/run/control.unit.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**


.. _installation-macos:
.. _homebrew:

=====
macOS
=====
.. tabs::
   :prefix: macos
   :toc:

   .. tab:: Homebrew

      .. warning::

         The Homebrew tap for FreeUnit is not yet published.
         Install via :ref:`Docker <installation-docker>` or a
         :ref:`source build <source>` until the tap lands.

      Previously, Unit on macOS was installed via the
      `nginx/homebrew-unit <https://github.com/nginx/homebrew-unit>`_ tap:

      .. code-block:: console

         $ brew install nginx/unit/unit  # archived; do not use

      This deploys the core Unit binary
      and the prerequisites for the
      :ref:`Node.js <installation-nodejs-package>`
      language module.

      To install the Java, Perl, Python, and Ruby language modules
      from Homebrew:

      .. code-block:: console

         $ brew install unit-java unit-perl unit-php unit-python unit-python3 unit-ruby

      .. code-block:: console

         # pkill unitd  # Stop Unit

      .. code-block:: console

         # unitd        # Start Unit to pick up any changes in language module setup

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <sec-socket>`
           - **/usr/local/var/run/unit/control.sock** (Intel), **/opt/homebrew/var/run/unit/control.sock** (Apple Silicon)

         * - Log :ref:`file <troubleshooting-log>`
           - **/usr/local/var/log/unit/unit.log** (Intel), **/opt/homebrew/var/log/unit/unit.log** (Apple Silicon)

         * - Non-privileged :ref:`user and group <security-apps>`
           - **nobody**

.. note::

   To run Unit as **root** on macOS:

   .. code-block:: console

      $ export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES

   .. code-block:: console

      $ sudo --preserve-env=OBJC_DISABLE_INITIALIZE_FORK_SAFETY :nxt_ph:`/path/to/unitd <Unit's executable pathname>` ...


.. _installation-nodejs-package:

=======
Node.js
=======

Unit's npm-hosted Node.js `module <https://www.npmjs.com/package/unit-http>`__
is called :program:`unit-http`.
Install it to run Node.js apps on Unit:

#. First, install the **unit-dev/unit-devel**
   :ref:`package <installation-precomp-pkgs>`; it's needed to build :program:`unit-http`.

#. Next, build and install :program:`unit-http` globally (this requires
   :program:`npm` and :program:`node-gyp`):

    .. code-block:: console

       # npm install -g --unsafe-perm unit-http

    .. warning::

       The :program:`unit-http` module is platform dependent due to optimizations;
       you can't move it across systems with the rest of **node-modules**.
       Global installation avoids such scenarios; just :ref:`relink <configuration-nodejs>`
       the migrated app.

#. It's entirely possible to run :ref:`Node.js apps <configuration-nodejs>`
   on Unit without mentioning **unit-http** in your app sources.
   However, you can explicitly use **unit-http** in your code instead of the
   built-in **http**, but mind that such frameworks as Express may require extra
   :doc:`changes <howto/express>`.

.. warning::

    The :program:`unit-http` module and :program:`Unit` must have matching version numbers.

If you update Unit later, make sure to update the module as well:

.. code-block:: console

   # npm update -g --unsafe-perm unit-http

.. note::

   You can also :ref:`configure <howto/source-modules-nodejs>` and
   :ref:`install <source-bld-src-ext>` the :program:`unit-http` module from sources.

.. nxt_details:: Working with multiple Node.js versions
   :hash: multiple-nodejs-versions

   To use Unit with multiple Node.js versions side by side, we recommend
   `Node Version Manager <https://github.com/nvm-sh/nvm>`__:

   .. code-block:: console

      $ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/:nxt_ph:`x.y.z <nvm version>`/install.sh | bash

   Install the versions you need and select the one you want to use with Unit:

   .. code-block:: console

      $ nvm install 18

   .. code-block:: console

      $ nvm install 16

   .. code-block:: console

      $ nvm use 18
            Now using node :nxt_hint:`v18.12.1 <Note the version numbers>` (npm v8.19.2)

   Having selected the specific version, install the :program:`node-gyp` module:

   .. code-block:: console

      $ npm install -g node-gyp

   Next, clone the FreeUnit source to build a :program:`unit-http` module
   for the selected Node.js version:

   .. code-block:: console

      $ git clone https://github.com/freeunitorg/freeunit

   .. code-block:: console

      $ cd freeunit

   .. code-block:: console

      $ pwd
            :nxt_hint:`/home/user/freeunit <Note the path to the source code>`

   .. code-block:: console

      $ ./configure

   .. code-block:: console

      $ ./configure nodejs

            configuring nodejs module
            checking for node ... found
             + node version :nxt_hint:`v18.12.1 <Should be the version selected with nvm>`
            checking for npm ... found
             + npm version :nxt_hint:`8.19.2 <Should be the version selected with npm>`
            checking for node-gyp ... found
             + node-gyp version v9.3.0

   Point to Unit's header files and libraries in the source code directory
   to build the module:

   .. code-block:: console

      $ CPPFLAGS="-I/home/user/freeunit/include/" LDFLAGS="-L/home/user/freeunit/lib/"  \
            make node-install

   .. code-block:: console

      $ npm list -g

            /home/vagrant/.nvm/versions/node/v18.12.1/lib
            ├── corepack@0.14.2
            ├── node-gyp@9.3.0
            ├── npm@8.19.2
            └── unit-http@1.29.0

   That's all;
   use the newly built module to run your
   :ref:`Node.js apps <configuration-nodejs>`
   on Unit as usual.


.. _installation-precomp-startup:

====================
Startup and shutdown
====================

.. tabs::
   :prefix: startup-shutdown
   :toc:

   .. tab:: Amazon, Debian, Fedora, RHEL, Ubuntu

      Enable Unit to launch automatically at system startup:

      .. code-block:: console

         # systemctl enable unit

      Start or restart Unit:

      .. code-block:: console

         # systemctl restart unit

      Stop a running Unit:

      .. code-block:: console

         # systemctl stop unit

      Disable Unit's automatic startup:

      .. code-block:: console

         # systemctl disable unit


   .. tab:: macOS (Homebrew)

      Start Unit as a daemon:

      .. code-block:: console

         # unitd

      Stop all Unit's processes:

      .. code-block:: console

         # pkill unitd

      For startup options, see
      :ref:`below <source-startup>`.

.. note::

   Restarting Unit is necessary
   after installing or uninstalling any language modules
   to pick up the changes.


.. _installation-community-repos:

**********************
Community Repositories
**********************

.. warning::

   These distributions are maintained by their respective communities,
   not the FreeUnit project.
   Use them with caution — they still ship the archived ``unit``/
   ``nginx-unit`` packages and may lag several releases behind.

.. note::
   **For package maintainers:** the steps to rebase these recipes onto
   ``freeunitorg/freeunit`` (rename the package, swap the source URL,
   add ``provides``/``obsoletes`` aliases, refresh checksums) are
   documented in
   :ref:`Community Repository Maintainers <migration-community-repos>`
   in the migration guide.

..
   Legacy anchors are left here so that external links remain valid

.. _installation-alpine-apk:
.. _installation-archlinux-aur:
.. _installation-scls:
.. _installation-freebsd-pkgs-prts:
.. _installation-gnt-prtg:
.. _installation-nix:
.. _installation-remirepo:

.. tabs::
   :prefix: community
   :toc:

   .. tab:: Alpine

      To install Unit's core executables
      from the Alpine Linux
      `packages <https://pkgs.alpinelinux.org/packages?name=unit*>`_:

      .. code-block:: console

         # apk update

      .. code-block:: console

         # apk upgrade

      .. code-block:: console

         # apk add unit

      To install service manager files
      and specific language modules:

      .. code-block:: console

         # apk add unit-openrc unit-perl unit-php7 unit-python3 unit-ruby

      .. code-block:: console

         # service unit restart  # Necessary for Unit to pick up any changes in language module setup

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <source-startup>`
           - **/run/control.unit.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**

         * - Startup and shutdown
           - .. code-block:: console

                # :nxt_hint:`service unit enable <Enable Unit to launch automatically at system startup>`

             .. code-block:: console

                # :nxt_hint:`service unit restart <Start or restart Unit; one-time action>`

             .. code-block:: console

                # :nxt_hint:`service unit stop <Stop a running Unit; one-time action>`

             .. code-block:: console

                # :nxt_hint:`service unit disable <Disable Unit's automatic startup>`


   .. tab:: ALT

      To install Unit's core executables
      and specific language modules
      from the Sisyphus
      `packages <https://packages.altlinux.org/en/sisyphus/srpms/unit>`__:

      .. code-block:: console

         # apt-get update

      .. code-block:: console

         # apt-get install unit

      .. code-block:: console

         # apt-get install unit-perl unit-php unit-python3 unit-ruby

      .. code-block:: console

         # service unit restart  # Necessary for Unit to pick up any changes in language module setup

      Versions of these packages
      with the ***-debuginfo** suffix
      contain symbols for
      :ref:`debugging <troubleshooting-core-dumps>`.

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <source-startup>`
           - **/run/unit/control.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **_unit** (mind the **_** prefix)

         * - Startup and shutdown
           - .. code-block:: console

                # :nxt_hint:`service unit enable <Enable Unit to launch automatically at system startup>`

             .. code-block:: console

                # :nxt_hint:`service unit restart <Start or restart Unit; one-time action>`

             .. code-block:: console

                # :nxt_hint:`service unit stop <Stop a running Unit; one-time action>`

             .. code-block:: console

                # :nxt_hint:`service unit disable <Disable Unit's automatic startup>`


   .. tab:: Arch

      To install Unit's core executables and all language modules,
      clone the
      `Arch User Repository (AUR)
      <https://aur.archlinux.org/pkgbase/nginx-unit/>`_:

      .. code-block:: console

         $ git clone https://aur.archlinux.org/nginx-unit.git
         $ cd nginx-unit

      Before proceeding further,
      verify that the **PKGBUILD** and the accompanying files
      aren't malicious or untrustworthy.
      AUR packages are user produced without pre-moderation;
      use them at your own risk.

      Next, build the package:

      .. code-block:: console

         $ makepkg -si

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <source-startup>`
           - **/run/nginx-unit.control.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/nginx-unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **nobody**

         * - Startup and shutdown
           - .. code-block:: console

                # :nxt_hint:`systemctl enable unit <Enable Unit to launch automatically at system startup>`

             .. code-block:: console

                # :nxt_hint:`systemctl restart unit <Start or restart Unit; one-time action>`

             .. code-block:: console

                # :nxt_hint:`systemctl stop unit <Stop a running Unit; one-time action>`

             .. code-block:: console

                # :nxt_hint:`systemctl disable unit <Disable Unit's automatic startup>`


   .. tab:: FreeBSD

        To install
        `FreeUnit
        <https://www.freshports.org/www/freeunit/>`_,
        get the core package and other packages you need:

        .. code-block:: console

           # pkg install -y freeunit

        .. code-block:: console

           # pkg install -y freeunit-php85 freeunit-python312

        .. code-block:: console

           # service unitd restart  # Necessary for Unit to pick up any changes in language module setup

        Runtime details:

        .. list-table::

           * - Rc script
             - **/usr/local/etc/rc.d/unitd**

           * - Control :ref:`socket <source-startup>`
             - **/var/run/unit/control.unit.sock**

           * - Log :ref:`file <troubleshooting-log>`
             - **/var/log/freeunit/freeunit.log**

           * - Non-privileged :ref:`user and group <security-apps>`
             - **www**

           * - Startup and shutdown
             - .. code-block:: console

                  # :nxt_hint:`service unitd enable <Enable FreeUnit to launch automatically at system startup>`

               .. code-block:: console

                  # :nxt_hint:`service unitd restart <Start or restart FreeUnit; one-time action>`

               .. code-block:: console

                  # :nxt_hint:`service unitd stop <Stop a running FreeUnit; one-time action>`

               .. code-block:: console

                  # :nxt_hint:`service unitd disable <Disable FreeUnit's automatic startup>`


   .. tab:: Gentoo

      To install Unit using
      `Portage <https://wiki.gentoo.org/wiki/Handbook:X86/Full/Portage>`_,
      update the repository
      and install the
      `package
      <https://packages.gentoo.org/packages/www-servers/nginx-unit>`__:

      .. code-block:: console

         # emerge --sync

      .. code-block:: console

         # emerge www-servers/nginx-unit

      To install specific language modules and features,
      apply the corresponding
      `USE flags
      <https://packages.gentoo.org/packages/www-servers/nginx-unit>`_.

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <source-startup>`
           - **/run/nginx-unit.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/nginx-unit**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **nobody**

         * - Startup and shutdown
           - .. code-block:: console

                # :nxt_hint:`rc-update add nginx-unit <Enable Unit to launch automatically at system startup>`

             .. code-block:: console

                # :nxt_hint:`rc-service nginx-unit restart <Start or restart Unit; one-time action>`

             .. code-block:: console

                # :nxt_hint:`rc-service nginx-unit stop <Stop a running Unit; one-time action>`

             .. code-block:: console

                # :nxt_hint:`rc-update del nginx-unit <Disable Unit's automatic startup>`


   .. tab:: NetBSD

      To install Unit's core package
      and the other packages you need
      from the
      `NetBSD Packages Collection
      <https://cdn.netbsd.org/pub/pkgsrc/current/pkgsrc/www/unit/index.html>`_:

      .. code-block:: console

         # pkg_add unit

      .. code-block:: console

         # pkg_add :nxt_hint:`libunit <Required to install the Node.js module>`

      .. code-block:: console

         # pkg_add unit-perl  \
                   unit-python2.7  \
                   unit-python3.8 unit-python3.9 unit-python3.10 unit-python3.11 unit-python3.12  \
                   unit-ruby31 unit-ruby32 unit-ruby33

      .. code-block:: console

         # service unit restart  # Necessary for Unit to pick up any changes in language module setup

      To build Unit manually,
      start by updating the package collection:

      .. code-block:: console

         # cd /usr/pkgsrc && cvs update -dP

      Next, browse to the package path
      to build and install the core Unit binaries:

      .. code-block:: console

         # cd /usr/pkgsrc/www/unit/

      .. code-block:: console

         # make build install

      Repeat the steps for the other packages you need:
      `libunit
      <https://cdn.netbsd.org/pub/pkgsrc/current/pkgsrc/devel/libunit/index.html>`__
      (required to install the Node.js
      :ref:`module
      <installation-nodejs-package>`
      and build
      :ref:`Go apps <configuration-go>`),
      `unit-perl
      <https://cdn.netbsd.org/pub/pkgsrc/current/pkgsrc/www/unit-perl/index.html>`__,
      `unit-php
      <https://cdn.netbsd.org/pub/pkgsrc/current/pkgsrc/www/unit-php/index.html>`__,
      `unit-python
      <https://cdn.netbsd.org/pub/pkgsrc/current/pkgsrc/www/unit-python/index.html>`__,
      or
      `unit-ruby
      <https://cdn.netbsd.org/pub/pkgsrc/current/pkgsrc/www/unit-ruby/index.html>`__.

      Note that **unit-php** packages require the PHP package
      to be built with the **php-embed** option.
      To enable the option for **lang/php82**:

      .. code-block:: console

         # echo "PKG_OPTIONS.php82=php-embed" >> /etc/mk.conf

      After that, restart Unit:

      .. code-block:: console

         # service unit restart  # Necessary for Unit to pick up any changes in language module setup

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <source-startup>`
           - **/var/run/unit/control.unit.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**

         * - Startup and shutdown
           - First, add Unit's startup script
             to the **/etc/rc.d/** directory:

             .. code-block:: console

                # cp /usr/pkg/share/examples/rc.d/unit /etc/rc.d/

             After that, you can start and stop Unit as follows:

             .. code-block:: console

                # :nxt_hint:`service unit restart <Start or restart Unit; one-time action>`

             .. code-block:: console

                # :nxt_hint:`service unit stop <Stop a running Unit; one-time action>`

             To enable or disable Unit's automatic startup,
             edit **/etc/rc.conf**:

             .. code-block:: ini

                # Enable service:
                unit=YES

                # Disable service:
                unit=NO


   .. tab:: Nix

      To install Unit's core executables and all language modules
      using the
      `Nix <https://nixos.org>`_
      package manager,
      update the channel,
      check if Unit's available,
      and install the
      `package
      <https://github.com/NixOS/nixpkgs/tree/master/pkgs/servers/http/unit>`__:

      .. code-block:: console

         $ nix-channel --update
         $ nix-env -qa 'unit'
         $ nix-env -i unit

      This installs most embedded language modules
      and such features as SSL or IPv6 support.
      For a full list of optionals,
      see the
      `package definition
      <https://github.com/NixOS/nixpkgs/blob/master/pkgs/servers/http/unit/default.nix>`_;
      for a **.nix** configuration file defining an app,
      see
      `this sample
      <https://github.com/NixOS/nixpkgs/blob/master/nixos/tests/web-servers/unit-php.nix>`_.

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <source-startup>`
           - **/run/unit/control.unit.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **unit**

         * - Startup and shutdown
           - Add **services.unit.enable = true;** to
             **/etc/nixos/configuration.nix**
             and rebuild the system configuration:

             .. code-block:: console

                # nixos-rebuild switch

             After that, use :program:`systemctl`:

             .. code-block:: console

                # :nxt_hint:`systemctl enable unit <Enable Unit to launch automatically at system startup>`

             .. code-block:: console

                # :nxt_hint:`systemctl restart unit <Start or restart Unit; one-time action>`

             .. code-block:: console

                # :nxt_hint:`systemctl stop unit <Stop a running Unit; one-time action>`

             .. code-block:: console

                # :nxt_hint:`systemctl disable unit <Disable Unit's automatic startup>`


   .. tab:: OpenBSD

        To install Unit from
        `OpenBSD packages
        <https://www.openbsd.org/faq/faq15.html>`_,
        get the core package and other packages you need:

        .. code-block:: console

           # pkg_add unit

        .. code-block:: console

           # pkg_add unit-perl

        .. code-block:: console

           # pkg_add unit-php74

        .. code-block:: console

           # pkg_add unit-php80

        .. code-block:: console

           # pkg_add unit-php81

        .. code-block:: console

           # pkg_add unit-php82

        .. code-block:: console

           # pkg_add unit-php83

        .. code-block:: console

           # pkg_add unit-python

        .. code-block:: console

           # pkg_add unit-ruby

        .. code-block:: console

           # rcctl restart unit  # Necessary for Unit to pick up any changes in language module setup

        To install Unit from
        `OpenBSD ports <https://pkgsrc.se/www/unit>`_,
        start by updating your port collection,
        for example:

        .. code-block:: console

           $ cd /usr/

        .. code-block:: console

           $ cvs -d anoncvs@anoncvs.spacehopper.org:/cvs checkout -P ports

        Next, browse to the port path to build and install Unit:

        .. code-block:: console

           $ cd /usr/ports/www/unit/

        .. code-block:: console

           $ make

        .. code-block:: console

           # make install

        This also installs the language modules for Perl, PHP, Python, and Ruby;
        other modules can be built and installed from
        :ref:`source <source>`.
        After that, restart Unit:

        .. code-block:: console

           # rcctl restart unit  # Necessary for Unit to pick up any changes in language module setup

        Runtime details:

        .. list-table::

           * - Control :ref:`socket <source-startup>`
             - **/var/run/unit/control.unit.sock**

           * - Log :ref:`file <troubleshooting-log>`
             - **/var/log/unit/unit.log**

           * - Non-privileged :ref:`user and group <security-apps>`
             - **_unit**

           * - Startup and shutdown

             - .. code-block:: console

                  # :nxt_hint:`rcctl enable unit <Enable Unit to launch automatically at system startup>`

               .. code-block:: console

                  # :nxt_hint:`rcctl restart unit <Start or restart Unit; one-time action>`

               .. code-block:: console

                  # :nxt_hint:`rcctl stop unit <Stop a running Unit; one-time action>`

               .. code-block:: console

                  # :nxt_hint:`rcctl disable unit <Disable Unit's automatic startup>`


   .. tab:: Remi's RPM

      `Remi's RPM repository
      <https://blog.remirepo.net/post/2019/01/14/PHP-with-the-NGINX-unit-application-server>`_,
      which hosts the latest versions of the PHP stack
      for Fedora and RHEL,
      also has the core Unit package and the PHP modules.

      To use Remi's versions of Unit's packages,
      configure the
      `repository <https://blog.remirepo.net/pages/Config-en>`_
      first.
      Remi's PHP language modules are also compatible
      with the core Unit package from
      :ref:`our own
      repository <installation-precomp-pkgs>`.

      Next, install Unit and the PHP modules you want:

      .. code-block:: console

         # yum install --enablerepo=remi unit  \
               php54-unit-php php55-unit-php php56-unit-php  \
               php70-unit-php php71-unit-php php72-unit-php php73-unit-php php74-unit-php  \
               php80-unit-php php81-unit-php php82-unit-php

      .. code-block:: console

         # systemctl restart unit  # Necessary for Unit to pick up any changes in language module setup

      Runtime details:

      .. list-table::

         * - Control :ref:`socket <source-startup>`
           - **/run/unit/control.sock**

         * - Log :ref:`file <troubleshooting-log>`
           - **/var/log/unit/unit.log**

         * - Non-privileged :ref:`user and group <security-apps>`
           - **nobody**

         * - Startup and shutdown
           - .. code-block:: console

                # :nxt_hint:`systemctl enable unit <Enable Unit to launch automatically at system startup>`

             .. code-block:: console

                # :nxt_hint:`systemctl restart unit <Start or restart Unit; one-time action>`

             .. code-block:: console

                # :nxt_hint:`systemctl stop unit <Stop a running Unit; one-time action>`

             .. code-block:: console

                # :nxt_hint:`systemctl disable unit <Disable Unit's automatic startup>`


.. _installation-docker:

*************
Docker Images
*************

FreeUnit images are published to
`GitHub Container Registry <https://github.com/freeunitorg/freeunit/pkgs/container/freeunit>`_
as multi-arch manifests (``amd64`` + ``arm64``).

Tag format: :samp:`{VERSION}-{VARIANT}` (pinned) or :samp:`latest-{VARIANT}` (rolling).

.. list-table::
   :header-rows: 1
   :widths: 30 70

   * - Variant
     - Description

   * - ``minimal``
     - No language modules. Base for custom images.

   * - ``wasm``
     - WebAssembly Components (WASI 0.2) via Wasmtime.

   * - ``go1.24`` ``go1.25`` ``go1.26``
     - Go (single-version images).

   * - ``jsc17`` ``jsc21``
     - Java Servlet Container via Eclipse Temurin OpenJDK LTS.
       Runs ``.war``/``.jsp`` applications.

   * - ``node20`` ``node22`` ``node24``
     - Node.js (single-version images).

   * - ``perl5.38`` ``perl5.40``
     - Perl (single-version images).

   * - ``php8.3`` ``php8.4`` ``php8.5``
     - PHP (single-version images).

   * - ``python3.12`` ``python3.12-slim``
     - Python 3.12, full and slim variants.

   * - ``python3.13`` ``python3.13-slim``
     - Python 3.13, full and slim variants.

   * - ``python3.14`` ``python3.14-slim``
     - Python 3.14, full and slim variants.

   * - ``ruby3.3`` ``ruby3.4``
     - Ruby (single-version images).

To pull and run an image:

.. code-block:: console

   $ docker pull ghcr.io/freeunitorg/freeunit::nxt_ph:`TAG <e.g. latest-php8.4 or 1.35.3-python3.13>`

.. code-block:: console

   $ docker run -d ghcr.io/freeunitorg/freeunit::nxt_ph:`TAG <e.g. latest-php8.4 or 1.35.3-python3.13>`

.. nxt_details:: Building custom language-version images
   :hash: inst-lang-docker

   Clone the FreeUnit source, then build a specific variant locally:

   .. code-block:: console

      $ git clone https://github.com/freeunitorg/freeunit
      $ cd freeunit
      $ docker build -f pkg/docker/Dockerfile.:nxt_ph:`VARIANT <e.g. python3.13>` pkg/docker/

   See ``pkg/docker/`` for all available Dockerfiles and the
   `Makefile <https://github.com/freeunitorg/freeunit/blob/master/pkg/docker/Makefile>`__
   for the full build pipeline.
   For other customization scenarios, see the
   :doc:`Docker howto <howto/docker>`.

Runtime details:

.. list-table::

   * - Control :ref:`socket <sec-socket>`
     - **/var/run/control.unit.sock**

   * - Log :ref:`file <troubleshooting-log>`
     - Forwarded to the
       `Docker log collector
       <https://docs.docker.com/config/containers/logging/>`_

   * - Non-privileged :ref:`user and group <security-apps>`
     - **unit**

For full image details, see the
`GHCR package page <https://github.com/freeunitorg/freeunit/pkgs/container/freeunit>`_
and our :doc:`Docker howto <howto/docker>`.


.. _installation-docker-init:

=====================
Initial configuration
=====================

The official images support initial container configuration,
implemented with an **ENTRYPOINT**
`script <https://docs.docker.com/engine/reference/builder/#entrypoint>`_.
First, the script checks the Unit
:ref:`state directory <source-config-src-state>`
in the container
(**/var/lib/unit/**).
If it's empty,
the script processes certain file types
in the container's **/docker-entrypoint.d/** directory:

.. list-table::
   :header-rows: 1

   * - File Type
     - Purpose/Action

   * - **.pem**
     - :ref:`Certificate bundles <configuration-ssl>`,
       uploaded under respective names:
       **cert.pem** to **/certificates/cert**.

   * - **.json**
     - :ref:`Configuration snippets <configuration-mgmt>`, uploaded
       to the **/config** section of Unit's configuration.

   * - **.sh**
     - :nxt_hint:`Shell scripts
       <Use shebang in your scripts to specify a custom shell>`,
       run after the **.pem** and **.json** files are uploaded;
       must be executable.

The script warns about any other file types
in **/docker-entrypoint.d/**.

This mechanism enables
customizing your containers at startup,
reusing configurations,
and automating workflows to reduce manual effort.
To use the feature,
add **COPY** directives for certificate bundles,
configuration fragments,
and shell scripts
to your **Dockerfile** derived from an official image:

.. subs-code-block:: docker

   FROM ghcr.io/freeunitorg/freeunit:|version|-minimal
   COPY ./*.pem  /docker-entrypoint.d/
   COPY ./*.json /docker-entrypoint.d/
   COPY ./*.sh   /docker-entrypoint.d/

.. note::

   Mind that running Unit even once populates its state directory;
   this prevents the script from executing,
   so this script-based initialization must occur
   before you run Unit in your derived container.

This feature comes in handy
if you want to tie Unit
to a certain app configuration for later use.
For ad-hoc initialization,
you can mount a directory with configuration files
to a container at startup:

.. subs-code-block:: console

   $ docker run -d --mount  \
            type=bind,src=:nxt_ph:`/path/to/config/files/ <Use a real path instead>`,dst=/docker-entrypoint.d/  \
            ghcr.io/freeunitorg/freeunit:|version|-minimal


.. _source:

***********
Source Code
***********

FreeUnit's source code lives in the community-maintained fork
at `github.com/freeunitorg/freeunit
<https://github.com/freeunitorg/freeunit>`_.

.. tabs::
   :prefix: get-source

   .. tab:: Git

      .. subs-code-block:: console

         $ git clone https://github.com/freeunitorg/freeunit            # Latest updates to the repository

      .. subs-code-block:: console

         $ # -- or --

      .. subs-code-block:: console

         $ git clone -b |version| https://github.com/freeunitorg/freeunit  # Specific version tag; see https://github.com/freeunitorg/freeunit/tags

      .. subs-code-block:: console

         $ cd freeunit


   .. tab:: Tarball

      .. subs-code-block:: console

         $ curl -LO https://github.com/freeunitorg/freeunit/archive/refs/tags/|version|.tar.gz

      .. subs-code-block:: console

         $ tar xzf |version|.tar.gz

      .. subs-code-block:: console

         $ cd freeunit-|version|

To build Unit and specific language modules from these sources,
refer to the
:doc:`source code howto <howto/source>`;
to package custom modules, see the
:ref:`module howto <modules-pkg>`.
