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

# Build every site, then run the end-to-end suite in every browser project
test-e2e: build-all
    rm -rf test-results
    npm run test-e2e

# Run the end-to-end suite in one browser project, against sites already built
test-e2e-on project:
    rm -rf test-results
    npm run test-e2e -- --project "{{project}}"

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

# Write the SVG a generator describes (just gen <path to <id>.gen.ts>)
gen file:
    node scripts/gen.ts {{file}}

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

# Build the nginx image for one site: just build-image kafka
build-image site:
    docker build --build-arg SITE={{ site }} -t learning-animated-{{ site }}:dev .

# Run a site's image on http://localhost:3000
start-container site:
    docker run --rm -p 3000:3000 learning-animated-{{ site }}:dev

# Remove build output
clean:
    rm -rf coverage tracks/*/dist tracks/*/.astro home/dist home/.astro

# Run all checks and tests before committing
pre-commit: check test

# Prepare for a new release (strip -SNAPSHOT, run checks, commit the bump)
pre-release:
    #!/usr/bin/env bash
    set -euo pipefail

    if [[ -n "$(git status --porcelain)" ]]; then
      echo "Git working directory is not clean. Please commit or stash your changes."
      exit 1
    fi

    echo "Running checks, tests, and build..."
    just check
    just test
    just build-all

    current_version=$(node -p "require('./package.json').version")
    echo "Current version is ${current_version}"

    if [[ "${current_version}" != *"-SNAPSHOT"* ]]; then
      echo "Error: current version is not a SNAPSHOT version."
      exit 1
    fi

    new_version="${current_version/-SNAPSHOT/}"
    echo "Bumping version to ${new_version}..."
    npm version --no-git-tag-version "${new_version}"

    echo "Committing version bump..."
    git add package.json package-lock.json
    git commit -m "chore(release): prepare for release v${new_version}"

    echo "Pre-release for version ${new_version} is ready."
    echo "Open a pull request; merging it triggers the Continuous Delivery workflow."
