import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import { ethers } from 'ethers';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { EVENTS } from '../src/journey.js';

const artifact = JSON.parse(fs.readFileSync(new URL('../src/generated/contract.json', import.meta.url)));
const sourceHash = createHash('sha256').update(fs.readFileSync(new URL('../contracts/Wayfarer.sol', import.meta.url))).digest('hex');
const expectedOutcomes = [
  [[5, 1], [0, 2]],
  [[3, 4], [5, 8]],
  [[4, 16], [2, 32]],
  [[4, 64], [1, 128]],
  [[4, 256], [5, 512]],
  [[3, 0], [4, 1024]],
];

let rpc;
let provider;
let owner;
let companion;
let third;
let contract;

async function deploy() {
  rpc = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 5 } });
  provider = new ethers.BrowserProvider(rpc);
  owner = await provider.getSigner(0);
  companion = await provider.getSigner(1);
  third = await provider.getSigner(2);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner);
  contract = await factory.deploy();
  await contract.waitForDeployment();
}

async function create(name = '小旅伴', seed = 7, palette = 1, trait = 2, signer = owner) {
  const tx = await contract.connect(signer).create(name, seed, palette, trait);
  await tx.wait();
  return await contract.travelerCount();
}

async function assertReverts(action) {
  await assert.rejects(action);
}

function domainIds() {
  return EVENTS.flatMap((event, eventId) => event.responses.map((response, responseId) => ({ event, response, eventId, responseId })));
}

beforeEach(async () => {
  await deploy();
});

test('create stores the requested fields and enforces boundary values', async () => {
  const max = await create('a'.repeat(48), 0xffffffff, 3, 3);
  const traveler = await contract.getTraveler(max);
  assert.equal(traveler.origin, await owner.getAddress());
  assert.equal(traveler.name, 'a'.repeat(48));
  assert.equal(Number(traveler.seed), 0xffffffff);
  assert.equal(Number(traveler.palette), 3);
  assert.equal(Number(traveler.trait), 3);
  assert.equal(Number(traveler.chapter), 0);
  assert.equal(Number(traveler.mood), 0);
  assert.equal(Number(traveler.marks), 0);

  for (const args of [
    ['a'.repeat(49), 1, 0, 0],
    ['', 1, 0, 0],
    ['ok', 1, 4, 0],
    ['ok', 1, 0, 4],
  ]) await assertReverts(contract.create(...args));
});

test('only origin can experience and stale expectedChapter is rejected', async () => {
  const id = await create();
  await assertReverts(contract.connect(companion).experience(id, 0, 0, 0));
  await (await contract.experience(id, 0, 0, 0)).wait();
  assert.equal(Number((await contract.getTraveler(id)).chapter), 1);
  await assertReverts(contract.experience(id, 0, 1, 0));
  assert.equal(Number((await contract.getTraveler(id)).chapter), 1);
});

test('domain EVENTS map to all twelve on-chain outcomes and batch emits each result', async () => {
  const id = await create();
  const rows = domainIds();
  const eventIds = rows.map(({ eventId }) => eventId);
  const responseIds = rows.map(({ responseId }) => responseId);
  for (const { eventId, responseId, response } of rows) {
    const result = await contract.outcome(eventId, responseId);
    assert.equal(Number(result[0]), response.mood);
    assert.equal(Number(result[1]), expectedOutcomes[eventId][responseId][1]);
  }

  const receipt = await (await contract.experienceBatch(id, 0, eventIds, responseIds)).wait();
  const chapters = receipt.logs
    .map((log) => { try { return contract.interface.parseLog(log); } catch { return null; } })
    .filter((parsed) => parsed?.name === 'Chapter');
  assert.equal(chapters.length, 12);
  for (const [index, parsed] of chapters.entries()) {
    const row = rows[index];
    assert.equal(Number(parsed.args.chapter), index + 1);
    assert.equal(Number(parsed.args.eventId), row.eventId);
    assert.equal(Number(parsed.args.responseId), row.responseId);
    assert.equal(Number(parsed.args.mood), row.response.mood);
    assert.equal(Number(parsed.args.marks) & expectedOutcomes[row.eventId][row.responseId][1], expectedOutcomes[row.eventId][row.responseId][1]);
  }
  const traveler = await contract.getTraveler(id);
  assert.equal(Number(traveler.chapter), 12);
  assert.equal(Number(traveler.mood), 4);
  assert.equal(Number(traveler.marks) & 0x7ff, 0x7ff);
});

test('batch rejects empty or overlong input atomically', async () => {
  const id = await create();
  await assertReverts(contract.experienceBatch(id, 0, [], []));
  await assertReverts(contract.experienceBatch(id, 0, Array(21).fill(0), Array(21).fill(0)));
  await assertReverts(contract.experienceBatch(id, 0, [0, 1], [0]));

  await assertReverts(contract.experienceBatch(id, 0, [0, 99], [0, 0]));
  const traveler = await contract.getTraveler(id);
  assert.equal(Number(traveler.chapter), 0);
  assert.equal(Number(traveler.mood), 0);
  assert.equal(Number(traveler.marks), 0);
});

test('encourage is one-time per other wallet, supports gifts 0..3, and gift3 is a transient interaction', async () => {
  const id = await create();
  await assertReverts(contract.encourage(id, 0));
  await (await contract.connect(companion).encourage(id, 3)).wait();
  const gift3Traveler = await contract.getTraveler(id);
  assert.equal(Number(gift3Traveler.marks), 0);
  assert.equal(Number(gift3Traveler.mood), 0);
  assert.equal(Number(gift3Traveler.lastInteraction), 3);
  assert.ok(Number(gift3Traveler.lastInteractionAt) > 0);
  await assertReverts(contract.connect(third).encourage(id, 4));
  await (await contract.connect(third).encourage(id, 0)).wait();
  assert.equal(await contract.hasEncouraged(id, await third.getAddress()), true);
  assert.equal(Number((await contract.getTraveler(id)).marks) & (1 << 12), 1 << 12);
  assert.equal(Number((await contract.getTraveler(id)).mood), 4);
  await assertReverts(contract.connect(third).encourage(id, 1));

  const id2 = await create('二号', 8, 0, 0);
  await (await contract.connect(companion).encourage(id2, 1)).wait();
  assert.equal(Number((await contract.getTraveler(id2)).marks) & (1 << 13), 1 << 13);
  const id3 = await create('三号', 9, 0, 0);
  await (await contract.connect(third).encourage(id3, 2)).wait();
  assert.equal(Number((await contract.getTraveler(id3)).marks) & (1 << 14), 1 << 14);
});

test.after(() => {
  console.log(`Wayfarer.sol sha256: ${sourceHash}`);
});
