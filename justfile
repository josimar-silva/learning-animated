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

# Remove build output
clean:
    rm -rf coverage tracks/*/dist tracks/*/.astro home/dist home/.astro

# Run all checks and tests before committing
pre-commit: check test
