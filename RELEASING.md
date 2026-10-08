## Releasing

The project uses a SNAPSHOT versioning scheme: the `main` branch always carries an
`X.Y.Z-SNAPSHOT` version in the root `package.json`, and a release strips the
`-SNAPSHOT` suffix. Every site shares that one version and one changelog, and the
Conventional Commit scopes show which track a change touched.

These are the general steps to release a new version:

1. Run `just pre-release`. It verifies a clean tree, runs the checks and tests,
   builds every site, runs the end-to-end suite in Google Chrome, strips
   `-SNAPSHOT` from the version, and commits the bump;
2. Open a pull request with the version bump;
3. Once the pull request is merged, the CI workflow runs and, on success, triggers
   the Continuous Delivery workflow. Because the version is no longer a SNAPSHOT,
   CD builds every site into one archive, creates the tag, starts the Deploy
   workflow on that tag, generates the change notes with git-cliff, and publishes
   a [GitHub release](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases);
4. CD then opens the next iteration by bumping `main` to the next
   `X.Y.Z-SNAPSHOT` version;
5. The Deploy workflow builds every site from the tag and deploys each one to
   production on its Cloudflare Pages project. CD has to start it, because a tag
   that CD pushes with `GITHUB_TOKEN` starts no workflows.

Only releases deploy: pull requests and pushes to `main` never do. To deploy a
release again, run the Deploy workflow by hand on its tag. A manual run on a ref
whose version is still a SNAPSHOT skips the deploy and leaves a notice saying why.
