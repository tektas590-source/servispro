/* iyzico REST istemcisi (IYZWSv2 imzası) — harici paket gerektirmez.
 * Doküman: https://docs.iyzico.com  (Abonelik / Subscription API)
 */
const crypto = require('crypto');

function authHeaders(apiKey, secretKey, uriPath, body) {
  const randomKey = Date.now().toString() + crypto.randomBytes(4).toString('hex');
  const payload = randomKey + uriPath + (body || '');
  const signature = crypto.createHmac('sha256', secretKey).update(payload, 'utf8').digest('hex');
  const authString = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  return {
    Authorization: 'IYZWSv2 ' + Buffer.from(authString, 'utf8').toString('base64'),
    'x-iyzi-rnd': randomKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function client({ apiKey, secretKey, baseUrl }) {
  async function request(method, path, data) {
    const body = data ? JSON.stringify(data) : '';
    const uriPath = path.split('?')[0];
    const res = await fetch(baseUrl.replace(/\/$/, '') + path, { method, headers: authHeaders(apiKey, secretKey, uriPath, body), body: body || undefined });
    const json = await res.json().catch(() => ({}));
    if (json.status !== 'success') {
      const err = new Error(json.errorMessage || `iyzico hatası (${res.status})`);
      err.iyzico = json;
      throw err;
    }
    return json;
  }
  return {
    request,
    // Abonelik ödeme formunu başlatır → { token, checkoutFormContent, tokenExpireTime }
    initCheckout: (data) => request('POST', '/v2/subscription/checkoutform/initialize', data),
    // Ödeme formu sonucunu getirir → data.referenceCode (abonelik), data.subscriptionStatus ...
    checkoutResult: (token) => request('GET', `/v2/subscription/checkoutform/${encodeURIComponent(token)}`),
    getSubscription: (ref) => request('GET', `/v2/subscription/subscriptions/${encodeURIComponent(ref)}`),
    cancel: (ref) => request('POST', `/v2/subscription/subscriptions/${encodeURIComponent(ref)}/cancel`, {}),
    upgrade: (ref, newPricingPlanReferenceCode) => request('POST', `/v2/subscription/subscriptions/${encodeURIComponent(ref)}/upgrade`, {
      newPricingPlanReferenceCode, upgradePeriod: 'NOW', useTrial: false, resetRecurrenceCount: true,
    }),
  };
}

module.exports = { client, authHeaders };
