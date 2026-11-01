// Public release identity only. Never return process.env or infrastructure IDs.
module.exports=(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  // Vercel or Render (server/render.js) says which commit is running
  const sha=process.env.VERCEL_GIT_COMMIT_SHA||process.env.RENDER_GIT_COMMIT||'';
  const env=process.env.VERCEL_ENV||(process.env.RENDER?(process.env.IS_PULL_REQUEST==='true'?'preview':'production'):'');
  res.end(JSON.stringify({version:'2026.10.21',commit:/^[a-f0-9]{40}$/.test(sha)?sha:'local',environment:env==='production'?'production':env==='preview'?'preview':'local'}));
};
