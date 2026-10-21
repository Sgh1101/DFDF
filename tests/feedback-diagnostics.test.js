const test=require('node:test'),assert=require('node:assert/strict'),{harness}=require('./api-harness');
test('optional feedback diagnostics store a strict numeric summary, never raw events, addresses or tokens',async()=>{
 const h=harness(),u=await h.api('auth',{id:'diagnosticcase',pw:'password',device:'diagnostic-case'}),owner=await h.api('auth',{id:'owner',pw:'owner-password',device:'owner-diagnostic'});
 const sent=await h.api('feedback_submit',{token:u.token,type:'bug',text:'검사 중 확인한 오류입니다.',ctx:{diagnostic:{version:'2026.10.21',commit:'a'.repeat(40),quality:'mobile',medianMs:16,p95Ms:31.45,geometries:100,textures:12,token:'DO_NOT_STORE',ip:'DO_NOT_STORE',events:['DO_NOT_STORE']}}});assert.equal(sent.status,200);
 const all=await h.api('a_feedback',{atoken:owner.atoken}),d=all.items[0].ctx.diagnostic;
 assert.deepEqual(d,{version:'2026.10.21',commit:'a'.repeat(40),quality:'mobile',medianMs:16,p95Ms:31.5,geometries:100,textures:12});assert.ok(!JSON.stringify(all.items).includes('DO_NOT_STORE'));
 h.advance(60001);await h.api('feedback_submit',{token:u.token,type:'ask',text:'진단 첨부 없는 일반 문의입니다.'});const next=await h.api('a_feedback',{atoken:owner.atoken});assert.equal(next.items[0].ctx.diagnostic,undefined);
});
