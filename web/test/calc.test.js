import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBill } from '../calc.js';
import { parseReceiptText } from '../receipt.js';

const people = [{ id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob' }];
const item = (price, taxable, sharers) => ({ price, taxable, sharers });

test('tax applies only to selected taxable items and their sharers', () => {
  const result = calculateBill({
    people,
    items: [item('10.00', true, ['alice', 'bob']), item('4.00', false, ['bob'])],
    taxEnabled: true, taxRate: 13, discount10: false, discount20: false,
  });
  assert.deepEqual(result.people.map(person => person.cents), [565, 965]);
  assert.equal(result.tax, 130);
  assert.equal(result.total, 1530);
});

test('global tax toggle and combined 30% discounts match the workbook', () => {
  const state = {
    people, items: [item('10.00', true, ['alice']), item('5.00', false, ['bob'])],
    taxEnabled: true, taxRate: 13, discount10: true, discount20: true,
  };
  const taxed = calculateBill(state);
  assert.deepEqual(taxed.people.map(person => person.cents), [791, 350]);
  assert.equal(taxed.discount, 450);
  assert.equal(taxed.tax, 91);
  assert.equal(calculateBill({ ...state, taxEnabled: false }).tax, 0);
});

test('allocates every cent and flags unassigned or invalid entries', () => {
  const result = calculateBill({
    people,
    items: [item('0.01', false, ['alice', 'bob']), item('2.00', true, []), item('', true, ['alice'])],
    taxEnabled: true, taxRate: 13, discount10: false, discount20: false,
  });
  assert.deepEqual(result.people.map(person => person.cents), [1, 0]);
  assert.equal(result.total, 1);
  assert.equal(result.unassigned, 1);
  assert.equal(result.invalid, 1);
});

test('receipt parser omits totals and keeps reviewable line items', () => {
  const result = parseReceiptText('MILK 2% 6.44\nBREAD $3.99\nHST 1.34\nTOTAL 11.77\n2 x APPLES 4.50');
  assert.deepEqual(result, [
    { name: 'MILK 2%', price: '6.44' },
    { name: 'BREAD', price: '3.99' },
    { name: 'APPLES', price: '4.50' },
  ]);
});
