export const product={name:globalThis.document?.title.replace(/^Install /,'')||'',slugPrefix:'penny'}
export const features={hosting:true,localTrialWithoutEmail:true,github:false,artwork:false}
export const readySummary=()=>`${product.name} is ready for review. Local sign-in uses the private development outbox.`
