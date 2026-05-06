/**
 * 喜欢 API - EdgeOne Edge Function
 * 使用 KV Storage 存储用户喜欢歌单数据
 * 
 * KV 绑定说明：
 * 1. 在 EdgeOne Pages 控制台启用 KV Storage
 * 2. 创建命名空间（如 music_kv）
 * 3. 绑定到项目，变量名设为 music_kv
 * 
 * KV key 格式：fav:{userId}
 * KV value 格式：JSON 数组
 */

// CORS 和 JSON 响应头
const JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function errorResponse(message, status = 400) {
    return jsonResponse({ success: false, message }, status);
}

// 验证用户ID格式
function validateUserId(userId) {
    if (!userId || typeof userId !== 'string') return false;
    const trimmed = userId.trim();
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

// 获取 KV 实例
function getKV() {
    // music_kv 是在控制台绑定时设置的全局变量名
    // 参考：https://edgeone-pages-docs KV is a global variable, NOT on context.env
    if (typeof music_kv !== 'undefined') {
        return music_kv;
    }
    // 未绑定 KV 时的错误提示
    throw new Error('KV 未绑定，请在 EdgeOne 控制台绑定 music_kv 命名空间');
}

export async function onRequest(context) {
    const { request } = context;
    const method = request.method;

    // 处理 CORS 预检请求
    if (method === 'OPTIONS') {
        return new Response(null, { headers: JSON_HEADERS });
    }

    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);
    let body = {};
    if (method === 'POST') {
        try {
            body = await request.json();
        } catch (e) {
            body = {};
        }
    }

    // 合并参数（兼容 GET 和 POST）
    const action = body.action || queryParams.action || 'get';
    const userId = (body.user_id || queryParams.user_id || '').trim();

    // 验证用户ID
    if (!userId) {
        return errorResponse('用户ID不能为空');
    }
    if (!validateUserId(userId)) {
        return errorResponse('用户ID格式错误：只允许字母和数字，长度1-20个字符');
    }

    const kv = getKV();
    const kvKey = `fav_${userId}`;

    try {
        switch (action) {
            case 'get': {
                const data = await kv.get(kvKey, 'json');
                const favorites = Array.isArray(data) ? data : [];
                // 限制返回数量
                const result = favorites.slice(0, 10000);
                return jsonResponse({
                    success: true,
                    data: result,
                    count: result.length,
                });
            }

            case 'save': {
                let favorites = body.favorites;
                if (typeof favorites === 'string') {
                    try { favorites = JSON.parse(favorites); } catch { return errorResponse('喜欢歌单数据格式错误'); }
                }
                if (!Array.isArray(favorites)) return errorResponse('需要数组格式');
                if (favorites.length > 10000) return errorResponse('歌曲数量不能超过10000首');

                // 验证每首歌
                const validated = [];
                for (const song of favorites) {
                    const v = validateSong(song);
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
                let localFavorites = body.local_favorites;
                if (typeof localFavorites === 'string') {
                    try { localFavorites = JSON.parse(localFavorites); } catch { return errorResponse('本地数据格式错误'); }
                }
                if (!Array.isArray(localFavorites)) return errorResponse('需要数组格式');
                if (localFavorites.length > 10000) return errorResponse('歌曲数量不能超过10000首');

                // 验证本地数据
                const validLocal = [];
                for (const song of localFavorites) {
                    const v = validateSong(song);
                    if (v) validLocal.push(v);
                }

                // 获取云端数据
                const cloudData = await kv.get(kvKey, 'json');
                const cloudFavorites = Array.isArray(cloudData) ? cloudData : [];

                // 合并：以 id+source 为唯一键，取最新的 added_time
                const songMap = new Map();
                for (const song of cloudFavorites) {
                    const key = `${song.id}|${song.source}`;
                    songMap.set(key, song);
                }
                for (const song of validLocal) {
                    const key = `${song.id}|${song.source}`;
                    const existing = songMap.get(key);
                    if (!existing || (song.added_time && existing.added_time && song.added_time > existing.added_time)) {
                        songMap.set(key, song);
                    }
                }

                const merged = Array.from(songMap.values());
                // 按添加时间降序
                merged.sort((a, b) => (b.added_time || 0) - (a.added_time || 0));

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
