// Readiness decisions only. This module never loads an ad SDK, calls an ad network,
// grants consent or certifies a CMP. Account/CMP activation is an external prerequisite.
(function(root){
  'use strict';
  const pages=Object.freeze(['/guide.html','/controls.html','/modes.html','/maps.html','/agents.html','/patch-notes.html']);
  function evaluate(config,pathname,consent){
    const c=config||{},s=consent||{},reasons=[];
    if(c.enabled!==true)reasons.push('disabled');
    if(!/^ca-pub-\d{16}$/.test(c.publisherId||''))reasons.push('publisher-missing');
    if(c.siteApproved!==true)reasons.push('site-not-approved');
    if(c.audience!=='general')reasons.push('audience-unreviewed');
    if(c.cmpReady!==true)reasons.push('cmp-not-ready');
    if(c.rightsReviewed!==true)reasons.push('rights-unreviewed');
    if(c.format!=='display')reasons.push('format-not-approved');
    if(!pages.includes(String(pathname||'').split(/[?#]/)[0]))reasons.push('page-excluded');
    if(s.advertising!==true||s.cmpVerified!==true||s.underAge!==false)reasons.push('consent-not-verified');
    return {allowed:reasons.length===0,reasons};
  }
  const api=Object.freeze({pages,evaluate});
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ADVERTISING_POLICY=api;
})(typeof window==='object'?window:globalThis);
