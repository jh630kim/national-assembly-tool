// Vercel 함수 진입점: /api/app
import { createHandler, blobStore } from '../server.mjs';
import org from './org.json' with { type: 'json' };

export default { fetch: createHandler(blobStore(), org) };
