import test from 'node:test';
import assert from 'node:assert/strict';
import {encodePreview,decodePreview,createShareURL} from '../src/share.js';
import {recordLook,recordLookFromVisual} from '../src/record-look.js';
const character={name:'小芽🌱与风',seed:123,palette:2,trait:3,mood:0,marks:['好奇'],giftCounts:['3','0','0','0']};
const rawToken=value=>Buffer.from(JSON.stringify(value),'utf8').toString('base64url');
test('preview round-trips Chinese and emoji through a URL',()=>{
 const url=createShareURL('https://example.com/road?old=1#secret',character);
 const parsed=new URL(url);
 assert.equal(parsed.pathname,'/road');assert.equal(parsed.hash,'');
 assert.deepEqual(decodePreview(parsed.searchParams.get('preview')),{version:1,...character});
 assert.equal(parsed.searchParams.size,1);
});
test('sharing only exports public appearance fields, never writing or private media',()=>{
 const token=encodePreview({...character,id:'private-id',entries:[{body:'秘密正文'}],body:'秘密正文',note:'秘密备注',photo:'private-photo',privateKey:'SECRET',memories:[{text:'秘密经历'}]});
 const snapshot=decodePreview(token);
 assert.deepEqual(Object.keys(snapshot).sort(),['version','name','seed','palette','trait','mood','marks','giftCounts'].sort());
 assert.ok(!JSON.stringify(snapshot).includes('秘密'));assert.ok(!JSON.stringify(snapshot).includes('SECRET'));
});
test('existing chain invitation keeps its original address and id without a preview',()=>{
 const address='0x1234567890abcdef1234567890abcdef12345678';
 assert.equal(createShareURL('https://example.com/road?preview=old#old',character,{address,id:'42'}),`https://example.com/road?c=${address}&id=42`);
});
test('preview rejects unknown fields, malformed base64, excessive input and invalid shapes',()=>{
 const valid={version:1,...character};
 for(const data of [{...valid,body:'secret'},{...valid,version:2},{...valid,name:'x'.repeat(41)},{...valid,seed:-1},{...valid,trait:99},{...valid,marks:['<img onerror=x>']},{...valid,giftCounts:['-1','0','0','0']},null,[]])assert.throws(()=>decodePreview(rawToken(data)));
 for(const token of ['x'.repeat(4097),'@@@','_w',''])assert.throws(()=>decodePreview(token));
 assert.throws(()=>encodePreview({...character,name:'x'.repeat(5000)}));
 assert.throws(()=>createShareURL('https://example.com',character,{address:'bad',id:'1'}));
});
test('markup in a short name survives as plain data rather than executing or adding fields',()=>{
 const name='<img src=x onerror=alert(1)>';
 assert.equal(decodePreview(encodePreview({...character,name})).name,name);
});

test('a visual snapshot preserves the shared outfit without carrying a record or arbitrary CSS',()=>{
 const look={hue:-17,scale:103,tilt:2,outfit:'cape'};
 const snapshot=decodePreview(encodePreview({...character,look}));
 assert.deepEqual(snapshot.look,look);
 assert.ok(!Object.hasOwn(snapshot,'entries'));
 for(const invalid of [{...look,hue:36},{...look,scale:104},{...look,tilt:-4},{...look,outfit:'url(javascript:x)'},{...look,style:'color:red'},{...look,scale:1.03}]){
  assert.throws(()=>decodePreview(rawToken({version:1,...character,look:invalid})));
 }
});

test('shared visual reconstructs the same record appearance without record identifiers or text',()=>{
 const look=recordLook([{id:'private-entry-1',body:'不该分享的正文'},{id:'private-entry-2',note:'私密备注'}]);
 const snapshot=decodePreview(encodePreview({...character,look:look.visual}));
 assert.deepEqual(recordLookFromVisual(snapshot.look),look);
 assert.ok(!JSON.stringify(snapshot).includes('private-entry'));
 assert.ok(!JSON.stringify(snapshot).includes('正文'));
});
