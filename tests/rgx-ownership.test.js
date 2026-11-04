const test = require('node:test'), assert = require('node:assert/strict');
const {harness} = require('./api-harness');
test('an owned legacy RGX butterfly keeps ownership and equipment without a refund or second charge', async () => {
  const h=harness(),session=await h.api('auth',{id:'rgxowner',pw:'password',device:'rgx-owner'}),u=h.user('rgxowner');
  u.own={knife:['vp_future_butterfly','karambit']};u.skins={m:{knife:'vp_future_butterfly'},t:1};u.wish=['knife|vp_future_butterfly'];
  const gold=u.gold;h.db.set('user:rgxowner',JSON.stringify(u));
  await Promise.all([h.api('skins',{token:session.token}),h.api('skins',{token:session.token})]);
  const next=h.user('rgxowner');
  assert.deepEqual(next.own.knife,['butterfly','karambit']);
  assert.equal(next.skins.m.knife,'butterfly');assert.deepEqual(next.wish,['knife|butterfly']);assert.equal(next.gold,gold);
  await h.api('skins',{token:session.token});assert.equal(h.user('rgxowner').gold,gold);
});
