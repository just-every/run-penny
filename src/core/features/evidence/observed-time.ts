/** Exact ordering for ISO observed instants, without rewriting provenance.
 * Strip fractions before SQLite converts the whole second: its datetime parser
 * rounds fractional input. Compare the accepted 1–9 digits as nanoseconds next.
 * Historical zone-free/date-only records retain SQLite's UTC interpretation.
 * Callers pass fixed SQL column expressions, never request input. */
export function observedTimeOrderSql(column:string):string {
 const point=`instr(${column},'.')`
 const zoneLength=`CASE WHEN lower(substr(${column},-1))='z' THEN 1 WHEN substr(${column},-6,1) IN ('+','-') THEN 6 ELSE 0 END`
 const whole=`CASE WHEN ${point}=0 THEN ${column} ELSE substr(${column},1,${point}-1)||substr(${column},length(${column})-(${zoneLength})+1) END`
 const fraction=`CASE WHEN ${point}=0 THEN 0 ELSE CAST(substr(substr(${column},${point}+1,length(${column})-${point}-(${zoneLength}))||'000000000',1,9) AS INTEGER) END`
 return `CAST(strftime('%s',${whole}) AS INTEGER) DESC, ${fraction} DESC`
}
