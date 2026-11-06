"""Read-only product diagnosis recorder; all writes are normal build/test outputs or packet receipts."""
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
import time

label, phase = sys.argv[1:]
root = Path.cwd()
packet = root.parent/'packet'
commands = {
    'install': [('install', 'cloud_run timeout 900 pnpm install --frozen-lockfile'),
                ('deps', 'cloud_run timeout 900 pnpm run deps')],
    'repro': [('build', 'cloud_run timeout 900 pnpm run build'),
              ('deployment-spec', 'cloud_run timeout 120 node scripts/build-deployment-spec.mjs --check'),
              ('older-archive', "cloud_run timeout 720 node --test --test-name-pattern='^\\[DATA-001 DATA-003\\] import before setup restores an older backup with either migration ledger and replays later settings and status clocks$' tests/installer/older-archive.test.mjs")],
}[phase]
# No credentials or application settings are passed to product tooling. Keep the
# same runner transport, CA trust, real HOME, process paths and declared CI flags.
keep = ['PATH','HOME','USER','LOGNAME','SHELL','TMPDIR','TMP','TEMP','LANG','LC_ALL',
        'HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy',
        'NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR','REQUESTS_CA_BUNDLE']
env = {k: os.environ[k] for k in keep if k in os.environ}
env.update(CI='true', WRANGLER_SEND_METRICS='false',
           CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV='false', PLAYWRIGHT_SKIP_BROWSER_GC='1')
setup = 'export PATH="$HOME/.rer/toolchain/node-22.20.0/node_modules/node/bin:$PATH"; . /tmp/rer-cloud-toolchain.sh; '
receipt_path = packet/(label+'-runtime.json')
receipt = json.loads(receipt_path.read_text()) if receipt_path.exists() else {'label':label,'commands':[]}
receipt['head'] = subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
receipt['ci_configuration'] = {k:env[k] for k in ['CI','WRANGLER_SEND_METRICS','CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV','PLAYWRIGHT_SKIP_BROWSER_GC']}
for name, command in commands:
    start = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log = packet/f'{label}-{name}.log'
    before = time.monotonic()
    with log.open('w') as out:
        out.write(f'HEAD={receipt["head"]}\nSTART={start}\nCOMMAND={command}\n')
        out.flush()
        child = subprocess.Popen(['bash','-c',setup+command],cwd=root,env=env,stdout=out,stderr=subprocess.STDOUT)
        print(f'{label}/{name}: pid={child.pid} log={log}',flush=True)
        code = child.wait()
        elapsed = round(time.monotonic()-before,3)
        out.write(f'\nEXIT={code}\nELAPSED_SECONDS={elapsed}\n')
    receipt['commands'].append({'name':name,'command':command,'start_utc':start,'exit':code,'elapsed_seconds':elapsed,'pid':child.pid,'log':log.name})
    receipt_path.write_text(json.dumps(receipt,indent=2)+'\n')
    print(f'{label}/{name}: exit={code} seconds={elapsed}',flush=True)
    print('\n'.join(log.read_text().splitlines()[-16:]),flush=True)
    if name in ['install','deps','build'] and code:
        print('PREREQUISITE_FAILED; no dependent target executed',flush=True)
        sys.exit(code)
