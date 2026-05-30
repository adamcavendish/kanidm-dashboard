# Development

## Setup

```bash
vp install
just generate-sdk
vp dev
```

See the [Getting Started](getting-started.md) guide for detailed prerequisites
and local Kanidm setup.

## Project scripts

```bash
just check     # Type-check and lint
just test      # Run unit tests
just build     # Production build
just audit     # Verify production build integrity
just ci-fast   # Run all fast quality checks
```

## Code conventions

- **TypeScript strict mode** — all code is fully typed; `any` is avoided.
- **SolidJS reactivity** — use signals, `createEffect`, and `setState`; avoid
  direct DOM manipulation.
- **Component structure** — shared UI components live in `src/components/`;
  page components are defined in `src/App.tsx`.
- **Data access** — always go through the `DashboardDataSource` interface; never
  call the SDK directly from components.

## Adding a new page

1. Define the route in `App.tsx` in the `SwitchPublic` or `SwitchPrivate`
   component.
2. Create the page component in `App.tsx` (or a new file in `src/pages/`).
3. Use `useConsole()` to access state and mutations.
4. Follow the existing patterns for error handling (`ErrorBox`), busy states,
   and review-before-submit flows.
