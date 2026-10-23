#!/usr/bin/env bash
set -euo pipefail

# Retry only Linux package installation; each mirror serves the same signed
# Ubuntu archive. The runner's source lists and keyring remain unchanged.
scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
node=$(command -v node)
mirrors=(http://azure.archive.ubuntu.com/ubuntu http://mirrors.edge.kernel.org/ubuntu http://us-east-1.ec2.archive.ubuntu.com/ubuntu)
for attempt in 1 2 3; do
  mirror=${mirrors[attempt - 1]}
  mkdir -p "$scratch/sources-$attempt/parts"
  : > "$scratch/sources-$attempt/sources.list"
  for src in /etc/apt/sources.list /etc/apt/sources.list.d/*; do
    [[ -f $src ]] || continue
    dest="$scratch/sources-$attempt/parts/${src##*/}"
    [[ $src != /etc/apt/sources.list ]] || dest="$scratch/sources-$attempt/sources.list"
    sed -E \
      -e "s@mirror\\+file:/etc/apt/apt-mirrors(-security)?\\.txt@${mirror}/@g" \
      -e "s@https?://(([a-z0-9.-]+\\.)?archive\\.ubuntu\\.com|security\\.ubuntu\\.com|mirrors\\.edge\\.kernel\\.org)/ubuntu/?@${mirror}/@g" "$src" > "$dest"
  done
  cat > "$scratch/apt.conf" <<APT
Dir::Etc::sourcelist "$scratch/sources-$attempt/sources.list";
Dir::Etc::sourceparts "$scratch/sources-$attempt/parts";
APT::Update::Error-Mode "any";
Acquire::Retries "2";
Acquire::http::Timeout "30";
Acquire::https::Timeout "30";
APT
  # apt's unprivileged downloader must be able to read the scratch sources.
  chmod -R a+rX "$scratch"
  printf 'Chromium apt: attempt %s/3 (90s deadline; mirror %s)\n' "$attempt" "$mirror"
  if sudo env APT_CONFIG="$scratch/apt.conf" "$node" scripts/ci/chromium-apt-attempt.mjs \
    bash -ec 'dpkg --configure -a; exec "$@"' bash \
    "$node" "$PWD/node_modules/@playwright/test/cli.js" install-deps chromium; then
    printf 'Chromium apt: complete (attempts=%s mirror=%s)\n' "$attempt" "$mirror"
    pnpm exec playwright install chromium
    exit 0
  else
    status=$?
    printf 'Chromium apt: attempt %s/3 failed (mirror %s, exit %s)\n' "$attempt" "$mirror" "$status" >&2
  fi
  if (( attempt < 3 )); then sleep "$((attempt * 2))"; fi
done
printf 'Chromium apt: failed after 3 bounded attempts (exit %s)\n' "$status" >&2
exit 1
