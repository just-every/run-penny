/** Disposable verification uses the production signed claim and product setup. */
export default async function ({ request, origin, claim, displayName, returnTo }) {
 const bootstrap = await request(origin + claim.path, { method: 'POST', redirect: 'manual', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: claim.token, displayName, returnTo }) });
 if (bootstrap.status !== 303) throw Error('Native signed owner claim failed');
 const cookie = bootstrap.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ');
 const session = await request(origin + '/api/auth/session', { headers: { Cookie: cookie } });
 if (!session.ok) throw Error('Native product actor admission failed');
 await session.body?.cancel();
 const setup = await request(origin + '/setup', { method: 'POST', redirect: 'manual', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ confirm: 'yes', companyName: 'Synthetic feedback team', postalAddress: '1 Test Street', timezone: 'UTC', quietStart: '22', quietEnd: '8' }) });
 if (setup.status !== 303) throw Error('Native product setup failed');
 await setup.body?.cancel();
 return bootstrap;
}
