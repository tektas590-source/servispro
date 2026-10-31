/* Ayarlar, abonelik (iyzico) ve platform yönetici paneli */
(function () {
  const SP = window.SP;
  const { h, toast, money, date, table, badge, pageHead, formModal, modal, confirmBox } = SP.ui;

  /* ------------------------------ Ayarlar */
  SP.pages.ayarlar = async (view) => {
    const t = SP.session.tenant;
    const fields = [
      { name: 'name', label: 'Servis adı', required: true, span: 2 },
      { name: 'phone', label: 'Telefon', type: 'tel' }, { name: 'email', label: 'E-posta', type: 'email' },
      { name: 'address', label: 'Adres', type: 'textarea', span: 2, rows: 2 },
      { name: 'taxOffice', label: 'Vergi dairesi' }, { name: 'taxNo', label: 'Vergi / TC no' },
      { name: 'iban', label: 'IBAN (faturada görünür)', span: 2 },
      { name: 'invoiceNote', label: 'Fatura alt notu', type: 'textarea', span: 2, rows: 2, placeholder: 'Örn. Parçalarımız 1 yıl garantilidir.' },
    ];
    const form = h('form', { class: 'grid-form card', onsubmit: async (e) => {
      e.preventDefault();
      if (!SP.session.isOwner) return toast('Bu bilgileri yalnızca servis sahibi değiştirebilir.', 'err');
      try { await SP.api.updateTenant(SP.ui.readForm(form, fields)); toast('Servis bilgileri kaydedildi'); SP.refresh(); }
      catch (err) { toast(err.message, 'err'); }
    } }, fields.map((f) => SP.ui.field(f, t[f.name])), h('div', { class: 'span2 right' }, h('button', { class: 'btn primary', type: 'submit' }, 'Kaydet')));

    const team = h('div', { class: 'card' }, h('div', { class: 'loading' }, 'Yükleniyor…'));
    view.append(pageHead('Ayarlar', 'Servis bilgileri faturalarınızda görünür.'), h('h2', { class: 'sec' }, 'Servis bilgileri'), form,
      SP.logoCard ? SP.logoCard() : null, SP.reminderSettings ? SP.reminderSettings() : null,
      h('h2', { class: 'sec' }, 'Verileri içe aktar'),
      h('div', { class: 'card row between' }, h('span', { class: 'muted' }, 'Eski programınızdaki müşteri, araç ve stok listelerini Excel’den tek seferde aktarın.'),
        h('div', { class: 'row gap' }, h('a', { class: 'btn ghost', href: '#ice-aktar?tur=musteri' }, 'Müşteri & araç'), h('a', { class: 'btn ghost', href: '#ice-aktar?tur=stok' }, 'Stok kartları'))),
      h('h2', { class: 'sec' }, 'Ekip'), team);

    async function loadTeam() {
      const { users, invites } = await SP.api.members();
      const max = SP.core.limits().users;
      const used = users.length + invites.length;
      const inviteBtn = SP.session.isOwner ? h('button', { class: 'btn primary sm', onclick: () => {
        if (max != null && used >= max) return toast(SP.core.limitError('users', max).message, 'err');
        formModal('Kullanıcı davet et', [
          { name: 'email', label: 'E-posta', type: 'email', required: true, span: 2, hint: 'Bu kişi aynı e-posta ile kayıt olduğunda servisinize otomatik katılır.' },
          { name: 'role', label: 'Yetki', type: 'select', options: [['staff', 'Usta / personel'], ['owner', 'Yönetici (tam yetki)']] }],
        null, async (d) => { await SP.api.invite(d.email, d.role); toast('Davet oluşturuldu'); loadTeam(); });
      } }, '+ Kullanıcı davet et') : null;
      team.replaceChildren(
        h('div', { class: 'row between' }, h('span', { class: 'muted' }, `${used} / ${max == null ? 'sınırsız' : max} kullanıcı`), inviteBtn),
        table([...users.map((u) => ({ ...u, kind: 'user' })), ...invites.map((i) => ({ ...i, kind: 'invite' }))], [
          { label: 'Ad', get: (r) => r.name || '—' },
          { label: 'E-posta', get: (r) => r.email },
          { label: 'Yetki', get: (r) => (r.role === 'owner' ? 'Yönetici' : 'Personel') },
          { label: 'Durum', get: (r) => (r.kind === 'invite' ? badge('Davet bekliyor', 'warn') : badge('Aktif', 'ok')) },
          { label: '', class: 'right', get: (r) => (!SP.session.isOwner || r.uid === SP.session.user.uid) ? '' : h('button', { class: 'btn sm ghost', onclick: async () => {
            if (!(await confirmBox(`${r.email} servisinizden çıkarılsın mı?`, 'Çıkar'))) return;
            if (r.kind === 'invite') await SP.api.revokeInvite(r.email); else await SP.api.removeMember(r.uid);
            loadTeam();
          } }, 'Çıkar') },
        ]));
    }
    loadTeam().catch((e) => team.replaceChildren(h('div', { class: 'empty err' }, e.message)));
  };

  /* ------------------------------ Abonelik */
  SP.pages.abonelik = async (view, r) => {
    if (r.query.durum && SP.api.refreshTenant) {
      await SP.api.refreshTenant();
      toast(r.query.durum === 'ok' ? 'Ödeme alındı, aboneliğiniz aktif. Teşekkürler!' : 'Ödeme tamamlanamadı: ' + (r.query.mesaj || 'tekrar deneyin'), r.query.durum === 'ok' ? 'ok' : 'err');
      history.replaceState(null, '', '#abonelik');
    }
    const t = SP.session.tenant, s = SP.core.subState(t);
    const owner = SP.session.isOwner;
    const paid = t.status === 'active' || (t.status === 'past_due') || (t.status === 'canceled' && s.active);
    const statusCard = h('div', { class: 'card sub-status ' + s.kind },
      h('div', null, h('small', { class: 'muted' }, 'Mevcut durum'), h('h2', null, s.plan.name), h('p', null, s.label)),
      h('dl', { class: 'kv' },
        t.status === 'trial' ? [h('dt', null, 'Deneme bitişi'), h('dd', null, date(t.trialEndsAt))] : null,
        t.currentPeriodEnd ? [h('dt', null, t.status === 'canceled' ? 'Erişim bitişi' : 'Sonraki ödeme'), h('dd', null, date(t.currentPeriodEnd))] : null,
        h('dt', null, 'Aylık ücret'), h('dd', null, money(s.plan.price) + ' + KDV')),
      owner && t.status === 'active' && SP.config.paymentMode !== 'manual' ? h('button', { class: 'btn ghost sm', onclick: cancel }, 'Aboneliği iptal et') : null);

    const manual = SP.config.paymentMode === 'manual';
    const notice = t.paymentNotice;
    view.append(pageHead('Abonelik', manual ? 'Paketinizi seçin, aylık ücreti havale/EFT ile ödeyin.' : 'Paketinizi seçin, kartınızdan her ay otomatik ödensin.'), statusCard,
      !owner ? h('div', { class: 'banner info' }, 'Paket değişikliğini yalnızca servis sahibi yapabilir.') : null,
      notice ? h('div', { class: 'banner info' }, `Ödeme bildiriminiz alındı (${(SP.PLANS[notice.planId] || {}).name || ''}, ${SP.ui.dateTime(notice.at)}). Ödeme hesabımıza geçince aboneliğiniz aktif edilecek.`) : null,
      SP.pricingCards((p) => {
        if (!owner) return null;
        if (manual) {
          const same = t.status === 'active' && t.plan === p.id;
          return h('button', { class: 'btn block ' + (p.popular || same ? 'primary' : 'ghost'), onclick: () => payManual(p) }, same ? 'Süreyi uzat' : 'Havale ile öde');
        }
        if (t.status === 'active' && t.plan === p.id) return h('button', { class: 'btn block', disabled: true }, 'Mevcut paketiniz');
        if (t.status === 'active') return h('button', { class: 'btn block ' + (p.popular ? 'primary' : 'ghost'), onclick: () => change(p) }, 'Bu pakete geç');
        return h('button', { class: 'btn block ' + (p.popular ? 'primary' : 'ghost'), onclick: () => buy(p) }, paid ? 'Yeniden abone ol' : 'Bu paketi seç');
      }),
      h('p', { class: 'muted small center' }, manual
        ? 'Ödemeniz hesabımıza geçtiğinde aboneliğiniz 1 ay uzatılır. Süre bitmeden 5 gün önce uyarı görürsünüz.'
        : 'Ödemeler iyzico altyapısıyla alınır; kart bilgileriniz servis yazılımında saklanmaz. Faturanız her ay e-posta adresinize gönderilir.'));

    function payManual(p) {
      const b = SP.config.bank || {};
      const vat = SP.config.vatRate ?? 20;
      const total = Math.round(p.price * (1 + vat / 100) * 100) / 100;
      const ref = 'SP-' + String(t.id).slice(0, 6).toUpperCase();
      const row = (k, v, copy) => h('div', { class: 'pay-row' }, h('span', { class: 'muted' }, k), h('b', { class: copy ? 'mono' : null }, v),
        copy ? h('button', { class: 'btn sm ghost', onclick: () => { navigator.clipboard?.writeText(v).then(() => toast('Kopyalandı'), () => toast('Kopyalanamadı, elle seçin', 'err')); } }, 'Kopyala') : null);
      const body = h('div', { class: 'stack' },
        h('p', null, `${p.name} paketi için 1 aylık ücreti aşağıdaki hesaba gönderin. Açıklamaya mutlaka ödeme kodunu yazın.`),
        h('div', { class: 'card pay-box' },
          row('Tutar', `${money(total)} (KDV %${vat} dahil)`),
          b.iban ? [row('Alıcı', b.accountHolder || '—'), b.bankName ? row('Banka', b.bankName) : null, row('IBAN', b.iban, true)] : h('p', { class: 'muted' }, `IBAN bilgisi için bize ulaşın: ${SP.config.supportPhone} · ${SP.config.supportEmail}`),
          row('Açıklama (ödeme kodu)', `${ref} ${t.name}`.slice(0, 40), true)),
        h('p', { class: 'muted small' }, 'Ödemeyi yaptıktan sonra aşağıdaki butona basın; kontrol edip aboneliğinizi aynı gün aktif ederiz.'));
      const m = modal(`${p.name} — havale/EFT ile ödeme`, body, { actions: [
        h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Kapat'),
        h('button', { class: 'btn primary', onclick: async () => {
          try { await SP.api.notifyPayment({ planId: p.id, amount: total, ref }); m.close(); toast('Ödeme bildiriminiz alındı. Teşekkürler!'); SP.refresh(); }
          catch (e) { toast(e.message, 'err'); }
        } }, 'Ödemeyi yaptım'),
      ] });
    }

    async function change(p) {
      const cur = SP.PLANS[t.plan];
      if (!(await confirmBox(`${cur.name} → ${p.name} geçişi yapılsın mı? Yeni ücret (${money(p.price)} + KDV) bir sonraki ödemeden itibaren geçerli olur.`, 'Paketi değiştir'))) return;
      try { await SP.api.changePlan(p.id); toast('Paketiniz güncellendi'); if (SP.api.refreshTenant) await SP.api.refreshTenant(); SP.refresh(); }
      catch (e) { toast(e.message, 'err'); }
    }
    async function cancel() {
      if (!(await confirmBox('Aboneliğiniz iptal edilsin mi? Ödediğiniz dönem sonuna kadar kullanmaya devam edebilirsiniz.', 'İptal et'))) return;
      try { await SP.api.cancelSubscription(); toast('Aboneliğiniz iptal edildi'); if (SP.api.refreshTenant) await SP.api.refreshTenant(); SP.refresh(); }
      catch (e) { toast(e.message, 'err'); }
    }
    function buy(p) {
      const [first, ...rest] = (SP.session.user.name || '').split(' ');
      formModal(`${p.name} paketi — fatura bilgileri`, [
        { name: 'name', label: 'Ad', required: true }, { name: 'surname', label: 'Soyad', required: true },
        { name: 'identityNumber', label: 'TC kimlik no', required: true, hint: 'iyzico, kart sahibini doğrulamak için ister.' },
        { name: 'gsmNumber', label: 'Cep telefonu', type: 'tel', required: true, placeholder: '+905xxxxxxxxx' },
        { name: 'email', label: 'Fatura e-postası', type: 'email', required: true },
        { name: 'city', label: 'İl', required: true },
        { name: 'address', label: 'Fatura adresi', type: 'textarea', span: 2, required: true, rows: 2 },
      ], { name: first, surname: rest.join(' '), email: t.email || SP.session.user.email, gsmNumber: t.phone, address: t.address },
      async (buyer) => {
        const res = await SP.api.startCheckout(p.id, buyer);
        if (res.demoActivated) { toast(`Demo: ${p.name} paketi aktif edildi (gerçek ödeme alınmadı)`); SP.refresh(); return; }
        if (res.paymentPageUrl) { location.href = res.paymentPageUrl; return; }
        if (res.checkoutFormContent) showIyzicoForm(res.checkoutFormContent);
      }, { saveText: 'Ödemeye geç' });
    }
  };

  // iyzico'nun döndürdüğü script içeriğini sayfaya yerleştirir (innerHTML ile scriptler çalışmaz)
  function showIyzicoForm(content) {
    const holder = h('div', { id: 'iyzipay-checkout-form', class: 'responsive' });
    modal('Güvenli ödeme', holder, { wide: true });
    const tmp = document.createElement('div'); tmp.innerHTML = content;
    tmp.querySelectorAll('script').forEach((old) => {
      const s = document.createElement('script');
      [...old.attributes].forEach((a) => s.setAttribute(a.name, a.value));
      s.textContent = old.textContent;
      document.body.appendChild(s);
    });
  }

  /* ------------------------------ Platform yöneticisi (sizin müşterileriniz) */
  SP.pages.yonetici = async (view) => {
    if (!SP.session.isAdmin) { view.append(h('div', { class: 'empty err' }, 'Bu sayfa yalnızca platform yöneticisine açıktır.')); return; }
    const ts = (await SP.api.adminTenants()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const act = ts.filter((t) => t.status === 'active');
    const mrr = act.reduce((s, t) => s + ((SP.PLANS[t.plan] || {}).price || 0), 0);
    const trial = ts.filter((t) => SP.core.subState(t).trial);
    const notices = ts.filter((t) => t.paymentNotice);
    const activate = (t) => {
      const n = t.paymentNotice || {};
      formModal(`${t.name} — aboneliği aktif et`, [
        { name: 'planId', label: 'Paket', type: 'select', options: SP.PLAN_ORDER.map((k) => [k, `${SP.PLANS[k].name} (${money(SP.PLANS[k].price)} + KDV)`]) },
        { name: 'months', label: 'Kaç ay', type: 'number', min: 1, default: 1, required: true },
      ], { planId: n.planId || t.plan }, async (d) => {
        await SP.api.adminActivate(t.id, d.planId, Math.max(1, d.months || 1));
        toast(`${t.name} aktif edildi`); SP.refresh();
      }, { saveText: 'Aktif et' });
    };
    view.append(pageHead('Platform yönetimi', 'Yazılımı kullanan tüm servisler'),
      h('div', { class: 'kpis' },
        kpi('Toplam servis', ts.length), kpi('Ücretli abone', act.length), kpi('Denemede', trial.length), kpi('Aylık gelir (KDV hariç)', money(mrr))),
      notices.length ? [h('h2', { class: 'sec' }, `Bekleyen ödeme bildirimleri (${notices.length})`), table(notices, [
        { label: 'Servis', get: (t) => h('b', null, t.name) },
        { label: 'Paket', get: (t) => (SP.PLANS[t.paymentNotice.planId] || {}).name || '—' },
        { label: 'Tutar', class: 'right', get: (t) => money(t.paymentNotice.amount) },
        { label: 'Ödeme kodu', get: (t) => h('span', { class: 'mono' }, t.paymentNotice.ref || '—') },
        { label: 'Bildirim', get: (t) => SP.ui.dateTime(t.paymentNotice.at) },
        { label: '', class: 'right', get: (t) => h('button', { class: 'btn sm primary', onclick: () => activate(t) }, 'Ödemeyi onayla') },
      ])] : null,
      h('h2', { class: 'sec' }, 'Tüm servisler'),
      table(ts, [
        { label: 'Servis', get: (t) => h('div', null, h('b', null, t.name), h('div', { class: 'muted small' }, t.email || '')) },
        { label: 'Telefon', get: (t) => t.phone || '—' },
        { label: 'Paket', get: (t) => (SP.PLANS[t.plan] || {}).name || t.plan },
        { label: 'Durum', get: (t) => { const s = SP.core.subState(t); return badge(s.label, s.kind); } },
        { label: 'Bitiş', get: (t) => date(t.status === 'trial' ? t.trialEndsAt : t.currentPeriodEnd) },
        { label: 'Kayıt', get: (t) => date(t.createdAt) },
        { label: '', class: 'right', get: (t) => h('button', { class: 'btn sm ghost', onclick: () => activate(t) }, t.status === 'active' ? 'Süre uzat' : 'Aktif et') },
      ], { empty: 'Henüz kayıtlı servis yok' }));
  };
  function kpi(label, value, sub, kind) { return h('div', { class: 'kpi ' + (kind || '') }, h('small', null, label), h('b', null, value), sub ? h('span', { class: 'muted small' }, sub) : null); }
  SP.kpi = kpi;
})();
