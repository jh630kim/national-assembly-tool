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
export function createHandler(store, org) {
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
