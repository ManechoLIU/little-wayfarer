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

async function assertReverts(action) {
  await assert.rejects(async () => {
    const result = await (typeof action === 'function' ? action() : action);
    if (result?.wait) await result.wait();
  });
}

beforeEach(async () => {
  await deploy();
});

test('gift3 records a short-lived interaction without changing mood or marks', async () => {
  const targetId = await create('当前旅伴', companion);
  await (await contract.connect(companion).experience(targetId, 0, 0, 0)).wait();
  const before = await contract.getTraveler(targetId);
  await (await contract.connect(third).encourage(targetId, 3)).wait();
  const after = await contract.getTraveler(targetId);
  assert.equal(after.marks, before.marks);
  assert.equal(after.mood, before.mood);
  assert.equal(Number(after.lastInteraction), 3);
  assert.ok(Number(after.lastInteractionAt) > 0);
  assert.equal(await contract.hasEncouraged(targetId, await third.getAddress()), true);
  await assertReverts(contract.connect(third).encourage(targetId, 3));
  await assertReverts(contract.connect(third).encourage(targetId, 4));
});

test('gift3 is distinct from gifts 0..2 and experience preserves the interaction fields', async () => {
  const targetId = await create('旅伴', companion);
  await (await contract.connect(owner).encourage(targetId, 0)).wait();
  const ordinary = await contract.getTraveler(targetId);
  assert.equal(Number(ordinary.marks) & (1 << 12), 1 << 12);
  assert.equal(Number(ordinary.mood), 4);
  const targetId2 = await create('彩纸旅伴', companion);
  await (await contract.connect(owner).encourage(targetId2, 3)).wait();
  const reaction = await contract.getTraveler(targetId2);
  await (await contract.connect(companion).experience(targetId2, 0, 0, 0)).wait();
  const afterExperience = await contract.getTraveler(targetId2);
  assert.equal(Number(afterExperience.lastInteraction), 3);
  assert.equal(afterExperience.lastInteractionAt, reaction.lastInteractionAt);
  assert.equal(Number(afterExperience.marks), 1);
  assert.equal(Number(afterExperience.mood), 5);
});

test('self interaction and gift4 are rejected while souvenir and reaction limits stay independent', async () => {
  const sourceId = await create('来源');
  const targetId = await create('收件人', companion);
  await (await contract.experience(sourceId, 0, 0, 0)).wait();
  await assertReverts(contract.encourage(sourceId, 3));
  await assertReverts(contract.connect(third).encourage(targetId, 4));
  await (await contract.sendSouvenir(sourceId, targetId, 0)).wait();
  await (await contract.connect(third).encourage(targetId, 3)).wait();
  assert.equal(Number((await contract.getTraveler(targetId)).souvenirCount), 1);
  assert.equal(Number((await contract.getTraveler(targetId)).lastInteraction), 3);
});

test.after(() => {
  console.log(`Wayfarer.sol sha256: ${sourceHash}`);
});
