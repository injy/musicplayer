/**
 * 音乐 API 代理 - EdgeOne Edge Function
 * 唯一职责：CORS 代理（网易 API 无 CORS 头，浏览器无法直接请求）
 * 
 * 不做任何数据转换/处理，全部交给前端
 * V8 运行时 CPU 限制 200ms（fetch 等待网络时不计入）
 */

var JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status) {
    if (status === undefined) status = 200;
    return new Response(JSON.stringify(data), {
        status: status,
        headers: JSON_HEADERS,
    });
}

function errorResponse(message, status) {
    if (status === undefined) status = 400;
    return jsonResponse({ error: message }, status);
}

// 代理请求网易 API，加 CORS 头返回
async function proxyRequest(apiUrl) {
    var response = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    var text = await response.text();
    return new Response(text, {
        status: response.status,
        headers: JSON_HEADERS,
    });
}

// 解析请求参数
function parseParams(request) {
    var url = new URL(request.url);
    var params = {};
    url.searchParams.forEach(function(value, key) {
        params[key] = value;
    });
    return params;
}

export default async function onRequest(context) {
    var request = context.request;
    var method = request.method;

    if (method === 'OPTIONS') {
        return new Response(null, { headers: JSON_HEADERS });
    }

    var params = parseParams(request);

    if (method === 'POST') {
        try {
            var body = await request.json();
            for (var key in body) {
                if (body.hasOwnProperty(key)) params[key] = body[key];
            }
        } catch (e) {}
    }

    var action = params.action || params.types || '';

    try {
        switch (action) {
            case 'url': {
                if (!params.id) return errorResponse('缺少 id 参数');
                var apiUrl = 'https://music.163.com/api/song/enhance/player/url?id=' + params.id +
                    '&ids=%5B' + params.id + '%5D&br=320000';
                return proxyRequest(apiUrl);
            }

            case 'pic': {
                if (!params.id) return errorResponse('缺少 id 参数');
                var apiUrl = 'https://music.163.com/api/song/detail/?id=' + params.id +
                    '&ids=%5B' + params.id + '%5D';
                return proxyRequest(apiUrl);
            }

            case 'lyric': {
                if (!params.id) return errorResponse('缺少 id 参数');
                var apiUrl = 'https://music.163.com/api/song/lyric?id=' + params.id + '&lv=1&kv=1&tv=-1';
                return proxyRequest(apiUrl);
            }

            case 'search': {
                var name = params.name || params.s;
                if (!name) return errorResponse('缺少搜索关键词');
                var source = params.source || 'netease';
                var limit = params.count || params.limit || '20';
                var page = params.pages || params.page || '1';
                var offset = (parseInt(page) - 1) * parseInt(limit);
                var apiUrl = 'https://music.163.com/api/search/get?s=' + encodeURIComponent(name) +
                    '&type=1&offset=' + offset + '&limit=' + limit;
                return proxyRequest(apiUrl);
            }

            case 'playlist': {
                if (!params.id) return errorResponse('缺少歌单 id');
                var apiUrl = 'https://music.163.com/api/v6/playlist/detail?id=' + params.id + '&n=100000';
                return proxyRequest(apiUrl);
            }

            case 'userlist': {
                if (!params.uid) return errorResponse('缺少 uid 参数');
                var apiUrl = 'https://music.163.com/api/user/playlist/?offset=0&limit=1001&uid=' + params.uid;
                return proxyRequest(apiUrl);
            }

            default:
                return jsonResponse({
                    name: 'Music API',
                    version: '5.0',
                    description: '网易云音乐 CORS 代理',
                    endpoints: ['url', 'pic', 'lyric', 'search', 'playlist', 'userlist'],
                });
        }
    } catch (error) {
        return errorResponse('服务器错误: ' + (error.message || 'Unknown error'), 500);
    }
}
