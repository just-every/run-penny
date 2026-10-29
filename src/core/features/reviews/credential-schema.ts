import {z} from 'zod'
const pem=z.string().min(64).max(12000).regex(/^-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----\s*$/)
export const credentialInput=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('access_token'),value:z.string().min(1).max(8192)}).strict(),
 z.object({kind:z.literal('appstore'),issuerId:z.string().uuid(),keyId:z.string().regex(/^[A-Z0-9]{10}$/),privateKey:pem}).strict(),
 z.object({kind:z.literal('googleplay'),clientEmail:z.email().max(254),privateKey:pem}).strict(),
 z.object({kind:z.literal('trustpilot'),clientId:z.string().min(1).max(512),clientSecret:z.string().min(1).max(1024),refreshToken:z.string().min(1).max(4096)}).strict(),
])
export type Credential=z.infer<typeof credentialInput>
