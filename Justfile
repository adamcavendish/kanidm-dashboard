# Kanidm Dashboard — Justfile

default:
    @just --list

# === SDK generation ===

# Generate the TypeScript SDK from the checked-in Kanidm OpenAPI spec.
# Requires openapi-nexus ≥ 0.1.13: cargo binstall openapi-nexus
generate-sdk:
    openapi-nexus generate \
      -i spec/kanidm-openapi.json \
      -o src/generated/kanidm-sdk \
      -g typescript-fetch \
      --generator-config typescript-fetch.generate_package=false \
      --generator-config typescript-fetch.property_naming=camelCase \
      --generator-config typescript-fetch.file_naming_convention=PascalCase \
      --generator-config typescript-fetch.ts_target=ES2022 \
      --generator-config typescript-fetch.ts_module=ESNext \
      --generator-config typescript-fetch.include_build_scripts=false
    rm -f src/generated/kanidm-sdk/package.json \
          src/generated/kanidm-sdk/tsconfig.json \
          src/generated/kanidm-sdk/tsconfig.esm.json \
          src/generated/kanidm-sdk/README.md

# === Build ===

# Install dependencies
install:
    vp install --frozen-lockfile

# Type-check and lint
check:
    vp check

# Run unit tests
test:
    vp test

# Production build
build:
    vp build

# Verify production build integrity
audit:
    vp run production-artifact-audit

# Smoke-test the container image
container-smoke:
    vp run container-smoke

# Run all fast quality checks
ci-fast: check test build audit container-smoke

# === Documentation ===

# Build the mdbook documentation site
book:
    mdbook build docs

# Serve the mdbook with live reload
book-serve:
    mdbook serve docs --open

# Test mdbook code examples
book-test:
    mdbook test docs

# === Local CI ===

# Run the full local CI pipeline
ci: ci-fast

# === E2E ===

# Run the full E2E suite against a real Kanidm
e2e-kanidm:
    vp run e2e-kanidm

# Run the WebAuthn / passkey E2E test
e2e-webauthn:
    vp run e2e-webauthn-kanidm

# Run the recovery E2E test
e2e-recovery:
    vp run e2e-recovery-kanidm

# Run the recovery mail E2E test
e2e-recovery-mail:
    vp run e2e-recovery-mail-kanidm

# Run auth API smoke test
auth-smoke:
    vp run auth-smoke
