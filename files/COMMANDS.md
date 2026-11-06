# Commands and exits

All checkout commands used the owned shallow-filtered run-penny clone. Read-only source inspection commands are omitted from this execution ledger. No GitHub API/CI command was run.

| Command | Exit / result |
| --- | --- |
| `git config --global user.name 'Run Edit Run fleet' && git config --global user.email fleet@runeditrun.com` | 0 after environment became ready; the first attempt had no usable execution environment and did not execute |
| `bash /workspace/rer-cloud-launcher/refresh.sh` | 0 |
| Fleet Git setup supplied in task | 0; bundle helper installed and zero embedded-credential rewrites found |
| `git clone --depth 1 --filter=blob:none https://github.com/just-every/run-penny.git <owned-clone>` | 0 |
| `git config user.name 'Run Edit Run fleet' && git config user.email fleet@runeditrun.com` | 0 |
| `git fetch --depth 1 origin f52beea3be587114d61166d21e4be26777fa96f3` | 0 |
| `git fetch --depth 1 origin main` | 0; fresh main equals failed head |
| `git switch -c cloud/sd-penny-main-unicode-triage-1 origin/main` | 0; local diagnostic custody branch only |
| Task-supplied toolchain shell sourced | 0; initially retained existing Node 24.19.0 because it is newer, so an explicit exact Node pin was installed before every build/test |
| `timeout 300 npm install --prefix "$HOME/.rer/toolchain/node-22.20.0" --no-audit --no-fund node@22.20.0` | 0 |
| `export PATH="$HOME/.rer/toolchain/node-22.20.0/node_modules/node/bin:$PATH"; . /tmp/rer-cloud-toolchain.sh; cloud_run pnpm install --frozen-lockfile` | 0; pnpm 10.12.4, frozen lockfile |
| Task-supplied fleet hook installed in clone and repeated after dependencies/build | 0 |
| `export PATH="$HOME/.rer/toolchain/node-22.20.0/node_modules/node/bin:$PATH"; . /tmp/rer-cloud-toolchain.sh; cloud_run npx -y @runeditrun/rer build` | 0; installed dispatcher 0.2.94 |
| Initial tool identity probe using `require.resolve('@cloudflare/vitest-plugin/package.json')` | 1; ERR_PACKAGE_PATH_NOT_EXPORTED. Replaced with direct filesystem package metadata reads, exit 0. No test run consumed. |

Each measurement shell sources `/tmp/rer-cloud-toolchain.sh` after placing exact Node 22.20.0 on PATH, and sets the non-secret CI configuration `CI=true WRANGLER_SEND_METRICS=false CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false PLAYWRIGHT_SKIP_BROWSER_GC=1`. Receipts record the actual measured commands, start/end times and exits. No setup owner data is needed: the journey itself starts isolated Miniflare, applies every migration, fills the unchanged corpus, and bootstraps synthetic operator authority. `rer setup` is NOT RUN (not a prerequisite of this journey). No browser is launched by this HTTP/D1 runtime journey.

The three endpoint commands and the plan-only command, including all failures and NOT RUN phases, are listed in REPORT.md and the actual JSON receipts. Initial auxiliary reads of `/root/rer-consolidation/.tools` failed permission checks (the real fleet HOME is `/home/agent`), and `.nvmrc` was absent (the actual `.node-version` pin is 22.20.0); neither ran a product test or changed settings.

The supplied evidence transport was installed outside the product clone. Its report-only commit/push path additionally configures the fleet identity and preserved hook path in its temporary bare repository, fetches main for the required `git log origin/main..HEAD` audit, and rejects any unexpected author/committer/co-author before publication. No product ref or checkout/head/index is changed.
