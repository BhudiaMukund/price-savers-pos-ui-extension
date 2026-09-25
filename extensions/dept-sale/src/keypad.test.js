// Run with: node --test extensions/dept-sale/src/keypad.test.js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState, press} from './keypad.js';

function run(keys) {
  let state = initialState;
  const sales = [];
  const errors = [];
  for (const k of keys) {
    const r = press(state, k);
    state = r.state;
    if (r.sale) sales.push(r.sale);
    if (r.error) errors.push(r.error);
  }
  return {state, sales, errors};
}

test('450 PARTY adds 1 x $4.50', () => {
  const {sales} = run(['4', '5', '0', 'DEPT:PARTY']);
  assert.deepEqual(sales, [{code: 'PARTY', cents: 450, qty: 1}]);
});

test('3 x 450 PARTY adds 3 x $4.50', () => {
  const {sales} = run(['3', 'X', '4', '5', '0', 'DEPT:PARTY']);
  assert.deepEqual(sales, [{code: 'PARTY', cents: 450, qty: 3}]);
});

test('10 00 = $10.00', () => {
  const {sales} = run(['1', '0', '00', 'DEPT:TOY']);
  assert.equal(sales[0].cents, 1000);
});

test('pressing same dept again repeats last price, qty resets to 1', () => {
  const {sales} = run(['2', 'X', '9', '9', '5', 'DEPT:XMAS', 'DEPT:XMAS']);
  assert.deepEqual(sales[1], {code: 'XMAS', cents: 995, qty: 1});
});

test('dept with no price and different last dept errors', () => {
  const {sales, errors} = run(['5', '0', '0', 'DEPT:TOY', 'DEPT:GIFT']);
  assert.equal(sales.length, 1);
  assert.equal(errors.length, 1);
});

test('dept with no price at start errors', () => {
  const {sales, errors} = run(['DEPT:TOY']);
  assert.equal(sales.length, 0);
  assert.equal(errors.length, 1);
});

test('C clears entry and qty', () => {
  const {state} = run(['3', 'X', '4', '5', 'C']);
  assert.equal(state.entry, '');
  assert.equal(state.qty, 1);
});

test('leading zeros are ignored', () => {
  const {sales} = run(['0', '00', '5', 'DEPT:MISC']);
  assert.equal(sales[0].cents, 5);
});

test('price over max is rejected and keeps previous entry', () => {
  const {state, errors} = run(['9', '9', '9', '9', '9', '9']);
  assert.equal(state.entry, '99999');
  assert.equal(errors.length, 1);
});

test('qty over max is rejected', () => {
  const {state, errors} = run(['1', '0', '0', 'X']);
  assert.equal(state.qty, 1);
  assert.equal(errors.length, 1);
});

test('x with nothing typed errors', () => {
  const {errors} = run(['X']);
  assert.equal(errors.length, 1);
});
