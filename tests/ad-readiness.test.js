const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const policy=require('../js/advertising-policy');
const grant={webUse:true,modification:true,redistribution:true,adMonetization:true};
const review=()=>({schemaVersion:1,site:{status:'approved',publisherId:'ca-pub-1234567890123456'},applicant:{adultConfirmed:true},audience:{classification:'general',underAgeHandlingReviewed:true},consent:{regionalPolicyReviewed:true,cmpProvider:'test fixture only',certificationVerified:true,withdrawalTested:true},inventory:{status:'reviewed',evidenceRef:'test-only-record'},assets:['dusk-layout','sgh-butterfly-retained'].map(id=>({id,status:'verified',grant:{...grant},evidenceRef:'test-only-record',files:[{path:'sample.bin',sha256:'a'.repeat(64)}]}))});
const config={enabled:true,publisherId:'ca-pub-1234567890123456',siteApproved:true,audience:'general',cmpReady:true,rightsReviewed:true,format:'display'};
test('configuration booleans cannot bypass an absent or unresolved review',()=>{
 assert.equal(policy.evaluate(config,'/guide.html',{advertising:true,cmpVerified:true,underAge:false}).allowed,false);
 assert.equal(typeof policy.reviewReasons,'function');
 assert.deepEqual(policy.reviewReasons(review(),config),[]);
 for(const r of [null,{},[],{...review(),schemaVersion:2},{...review(),assets:[]},{...review(),assets:[review().assets[0],review().assets[0]]}])assert.ok(policy.reviewReasons(r,config).length);
 for(const mutate of [r=>r.site.status='in-review',r=>r.site.publisherId='ca-pub-0000000000000000',r=>r.applicant.adultConfirmed=false,r=>r.audience.underAgeHandlingReviewed=false,r=>r.consent.withdrawalTested=false,r=>r.consent.cmpProvider='',r=>r.inventory.status='unreviewed',r=>r.assets[0].grant.adMonetization=false,r=>r.assets[1].evidenceRef='',r=>r.assets[0].files=[]]){const r=review();mutate(r);assert.ok(policy.reviewReasons(r,config).length);}
});
test('unknown age, stale consent and CMP errors stay denied even after operator review',()=>{
 const now=2000,s={advertising:true,cmpVerified:true,underAge:false,status:'ready',expiresAt:3000};
 assert.equal(policy.evaluate(config,'/guide.html',s,review(),now).allowed,true);
 for(const change of [{expiresAt:2000},{expiresAt:'3000'},{expiresAt:NaN},{status:'error'},{status:'loading'},{underAge:undefined},{cmpVerified:false},{advertising:false}])assert.equal(policy.evaluate(config,'/guide.html',{...s,...change},review(),now).allowed,false);
 for(const route of ['/','/play.html','/login.html','/contact.html','/admin','/guide.html/','/privacy.html'])assert.equal(policy.evaluate(config,route,s,review(),now).allowed,false);
});
test('repository audit detects missing files and asset drift after rights review',()=>{
 const {audit}=require('../scripts/check-ad-readiness'),root=fs.mkdtempSync(path.join(os.tmpdir(),'dfdf-ad-review-'));
 const assetPaths=Object.fromEntries(require('../monetization-review.json').assets.map(a=>[a.id,a.files.map(f=>f.path)]));
 try{
  const crypto=require('node:crypto'),r=review(),hash=crypto.createHash('sha256').update('fixture').digest('hex');
  for(const asset of r.assets){asset.files=assetPaths[asset.id].map(name=>({path:name,sha256:hash}));for(const f of asset.files){fs.mkdirSync(path.dirname(path.join(root,f.path)),{recursive:true});fs.writeFileSync(path.join(root,f.path),'fixture');}}
  fs.writeFileSync(path.join(root,'ads-config.json'),JSON.stringify(config));fs.writeFileSync(path.join(root,'monetization-review.json'),JSON.stringify(r));
  assert.equal(audit(root).ready,true);
  const removed=r.assets[0].files.pop();fs.writeFileSync(path.join(root,'monetization-review.json'),JSON.stringify(r));assert.ok(audit(root).reasons.some(x=>x.startsWith('asset-coverage:')));r.assets[0].files.push(removed);
  fs.writeFileSync(path.join(root,'monetization-review.json'),JSON.stringify(r));
  fs.writeFileSync(path.join(root,removed.path),'changed');assert.ok(audit(root).reasons.some(x=>x.startsWith('asset-changed:')));
  r.assets[0].files[0].path='../outside.bin';fs.writeFileSync(path.join(root,'monetization-review.json'),JSON.stringify(r));assert.ok(audit(root).reasons.some(x=>x.startsWith('asset-path:')));
  fs.writeFileSync(path.join(root,'monetization-review.json'),'{');assert.ok(audit(root).reasons.includes('review-unreadable'));
 }finally{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true,force:true});}
});
test('the checked-in release honestly stays blocked during review',()=>{
 const {audit}=require('../scripts/check-ad-readiness'),r=audit(path.resolve(__dirname,'..'));
 assert.equal(r.ready,false);assert.ok(r.reasons.includes('site-not-approved'));assert.ok(r.reasons.includes('asset-unverified:dusk-layout'));assert.ok(r.reasons.includes('asset-unverified:sgh-butterfly-retained'));
 assert.deepEqual(r.assetErrors,[],'review fingerprints must describe the current files even when permission is pending');
 // the one integration the owner asked for (the home screen's slot); nothing else carries ad code
 assert.deepEqual(r.adIntegrations,['play.html']);assert.deepEqual(r.unapprovedIntegrations,[]);assert.equal(r.unexpectedIntegration,false);assert.equal(r.gateChecksPass,true);
});
test('ad code in a file the owner did not approve still fails the gate',()=>{
 const {audit}=require('../scripts/check-ad-readiness'),root=fs.mkdtempSync(path.join(os.tmpdir(),'dfdf-ad-scan-'));
 try{
  for(const f of ['ads-config.json','monetization-review.json'])fs.copyFileSync(path.join(__dirname,'..',f),path.join(root,f));
  const tag='<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3446698746925219"></script>';
  fs.writeFileSync(path.join(root,'play.html'),tag);
  let r=audit(root);assert.deepEqual(r.unapprovedIntegrations,[]);assert.equal(r.unexpectedIntegration,false);
  fs.writeFileSync(path.join(root,'guide.html'),tag);
  r=audit(root);assert.deepEqual(r.unapprovedIntegrations,['guide.html']);assert.equal(r.unexpectedIntegration,true);assert.equal(r.gateChecksPass,false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
