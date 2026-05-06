/**
 * 喜欢 API - EdgeOne Edge Function
 * 使用 KV Storage 存储用户喜欢歌单数据
 * 
 * KV key 格式：fav_{userId}（仅允许字母数字下划线）
 * KV value 格式：JSON 数组
 */

// CORS 和 JSON 响应头
var JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
};

function jsonResponse(data, status) {
    if (status === undefined) status = 200;
    return new Response(JSON.stringify(data), { status: status, headers: JSON_HEADERS });
}

function errorResponse(message, status) {
    if (status === undefined) status = 400;
    return jsonResponse({ success: false, message: message }, status);
}

// 验证用户ID格式
function validateUserId(userId) {
    if (!userId || typeof userId !== 'string') return false;
    var trimmed = userId.trim();
    return /^[a-zA-Z0-9]{1,20}$/.test(trimmed);
}

// 验证歌曲数据
function validateSong(song) {
    if (!song || typeof song !== 'object') return null;
    if (!song.id || !song.name) return null;
    return {
        id: String(song.id).replace(/[^a-zA-Z0-9_]/g, '').substring(0, 100),
        name: String(song.name).substring(0, 255),
        artist: song.artist ? String(song.artist).substring(0, 255) : '',
        url: song.url ? String(song.url).substring(0, 500) : '',
        pic: song.pic ? String(song.pic).substring(0, 500) : '',
        url_id: song.url_id ? String(song.url_id).replace(/[^a-zA-Z0-9_\-]/g, '').substring(0, 200) : '',
        pic_id: song.pic_id ? String(song.pic_id).replace(/[^a-zA-Z0-9_\-]/g, '').substring(0, 200) : '',
        lyric_id: song.lyric_id ? String(song.lyric_id).replace(/[^a-zA-Z0-9_\-]/g, '').substring(0, 200) : '',
        source: song.source ? String(song.source).replace(/[^a-zA-Z0-9_]/g, '').substring(0, 50) : '',
        added_time: song.added_time ? Number(song.added_time) : Date.now(),
    };
}

export default async function onRequest(context) {
    var request = context.request;
    var method = request.method;

    // 处理 CORS 预检请求
    if (method === 'OPTIONS') {
        return new Response(null, { headers: JSON_HEADERS });
    }

    var url = new URL(request.url);
    var queryParams = Object.fromEntries(url.searchParams);
    var body = {};
    if (method === 'POST') {
        try {
            body = await request.json();
        } catch (e) {
            body = {};
        }
    }

    // 合并参数
    var action = body.action || queryParams.action || 'get';
    var userId = (body.user_id || queryParams.user_id || '').trim();

    // 验证用户ID
    if (!userId) {
        return errorResponse('用户ID不能为空');
    }
    if (!validateUserId(userId)) {
        return errorResponse('用户ID格式错误：只允许字母和数字，长度1-20个字符');
    }

    // 获取 KV 实例（music_kv 是控制台绑定时设置的全局变量名）
    var kv = music_kv;
    if (!kv) {
        return errorResponse('KV 未绑定，请在 EdgeOne 控制台绑定 music_kv 命名空间', 500);
    }

    var kvKey = 'fav_' + userId;

    try {
        switch (action) {
            case 'get': {
                var data = await kv.get(kvKey, 'json');
                var favorites = Array.isArray(data) ? data : [];
                var result = favorites.slice(0, 10000);
                return jsonResponse({
                    success: true,
                    data: result,
                    count: result.length,
                });
            }

            case 'save': {
                var favorites = body.favorites;
                if (typeof favorites === 'string') {
                    try { favorites = JSON.parse(favorites); } catch (e) { return errorResponse('喜欢歌单数据格式错误'); }
                }
                if (!Array.isArray(favorites)) return errorResponse('需要数组格式');
                if (favorites.length > 10000) return errorResponse('歌曲数量不能超过10000首');

                var validated = [];
                for (var i = 0; i < favorites.length; i++) {
                    var v = validateSong(favorites[i]);
                    if (v) validated.push(v);
                }

                await kv.put(kvKey, JSON.stringify(validated));
                return jsonResponse({
                    success: true,
                    message: '喜欢歌单保存成功',
                    count: validated.length,
                });
            }

            case 'incremental_sync': {
                var localFavorites = body.local_favorites;
                if (typeof localFavorites === 'string') {
                    try { localFavorites = JSON.parse(localFavorites); } catch (e) { return errorResponse('本地数据格式错误'); }
                }
                if (!Array.isArray(localFavorites)) return errorResponse('需要数组格式');
                if (localFavorites.length > 10000) return errorResponse('歌曲数量不能超过10000首');

                var validLocal = [];
                for (var i = 0; i < localFavorites.length; i++) {
                    var v = validateSong(localFavorites[i]);
                    if (v) validLocal.push(v);
                }

                // 获取云端数据
                var cloudData = await kv.get(kvKey, 'json');
                var cloudFavorites = Array.isArray(cloudData) ? cloudData : [];

                // 合并：以 id+source 为唯一键
                var songMap = new Map();
                for (var i = 0; i < cloudFavorites.length; i++) {
                    var song = cloudFavorites[i];
                    var songKey = song.id + '|' + song.source;
                    songMap.set(songKey, song);
                }
                for (var i = 0; i < validLocal.length; i++) {
                    var song = validLocal[i];
                    var songKey = song.id + '|' + song.source;
                    var existing = songMap.get(songKey);
                    if (!existing || (song.added_time && existing.added_time && song.added_time > existing.added_time)) {
                        songMap.set(songKey, song);
                    }
                }

                var merged = Array.from(songMap.values());
                merged.sort(function(a, b) { return (b.added_time || 0) - (a.added_time || 0); });

                await kv.put(kvKey, JSON.stringify(merged));

                return jsonResponse({
                    success: true,
                    message: '增量同步完成',
                    local_count: validLocal.length,
                    cloud_count: cloudFavorites.length,
                    merged_count: merged.length,
                    data: merged,
                });
            }

            default:
                return errorResponse('不支持的操作类型');
        }
    } catch (error) {
        return errorResponse('服务器错误: ' + error.message, 500);
    }
}
