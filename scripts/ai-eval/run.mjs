const args=process.argv.slice(2).filter(value=>value!=='--')
if(args.length===2&&args[0]==='--set'&&args[1]==='redaction-v1')await import('./redaction.mjs')
else if(args[0]==='--set'&&args[1]==='duplicates-v1'&&(args.length===2||(args.length===4&&args[2]==='--model'&&args[3].trim()))){
 const {runDuplicates}=await import('./duplicates.mjs')
 try{await runDuplicates(args[3])}catch(error){
  console.error(JSON.stringify({set:'duplicates-v1',passed:false,error:error.code??'evaluation_failed',reason:error.safeReason??'The evaluation could not complete.',...(error.status?{httpStatus:error.status}:{})}))
  process.exitCode=1
 }
}else throw Error('Choose --set redaction-v1 or --set duplicates-v1 [--model <id>].')
