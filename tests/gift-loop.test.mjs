import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory } from 'ethers';
import { createTraveler, validateTraveler } from '../src/journey.js';
import { makeTextDiaryEntry, validateDiaryEntry } from '../src/diary.js';
import { readGiftCounts } from '../src/gift-counts.js';
import { gearHTML } from '../src/gear.js';
import { historicalLook } from '../src/history.js';
import { writeJournal } from '../src/integrity.js';

test('local EVM gifts survive journal reload while previous diary appearances stay frozen', async () => {
  const rpc = ganache.provider({ logging: { quiet: true } });
  try {
    const provider = new BrowserProvider(rpc);
    const owner = await provider.getSigner(0), friend = await provider.getSigner(1);
    const artifact = JSON.parse(fs.readFileSync(new URL('../src/generated/contract.json', import.meta.url)));
    const contract = await new ContractFactory(artifact.abi, artifact.bytecode, owner).deploy();
    await contract.waitForDeployment();
    let traveler = createTraveler({ name: '一直在长大', seed: 123, palette: 0, trait: 3 });
    await (await contract.create(traveler.name, traveler.seed, traveler.palette, traveler.trait)).wait();
    traveler.giftCounts = await readGiftCounts(contract, 1);
    const before = makeTextDiaryEntry(traveler, traveler, '朋友来之前', []);
    await (await contract.connect(friend).encourage(1, 0)).wait();
    traveler = { ...traveler, marks: ['一朵小花'], giftCounts: await readGiftCounts(contract, 1) };
    const afterOne = makeTextDiaryEntry(traveler, traveler, '收到第一朵小花', []);
    for (let i = 0; i < 2; i++) await (await contract.connect(friend).encourage(1, 0)).wait();
    const chain = await contract.getTraveler(1);
    assert.equal(Number(chain.marks) & 4096, 4096);
    traveler = { ...traveler, mood: Number(chain.mood), giftCounts: await readGiftCounts(contract, 1) };
    assert.deepEqual(traveler.giftCounts, ['3', '0', '0', '0']);
    let stored = null;
    writeJournal({ getItem: () => stored, setItem: (_, value) => { stored = value; } }, 'journal', { travelers: [traveler], entries: [before, afterOne] }, null);
    const restored = JSON.parse(stored);
    assert.ok(validateTraveler(restored.travelers[0]));
    assert.ok(restored.entries.every(validateDiaryEntry));
    const countFlowers = t => (gearHTML(t, []).match(/data-gift-kind="flower"/g) || []).length;
    assert.equal(countFlowers(restored.travelers[0]), 3);
    assert.equal(countFlowers(historicalLook(restored.travelers[0], restored.entries[0], restored.entries).traveler), 0);
    assert.equal(countFlowers(historicalLook(restored.travelers[0], restored.entries[1], restored.entries).traveler), 1);
    assert.deepEqual(afterOne.giftCounts, ['1', '0', '0', '0']);
  } finally { await rpc.disconnect(); }
});
