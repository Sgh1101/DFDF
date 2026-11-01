// Public release identity only. Never return process.env or infrastructure IDs.
module.exports=(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  // Vercel says which commit is running; on Cloudflare the deploy command passes it in (npm run deploy: GIT_COMMIT_SHA)
  const sha=process.env.VERCEL_GIT_COMMIT_SHA||process.env.GIT_COMMIT_SHA||'';
  const env=process.env.VERCEL_ENV||(/^[a-f0-9]{40}$/.test(sha)?'production':'');
  res.end(JSON.stringify({version:'2026.10.21',commit:/^[a-f0-9]{40}$/.test(sha)?sha:'local',environment:env==='production'?'production':env==='preview'?'preview':'local'}));
};
