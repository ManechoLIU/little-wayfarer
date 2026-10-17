import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyWalkGesture } from '../src/walk.js';

test('a short steady press remains a tap', () => {
  assert.equal(classifyWalkGesture(180, 4), 'tap');
});

test('movement past the threshold becomes a drag before or after hold time', () => {
  assert.equal(classifyWalkGesture(120, 11), 'drag');
  assert.equal(classifyWalkGesture(500, 18), 'drag');
});

test('a steady 350ms press becomes continuous hold movement', () => {
  assert.equal(classifyWalkGesture(349, 2), 'tap');
  assert.equal(classifyWalkGesture(350, 2), 'hold');
});

test('pointer cancellation wins over tap, drag and hold classification', () => {
  assert.equal(classifyWalkGesture(700, 30, true), 'cancel');
});
