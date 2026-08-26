# Releasing Markdown Monroe

Releases are created manually through the `Release` GitHub Actions workflow.

1. Make sure the intended release commit is on `main` and the repository checks pass.
2. Open **Actions → Release → Run workflow** in GitHub.
3. Select `main`, enter a new numeric `major.minor.patch` version such as `0.2.0`, and run the workflow.

The workflow installs the frozen Bun dependency graph, synchronizes the version in `package.json` and the extension manifest, runs the type and fixture checks, builds the extension, and creates a versioned ZIP and checksum. It then commits the version change when needed, creates and pushes the matching `vX.Y.Z` tag, and publishes both files in a GitHub release.

Chrome manifest versions only accept numeric components, so prerelease suffixes such as `-beta.1` are rejected. Re-running a version is also rejected if its Git tag already exists. Releases must be dispatched from `main`.
