# Releasing Penny

The public source repository is `just-every/run-penny` (`https://github.com/just-every/run-penny`). The current version is 0.1.0 (annotated tag `v0.1.0`), declared consistently by package, seed and release metadata. The first release was the annotated tag `v0.0.0` on the repository's first commit, a parentless export whose tree equals the verified source tree. RELEASE.json lists each migration since then with its steps, and README.md and CHANGELOG.md carry the upgrade note. Hosted mail delivery, hosted Cron, real Canny and UserVoice exports and whole-product acceptance are not yet proven; see HANDOVER.md and ACCEPTANCE.md.

Before a release, freeze and independently verify the candidate, refresh and check its complete source lock, review migration and update instructions in RELEASE.json, and run Base's publication check against the exact intended public tree with no exclusions, allowlists or waivers. The export's complete history scan must have zero findings, and its source bytes and modes must match exactly.

Create tags and publish only through the maintained Base release tool after review. A source publication check is distinct from whole-product, live-provider, deployment and accessibility or capacity acceptance; keep the limitations in HANDOVER.md and ACCEPTANCE.md in any public announcement.
