// Render'ın ücretsiz katmanı 15 dk istek gelmeyince API'yi uyutur; uyanması ~1 dk sürer.
// Bu Worker gündüz (TR 07:00-24:00) her 10 dakikada sağlık ucunu çağırır. Gece uyumasına izin verilir:
// Render'ın aylık 750 ücretsiz saati aşılmasın.
const TARGET = 'https://cap-api-cv8e.onrender.com/api/v1/health';

export default {
  async scheduled(_event, _env, ctx) {
    ctx.waitUntil(fetch(TARGET, { headers: { 'user-agent': 'cap-uyanik-tut' } }).then((r) => console.log('health', r.status)));
  },
};
