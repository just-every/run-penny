export function browserOptions() {
 const executablePath=process.env.PENNY_BROWSER_EXECUTABLE
 if(!executablePath)throw new Error('PENNY_BROWSER_EXECUTABLE must name the installed browser executable.')
 return {headless:true,args:['--disable-gpu'],executablePath}
}
