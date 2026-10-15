/** BASE-SECRET-001: a failure log names what failed, never the values involved.
 * Exception messages, causes and stacks can carry SQL parameters, addresses or
 * provider credentials, so only the error type and a code-shaped message
 * (`snake_case` or `UPPER_SNAKE`) are kept. */
export function failureSummary(error:unknown):{name:string;code:string}{
 const name=error instanceof Error&&/^[A-Za-z]{1,64}$/.test(error.name)?error.name:'Unknown'
 const message=error instanceof Error?error.message:''
 return {name,code:/^([a-z][a-z0-9]*(_[a-z0-9]+)+|[A-Z][A-Z0-9]*(_[A-Z0-9]+)+)$/.test(message)&&message.length<=64?message:'unclassified'}
}
