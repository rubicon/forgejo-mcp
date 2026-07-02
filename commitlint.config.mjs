// Commit message linting. Pins the type set to Conventional Commits 1.0.0 via
// @commitlint/config-conventional: feat, fix, chore, docs, test, ci, refactor,
// build, perf, revert, style. Enforced in CI by wagoid/commitlint-github-action
// (which bundles config-conventional). To lint locally, install the tooling:
//   npm i -D @commitlint/cli @commitlint/config-conventional
//   npx commitlint --from origin/main
export default {
  extends: ['@commitlint/config-conventional'],
};
