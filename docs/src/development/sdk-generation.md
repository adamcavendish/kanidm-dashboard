# SDK Generation

The Kanidm TypeScript SDK is generated from the checked-in OpenAPI spec at
`spec/kanidm-openapi.json` using
[openapi-nexus](https://github.com/adamcavendish/openapi-nexus).

## Prerequisites

Install `openapi-nexus`:

```bash
cargo install --path ../openapi-nexus
```

## Generate

```bash
just generate-sdk
```

This runs `openapi-nexus generate` with:

- **Input:** `spec/kanidm-openapi.json`
- **Output:** `src/generated/kanidm-sdk/`
- **Generator:** `typescript-fetch`
- **Naming:** `camelCase` property naming, `PascalCase` file naming
- **Target:** ES2022, ESNext modules

The generated SDK includes:

- **API classes** in `apis/` — one per Kanidm tag (PersonApi, GroupApi,
  Oauth2Api, etc.)
- **Model types** in `models/` — TypeScript interfaces with `fromJSON` /
  `toJSON` converters
- **Runtime** in `runtime/` — `Configuration`, fetch wrapper, response types

## Version control

The `src/generated/` directory is excluded from version control via
`.gitignore`. Run `just generate-sdk` after cloning the repository and after
updating `spec/kanidm-openapi.json`.
