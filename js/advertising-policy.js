// Readiness decisions only. This module never loads an ad SDK, calls an ad network,
// grants consent or certifies a CMP. Account/CMP activation is an external prerequisite.
(function(root){
  'use strict';
  const pages=Object.freeze(['/guide.html','/controls.html','/modes.html','/maps.html','/agents.html','/patch-notes.html']);
  const requiredAssets=Object.freeze(['dusk-layout','sgh-butterfly-retained']);
  function configurationReasons(config){
    const c=config||{},reasons=[];
    if(c.enabled!==true)reasons.push('disabled');
    if(!/^ca-pub-\d{16}$/.test(c.publisherId||''))reasons.push('publisher-missing');
    if(c.siteApproved!==true)reasons.push('site-not-approved');
    if(c.audience!=='general')reasons.push('audience-unreviewed');
    if(c.cmpReady!==true)reasons.push('cmp-not-ready');
    if(c.rightsReviewed!==true)reasons.push('rights-unreviewed');
    if(c.format!=='display')reasons.push('format-not-approved');
    return reasons;
  }
  // This is a reviewed operator record, never browser preferences. It is not proof
  // of permission or certification by itself; the CLI also pins current asset files.
  function reviewReasons(review,config){
    const r=review,c=config||{},reasons=[];
    if(!r||Array.isArray(r)||r.schemaVersion!==1)return ['review-invalid'];
    if(r.site?.status!=='approved')reasons.push('review-site-not-approved');
    if(r.site?.publisherId!==c.publisherId)reasons.push('review-publisher-mismatch');
    if(r.applicant?.adultConfirmed!==true)reasons.push('applicant-unconfirmed');
    if(r.audience?.classification!=='general'||r.audience?.underAgeHandlingReviewed!==true)reasons.push('age-handling-unreviewed');
    if(r.consent?.regionalPolicyReviewed!==true||typeof r.consent?.cmpProvider!=='string'||!r.consent.cmpProvider.trim()||r.consent?.certificationVerified!==true||r.consent?.withdrawalTested!==true)reasons.push('cmp-review-incomplete');
    if(r.inventory?.status!=='reviewed'||typeof r.inventory?.evidenceRef!=='string'||!r.inventory.evidenceRef.trim())reasons.push('inventory-unreviewed');
    const assets=Array.isArray(r.assets)?r.assets:[];
    if(assets.length!==requiredAssets.length||new Set(assets.map(a=>a?.id)).size!==assets.length)reasons.push('asset-review-incomplete');
    for(const id of requiredAssets){
      const a=assets.find(a=>a?.id===id);
      if(!a||a.status!=='verified'||typeof a.evidenceRef!=='string'||!a.evidenceRef.trim()||!['webUse','modification','redistribution','adMonetization'].every(k=>a.grant?.[k]===true))reasons.push('asset-unverified:'+id);
      if(!a||!Array.isArray(a.files)||!a.files.length||a.files.some(f=>!f||typeof f.path!=='string'||!f.path||!/^[a-f0-9]{64}$/.test(f.sha256||'')))reasons.push('asset-fingerprints-missing:'+id);
    }
    return reasons;
  }
  function evaluate(config,pathname,consent,review,now=Date.now()){
    const s=consent||{},reasons=configurationReasons(config).concat(reviewReasons(review,config));
    if(!pages.includes(String(pathname||'').split(/[?#]/)[0]))reasons.push('page-excluded');
    if(s.advertising!==true||s.cmpVerified!==true||s.underAge!==false||s.status!=='ready'||!Number.isFinite(s.expiresAt)||s.expiresAt<=now)reasons.push('consent-not-verified');
    return {allowed:reasons.length===0,reasons};
  }
  const api=Object.freeze({pages,requiredAssets,configurationReasons,reviewReasons,evaluate});
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ADVERTISING_POLICY=api;
})(typeof window==='object'?window:globalThis);
