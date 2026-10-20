/** Decimal rate arithmetic; binary floating point must not add a micro-dollar. */
export function meteredCost(input:number,output:number,inputRate:number,outputRate:number){
 const fraction=(rate:number)=>{const [mantissa,exponent='0']=String(rate).toLowerCase().split('e'),[whole,decimal='']=mantissa.split('.'),power=decimal.length-Number(exponent);return power>=0?{n:BigInt(whole+decimal),d:10n**BigInt(power)}:{n:BigInt(whole+decimal)*10n**BigInt(-power),d:1n}}
 const a=fraction(inputRate),b=fraction(outputRate),denominator=a.d*b.d,numerator=BigInt(input)*a.n*b.d+BigInt(output)*b.n*a.d
 const cost=Number((numerator+denominator-1n)/denominator)
 if(!Number.isSafeInteger(cost))throw Error('ai_cost_limit')
 return cost
}
