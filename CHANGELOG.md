# Changelog

All notable changes to FreeUnit Documentation are documented in this file.

## [1.2.0] - 2026-05-18

### Added
- Comprehensive accessibility widget with 7 independent modes (text size, contrast, dyslexia-friendly font, spacing, animations, link highlighting, color vision)
- localStorage persistence for accessibility preferences
- Keyboard accessibility (Alt+A to toggle, Escape to close, Tab focus trap)
- Material Design accessibility icon with 24×24 viewBox

### Changed
- Migrated layout from float-based to CSS Grid for better responsive design
- Typography scaling with `clamp()` for improved readability
- Line-height set to 1.65 for enhanced readability in normal mode
- Updated accessibility icon from Font Awesome 6 to Material Design
- Simplified logo to static 2-column flex layout (icon and version badge)

### Fixed
- Animation disable mode now properly disables smooth scroll behavior
- Fixed positioning now correctly anchored to viewport when grayscale filter is active
- Mobile layout: moved accessibility widget to bottom-left to prevent overlap with mobile menu button
- Logo no longer drifts horizontally in sidebar overflow; now uses max-height collapse animation
- High contrast modes now properly override all design tokens for WCAG 7:1+ compliance

---

## [1.1.0] - 2026-05-05

### Added
- Full-text search with lunr.js library
- Global search box in sidebar with keyboard shortcut (Cmd+K / Ctrl+K)
- Search autocomplete with popular page suggestions
- Keyboard navigation (Enter to search, Escape to close)
- Responsive dark/light mode search UI
- Search index generation via Sphinx extension

---

## [1.0.0] - 2026-05-05

### Added
- Initial FreeUnit documentation website
- Comprehensive guides for installation, configuration, and usage
- Control API documentation
- Status API documentation
- Scripting and security sections
- Community resources and troubleshooting guides
- Docker and deployment examples
- Theme and static assets
- Build system with Sphinx and Make
