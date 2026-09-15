# Repository Guidelines

## Project Structure & Module Organization

This repository contains a Tauri 2 desktop application with a React/TypeScript frontend and Rust backend.

- `src/`: frontend application code. UI components live in `src/components/`, shared state in `src/context/`, hooks in `src/hooks/`, USI integration in `src/usi/`, and reusable helpers in `src/utils/`.
- `src-tauri/`: Rust commands, engine process management, persistence, capabilities, icons, and Tauri configuration.
- `public/`: runtime assets such as wallpapers, sounds, themes, and logos.
- `docs/`: design and operational notes.
- Tests are colocated with source files and use the `*.test.ts` or `*.test.tsx` suffix.

Keep component-specific CSS beside its component. Put broadly shared styling in `src/styles/`.

## Build, Test, and Development Commands

- `npm ci`: install the exact dependencies recorded in `package-lock.json`.
- `npm run tauri:dev`: start Vite and launch the native development application. This is the preferred way to exercise engine features.
- `npm run dev`: run only the browser frontend at `http://localhost:5173`; Tauri-backed features may be unavailable.
- `npm run build`: create the frontend bundle in `dist/`.
- `npm run tauri:build`: produce native packages under `src-tauri/target/release/bundle/`.
- `npm test -- --run`: execute the Vitest suite once.
- `npm run type-check`: run strict TypeScript checks without emitting files.
- `npm run lint`: run ESLint.

Do not rely on the legacy root `build.sh`; it references engine sources that are no longer present.

## Coding Style & Naming Conventions

Use two-space indentation in TypeScript/TSX and Rust's standard `rustfmt` output. Prefer functional React components and typed props. Name components and component files in `PascalCase`, hooks as `useCamelCase`, utilities in `camelCase`, and Rust modules in `snake_case`. Keep imports grouped logically and remove unused declarations; TypeScript enables strict, unused, and implicit-return checks.

## Testing Guidelines

Vitest, jsdom, and Testing Library are configured in `vite.config.ts`. Add focused tests beside the code being changed and describe behavior rather than implementation details. There is no enforced coverage threshold, but new behavior and bug fixes should include regression tests. Run tests, type checking, and a production build before requesting review. Note any pre-existing failures separately.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries such as `Add comprehensive logging for USI engine responses`. Keep each commit focused. Pull requests should explain the user-visible change, identify affected frontend or Rust modules, link relevant issues, list verification commands, and include screenshots for visual changes. Call out engine compatibility, persistence, or platform-specific effects explicitly.
