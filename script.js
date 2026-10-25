/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   ตรวจจาก id ของ element ในหน้า แล้วทำงานเฉพาะส่วนที่เกี่ยวข้อง
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   ========================================================== */

const ORDER_URL = 'https://script.google.com/macros/s/AKfycbwdd_bXpgFVKY9OMmqQJYORXKmE6w1UrjEUczbsnD_PrqmM8Z3ZKFO5X4n5LEbxCZ9P/exec';
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRW7Q9t3XYkVDxHDaJd598ZAMIXCpBHboMqxKGXvPgy8f6qMqqt9ms2oL_ezrfdlNZ2atg0qLAs3hVE/pub?gid=0&single=true&output=csv';

const MOODS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

/* ---------- Helpers ---------- */
function $(selector) {
  return document.querySelector(selector);
}

// สร้าง element แบบปลอดภัย (ใช้ textContent ไม่ใช้ innerHTML)
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('th-TH') : value;
}

/* ==========================================================
   1) หน้า product.html — แสดงสินค้า + ปุ่มกรอง mood
   ========================================================== */
function initProductPage() {
  const list = $('#product-list');
  if (!list) return;

  const bar = $('#filter-bar');
  let products = [];
  let currentMood = 'all';

  function moodLabel(key) {
    const found = MOODS.find(function (m) { return m.key === key; });
    return found ? found.label : key;
  }

  function buildOrderUrl(product) {
    const itemName = product.size ? product.name + ' ' + product.size : product.name;
    return 'order.html?item=' + encodeURIComponent(itemName) +
           '&price=' + encodeURIComponent(product.price);
  }

  function createCard(product) {
    const card = el('article', 'product-card');
    card.setAttribute('data-mood', product.mood);

    const media = el('div', 'product-card__media');
    const img = el('img');
    img.src = product.image;
    img.alt = product.name;
    img.loading = 'lazy';
    img.addEventListener('error', function () { img.style.visibility = 'hidden'; });
    media.appendChild(img);

    const body = el('div', 'product-card__body');

    const moodRow = el('div', 'product-card__mood');
    moodRow.appendChild(el('span', 'mood-dot'));
    moodRow.appendChild(el('span', null, moodLabel(product.mood)));
    body.appendChild(moodRow);

    body.appendChild(el('h3', 'product-card__name', product.name));

    if (product.size) {
      body.appendChild(el('p', 'product-card__size', product.size));
    }

    const footer = el('div', 'product-card__footer');
    const price = el('span', 'price', formatNumber(product.price) + ' ');
    price.appendChild(el('small', null, 'บาท'));
    footer.appendChild(price);

    const buy = el('a', 'btn', 'สั่งซื้อ');
    buy.href = buildOrderUrl(product);
    footer.appendChild(buy);

    body.appendChild(footer);
    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  function renderProducts() {
    list.textContent = '';
    const shown = products.filter(function (p) {
      return currentMood === 'all' || p.mood === currentMood;
    });

    if (shown.length === 0) {
      list.appendChild(el('p', null, 'ยังไม่มีสินค้าในหมวดนี้'));
      return;
    }
    shown.forEach(function (p) { list.appendChild(createCard(p)); });
  }

  function updateFilterButtons() {
    if (!bar) return;
    bar.querySelectorAll('.filter').forEach(function (btn) {
      const active = btn.getAttribute('data-mood') === currentMood;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setMood(key) {
    currentMood = key;
    updateFilterButtons();
    renderProducts();
    try {
      const url = new URL(window.location.href);
      if (key === 'all') url.searchParams.delete('mood');
      else url.searchParams.set('mood', key);
      history.replaceState(null, '', url);
    } catch (e) { /* ไม่ต้องทำอะไร ถ้าเบราว์เซอร์ไม่อนุญาต */ }
  }

  function buildFilterBar() {
    if (!bar) return;
    bar.textContent = '';
    MOODS.forEach(function (m) {
      const btn = el('button', 'filter');
      btn.type = 'button';
      btn.setAttribute('data-mood', m.key);
      if (m.key !== 'all') {
        btn.appendChild(el('span', 'mood-dot'));
      }
      btn.appendChild(el('span', null, m.label));
      btn.addEventListener('click', function () { setMood(m.key); });
      bar.appendChild(btn);
    });
  }

  // กำหนดสี mood ให้ปุ่มกรอง (ผ่าน data-mood บนตัวจุด)
  function applyDotColors() {
    if (!bar) return;
    bar.querySelectorAll('.filter').forEach(function (btn) {
      const dot = btn.querySelector('.mood-dot');
      if (dot) dot.setAttribute('data-mood', btn.getAttribute('data-mood'));
    });
  }

  list.textContent = 'กำลังโหลดสินค้า...';

  fetch('products.json')
    .then(function (res) {
      if (!res.ok) throw new Error('โหลด products.json ไม่สำเร็จ (' + res.status + ')');
      return res.json();
    })
    .then(function (data) {
      products = data;

      const wanted = (new URLSearchParams(window.location.search).get('mood') || '').toLowerCase();
      const valid = MOODS.some(function (m) { return m.key === wanted; });
      currentMood = valid ? wanted : 'all';

      buildFilterBar();
      applyDotColors();
      updateFilterButtons();
      renderProducts();
    })
    .catch(function (error) {
      console.error(error);
      list.textContent = 'ไม่สามารถโหลดสินค้าได้ กรุณาลองใหม่อีกครั้ง';
    });
}

/* ==========================================================
   2) หน้า order.html — เติมฟอร์มอัตโนมัติ + ส่งคำสั่งซื้อ
   ========================================================== */
function initOrderPage() {
  const form = $('#orderForm');
  if (!form) return;

  // อ่าน item และ price จาก URL แล้วเติมลงทั้งสองช่องทันที
  const params = new URLSearchParams(window.location.search);
  const item = params.get('item');
  const price = params.get('price');

  const itemsInput = $('#items');
  const totalInput = $('#total');

  if (item && itemsInput) itemsInput.value = item;
  if (price && totalInput) totalInput.value = price;

  function valueOf(id) {
    const input = document.getElementById(id);
    return input ? input.value.trim() : '';
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

    const totalRaw = valueOf('total');
    const totalNum = Number(totalRaw);

    const payload = {
      customerName: valueOf('customerName'),
      contact: valueOf('contact'),
      items: valueOf('items'),
      total: totalRaw !== '' && Number.isFinite(totalNum) ? totalNum : totalRaw,
      note: valueOf('note')
    };

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(ORDER_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      if (submitBtn) submitBtn.disabled = false;
    });
  });
}

/* ==========================================================
   3) หน้า admin.html — แสดงรายการสั่งซื้อจาก Google Sheet (CSV)
   ========================================================== */

// แปลง CSV เป็น array 2 มิติ รองรับ "..." , "" (quote ซ้อน), ขึ้นบรรทัดใหม่ในช่อง, CRLF และ BOM
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function initAdminPage() {
  const tbody = $('#ordersTable tbody');
  if (!tbody) return;

  const COLUMNS = 6;

  function showMessage(message) {
    tbody.textContent = '';
    const tr = el('tr');
    const td = el('td', null, message);
    td.colSpan = COLUMNS;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  showMessage('กำลังโหลดข้อมูล...');

  fetch(SHEET_CSV_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ (' + res.status + ')');
      return res.text();
    })
    .then(function (text) {
      let rows = parseCSV(text).filter(function (r) {
        return r.some(function (cell) { return cell.trim() !== ''; });
      });

      // ถ้าแถวแรกไม่มีตัวเลขในคอลัมน์วันเวลา ให้ถือว่าเป็นหัวตาราง แล้วข้าม
      if (rows.length > 0 && !/\d/.test(rows[0][0] || '')) {
        rows = rows.slice(1);
      }

      if (rows.length === 0) {
        showMessage('ยังไม่มีรายการสั่งซื้อ');
        return;
      }

      // appendRow เพิ่มแถวต่อท้ายตามเวลา จึงกลับลำดับเพื่อให้รายการล่าสุดขึ้นก่อน
      rows.reverse();

      tbody.textContent = '';
      rows.forEach(function (r) {
        const tr = el('tr');
        for (let i = 0; i < COLUMNS; i++) {
          const cell = r[i] !== undefined ? r[i] : '';
          // คอลัมน์ที่ 5 (index 4) คือจำนวนเงินรวม
          tr.appendChild(el('td', null, i === 4 ? formatNumber(cell) : cell));
        }
        tbody.appendChild(tr);
      });
    })
    .catch(function (error) {
      console.error(error);
      showMessage('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    });
}

/* ---------- Start ---------- */
function init() {
  initProductPage();
  initOrderPage();
  initAdminPage();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
