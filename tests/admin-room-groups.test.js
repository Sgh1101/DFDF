const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.env.DFDF_ADMIN_SOURCE||'admin.html','utf8'),start=source.indexOf('    const by =',source.indexOf('VIEWS.rooms ='));
const grouping=source.slice(start,source.indexOf('    $("#main")',start));
test('untrusted inherited-property channel names remain separate room groups',()=>{
 const c={rooms:[{ch:'__proto__'},{ch:'constructor'},{ch:'s1'},{ch:'s1'}]};vm.createContext(c);vm.runInContext(grouping+'globalThis.groups=by;',c);
 assert.equal(c.groups.__proto__.length,1);assert.equal(c.groups.constructor.length,1);assert.equal(c.groups.s1.length,2);assert.equal(Object.getPrototypeOf(c.groups),null);
});
