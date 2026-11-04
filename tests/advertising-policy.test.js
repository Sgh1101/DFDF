const test=require('node:test'),assert=require('node:assert/strict');
const rawPolicy=require('../js/advertising-policy');
// Synthetic operator approval only. This is not the site's live review record.
const grant={webUse:true,modification:true,redistribution:true,adMonetization:true};
const review={schemaVersion:1,site:{status:'approved',publisherId:'ca-pub-1234567890123456'},applicant:{adultConfirmed:true},audience:{classification:'general',underAgeHandlingReviewed:true},consent:{regionalPolicyReviewed:true,cmpProvider:'fixture',certificationVerified:true,withdrawalTested:true},inventory:{status:'reviewed',evidenceRef:'fixture'},assets:rawPolicy.requiredAssets.map(id=>({id,status:'verified',grant,evidenceRef:'fixture',files:[{path:'fixture.bin',sha256:'a'.repeat(64)}]}))};
const policy={evaluate:(c,p,s)=>rawPolicy.evaluate(c,p,s,review)};
const ready={enabled:true,publisherId:'ca-pub-1234567890123456',siteApproved:true,audience:'general',cmpReady:true,rightsReviewed:true,format:'display'};
const consent={advertising:true,cmpVerified:true,underAge:false,status:'ready',expiresAt:Date.now()+60000};
test('advertising is default-off and incomplete external readiness cannot enable it',()=>{
 const configured=require('../ads-config.json');
 assert.equal(policy.evaluate(configured,'/guide.html',consent).allowed,false);
 for(const change of [{enabled:false},{publisherId:''},{publisherId:'ca-pub-test'},{siteApproved:false},{audience:'unreviewed'},{cmpReady:false},{rightsReviewed:false},{format:'h5'}]){
  const result=policy.evaluate({...ready,...change},'/guide.html',consent);assert.equal(result.allowed,false);assert.ok(result.reasons.length);
 }
});
test('only explicit article routes can be candidates, never gameplay or private workflows',()=>{
 for(const p of ['/guide.html','/controls.html','/modes.html','/maps.html','/agents.html','/patch-notes.html'])assert.equal(policy.evaluate(ready,p,consent).allowed,true,p);
 for(const p of ['/','/index.html','/play.html','/play.html#skins','/admin','/contact.html','/privacy.html','/terms.html','/credits.html','/404.html','/guide.html/','/foo/guide.html'])assert.equal(policy.evaluate(ready,p,consent).allowed,false,p);
});
test('local optional preferences alone never constitute verified CMP consent',()=>{
 for(const c of [null,{}, {advertising:true},{...consent,advertising:false},{...consent,cmpVerified:false},{...consent,underAge:true}])assert.equal(policy.evaluate(ready,'/guide.html',c).allowed,false);
 assert.deepEqual(policy.evaluate(ready,'/guide.html',consent),{allowed:true,reasons:[]});
});
