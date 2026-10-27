import { calculateBill, toCents } from './calc.js';
import { parseReceiptText, readReceipt } from './receipt.js';

const storageKey = 'sharecart-bill-v1';
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const initialState = () => ({ people: [], items: [], taxEnabled: false, taxRate: 13, discount10: false, discount20: false });
let state = loadState();
let nextId = Date.now();
let lastScanIds = [];

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved?.people) && Array.isArray(saved?.items)) return { ...initialState(), ...saved };
  } catch {}
  return initialState();
}

function saveState() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
}

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function renderPeople() {
  const list = document.querySelector('#people-list');
  list.replaceChildren();
  for (const person of state.people) {
    const chip = element('div', 'person-chip');
    const input = element('input', 'chip-name');
    input.value = person.name;
    input.maxLength = 32;
    input.setAttribute('aria-label', `Rename ${person.name}`);
    input.dataset.personId = person.id;
    const remove = element('button', '', '×');
    remove.type = 'button';
    remove.dataset.removePerson = person.id;
    remove.setAttribute('aria-label', `Remove ${person.name}`);
    chip.append(input, remove);
    list.append(chip);
  }
  document.querySelector('#people-count').textContent = `${state.people.length} ${state.people.length === 1 ? 'person' : 'people'}`;
}

function updateItemDetails(card, item) {
  const label = item.name || 'item';
  card.querySelector('.item-price').setAttribute('aria-label', `Price for ${label}`);
  card.querySelector('[data-remove-item]').setAttribute('aria-label', `Remove ${label}`);
  card.querySelector('[data-field="taxable"]').setAttribute('aria-label', `${label} is taxable`);
  card.querySelectorAll('[data-sharer-id]').forEach(checkbox => {
    const person = state.people.find(entry => entry.id === checkbox.dataset.sharerId);
    checkbox.setAttribute('aria-label', `${person?.name || 'Person'} shares ${label}`);
  });
  card.querySelector('.item-note')?.remove();
  if (toCents(item.price) === null) card.append(element('p', 'item-note', 'Enter a valid price to include this item.'));
  else if (Number(item.price) > 0 && item.sharers.length === 0) card.append(element('p', 'item-note', 'Select at least one person to include this item.'));
}

function renderItems() {
  const list = document.querySelector('#items-list');
  list.replaceChildren();
  if (!state.items.length) list.append(element('p', 'items-empty', 'Your items will appear here after a scan, or add one manually.'));
  for (const item of state.items) {
    const card = element('article', 'item-card');
    card.dataset.itemId = item.id;
    const top = element('div', 'item-top');
    const name = element('input', 'item-name');
    name.value = item.name;
    name.placeholder = 'Item description';
    name.dataset.field = 'name';
    name.setAttribute('aria-label', 'Item description');
    const priceWrap = element('div', 'price-wrap');
    const price = element('input', 'item-price');
    price.type = 'number';
    price.min = '0';
    price.step = '0.01';
    price.inputMode = 'decimal';
    price.value = item.price;
    price.dataset.field = 'price';
    price.setAttribute('aria-label', `Price for ${item.name || 'item'}`);
    priceWrap.append(element('span', '', '$'), price);
    const remove = element('button', 'icon-button', '×');
    remove.type = 'button';
    remove.dataset.removeItem = item.id;
    remove.setAttribute('aria-label', `Remove ${item.name || 'item'}`);
    top.append(name, priceWrap, remove);

    const bottom = element('div', 'item-bottom');
    const sharers = element('div', 'sharer-group');
    sharers.append(element('span', 'group-label', 'Shared by'));
    if (!state.people.length) sharers.append(element('span', 'no-people', 'Add people above'));
    for (const person of state.people) {
      const label = element('label', 'sharer-check');
      const checkbox = element('input');
      checkbox.type = 'checkbox';
      checkbox.checked = item.sharers.includes(person.id);
      checkbox.dataset.sharerId = person.id;
      checkbox.setAttribute('aria-label', `${person.name} shares ${item.name || 'item'}`);
      label.append(checkbox, element('span', '', person.name));
      sharers.append(label);
    }
    const taxable = element('label', 'tax-check');
    const taxCheckbox = element('input');
    taxCheckbox.type = 'checkbox';
    taxCheckbox.checked = item.taxable;
    taxCheckbox.dataset.field = 'taxable';
    taxCheckbox.setAttribute('aria-label', `${item.name || 'item'} is taxable`);
    taxable.append(taxCheckbox, element('span'), document.createTextNode('Taxable'));
    bottom.append(sharers, taxable);
    card.append(top, bottom);
    updateItemDetails(card, item);
    list.append(card);
  }
  document.querySelector('#items-count').textContent = `${state.items.length} ${state.items.length === 1 ? 'item' : 'items'}`;
}

function renderTotals() {
  const bill = calculateBill(state);
  const list = document.querySelector('#person-totals');
  list.replaceChildren();
  if (!bill.people.length) list.append(element('p', 'empty-state', 'Add people to see their totals.'));
  for (const person of bill.people) {
    const line = element('div', 'person-total');
    line.append(element('span', '', person.name), element('strong', '', currency.format(person.cents / 100)));
    list.append(line);
  }
  document.querySelector('#subtotal').textContent = currency.format(bill.subtotal / 100);
  document.querySelector('#discount-total').textContent = `−${currency.format(bill.discount / 100)}`;
  document.querySelector('#tax-total').textContent = currency.format(bill.tax / 100);
  document.querySelector('#grand-total').textContent = currency.format(bill.total / 100);
  const warning = document.querySelector('#split-warning');
  const parts = [];
  if (bill.unassigned) parts.push(`${bill.unassigned} ${bill.unassigned === 1 ? 'item needs' : 'items need'} a sharer`);
  if (bill.invalid) parts.push(`${bill.invalid} ${bill.invalid === 1 ? 'item has' : 'items have'} an invalid price`);
  warning.textContent = parts.join(' · ');
  warning.hidden = parts.length === 0;
}

function render() {
  renderPeople();
  renderItems();
  document.querySelector('#tax-enabled').checked = state.taxEnabled;
  document.querySelector('#tax-rate').value = state.taxRate;
  document.querySelector('#discount-10').checked = state.discount10;
  document.querySelector('#discount-20').checked = state.discount20;
  renderTotals();
}

function changed() { saveState(); renderTotals(); }
function newItem(name = '', price = '') { return { id: `item-${++nextId}`, name, price, taxable: false, sharers: [] }; }

document.querySelector('#add-person-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.querySelector('#person-name');
  const name = input.value.trim();
  if (!name) return;
  state.people.push({ id: `person-${++nextId}`, name });
  input.value = '';
  saveState(); render();
});

document.querySelector('#people-list').addEventListener('change', event => {
  const person = state.people.find(entry => entry.id === event.target.dataset.personId);
  if (!person) return;
  person.name = event.target.value.trim() || person.name;
  saveState(); render();
});

document.querySelector('#people-list').addEventListener('click', event => {
  const id = event.target.dataset.removePerson;
  if (!id) return;
  state.people = state.people.filter(person => person.id !== id);
  state.items.forEach(item => { item.sharers = item.sharers.filter(sharer => sharer !== id); });
  saveState(); render();
});

document.querySelector('#add-item').addEventListener('click', () => {
  state.items.push(newItem());
  saveState(); render();
  document.querySelector('.item-card:last-child .item-name')?.focus();
});

document.querySelector('#items-list').addEventListener('click', event => {
  const id = event.target.dataset.removeItem;
  if (!id) return;
  state.items = state.items.filter(item => item.id !== id);
  saveState(); render();
});

document.querySelector('#items-list').addEventListener('input', event => {
  const card = event.target.closest('.item-card');
  const item = state.items.find(entry => entry.id === card?.dataset.itemId);
  if (!item || !['name', 'price'].includes(event.target.dataset.field)) return;
  item[event.target.dataset.field] = event.target.value;
  updateItemDetails(card, item);
  changed();
});

document.querySelector('#items-list').addEventListener('change', event => {
  const card = event.target.closest('.item-card');
  const item = state.items.find(entry => entry.id === card?.dataset.itemId);
  if (!item) return;
  if (event.target.dataset.field === 'taxable') item.taxable = event.target.checked;
  else if (event.target.dataset.sharerId) {
    const id = event.target.dataset.sharerId;
    item.sharers = event.target.checked ? [...item.sharers, id] : item.sharers.filter(sharer => sharer !== id);
  } else return;
  saveState(); render();
});

for (const [selector, key] of [['#tax-enabled', 'taxEnabled'], ['#discount-10', 'discount10'], ['#discount-20', 'discount20']]) {
  document.querySelector(selector).addEventListener('change', event => { state[key] = event.target.checked; changed(); });
}
document.querySelector('#tax-rate').addEventListener('input', event => { state.taxRate = event.target.value; changed(); });

function setStatus(message, error = false) {
  const status = document.querySelector('#scan-status');
  status.textContent = message;
  status.classList.toggle('error', error);
}

async function processFiles(files) {
  if (!files.length) return;
  const texts = [];
  try {
    for (const file of files) {
      setStatus(`Opening ${file.name}…`);
      texts.push(await readReceipt(file, message => setStatus(message)));
    }
    const combined = texts.join('\n');
    document.querySelector('#receipt-text').value = combined;
    document.querySelector('#receipt-text-section').hidden = false;
    const extracted = parseReceiptText(combined);
    const newItems = extracted.map(item => newItem(item.name, item.price));
    lastScanIds = newItems.map(item => item.id);
    state.items.push(...newItems);
    saveState(); render();
    setStatus(extracted.length ? `Found ${extracted.length} possible ${extracted.length === 1 ? 'item' : 'items'}. Check every description and price before splitting.` : 'No items found automatically. Review the text or add items manually.');
  } catch (error) { setStatus(error.message || 'Could not read this receipt. Try another file or add items manually.', true); }
}

document.querySelector('#receipt-file').addEventListener('change', event => { processFiles([...event.target.files]); event.target.value = ''; });
const dropZone = document.querySelector('#drop-zone');
dropZone.addEventListener('dragover', event => { event.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
dropZone.addEventListener('drop', event => { event.preventDefault(); dropZone.classList.remove('dragging'); processFiles([...event.dataTransfer.files]); });
document.querySelector('#reparse-text').addEventListener('click', () => {
  const extracted = parseReceiptText(document.querySelector('#receipt-text').value);
  state.items = state.items.filter(item => !lastScanIds.includes(item.id));
  const newItems = extracted.map(item => newItem(item.name, item.price));
  lastScanIds = newItems.map(item => item.id);
  state.items.push(...newItems);
  saveState(); render();
  setStatus(`Found ${extracted.length} possible items from the corrected text. Review them below.`);
});
document.querySelector('#reset-bill').addEventListener('click', () => {
  if (!window.confirm('Start a fresh bill? This clears the current items and people saved in this browser.')) return;
  state = initialState();
  lastScanIds = [];
  document.querySelector('#receipt-text').value = '';
  document.querySelector('#receipt-text-section').hidden = true;
  setStatus('');
  saveState(); render();
});

render();
