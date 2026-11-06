import datetime,json,os,re,subprocess,sys,time
from pathlib import Path
name=sys.argv[1]
command=sys.argv[2:]
packet=Path.home()/'rer-consolidation/work/sd-penny-main-unicode-fix-1/packet'
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
start=time.monotonic()
result=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
text=result.stdout
text=re.sub(r'(?m)^.*(?:RER_OPEN|rer-dev=|RER_READY|RER_SIGNED_IN|AUTH_SECRET=|SETUP_TOKEN=).*$','[local runtime credential line omitted]',text)
(packet/(name+'.log')).write_text(text)
receipt={'command':command,'head':head,'started':started,'ended':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsed_seconds':time.monotonic()-start,'exit':result.returncode,'log':name+'.log'}
(packet/(name+'-receipt.json')).write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
print(text[-3500:])
sys.exit(result.returncode)
