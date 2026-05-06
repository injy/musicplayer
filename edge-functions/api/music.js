/**
 * 音乐 API 代理 - EdgeOne Edge Function
 * 替代原 api.php 的音乐搜索/播放/封面/歌词/歌单功能
 * 使用公共 Meting API 获取音乐数据
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

// 返回 JSON 响应
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

// 尝试从多个 Meting API 获取数据
async function fetchFromMeting(params) {
    const { type, id, source = 'netease', name, limit = 20, page = 1 } = params;

    for (const apiBase of METING_APIS) {
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

            const response = await fetch(url.toString(), {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(10000),
            });

            if (response.ok) {
                const text = await response.text();
                try {
                    return JSON.parse(text);
                } catch {
                    // 非 JSON 响应，尝试下一个 API
                    continue;
                }
            }
        } catch (e) {
            // 当前 API 失败，尝试下一个
            continue;
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
            url: `https://music.163.com/song/media/outer/url?id=${id}.mp3`,
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
        const url = `https://music.163.com/api/user/playlist/?offset=0&limit=1001&uid=${uid}`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(10000),
        });
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        // 忽略错误
    }
    return null;
}

// 将 HTTP 替换为 HTTPS（原 api.php 中的 HTTPS 配置）
function httpToHttps(data) {
    const str = JSON.stringify(data);
    return JSON.parse(str.replace(/http:\/\//g, 'https://'));
}

export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

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
                    endpoints: ['url', 'pic', 'lyric', 'search', 'playlist', 'userlist', 'favorite'],
                });
        }
    } catch (error) {
        return errorResponse('服务器错误: ' + error.message, 500);
    }
}
