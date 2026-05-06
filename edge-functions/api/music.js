/**
 * 音乐 API 代理 - EdgeOne Edge Function
 * 直接调用网易云音乐 API，不再依赖 Meting 第三方服务
 * 
 * V8 运行时限制：
 * - 不支持 Response.json()
 * - 不支持 setTimeout / clearTimeout
 * - CPU 时间限制 200ms（fetch 等待网络时不计入）
 */

// 网易云音乐 API 基地址
var NETEASE_API = 'https://music.163.com/api';
var NETEASE_API_V6 = 'https://music.163.com/api/v6';

// CORS 和 JSON 响应头
var JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// 返回 JSON 响应
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

// 通用网易云 API 请求
async function neteaseRequest(apiUrl) {
    try {
        var response = await fetch(apiUrl, {
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
    if (data === null || data === undefined) return data;
    var str = JSON.stringify(data);
    return JSON.parse(str.replace(/http:\/\//g, 'https://'));
}

// ========== 搜索 ==========
// 前端期望：[{id, name, artist:[], album, source, url_id, pic_id, lyric_id}]
async function search(name, source, limit, page) {
    if (source !== 'netease') {
        return []; // 仅支持网易云
    }

    var offset = (page - 1) * limit;
    var url = NETEASE_API + '/search/get?s=' + encodeURIComponent(name) +
        '&type=1&offset=' + offset + '&limit=' + limit;

    var data = await neteaseRequest(url);
    if (!data || !data.result || !data.result.songs) {
        return [];
    }

    var songs = data.result.songs;
    var result = [];

    for (var i = 0; i < songs.length; i++) {
        var song = songs[i];
        var artists = [];
        if (song.artists) {
            for (var j = 0; j < song.artists.length; j++) {
                artists.push(song.artists[j].name);
            }
        } else if (song.ar) {
            for (var j = 0; j < song.ar.length; j++) {
                artists.push(song.ar[j].name);
            }
        }

        result.push({
            id: song.id,
            name: song.name,
            artist: artists,
            album: song.album ? song.album.name : (song.al ? song.al.name : ''),
            source: 'netease',
            url_id: song.id,
            pic_id: (song.album && song.album.pic_str) ? song.album.pic_str :
                     (song.album && song.album.id) ? song.album.id :
                     (song.al && song.al.pic_str) ? song.al.pic_str :
                     (song.al && song.al.id) ? song.al.id : song.id,
            lyric_id: song.id
        });
    }

    return result;
}

// ========== 获取播放链接 ==========
// 前端期望：[{url, size, br}]
async function getUrl(id, source) {
    if (source === 'netease') {
        var url = NETEASE_API + '/song/enhance/player/url?id=' + id + '&ids=%5B' + id + '%5D&br=320000';
        var data = await neteaseRequest(url);
        if (data && data.data && data.data.length > 0 && data.data[0].url) {
            return data.data;
        }
        // 备用：直链
        return [{
            url: 'https://music.163.com/song/media/outer/url?id=' + id + '.mp3',
            size: 0,
            br: 128
        }];
    }
    return [{ url: '', size: 0, br: 128 }];
}

// ========== 获取封面 ==========
// 前端期望：[{url}]
async function getPic(id, source) {
    if (source === 'netease') {
        // 通过歌曲详情获取封面
        var url = NETEASE_API + '/song/detail/?id=' + id + '&ids=%5B' + id + '%5D';
        var data = await neteaseRequest(url);
        if (data && data.songs && data.songs.length > 0) {
            var song = data.songs[0];
            var picUrl = '';
            if (song.al && song.al.picUrl) {
                picUrl = song.al.picUrl;
            } else if (song.album && song.album.picUrl) {
                picUrl = song.album.picUrl;
            } else if (song.album && song.album.blurPicUrl) {
                picUrl = song.album.blurPicUrl;
            }
            if (picUrl) {
                return [{ url: picUrl }];
            }
        }
        // 备用：用 ID 拼封面
        return [{ url: 'https://music.163.com/api/img/blur/' + id }];
    }
    return [{ url: '' }];
}

// ========== 获取歌词 ==========
// 前端期望：{lyric: "..."}
async function getLyric(id, source) {
    if (source === 'netease') {
        var url = NETEASE_API + '/song/lyric?id=' + id + '&lv=1&kv=1&tv=-1';
        var data = await neteaseRequest(url);
        if (data) {
            var lyricText = '';
            if (data.lrc && data.lrc.lyric) {
                lyricText = data.lrc.lyric;
            }
            return { lyric: lyricText };
        }
    }
    return { lyric: '' };
}

// ========== 获取歌单 ==========
// 前端期望：{playlist: {name, coverImgUrl, creator:{nickname, avatarUrl}, tracks:[{id, name, ar:[{name}], al:{name, picUrl}}]}}
async function getPlaylist(id) {
    // 获取歌单详情（含 tracks）
    var url = NETEASE_API_V6 + '/playlist/detail?id=' + id + '&n=100000';
    var data = await neteaseRequest(url);
    if (!data || !data.playlist) {
        // 降级到 v1 接口
        url = NETEASE_API + '/playlist/detail?id=' + id;
        data = await neteaseRequest(url);
    }
    if (!data || !data.playlist) {
        return null;
    }

    var pl = data.playlist;
    var tracks = [];

    if (pl.tracks) {
        for (var i = 0; i < pl.tracks.length; i++) {
            var song = pl.tracks[i];
            var arList = [];
            if (song.ar) {
                for (var j = 0; j < song.ar.length; j++) {
                    arList.push({ name: song.ar[j].name });
                }
            } else if (song.artists) {
                for (var j = 0; j < song.artists.length; j++) {
                    arList.push({ name: song.artists[j].name });
                }
            }

            tracks.push({
                id: song.id,
                name: song.name,
                ar: arList,
                al: {
                    name: song.al ? song.al.name : (song.album ? song.album.name : ''),
                    picUrl: song.al ? song.al.picUrl : (song.album ? song.album.picUrl : '')
                }
            });
        }
    }

    return {
        playlist: {
            name: pl.name || '未知歌单',
            coverImgUrl: pl.coverImgUrl || '',
            creator: {
                nickname: pl.creator ? pl.creator.nickname : '未知',
                avatarUrl: pl.creator ? pl.creator.avatarUrl : ''
            },
            tracks: tracks
        }
    };
}

// ========== 获取用户歌单列表 ==========
// 前端期望：{playlist: [{id, name, coverImgUrl, creator:{nickname, avatarUrl}}]}
async function getUserList(uid) {
    var url = NETEASE_API + '/user/playlist/?offset=0&limit=1001&uid=' + uid;
    var data = await neteaseRequest(url);
    if (!data || !data.playlist) {
        return null;
    }
    return data;
}

// ========== 主入口 ==========
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
                if (!id) return errorResponse('缺少歌单 id');
                var data = await getPlaylist(id);
                if (!data) return errorResponse('获取歌单失败');
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
                    version: '4.0',
                    description: '网易云音乐 API 代理 - EdgeOne Edge Function',
                    endpoints: ['url', 'pic', 'lyric', 'search', 'playlist', 'userlist'],
                });
        }
    } catch (error) {
        return errorResponse('服务器错误: ' + (error.message || 'Unknown error'), 500);
    }
}
