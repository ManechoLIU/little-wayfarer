import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseAuthorizedAccount} from '../src/wallet-account.js';
const first='0x4e301418e08b04d47C4bbABa38008B75CF64DF1a';
const second='0xA3C0701b8CD4bD4A66Bd49251394c34081402C91';
test('explicitly selected account wins over the first authorized account',()=>{
  assert.equal(chooseAuthorizedAccount([first,second],second.toLowerCase()),second);
});
test('withdrawn authorization cannot silently select another sender',()=>{
  assert.throws(()=>chooseAuthorizedAccount([first],second),/所选账户/);
});
test('empty or invalid wallet authorization fails before requesting a signer',()=>{
  for(const accounts of [[],null,['not-an-address']])assert.throws(()=>chooseAuthorizedAccount(accounts),/没有返回/);
});
test('a new connection without an explicit selection uses an authorized account',()=>{
  assert.equal(chooseAuthorizedAccount([first,second]),first);
});
