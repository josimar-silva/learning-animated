set shell := ["bash", "-euo", "pipefail", "-c"]

# List available recipes
default:
    @just --list

# Install dependencies
install:
    npm install

# Install dependencies exactly as locked (CI)
ci:
    npm ci

# Run every test suite once
test:
    npx vitest run

# Lint the code
lint:
    npx eslint .

# Apply lint fixes and formatting
format:
    npx eslint . --fix
    npx prettier . --write

# Lint, check formatting, and type-check
check:
    npx eslint .
    npx prettier . --check
    npx tsc -p tsconfig.json
    for p in packages/*/; do npx tsc -p "$p"; done
    just style-check
    for d in $(just _site-dirs); do npm run check --workspace "$d"; done

# Re-embed the canonical LA-STYLE block into every animation SVG
style:
    node packages/design/bin/la-style.ts tracks/*/src/content/animations

# Fail if any SVG's LA-STYLE block drifted from theme.css
style-check:
    node packages/design/bin/la-style.ts --check tracks/*/src/content/animations

# The site folders that exist, one per line
_site-dirs:
    @for d in home tracks/*; do if [ -f "$d/astro.config.ts" ]; then echo "$d"; fi; done

# Run a site's dev server, for example: just dev quarkus
dev site:
    npm run dev --workspace {{ if site == "home" { "home" } else { "tracks/" + site } }}

# Build one site into its dist/
build site:
    npm run build --workspace {{ if site == "home" { "home" } else { "tracks/" + site } }}

# Serve a built site with its production headers
preview site:
    npm run preview --workspace {{ if site == "home" { "home" } else { "tracks/" + site } }}

# Build every site
build-all:
    for d in $(just _site-dirs); do npm run build --workspace "$d"; done

# Audit every built site: links resolve, and the theme boot is the only inline script
check-dist:
    node scripts/check-dist.ts $(for d in $(just _site-dirs); do echo "$d/dist"; done)

# Scan tracked files (and, with --commits <range>, commit metadata) for forbidden terms
forbidden-terms *args:
    node scripts/forbidden-terms.ts {{ args }}

# Remove build output
clean:
    rm -rf coverage tracks/*/dist tracks/*/.astro home/dist home/.astro

# Run all checks and tests before committing
pre-commit: check test
