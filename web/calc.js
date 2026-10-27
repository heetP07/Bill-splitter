export function toCents(value) {
  if (value === '' || value === null || value === undefined) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round((amount + Number.EPSILON) * 100) : null;
}

function allocate(cents, count) {
  const base = Math.floor(cents / count);
  return Array.from({ length: count }, (_, index) => base + (index < cents % count ? 1 : 0));
}

export function calculateBill(state) {
  const people = state.people.map(person => ({ id: person.id, name: person.name, cents: 0 }));
  const personById = new Map(people.map(person => [person.id, person]));
  const rate = Math.min(100, Math.max(0, Number(state.taxRate) || 0)) / 100;
  const discountRate = (state.discount10 ? 10 : 0) + (state.discount20 ? 20 : 0);
  const result = { people, subtotal: 0, discount: 0, tax: 0, total: 0, unassigned: 0, invalid: 0 };
  for (const item of state.items) {
    const price = toCents(item.price);
    if (price === null) { result.invalid++; continue; }
    const sharers = [...new Set(item.sharers)].filter(id => personById.has(id));
    if (sharers.length === 0) { if (price > 0) result.unassigned++; continue; }
    const discounted = Math.round(price * (100 - discountRate) / 100);
    const tax = state.taxEnabled && item.taxable ? Math.round(discounted * rate) : 0;
    result.subtotal += price;
    result.discount += price - discounted;
    result.tax += tax;
    result.total += discounted + tax;
    const shares = allocate(discounted + tax, sharers.length);
    sharers.forEach((id, index) => { personById.get(id).cents += shares[index]; });
  }
  return result;
}
