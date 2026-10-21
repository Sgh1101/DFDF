// Public release identity only. Never return process.env or infrastructure IDs.
module.exports=(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  const sha=process.env.VERCEL_GIT_COMMIT_SHA||'';
  res.end(JSON.stringify({version:'2026.10.21',commit:/^[a-f0-9]{40}$/.test(sha)?sha:'local',environment:process.env.VERCEL_ENV==='production'?'production':process.env.VERCEL_ENV==='preview'?'preview':'local'}));
};
