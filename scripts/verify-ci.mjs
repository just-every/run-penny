import { verificationPlan, run } from './verify-app.mjs';

const plan = await verificationPlan();
const [mode, tier] = process.argv.slice(2);
if (mode === '--matrix') {
 if (!['push', 'all'].includes(tier)) throw Error('Usage: verify-ci.mjs --matrix push|all');
 const shards = tier === 'push' ? plan.push : [...plan.push, ...plan.nightly];
 console.log(JSON.stringify({ include: shards.map(({ name, browser }) => ({ name, browser })) }));
} else {
 const shard = [...plan.push, ...plan.nightly].find(shard => shard.name === mode);
 if (!shard || tier) throw Error('Usage: verify-ci.mjs SHARD');
 // Exactly one job retains rer verify's hosted-output and hydration checks.
 run(shard.hosted ? 'pnpm run verify' : 'pnpm run verify:app', { ...process.env, SEED_VERIFY_SHARD: shard.name });
}
