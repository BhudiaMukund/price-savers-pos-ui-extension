// Pure keypad logic (no Shopify calls), so it can be unit-tested on its own.
//
// Works like the Casio:
//   450 PARTY          -> 1 x $4.50 Party
//   3 x 450 PARTY      -> 3 x $4.50 Party
//   PARTY (no price)   -> repeats the last Party sale (same price, qty 1)
//   C                  -> clears what's been typed and resets qty to 1
//
// Prices are keyed in cents with no decimal point, same as the till:
// 5 = $0.05, 450 = $4.50, 1000 = $10.00, 10 00 = $10.00.

import {MAX_PRICE_CENTS, MAX_QTY} from './departments.js';

export const initialState = {entry: '', qty: 1, last: null};

export function formatCents(cents) {
  return (cents / 100).toFixed(2);
}

export function entryCents(state) {
  return state.entry === '' ? 0 : parseInt(state.entry, 10);
}

// Returns {state, sale?, error?}
// sale = {code, cents, qty}
export function press(state, key) {
  if (key === 'C') {
    return {state: {...state, entry: '', qty: 1}};
  }

  if (key === '0' || key === '00' || /^[1-9]$/.test(key)) {
    let next = (state.entry + key).replace(/^0+/, '');
    if (next.length > String(MAX_PRICE_CENTS).length || parseInt(next || '0', 10) > MAX_PRICE_CENTS) {
      return {state, error: `Max price is $${formatCents(MAX_PRICE_CENTS)}`};
    }
    return {state: {...state, entry: next}};
  }

  if (key === 'X') {
    const n = entryCents(state);
    if (n < 1) return {state, error: 'Type the quantity, then press ×'};
    if (n > MAX_QTY) return {state: {...state, entry: ''}, error: `Max quantity is ${MAX_QTY}`};
    return {state: {...state, qty: n, entry: ''}};
  }

  if (key.startsWith('DEPT:')) {
    const code = key.slice(5);
    let cents = entryCents(state);
    if (cents < 1) {
      if (state.last && state.last.code === code) {
        cents = state.last.cents; // repeat key, like pressing a dept key twice on the Casio
      } else {
        return {state, error: 'Type a price first'};
      }
    }
    const sale = {code, cents, qty: state.qty};
    return {state: {entry: '', qty: 1, last: sale}, sale};
  }

  return {state, error: `Unknown key ${key}`};
}
