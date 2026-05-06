/**
 * 音乐 API 代理 - Cloud Function (Node.js)
 * 职责：CORS 代理（网易 API 无 CORS 头，浏览器无法直接请求）
 * 
 * 优势 vs Edge Function：
 * - 无 200ms CPU 限制（120s wall clock）
 * - 可用 npm 包
 * - 调试方便
 */

const NETEASE_BASE = 'https://music.163.com/api';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

// 代理请求网易 API
async function proxy(apiUrl) {
  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: CORS_HEADERS });
}

// 路由映射：action → 网易 API URL
function buildApiUrl(action, params) {
  switch (action) {
    case 'url': {
      if (!params.id) return null;
      return `${NETEASE_BASE}/song/enhance/player/url?id=${params.id}&ids=%5B${params.id}%5D&br=320000`;
    }
    case 'pic': {
      if (!params.id) return null;
      return `${NETEASE_BASE}/song/detail/?id=${params.id}&ids=%5B${params.id}%5D`;
    }
    case 'lyric': {
      if (!params.id) return null;
      return `${NETEASE_BASE}/song/lyric?id=${params.id}&lv=1&kv=1&tv=-1`;
    }
    case 'search': {
      const name = params.name || params.s;
      if (!name) return null;
      const limit = params.count || params.limit || '20';
      const page = params.pages || params.page || '1';
      const offset = (parseInt(page) - 1) * parseInt(limit);
      return `${NETEASE_BASE}/search/get?s=${encodeURIComponent(name)}&type=1&offset=${offset}&limit=${limit}`;
    }
    case 'playlist': {
      if (!params.id) return null;
      return `${NETEASE_BASE}/v6/playlist/detail?id=${params.id}&n=100000`;
    }
    case 'userlist': {
      if (!params.uid) return null;
      return `${NETEASE_BASE}/user/playlist/?offset=0&limit=1001&uid=${params.uid}`;
    }
    default:
      return null;
  }
}

export async function onRequest(context) {
  const request = context.request;

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // 解析参数
  const url = new URL(request.url);
  const params = {};
  url.searchParams.forEach((v, k) => { params[k] = v; });

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      Object.assign(params, body);
    } catch (e) {}
  }

  const action = params.action || params.types || '';

  if (!action) {
    return json({
      name: 'Music API',
      version: '6.0',
      description: '网易云音乐 CORS 代理 (Cloud Function)',
      endpoints: ['url', 'pic', 'lyric', 'search', 'playlist', 'userlist'],
    });
  }

  const apiUrl = buildApiUrl(action, params);
  if (!apiUrl) {
    const missing = (action === 'userlist') ? 'uid' : 'id';
    return error(`缺少 ${missing} 参数`);
  }

  try {
    return await proxy(apiUrl);
  } catch (err) {
    return error('服务器错误: ' + (err.message || 'Unknown error'), 500);
  }
}
