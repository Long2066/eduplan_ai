require('dotenv').config({ path: '.env.local' });

const GATEWAY_URL = 'https://753c-158-178-235-87.ngrok-free.app/v1/chat/completions';
const GATEWAY_KEY = '123456';

const TINY_RED_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';

async function testModel(label, model, withImage = false) {
  console.log(`\n--- TEST: ${label} (${model}) ---`);
  const messages = [{
    role: 'user',
    content: withImage
      ? [
          { type: 'text', text: 'Mô tả màu ảnh này.' },
          { type: 'image_url', image_url: { url: TINY_RED_PNG, detail: 'low' } },
        ]
      : 'Trả lời 1 từ: OK',
  }];
  const body = {
    model,
    messages,
    max_tokens: 50,
    stream: false,
    reasoning_effort: 'low',
  };
  try {
    const start = Date.now();
    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GATEWAY_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const elapsed = Date.now() - start;
    const text = await res.text();
    if (res.ok) {
      const data = JSON.parse(text);
      const content = data.choices?.[0]?.message?.content || '(no content)';
      console.log(`✅ HTTP ${res.status} - ${elapsed}ms - Reply: "${content.slice(0, 100)}"`);
    } else {
      const errData = JSON.parse(text);
      const msg = errData?.error?.message || text.slice(0, 200);
      const code = errData?.error?.code || '';
      const cooldownMatch = errData?.error?.last_upstream_error?.match(/reset after ([^"]+)/);
      const resetTime = cooldownMatch ? cooldownMatch[1] : '';
      console.log(`❌ HTTP ${res.status} [${code}] - ${elapsed}ms`);
      console.log(`   Error: ${msg.slice(0, 150)}`);
      if (resetTime) console.log(`   ⏰ Quota reset after: ${resetTime}`);
    }
  } catch (err) {
    console.log(`❌ FETCH ERROR: ${err.message}`);
  }
}

async function run() {
  console.log('====== KIỂM TRA TOÀN BỘ MODEL GATEWAY ======');
  console.log('Gateway:', GATEWAY_URL);

  // Gói Miễn phí (Free)
  console.log('\n=== FREE PLAN MODELS ===');
  await testModel('Free TEXT', 'gemini-3.5-flash-lite');
  await testModel('Free OCR (gemini-3.1-flash-image)', 'gemini-3.1-flash-image', true);

  // Gói Trả phí (Plus) - theo ảnh user vừa gửi
  console.log('\n=== PLUS PLAN MODELS ===');
  await testModel('Plus TEXT (gpt-5.6-terra)', 'gpt-5.6-terra');
  await testModel('Plus OCR (gpt-5.4-mini)', 'gpt-5.4-mini', true);

  // Thêm vài model khác để tìm model OCR thay thế
  console.log('\n=== ALTERNATIVE OCR MODELS ===');
  await testModel('gemini-3.8-flash-high (OCR alt)', 'gemini-3.8-flash-high', true);
  await testModel('gemini-3-flash (OCR alt)', 'gemini-3-flash', true);
}

run().catch(console.error);
