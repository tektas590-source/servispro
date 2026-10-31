/* Uygulama kabuğu: yönlendirme (hash router), oturum, yan menü */
(function () {
  const SP = window.SP;
  const { h, toast } = SP.ui;
  SP.pages = SP.pages || {};
  SP.session = null;

  const NAV = [
    ['panel', 'Gösterge paneli', '◧'],
    ['randevular', 'Randevular', '◷'],
    ['is-emirleri', 'İş emirleri', '⚒'],
    ['musteriler', 'Müşteri & araç', '☺'],
    ['stok', 'Stok & parça', '▤'],
    ['faturalar', 'Fatura & tahsilat', '₺'],
    ['ayarlar', 'Ayarlar', '⚙'],
    ['abonelik', 'Abonelik', '★'],
  ];
  const PUBLIC = ['', 'giris', 'kayit', 'sifre'];

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, q] = raw.split('?');
    const parts = path.split(/\/|--/).filter(Boolean);
    const query = Object.fromEntries(new URLSearchParams(q || ''));
    return { name: parts[0] || '', id: parts[1], query };
  }
  SP.go = (path) => { location.hash = '#' + path; };

  let rendering = 0;
  async function route() {
    const my = ++rendering;
    const r = parseHash();
    const root = document.getElementById('root');
    window.scrollTo(0, 0);

    if (!SP.session) {
      if (!PUBLIC.includes(r.name)) { SP.go('giris'); return; }
      root.replaceChildren();
      const page = r.name === '' ? 'landing' : r.name;
      await SP.pages[page](root, r);
      return;
    }
    if (PUBLIC.includes(r.name)) { SP.go('panel'); return; }
    if (!SP.session.tenant && r.name !== 'yonetici') { root.replaceChildren(noTenant()); return; }

    const name = SP.pages[r.name] ? r.name : 'panel';
    const shell = layout(name);
    root.replaceChildren(shell.el);
    try { await SP.pages[name](shell.view, r); }
    catch (e) { console.error(e); if (my === rendering) shell.view.replaceChildren(h('div', { class: 'empty err' }, 'Sayfa yüklenemedi: ' + (e.message || e))); }
  }
  SP.refresh = route;

  function layout(active) {
    const s = SP.session, sub = SP.core.subState(s.tenant);
    const view = h('main', { class: 'view', id: 'view' });
    view.append = (...a) => SP.ui.append(view, a); // null/false/dizi güvenli
    const navLinks = NAV.map(([k, label, ic]) => h('a', { href: '#' + k, class: 'nav-link' + (k === active || (active === 'is-emri' && k === 'is-emirleri') || (active === 'musteri' && k === 'musteriler') || (active === 'fatura' && k === 'faturalar') ? ' active' : '') }, h('span', { class: 'ic' }, ic), label));
    if (s.isAdmin) navLinks.push(h('a', { href: '#yonetici', class: 'nav-link' + (active === 'yonetici' ? ' active' : '') }, h('span', { class: 'ic' }, '♛'), 'Platform yönetimi'));
    const side = h('aside', { class: 'side' },
      h('div', { class: 'brand' }, h('span', { class: 'logo' }, 'S'), h('div', null, h('b', null, SP.config.appName), h('small', null, s.tenant ? s.tenant.name : ''))),
      h('nav', { onclick: () => document.body.classList.remove('nav-open') }, navLinks),
      h('div', { class: 'side-foot' },
        h('a', { href: '#abonelik', class: 'sub-pill ' + sub.kind }, sub.label),
        h('div', { class: 'me' }, h('span', null, s.user.name || s.user.email), h('button', { class: 'link', onclick: logout }, 'Çıkış'))));
    const banner = !sub.active || sub.kind === 'warn' || sub.pastDue
      ? h('div', { class: 'banner ' + (sub.active ? 'warn' : 'err') },
          sub.active ? (sub.trial ? `Deneme sürenizin bitmesine ${sub.daysLeft} gün kaldı.` : sub.label) : 'Aboneliğiniz aktif değil — kayıtlarınızı görüntüleyebilirsiniz, yeni kayıt ekleyemezsiniz.',
          h('a', { href: '#abonelik', class: 'btn sm primary' }, 'Paket seç'))
      : null;
    const demo = SP.api.isDemo ? h('div', { class: 'banner demo' }, 'Demo modu — veriler yalnızca bu tarayıcıda saklanır.', h('button', { class: 'btn sm ghost', onclick: () => { SP.api.resetDemo(); SP.core.clearCache(); boot(); toast('Demo verileri sıfırlandı'); } }, 'Demoyu sıfırla')) : null;
    const top = h('header', { class: 'topbar' }, h('button', { class: 'icon-btn menu', 'aria-label': 'Menü', onclick: () => document.body.classList.toggle('nav-open') }, '☰'), h('b', null, s.tenant ? s.tenant.name : SP.config.appName));
    return { el: h('div', { class: 'shell' }, side, h('div', { class: 'main' }, top, demo, banner, view), h('div', { class: 'scrim', onclick: () => document.body.classList.remove('nav-open') })), view };
  }

  function noTenant() {
    return h('div', { class: 'auth-wrap' }, h('div', { class: 'auth-card' },
      h('h2', null, 'Hesabınız bir servise bağlı değil'),
      h('p', { class: 'muted' }, 'Servis sahibinden sizi tekrar davet etmesini isteyin ya da yeni bir servis hesabı açın.'),
      h('button', { class: 'btn primary', onclick: logout }, 'Çıkış yap')));
  }

  async function logout() { await SP.api.logout(); }

  async function onUser(user) {
    SP.core.clearCache();
    if (!user) { SP.session = null; route(); return; }
    try {
      const { profile, tenant } = await SP.api.loadSession(user);
      SP.session = { user: { ...user, name: user.name || (profile && profile.name) }, profile, tenant, isAdmin: SP.config.adminEmails.map((e) => e.toLowerCase()).includes((user.email || '').toLowerCase()) };
      SP.session.isOwner = profile && profile.role === 'owner';
    } catch (e) { console.error(e); toast('Oturum yüklenemedi: ' + e.message, 'err'); SP.session = null; }
    route();
  }

  async function boot() {
    const root = document.getElementById('root');
    root.replaceChildren(h('div', { class: 'loading' }, 'Yükleniyor…'));
    try { await SP.api.init(); }
    catch (e) { root.replaceChildren(h('div', { class: 'empty err' }, 'Başlatılamadı: ' + e.message)); return; }
    SP.api.onAuthChange(onUser);
  }

  window.addEventListener('hashchange', () => route());
  window.addEventListener('DOMContentLoaded', boot);
})();
