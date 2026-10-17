import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import { ethers } from 'ethers';
import solc from 'solc';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const source = fs.readFileSync(new URL('../contracts/Wayfarer.sol', import.meta.url), 'utf8');
const sourceHash = createHash('sha256').update(source).digest('hex');
const compiled = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity',
  sources: { 'Wayfarer.sol': { content: source } },
  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
})));
const errors = (compiled.errors || []).filter((item) => item.severity === 'error');
if (errors.length) throw new Error(errors.map((item) => item.formattedMessage).join('\n'));
const artifact = compiled.contracts['Wayfarer.sol'].Wayfarer;

let provider;
let owner;
let companion;
let third;
let contract;

async function deploy() {
  provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 5 } }));
  owner = await provider.getSigner(0);
  companion = await provider.getSigner(1);
  third = await provider.getSigner(2);
  contract = await new ethers.ContractFactory(artifact.abi, `0x${artifact.evm.bytecode.object}`, owner).deploy();
  await contract.waitForDeployment();
}

async function create(name, signer = owner) {
  await (await contract.connect(signer).create(name, 1, 0, 0)).wait();
  return contract.travelerCount();
}

async function markSource(id, signer = owner) {
  await (await contract.connect(signer).experience(id, 0, 0, 0)).wait();
}

async function assertReverts(action) {
  await assert.rejects(action);
}

beforeEach(async () => {
  await deploy();
});

test('first mark chapter is recorded once and a souvenir copies it without changing either journey', async () => {
  const sourceId = await create('来源');
  const targetId = await create('收件人', companion);
  await markSource(sourceId);
  const before = await contract.getTraveler(sourceId);
  await (await contract.experience(sourceId, 1, 1, 0)).wait();
  assert.equal(Number(await contract.firstMarkChapter(sourceId, 0)), 1);
  assert.equal(Number(await contract.firstMarkChapter(sourceId, 2)), 2);
  await (await contract.experience(sourceId, 2, 0, 0)).wait();
  assert.equal(Number(await contract.firstMarkChapter(sourceId, 0)), 1);
  await (await contract.connect(owner).sendSouvenir(sourceId, targetId, 0)).wait();
  const gift = await contract.souvenirs(1);
  assert.equal(gift.source, sourceId);
  assert.equal(gift.target, targetId);
  assert.equal(Number(gift.chapter), 1);
  assert.equal(Number(gift.markBit), 0);
  assert.equal(gift.sender, await owner.getAddress());
  assert.equal((await contract.getTraveler(sourceId)).marks, before.marks | 1n | 4n);
  const target = await contract.getTraveler(targetId);
  assert.equal(Number(target.souvenirCount), 1);
  assert.equal(Number(target.wornSouvenirId), 0);
  assert.equal(Number(target.marks), 0);
  assert.equal(Number(target.mood), 0);
  assert.equal(await contract.receivedSouvenirs(targetId, 0), 1n);
  assert.equal(await contract.souvenirCount(), 1n);
});

test('sendSouvenir rejects missing marks, unauthorized source, self targets, invalid bits, and missing targets', async () => {
  const sourceId = await create('来源');
  const targetId = await create('收件人', companion);
  await markSource(sourceId);
  await assertReverts(contract.connect(companion).sendSouvenir(sourceId, targetId, 0));
  await assertReverts(contract.sendSouvenir(sourceId, targetId, 1));
  await assertReverts(contract.sendSouvenir(sourceId, sourceId, 0));
  await assertReverts(contract.sendSouvenir(sourceId, targetId, 11));
  await assertReverts(contract.sendSouvenir(sourceId, 999, 0));
});

test('the same wallet cannot send twice to one target through a different source', async () => {
  const sourceA = await create('来源一');
  const sourceB = await create('来源二');
  const targetId = await create('收件人', companion);
  await markSource(sourceA);
  await markSource(sourceB);
  await (await contract.sendSouvenir(sourceA, targetId, 0)).wait();
  await assertReverts(contract.sendSouvenir(sourceB, targetId, 0));
  assert.equal(await contract.souvenirCount(), 1n);
  assert.equal(Number((await contract.getTraveler(targetId)).souvenirCount), 1);
});

test('only the recipient can wear its gift, can reject another gift, and can remove it', async () => {
  const sourceId = await create('来源');
  const targetId = await create('收件人', companion);
  const otherTargetId = await create('另一个人', third);
  await markSource(sourceId);
  await (await contract.sendSouvenir(sourceId, targetId, 0)).wait();
  await (await contract.sendSouvenir(sourceId, otherTargetId, 0)).wait();
  await assertReverts(contract.wearSouvenir(targetId, 1));
  await assertReverts(contract.connect(companion).wearSouvenir(targetId, 2));
  await assertReverts(contract.connect(companion).wearSouvenir(targetId, 999));
  await (await contract.connect(companion).wearSouvenir(targetId, 1)).wait();
  assert.equal(Number((await contract.getTraveler(targetId)).wornSouvenirId), 1);
  await assertReverts(contract.connect(companion).sendSouvenir(targetId, otherTargetId, 0));
  await (await contract.connect(companion).wearSouvenir(targetId, 0)).wait();
  assert.equal(Number((await contract.getTraveler(targetId)).wornSouvenirId), 0);
});

test.after(() => {
  console.log(`Wayfarer.sol sha256: ${sourceHash}`);
});
