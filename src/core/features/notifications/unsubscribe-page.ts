import { NativeError } from '@/core/features/auth/native-tokens'
// The brand's own Inter Tight, served from this Worker's origin (the same file the app's pages load); without it the
// page falls back to the system stack. No third-party request.
const interTight = '/fonts/inter-tight/inter-tight-latin-wght-normal.woff2'

export const unsubscribeEndpoint='/api/public/notifications/unsubscribe'

/** Penny's paper, ink and copper, inline because this page is plain HTML outside the app. Ink on paper 16:1, copper text 5.2:1. */
const style=`@font-face{font-family:'Inter Tight';font-style:normal;font-weight:100 900;font-display:swap;src:url(${interTight}) format('woff2')}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#faf7ef;color:#20211f;font:17px/1.6 'Inter Tight',system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}main{max-width:36rem;margin:10vh auto;padding:24px}h1{margin:0 0 28px;font-size:clamp(1.8rem,7vw,2.4rem);font-weight:800;line-height:1.15;letter-spacing:-.025em;overflow-wrap:anywhere}h1::after{content:'';display:block;width:7rem;height:5px;margin-top:14px;border-radius:3px;background:#c85d2f}p{margin:0 0 16px;color:#474a4e}a{color:#ad4a1f;font-weight:600;text-decoration:underline;text-underline-offset:4px}a:hover{color:#8c3a17}form{margin:24px 0 0}button{font:inherit;font-size:15px;font-weight:600;min-height:44px;padding:10px 22px;cursor:pointer;border:0;border-radius:999px;background:#20211f;color:#faf7ef}button:hover{background:#474a4e}button:focus-visible,a:focus-visible{outline:3px solid #ad4a1f;outline-offset:4px}`

/** All content is fixed copy; the only interpolated token has passed validation. */
export function preferencePage(title:string,content:string,status=200):Response {
 return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} · Penny</title><style>${style}</style></head><body><main><h1>${title}</h1>${content}</main></body></html>`,{status,headers:{
  'Content-Type':'text/html; charset=UTF-8',
  'Cache-Control':'no-store',
  'Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
 }})
}

export function preferenceFailure(error:unknown):Response {
 if(error instanceof NativeError && error.status===400 && error.code==='invalid_unsubscribe_link')
  return preferencePage('Email preference link unavailable','<p>This email preference link is invalid or expired.</p><p>Open the preference link in your most recent email.</p>',400)
 return preferencePage('Email preferences temporarily unavailable','<p>We could not access your email preferences right now. Please try again later.</p>',503)
}

export function preferenceForbidden():Response {
 return preferencePage('Email preference change blocked','<p>We could not verify where this request came from. Your email preferences have not changed.</p><p>Open the preference link in your most recent email and use its Unsubscribe button.</p>',403)
}
