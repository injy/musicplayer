/**
 * 音乐 API 代理 - EdgeOne Edge Function
 * 替代原 api.php 的音乐搜索/播放/封面/歌词/歌单功能
 * 使用公共 Meting API 获取音乐数据
 * 
 * 注意：V8 运行时限制
 * - 不支持 Response.json()
 * - CPU 时间限制 200ms（fetch 等待网络时不计入）
 * - 不支持 Node.js 内置模块
 */

// Meting API 公共服务地址（多个备用）
const METING_APIS = [
    'https://api.injahow.cn/meting/',
    'https://meting.qjqq.cn/',
    'https://meting.api.0l0.fun/',
];

// CORS 和 JSON 响应头
const JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// 返回 JSON 响应（V8 不支持 Response.json()，必须用 JSON.stringify）
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: JSON_HEADERS,
    });
}

// 返回错误响应
function errorResponse(message, status = 400) {
    return jsonResponse({ error: message }, status);
}

// 尝试从多个 Meting API 获取数据（并行请求，取最快成功的）
async function fetchFromMeting(params) {
    const { type, id, source = 'netease', name, limit = 20, page = 1 } = params;

    // 并行请求所有 API，取第一个成功的
    const promises = METING_APIS.map(async (apiBase) => {
        try {
            const url = new URL(apiBase);
            url.searchParams.set('type', type);
            url.searchParams.set('id', id || '');
            url.searchParams.set('server', source);
            if (name) url.searchParams.set('name', name);
            if (type === 'search') {
                url.searchParams.set('limit', String(limit));
                url.searchParams.set('page', String(page));
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(url.toString(), {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const text = await response.text();
                try {
                    return JSON.parse(text);
                } catch {
                    return null;
                }
            }
            return null;
        } catch (e) {
            return null;
        }
    });

    // 串行等待：先等第一个，失败则等第二个，以此类推
    // 这样比 Promise.race 更可靠，避免竞态问题
    for (const promise of promises) {
        const result = await promise;
        if (result !== null) {
            return result;
        }
    }

    return null;
}

// 获取播放链接（增强版，含备用方案）
async function getUrl(id, source) {
    const result = await fetchFromMeting({ type: 'url', id, source });

    // 处理数组格式
    let urlData = null;
    if (Array.isArray(result) && result.length > 0) {
        urlData = result[0];
    } else if (result && typeof result === 'object' && !Array.isArray(result)) {
        urlData = result;
    }

    if (urlData && urlData.url && urlData.url.startsWith('http')) {
        return [urlData];
    }

    // 备用：网易云直链
    if (source === 'netease' && id) {
        return [{
            url: 'https://music.163.com/song/media/outer/url?id=' + id + '.mp3',
            size: 0,
            br: 128,
        }];
    }

    return [{ url: '', size: 0, br: 128, message: '无法获取播放链接' }];
}

// 获取封面
async function getPic(id, source) {
    const result = await fetchFromMeting({ type: 'pic', id, source });
    if (Array.isArray(result) && result.length > 0) {
        return result[0];
    }
    return result || { url: '' };
}

// 获取歌词
async function getLyric(id, source) {
    const result = await fetchFromMeting({ type: 'lyric', id, source });
    if (Array.isArray(result) && result.length > 0) {
        return result[0];
    }
    return result || { lyric: '' };
}

// 搜索
async function search(name, source, limit, page) {
    const result = await fetchFromMeting({ type: 'search', name, source, limit, page });
    return result || [];
}

// 获取歌单
async function getPlaylist(id, source) {
    const result = await fetchFromMeting({ type: 'playlist', id, source });
    return result;
}

// 获取用户歌单列表
async function getUserList(uid) {
    try {
        const url = 'https://music.163.com/api/user/playlist/?offset=0&limit=1001&uid=' + uid;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        // 忽略错误
    }
    return null;
}

// 将 HTTP 替换为 HTTPS
function httpToHttps(data) {
    const str = JSON.stringify(data);
    return JSON.parse(str.replace(/http:\/\//g, 'https://'));
}

export async function onRequest(context) {
    const { request } = context;
    const method = request.method;

    // 处理 CORS 预检请求
    if (method === 'OPTIONS') {
        return new Response(null, { headers: JSON_HEADERS });
    }

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);

    // 安全解析 POST body
    let body = {};
    if (method === 'POST') {
        try {
            body = await request.json();
        } catch (e) {
            body = {};
        }
    }

    // 合并 GET 和 POST 参数
    const allParams = { ...params, ...body };
    const action = allParams.action || allParams.types || '';

    try {
        switch (action) {
            case 'url': {
                const id = allParams.id;
                const source = allParams.source || 'netease';
                if (!id) return errorResponse('缺少 id 参数');
                const data = await getUrl(id, source);
                return jsonResponse(httpToHttps(data));
            }

            case 'pic': {
                const id = allParams.id;
                const source = allParams.source || 'netease';
                if (!id) return errorResponse('缺少 id 参数');
                const data = await getPic(id, source);
                return jsonResponse(httpToHttps(data));
            }

            case 'lyric': {
                const id = allParams.id;
                const source = allParams.source || 'netease';
                if (!id) return errorResponse('缺少 id 参数');
                const data = await getLyric(id, source);
                return jsonResponse(data);
            }

            case 'search': {
                const name = allParams.name || allParams.s;
                const source = allParams.source || 'netease';
                const limit = parseInt(allParams.count || allParams.limit || '20');
                const page = parseInt(allParams.pages || allParams.page || '1');
                if (!name) return errorResponse('缺少搜索关键词');
                const data = await search(name, source, limit, page);
                return jsonResponse(httpToHttps(data));
            }

            case 'playlist': {
                const id = allParams.id;
                const source = allParams.source || 'netease';
                if (!id) return errorResponse('缺少歌单 id');
                const data = await getPlaylist(id, source);
                return jsonResponse(httpToHttps(data));
            }

            case 'userlist': {
                const uid = allParams.uid;
                if (!uid) return errorResponse('缺少 uid 参数');
                const data = await getUserList(uid);
                if (!data) return errorResponse('获取用户歌单失败');
                return jsonResponse(httpToHttps(data));
            }

            default:
                return jsonResponse({
                    name: 'Music API',
                    version: '3.0',
                    description: 'EdgeOne Edge Function 音乐 API',
                    endpoints: ['url', 'pic', 'lyric', 'search', 'playlist', 'userlist'],
                });
        }
    } catch (error) {
        return errorResponse('服务器错误: ' + (error.message || 'Unknown error'), 500);
    }
}
