import {isRecordVisual} from './record-look.js';
const MAX_TOKEN_LENGTH=4096;
const MAX_JSON_BYTES=2048;
const MAX_UINT256=(1n<<256n)-1n;
const MARKS=new Set(['勇气','好奇','韧性','坚持','连接','独处','修补','诚实','善意','同行','照顾自己','一朵小花','一句加油','一颗星星']);
const REQUIRED=['version','name','seed','palette','trait','mood','marks'];
const uint=(value,max)=>Number.isInteger(value)&&value>=0&&value<=max;
function validateSnapshot(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('这份角色预览无法打开。');
 const keys=Object.keys(value),allowed=[...REQUIRED,'giftCounts','look'];
 if(REQUIRED.some(key=>!Object.hasOwn(value,key))||keys.some(key=>!allowed.includes(key))||value.version!==1
  ||typeof value.name!=='string'||!value.name.trim()||value.name.length>40
  ||!uint(value.seed,0xffffffff)||!uint(value.palette,3)||!uint(value.trait,3)||!uint(value.mood,5)
  ||!Array.isArray(value.marks)||value.marks.length>MARKS.size||new Set(value.marks).size!==value.marks.length||value.marks.some(mark=>!MARKS.has(mark)))throw Error('这份角色预览无法打开。');
 if(Object.hasOwn(value,'giftCounts')&&(!Array.isArray(value.giftCounts)||value.giftCounts.length!==4||value.giftCounts.some(count=>typeof count!=='string'||!/^\d{1,78}$/.test(count)||BigInt(count)>MAX_UINT256)))throw Error('这份角色预览无法打开。');
 if(Object.hasOwn(value,'look')&&!isRecordVisual(value.look))throw Error('这份角色预览无法打开。');
 return value;
}
export function encodePreview(traveler){
 const snapshot={version:1,name:traveler?.name,seed:traveler?.seed,palette:traveler?.palette,trait:traveler?.trait,mood:traveler?.mood,marks:Array.isArray(traveler?.marks)?[...traveler.marks]:traveler?.marks};
 if(Object.hasOwn(traveler||{},'giftCounts'))snapshot.giftCounts=Array.isArray(traveler.giftCounts)?[...traveler.giftCounts]:traveler.giftCounts;
 if(Object.hasOwn(traveler||{},'look')){const look=traveler.look;if(!isRecordVisual(look))throw Error('角色装扮无效');snapshot.look={hue:look.hue,scale:look.scale,tilt:look.tilt,outfit:look.outfit};}
 validateSnapshot(snapshot);
 const bytes=new TextEncoder().encode(JSON.stringify(snapshot));
 if(bytes.length>MAX_JSON_BYTES)throw Error('角色预览太长，请缩短名字后再试。');
 return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodePreview(token){
 if(typeof token!=='string'||!token.length||token.length>MAX_TOKEN_LENGTH||!/^[A-Za-z0-9_-]+$/.test(token)||token.length%4===1)throw Error('这份角色预览无法打开。');
 try{
  const binary=atob(token.replace(/-/g,'+').replace(/_/g,'/'));
  if(binary.length>MAX_JSON_BYTES)throw Error('oversized');
  const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
  return validateSnapshot(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
 }catch{throw Error('这份角色预览无法打开。');}
}
export function createShareURL(base,traveler,link){
 const url=new URL(base);
 if(!['http:','https:'].includes(url.protocol))throw Error('邀请链接地址无效。');
 url.search='';url.hash='';
 if(link){
  if(typeof link.address!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(link.address)||typeof link.id!=='string'||!/^[1-9]\d{0,77}$/.test(link.id)||BigInt(link.id)>MAX_UINT256)throw Error('同行卡地址无效。');
  url.searchParams.set('c',link.address);url.searchParams.set('id',link.id);
 }else url.searchParams.set('preview',encodePreview(traveler));
 return url.toString();
}
