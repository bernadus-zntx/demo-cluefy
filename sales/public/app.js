let items = [];
const status = document.querySelector('#status');
const button = document.querySelector('#refresh');
function render() {
  const q = document.querySelector('#search').value.toLocaleLowerCase('id');
  document.querySelector('#items').replaceChildren(...items.filter(item => [item.title, item.publisher, item.location].join(' ').toLocaleLowerCase('id').includes(q)).map(item => {
    const article = document.createElement('article');
    for (const [tag, value] of [['small', [item.publisher, item.platform, item.location].filter(Boolean).join(' · ')], ['h2', item.title], ['p', item.excerpt], ['small', item.published_at ? new Date(item.published_at).toLocaleString('id-ID') : 'Waktu publikasi tidak tersedia']]) {
      const node = document.createElement(tag); node.textContent = value || ''; article.append(node);
    }
    return article;
  }));
}
async function load() {
  button.disabled = true;
  status.textContent = 'Memuat data live…';
  try {
    const response = await fetch('/api/items', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    items = data.items;
    status.textContent = data.message || `${items.length} artikel · Diambil ${new Date(data.fetchedAt).toLocaleString('id-ID')}`;
  } catch (error) { items = []; status.textContent = error.message || 'Koneksi gagal.'; }
  finally { render(); button.disabled = false; }
}
button.addEventListener('click', load);
document.querySelector('#search').addEventListener('input', render);
document.querySelector('#login-form').addEventListener('submit', event => {
  event.preventDefault();
  // Simulation only. Never transmit or persist the entered email/password.
  document.querySelector('#login-form').reset();
  document.querySelector('#demo-login').hidden = true;
  document.querySelector('#dashboard').hidden = false;
  void load();
});
