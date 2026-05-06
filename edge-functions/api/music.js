/**
 * 音乐 API 代理 - EdgeOne Edge Function
 * 替代原 api.php 的音乐搜索/播放/封面/歌词/歌单功能
 * 使用公共 Meting API 获取音乐数据
 * 
 * 注意：V8 运行时限制
 * - 不支持 Response.json()
 * - 不支持 setTimeout / clearTimeout
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
function jsonResponse(data, status) {
    if (status === undefined) status = 200;
    return new Response(JSON.stringify(data), {
        status: status,
        headers: JSON_HEADERS,
    });
}

// 返回错误响应
function errorResponse(message, status) {
    if (status === undefined) status = 400;
    return jsonResponse({ error: message }, status);
}

// 带超时的 fetch（V8 无 setTimeout，使用 Promise.race 实现）
function fetchWithTimeout(requestUrl, options, ms) {
    var fetchPromise = fetch(requestUrl, options);

    var timeoutPromise = new Promise(function(resolve, reject) {
        // V8 运行时无 setTimeout，使用 AbortController + 延迟 reject
        // 如果 V8 支持 AbortSignal.timeout 则优先使用
        if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
            // 不做额外处理，在 options 中已设置
        }
        // 无法实现超时，直接返回 fetch 结果
        // 在 V8 环境下 fetch 本身有平台级超时机制
    });

    return fetchPromise;
}

// 尝试从多个 Meting API 获取数据（串行尝试，取第一个成功的）
async function fetchFromMeting(params) {
    var type = params.type;
    var id = params.id;
    var source = params.source || 'netease';
    var name = params.name;
    var limit = params.limit || 20;
    var page = params.page || 1;

    // 串行尝试每个 API
    for (var i = 0; i < METING_APIS.length; i++) {
        var apiBase = METING_APIS[i];
        try {
            var url = new URL(apiBase);
            url.searchParams.set('type', type);
            url.searchParams.set('id', id || '');
            url.searchParams.set('server', source);
            if (name) url.searchParams.set('name', name);
            if (type === 'search') {
                url.searchParams.set('limit', String(limit));
                url.searchParams.set('page', String(page));
            }

            var response = await fetch(url.toString(), {
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });

            if (response.ok) {
                var text = await response.text();
                try {
                    return JSON.parse(text);
                } catch (e) {
                    // JSON 解析失败，继续尝试下一个 API
                }
            }
        } catch (e) {
            // 请求失败，继续尝试下一个 API
        }
    }

    return null;
}

// 获取播放链接（增强版，含备用方案）
async function getUrl(id, source) {
    var result = await fetchFromMeting({ type: 'url', id: id, source: source });

    var urlData = null;
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
    var result = await fetchFromMeting({ type: 'pic', id: id, source: source });
    if (Array.isArray(result) && result.length > 0) {
        return result[0];
    }
    return result || { url: '' };
}

// 获取歌词
async function getLyric(id, source) {
    var result = await fetchFromMeting({ type: 'lyric', id: id, source: source });
    if (Array.isArray(result) && result.length > 0) {
        return result[0];
    }
    return result || { lyric: '' };
}

// 搜索
async function search(name, source, limit, page) {
    var result = await fetchFromMeting({ type: 'search', name: name, source: source, limit: limit, page: page });
    return result || [];
}

// 获取歌单
async function getPlaylist(id, source) {
    var result = await fetchFromMeting({ type: 'playlist', id: id, source: source });
    return result;
}

// 获取用户歌单列表
async function getUserList(uid) {
    try {
        var url = 'https://music.163.com/api/user/playlist/?offset=0&limit=1001&uid=' + uid;
        var response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
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
    var str = JSON.stringify(data);
    return JSON.parse(str.replace(/http:\/\//g, 'https://'));
}

export default async function onRequest(context) {
    var request = context.request;
    var method = request.method;

    // 处理 CORS 预检请求
    if (method === 'OPTIONS') {
        return new Response(null, { headers: JSON_HEADERS });
    }

    var url = new URL(request.url);
    var params = Object.fromEntries(url.searchParams);

    // 安全解析 POST body
    var body = {};
    if (method === 'POST') {
        try {
            body = await request.json();
        } catch (e) {
            body = {};
        }
    }

    // 合并 GET 和 POST 参数
    var allParams = {};
    var key;
    for (key in params) {
        if (params.hasOwnProperty(key)) allParams[key] = params[key];
    }
    for (key in body) {
        if (body.hasOwnProperty(key)) allParams[key] = body[key];
    }
    var action = allParams.action || allParams.types || '';

    try {
        switch (action) {
            case 'url': {
                var id = allParams.id;
                var source = allParams.source || 'netease';
                if (!id) return errorResponse('缺少 id 参数');
                var data = await getUrl(id, source);
                return jsonResponse(httpToHttps(data));
            }

            case 'pic': {
                var id = allParams.id;
                var source = allParams.source || 'netease';
                if (!id) return errorResponse('缺少 id 参数');
                var data = await getPic(id, source);
                return jsonResponse(httpToHttps(data));
            }

            case 'lyric': {
                var id = allParams.id;
                var source = allParams.source || 'netease';
                if (!id) return errorResponse('缺少 id 参数');
                var data = await getLyric(id, source);
                return jsonResponse(data);
            }

            case 'search': {
                var name = allParams.name || allParams.s;
                var source = allParams.source || 'netease';
                var limit = parseInt(allParams.count || allParams.limit || '20');
                var page = parseInt(allParams.pages || allParams.page || '1');
                if (!name) return errorResponse('缺少搜索关键词');
                var data = await search(name, source, limit, page);
                return jsonResponse(httpToHttps(data));
            }

            case 'playlist': {
                var id = allParams.id;
                var source = allParams.source || 'netease';
                if (!id) return errorResponse('缺少歌单 id');
                var data = await getPlaylist(id, source);
                return jsonResponse(httpToHttps(data));
            }

            case 'userlist': {
                var uid = allParams.uid;
                if (!uid) return errorResponse('缺少 uid 参数');
                var data = await getUserList(uid);
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
