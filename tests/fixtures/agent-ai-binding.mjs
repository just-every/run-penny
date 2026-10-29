/** Per-run synthetic configuration; never read a production provider key. */
export default ({sessionSecret}) => JSON.stringify({anthropic:{
 apiKey:sessionSecret,
 models:[{id:'penny-conformance-model',inputMicrosPerToken:0,outputMicrosPerToken:0,maxOutputTokens:1024}],
}})
