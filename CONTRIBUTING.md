# Contributing to OMCM

Read the [development guide](omcm/README.md) to run the frontend and backend.
Use a supported Node version from [.nvmrc](.nvmrc); `nvm use` selects it when nvm
is installed. Other Node version managers can use the same major version.

## Development workflow

1. Create a focused branch from the latest `main`.
2. Make one clear change and follow the existing React/FastAPI structure.
3. Run the [tests and data checks](omcm/README.md#tests-and-data-checks) relevant
   to your change. Run lint, frontend tests/build, and backend tests before review.
4. Open a pull request describing the problem, resulting behavior, and checks run.
   Include desktop/phone screenshots for visible UI changes and setup instructions
   when configuration changes.

Discuss changes to dependencies, database schemas, or scoring policy with the
maintainers before implementation. Keep pull requests small enough to review.

## Code and data conventions

- Use TypeScript for frontend code and the existing CSS stylesheets for styling.
- Use two spaces in frontend files and four spaces in Python. `.editorconfig`
  defines shared editor defaults; existing lint/build checks remain authoritative.
- Add meaningful regression coverage for behavior changes. Preserve the distinction
  between published deployments, private drafts, and practice simulations.
- Keep data provenance and upstream licenses. Regenerate derived assets with their
  scripts; do not edit trained model files or generated datasets by hand.
- Commit configuration examples, never actual credentials, database files, logs,
  patient records, or local conversation notes.
- Update the relevant guide when a workflow or public contract changes. Change
  history belongs in commits and pull requests.

## Reporting a problem

Use [GitHub Issues](https://github.com/Gab172005/WompWompOMCM/issues). Include steps
to reproduce, expected/actual behavior, browser and operating system, and sanitized
logs or screenshots. Remove credentials and personal information before posting.
