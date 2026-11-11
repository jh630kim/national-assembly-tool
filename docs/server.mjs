// /api/app의 요청 처리. 저장소(store)를 주입받아, 시험에서는 가짜 저장소로 바꿔 쓴다.
// 이 파일은 api/ 밖에 두어 함수로 따로 배포되지 않는다. 함수 진입점은 api/app.mjs이다.
import flow from './flow.js';

const BLOB_PATHNAME = 'cases.json';

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

function emptyDb() {
  return { cases: [], log: [] };
}

// GET은 cases.json 전체를, POST는 flow.apply 결과를 저장한 뒤 돌려준다.
export function createHandler(store, org, options = {}) {
  return async function handle(request) {
    const method = request.method.toUpperCase();
    try {
      if (method === 'GET') return json((await store.read()) ?? emptyDb());
      if (method !== 'POST') return json({ error: 'GET 또는 POST만 지원합니다.' }, 405, { Allow: 'GET, POST' });
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: '요청 본문이 JSON 형식이 아닙니다.' }, 400);
      }
      if (body?.작업 === 'AI추천') {
        const content = typeof body.요구내용 === 'string' ? body.요구내용.trim() : '';
        if (!content || content.length > 2000) return json({ error: '요구내용은 1~2000자로 입력해야 합니다.' }, 400);
        const apiKey = options.apiKey !== undefined ? options.apiKey : process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return json({ error: '서버에 OPENAI_API_KEY가 없습니다. Vercel 환경변수를 설정하고 다시 배포하세요.' }, 500);
        }
        // 명백한 연락처·식별번호가 있으면 외부 API 호출 전에 차단한다.
        if (/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\b0\d{1,2}-?\d{3,4}-?\d{4}\b|\b\d{6}-?\d{7}\b/.test(content)) {
          return json({ error: '개인정보로 보이는 값이 있어 AI 추천을 사용할 수 없습니다.' }, 400);
        }
        try {
          const names = new Set(org.map((item) => item.과));
          const response = await (options.fetch || fetch)('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-4o-mini', temperature: 0, store: false,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: 'A부의 가상 국회 자료요구에 대해 소관 과 후보를 최대 3개 추천한다. '
                  + '반드시 제공된 조직도 과 목록에서만 고르고 각 근거를 한 문장으로 쓴다. '
                  + '적합한 과가 없으면 {"후보":[],"해당없음":true}로 답한다. '
                  + '답변은 {"후보":[{"과":"과 이름","근거":"한 문장"}],"해당없음":false} 형식의 JSON만 쓴다. 배분은 확정하지 않는다.' },
                { role: 'user', content: JSON.stringify({ 요구내용: content, 조직도: org }) },
              ],
            }),
          });
          if (!response.ok) throw new Error(`OpenAI ${response.status}`);
          const data = await response.json();
          const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
          const seen = new Set();
          const 후보 = (Array.isArray(parsed.후보) ? parsed.후보 : []).filter((entry) => {
            if (!entry || !names.has(entry.과) || seen.has(entry.과) || !String(entry.근거 || '').trim()) return false;
            seen.add(entry.과);
            return true;
          }).slice(0, 3).map((entry) => ({ 과: entry.과, 근거: String(entry.근거).trim().slice(0, 120) }));
          return json({ 후보, 해당없음: 후보.length === 0 });
        } catch {
          return json({ error: 'AI 추천을 완료하지 못했습니다. OpenAI 연결 상태를 확인하세요.' }, 502);
        }
      }
      const db = (await store.read()) ?? emptyDb();
      const result = flow.apply(db, body, org);
      // 오류 결과에서는 저장하지 않는다.
      if (result.code === 200) await store.write(db);
      return json(result.body, result.code);
    } catch (error) {
      console.error('저장소 오류', error);
      return json({ error: '저장소 처리 중 오류가 발생했습니다.' }, 500);
    }
  };
}

// Vercel Blob의 비공개 저장소에 cases.json 하나를 둔다.
// 인증은 SDK가 처리한다(Vercel에서는 OIDC, 그 밖에는 환경변수의 토큰). 코드에는 토큰을 쓰지 않는다.
export function blobStore(pathname = BLOB_PATHNAME) {
  return {
    async read() {
      const { get } = await import('@vercel/blob');
      // 방금 쓴 내용이 바로 읽히도록 캐시를 거치지 않는다.
      const result = await get(pathname, { access: 'private', useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return JSON.parse(await new Response(result.stream).text());
    },
    async write(db) {
      const { put } = await import('@vercel/blob');
      await put(pathname, JSON.stringify(db), {
        access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json',
      });
    },
  };
}
