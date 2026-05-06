/**************************************************
 * MKOnlinePlayer v2.4
 * Ajax 后台数据交互请求模块
 * 编写：mengkun(https://mkblog.cn)
 * 时间：2018-3-11
 * 
 * 更新：2025-12-10 - 修复音乐URL和歌词获取问题
 *************************************************/

// ajax加载搜索结果
function ajaxSearch() {
    if(rem.wd === ""){
        layer.msg('搜索内容不能为空', {anim:6});
        return false;
    }
    
    if(rem.loadPage == 1) { // 弹出搜索提示
        var tmpLoading = layer.msg('搜索中', {icon: 16,shade: [0.75,'#000']});
    }
    
    $.ajax({
        type: mkPlayer.method, 
        url: mkPlayer.api, 
        data: "action=search&count=" + mkPlayer.loadcount + "&source=" + rem.source + "&pages=" + rem.loadPage + "&name=" + rem.wd,
        dataType: mkPlayer.dataType,
        complete: function(XMLHttpRequest, textStatus) {
            if(tmpLoading) layer.close(tmpLoading);    // 关闭加载中动画
        },  // complete
        success: function(jsonData){
            // 适配网易 API 原始格式：{result:{songs:[...]}}
            var songs = [];
            if(jsonData && jsonData.result && jsonData.result.songs) {
                songs = jsonData.result.songs;
            } else if(Array.isArray(jsonData)) {
                songs = jsonData; // 兼容旧格式
            }
            
            // 调试信息输出
            if(mkPlayer.debug) {
                console.debug("搜索结果数：" + songs.length);
            }
            
            if(rem.loadPage == 1)   // 加载第一页，清空列表
            {
                if(songs.length === 0)   // 返回结果为零
                {
                    layer.msg('没有找到相关歌曲', {anim:6});
                    return false;
                }
                musicList[0].item = [];
                rem.mainList.html('');   // 清空列表中原有的元素
                addListhead();      // 加载列表头
            } else {
                $("#list-foot").remove();     //已经是加载后面的页码了，删除之前的"加载更多"提示
            }
            
            if(songs.length === 0)
            {
                addListbar("nomore");  // 加载完了
                return false;
            }
            
            var tempItem = [], no = musicList[0].item.length;
            
            for (var i = 0; i < songs.length; i++) {
                no ++;
                var song = songs[i];
                // 适配网易云搜索结果格式
                var artistName = '';
                if(song.artist && Array.isArray(song.artist)) {
                    artistName = song.artist[0]; // 旧格式
                } else if(song.artists && song.artists.length > 0) {
                    artistName = song.artists[0].name; // 网易 API 格式
                } else if(song.ar && song.ar.length > 0) {
                    artistName = song.ar[0].name; // 歌单格式
                }
                var albumName = song.album || (song.al && song.al.name) || '';
                
                tempItem =  {
                    id: song.id,  // 音乐ID
                    name: song.name,  // 音乐名字
                    artist: artistName, // 艺术家名字
                    album: albumName,    // 专辑名字
                    source: song.source || "netease",     // 音乐来源
                    url_id: song.url_id || song.id,  // 链接ID
                    pic_id: song.pic_id || (song.album && song.album.pic_str) || (song.album && song.album.id) || (song.al && song.al.pic_str) || song.id,  // 封面ID
                    lyric_id: song.lyric_id || song.id,  // 歌词ID
                    pic: song.pic || (song.al && song.al.picUrl ? song.al.picUrl + "?param=300y300" : null),    // 专辑图片
                    url: null   // mp3链接
                };
                musicList[0].item.push(tempItem);   // 保存到搜索结果临时列表中
                addItem(no, tempItem.name, tempItem.artist);  // 在前端显示
            }
            
            rem.dislist = 0;    // 当前显示的是搜索列表
            rem.loadPage ++;    // 已加载的列数+1
            
            dataBox("list");    // 在主界面显示出播放列表
            refreshList();  // 刷新列表，添加正在播放样式
            
            if(no < mkPlayer.loadcount) {
                addListbar("nomore");  // 没加载满，说明已经加载完了
            } else {
                addListbar("more");     // 还可以点击加载更多
            }
            
            if(rem.loadPage == 2) listToTop();    // 播放列表滚动到顶部
        },   //success
        error: function(XMLHttpRequest, textStatus, errorThrown) {
            layer.msg('搜索结果获取失败 - ' + XMLHttpRequest.status);
            console.error(XMLHttpRequest + textStatus + errorThrown);
        }   // error
    });//ajax
}

// 完善获取音乐信息
// 音乐所在列表ID、音乐对应ID、回调函数
function ajaxUrl(music, callback)
{
    // 已经有数据，直接回调
    if(music.url !== null && music.url !== "err" && music.url !== "") {
        callback(music);
        return true;
    }
    // id为空，赋值链接错误。直接回调
    if(music.id === null) {
        music.url = "err";
        updateMinfo(music); // 更新音乐信息
        callback(music);
        return true;
    }
    
    $.ajax({ 
        type: mkPlayer.method, 
        url: mkPlayer.api,
        data: "action=url&id=" + music.id + "&source=" + music.source,
        dataType: mkPlayer.dataType,
        success: function(jsonData){
            // 适配网易 API 格式：{data:[{url}]}
            var urlData = null;
            if(jsonData && jsonData.data && Array.isArray(jsonData.data) && jsonData.data.length > 0) {
                urlData = jsonData.data[0]; // 网易 API 格式
            } else if(Array.isArray(jsonData) && jsonData.length > 0) {
                urlData = jsonData[0]; // 旧格式
            } else if(jsonData && jsonData.url) {
                urlData = jsonData; // 直接对象格式
            }
            
            if(!urlData || typeof urlData !== 'object') {
                console.warn('API返回数据格式异常:', jsonData);
                music.url = "err";
                updateMinfo(music);
                callback(music);
                return true;
            }
            
            // HTTP→HTTPS 替换（在客户端处理）
            if(typeof urlData.url === 'string') {
                urlData.url = urlData.url.replace(/http:\/\//g, 'https://');
            }
            
            // 调试信息输出
            if(mkPlayer.debug) {
                console.debug("歌曲链接：" + (urlData.url || 'undefined'));
            }
            
            // 解决网易云音乐部分歌曲无法播放问题
            if(music.source == "netease") {
                if(!urlData.url || urlData.url === "") {
                    urlData.url = "https://music.163.com/song/media/outer/url?id=" + music.id + ".mp3";
                } else {
                    if(typeof urlData.url === 'string') {
                        urlData.url = urlData.url.replace(/m7c.music./g, "m7.music.");
                        urlData.url = urlData.url.replace(/m8c.music./g, "m8.music.");
                    }
                }
            }
            
            if(!urlData.url || urlData.url === "") {
                music.url = "err";
            } else {
                music.url = urlData.url;    // 记录结果
            }
            
            updateMinfo(music); // 更新音乐信息
            
            callback(music);    // 回调函数
            return true;
        },   //success
        error: function(XMLHttpRequest, textStatus, errorThrown) {
            layer.msg('歌曲链接获取失败 - ' + XMLHttpRequest.status);
            console.error(XMLHttpRequest + textStatus + errorThrown);
        }   // error 
    }); //ajax
    
}

// 完善获取音乐封面图
// 包含音乐信息的数组、回调函数
function ajaxPic(music, callback)
{
    // 已经有数据，直接回调
    // 注意：要把 undefined 视为无图（某些流程可能未设置为 null）
    if(typeof music.pic !== 'undefined' && music.pic !== null && music.pic !== "err" && music.pic !== "") {
        callback(music);
        return true;
    }
    // 如果没有 pic_id，尝试使用 music.id 回退（多数 API 支持使用歌曲 id 获取封面）
    var picIdToUse = null;
    if(typeof music.pic_id !== 'undefined' && music.pic_id !== null && music.pic_id !== '') {
        picIdToUse = music.pic_id;
    } else if(typeof music.id !== 'undefined' && music.id !== null && music.id !== '') {
        picIdToUse = music.id; // 回退使用歌曲 id
    }

    if(!picIdToUse) {
        music.pic = "err";
        updateMinfo(music); // 更新音乐信息
        callback(music);
        return true;
    }
    
    $.ajax({ 
        type: mkPlayer.method, 
        url: mkPlayer.api,
        data: "action=pic&id=" + picIdToUse + "&source=" + music.source,
        dataType: mkPlayer.dataType,
        success: function(jsonData){
            // 适配网易 API 格式：{songs:[{al:{picUrl}}]}
            var picUrl = '';
            if(jsonData && jsonData.songs && jsonData.songs.length > 0) {
                // 网易 API /song/detail 格式
                var song = jsonData.songs[0];
                if(song.al && song.al.picUrl) {
                    picUrl = song.al.picUrl.replace(/http:\/\//g, 'https://');
                } else if(song.album && song.album.picUrl) {
                    picUrl = song.album.picUrl.replace(/http:\/\//g, 'https://');
                }
            } else if(Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0].url) {
                // 旧格式 [{url}]
                picUrl = jsonData[0].url.replace(/http:\/\//g, 'https://');
            } else if(jsonData && jsonData.url) {
                // 旧格式 {url}
                picUrl = jsonData.url.replace(/http:\/\//g, 'https://');
            }
            
            // 调试信息输出
            if(mkPlayer.debug) {
                console.log("歌曲封面：" + (picUrl || 'undefined'));
            }
            
            if(picUrl && picUrl !== "") {
                music.pic = picUrl;    // 记录结果
            } else {
                music.pic = "err";
            }
            
            updateMinfo(music); // 更新音乐信息
            // 如果未获取到图片，尝试使用 name+artist 搜索回退（仅尝试一次，防止循环）
            if(music.pic === 'err' && music.source === 'netease' && !music.__pic_search_tried && music.name && music.artist) {
                music.__pic_search_tried = true;
                $.ajax({
                    type: mkPlayer.method,
                    url: mkPlayer.api,
                    data: "action=search&count=1&source=" + music.source + "&pages=1&name=" + encodeURIComponent(music.name + ' ' + music.artist),
                    dataType: mkPlayer.dataType,
                    success: function(searchData) {
                        if(Array.isArray(searchData) && searchData.length > 0) {
                            var first = searchData[0];
                            if(first.pic_id) {
                                music.pic_id = first.pic_id;
                            } else if(first.al && first.al.pic_str) {
                                music.pic_id = first.al.pic_str;
                            }
                            if(first.pic) {
                                music.pic = first.pic;
                                updateMinfo(music);
                                callback(music);
                                return true;
                            }
                            // 若没有直接 pic 字段，但有 pic_id，则再次调用 ajaxPic 回去获取
                            if(music.pic_id) {
                                // 发起一次基于 pic_id 的请求
                                $.ajax({
                                    type: mkPlayer.method,
                                    url: mkPlayer.api,
                                    data: "action=pic&id=" + music.pic_id + "&source=" + music.source,
                                    dataType: mkPlayer.dataType,
                                    success: function(picRes) {
                                        if(Array.isArray(picRes) && picRes.length>0) picRes = picRes[0];
                                        if(picRes && picRes.url) {
                                            music.pic = picRes.url;
                                        } else {
                                            music.pic = 'err';
                                        }
                                        updateMinfo(music);
                                        callback(music);
                                    },
                                    error: function() {
                                        music.pic = 'err';
                                        updateMinfo(music);
                                        callback(music);
                                    }
                                });
                                return true;
                            }
                        }
                        // 搜索未命中或没有可用图片，回调原始结果
                        callback(music);
                    },
                    error: function() {
                        callback(music);
                    }
                });
                return true;
            }

            callback(music);    // 回调函数
            return true;
        },   //success
        error: function(XMLHttpRequest, textStatus, errorThrown) {
            layer.msg('歌曲封面获取失败 - ' + XMLHttpRequest.status);
            console.error(XMLHttpRequest + textStatus + errorThrown);
        }   // error 
    }); //ajax
    
}

// ajax加载用户歌单
// 参数：歌单网易云 id, 歌单存储 id，回调函数
function ajaxPlayList(lid, id, callback) {
    if(!lid) return false;
    
    // 已经在加载了，跳过
    if(musicList[id].isloading === true) {
        return true;
    }
    
    musicList[id].isloading = true; // 更新状态：列表加载中
    
    $.ajax({
        type: mkPlayer.method, 
        url: mkPlayer.api, 
        data: "action=playlist&id=" + lid,
        dataType: mkPlayer.dataType,
        complete: function(XMLHttpRequest, textStatus) {
            musicList[id].isloading = false;    // 列表已经加载完了
        },  // complete
        success: function(jsonData){
            if(!jsonData || !jsonData.playlist) {
                layer.msg('歌单数据格式异常', {anim:6});
                return false;
            }
            
            var pl = jsonData.playlist;
            // HTTP→HTTPS 替换（在客户端处理）
            var coverImgUrl = (pl.coverImgUrl || '').replace(/http:\/\//g, 'https://');
            var creatorNickname = pl.creator ? pl.creator.nickname : '未知';
            var creatorAvatarUrl = pl.creator ? (pl.creator.avatarUrl || '').replace(/http:\/\//g, 'https://') : '';
            
            // 存储歌单信息
            var tempList = {
                id: lid,    // 列表的网易云 id
                name: pl.name,   // 列表名字
                cover: coverImgUrl,   // 列表封面
                creatorName: creatorNickname,   // 列表创建者名字
                creatorAvatar: creatorAvatarUrl,   // 列表创建者头像
                item: []
            };
            
            if(coverImgUrl !== '') {
                tempList.cover = coverImgUrl + "?param=200y200";
            } else {
                tempList.cover = musicList[id].cover;
            }
            
            if(pl.tracks && pl.tracks.length > 0) {
                // 存储歌单中的音乐信息
                for (var i = 0; i < pl.tracks.length; i++) {
                    var track = pl.tracks[i];
                    var picUrl = (track.al && track.al.picUrl) ? track.al.picUrl.replace(/http:\/\//g, 'https://') : '';
                    tempList.item[i] =  {
                        id: track.id,  // 音乐ID
                        name: track.name,  // 音乐名字
                        artist: track.ar && track.ar[0] ? track.ar[0].name : '未知', // 艺术家名字
                        album: track.al ? track.al.name : '',    // 专辑名字
                        source: "netease",     // 音乐来源
                        url_id: track.id,  // 链接ID
                        pic_id: track.al && track.al.pic_str ? track.al.pic_str : track.id,  // 封面ID
                        lyric_id: track.id,  // 歌词ID
                        pic: picUrl ? picUrl + "?param=300y300" : null,    // 专辑图片
                        url: null   // mp3链接
                    };
                }
            }
            
            // 歌单用户 id 不能丢
            if(musicList[id].creatorID) {
                tempList.creatorID = musicList[id].creatorID;
                if(musicList[id].creatorID === rem.uid) {   // 是当前登录用户的歌单，要保存到缓存中
                    var tmpUlist = playerReaddata('ulist');    // 读取本地记录的用户歌单
                    if(tmpUlist) {  // 读取到了
                        for(i=0; i<tmpUlist.length; i++) {  // 匹配歌单
                            if(tmpUlist[i].id == lid) {
                                tmpUlist[i] = tempList; // 保存歌单中的歌曲
                                playerSavedata('ulist', tmpUlist);  // 保存
                                break;
                            }
                        }
                    }
                }
            }
            
            // 存储列表信息
            musicList[id] = tempList;
            
            // 首页显示默认列表
            if(id == mkPlayer.defaultlist) loadList(id);
            if(callback) callback(id);    // 调用回调函数
            
            // 改变前端列表
            $(".sheet-item[data-no='" + id + "'] .sheet-cover").attr('src', tempList.cover);    // 专辑封面
            $(".sheet-item[data-no='" + id + "'] .sheet-name").html(tempList.name);     // 专辑名字
            
            // 调试信息输出
            if(mkPlayer.debug) {
                console.debug("歌单 [" +tempList.name+ "] 中的音乐获取成功");
            }
        },   //success
        error: function(XMLHttpRequest, textStatus, errorThrown) {
            layer.msg('歌单读取失败 - ' + XMLHttpRequest.status);
            console.error(XMLHttpRequest + textStatus + errorThrown);
            $(".sheet-item[data-no='" + id + "'] .sheet-name").html('<span style="color: #EA8383">读取失败</span>');     // 专辑名字
        }   // error  
    });//ajax
}

// ajax加载歌词
// 参数：音乐ID，回调函数
function ajaxLyric(music, callback) {
    lyricTip('歌词加载中...');

    // 如果没有 lyric_id，尝试使用 music.id 回退（部分接口使用歌曲 id 即可获取歌词）
    if(!music.lyric_id) {
        if(typeof music.id !== 'undefined' && music.id !== null && music.id !== '') {
            music.lyric_id = music.id;
        } else {
            callback('', music.id || '');  // 没有歌词ID也没有歌曲ID，直接返回（传递歌曲 id 用于回调匹配）
            return;
        }
    }

    $.ajax({
        type: mkPlayer.method,
        url: mkPlayer.api,
        data: "action=lyric&id=" + music.lyric_id + "&source=" + music.source,
        dataType: mkPlayer.dataType,
        success: function(jsonData){
            // 适配网易 API 格式：{lrc:{lyric:""}}
            var lyricText = '';
            if(jsonData && jsonData.lrc && jsonData.lrc.lyric && typeof jsonData.lrc.lyric === 'string') {
                lyricText = jsonData.lrc.lyric; // 网易 API 格式
            } else if(jsonData && jsonData.lyric && typeof jsonData.lyric === 'string') {
                lyricText = jsonData.lyric; // 旧格式
            } else if(Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0].lyric) {
                lyricText = jsonData[0].lyric; // 旧数组格式
            }

            if(!lyricText) {
                console.warn('歌词API返回数据格式异常:', jsonData);
                callback('', music.id);
                return;
            }

            // 调试信息输出
            if (mkPlayer.debug) {
                console.debug("歌词获取成功");
            }

            callback(lyricText, music.id);    // 回调函数
        },   //success
        error: function(XMLHttpRequest, textStatus, errorThrown) {
            layer.msg('歌词读取失败 - ' + XMLHttpRequest.status);
            console.error(XMLHttpRequest + textStatus + errorThrown);
            callback('', music.id);    // 回调函数
        }   // error   
    });//ajax
}


// ajax加载用户的播放列表
// 参数 用户的网易云 id
function ajaxUserList(uid)
{
    var tmpLoading = layer.msg('加载中...', {icon: 16,shade: [0.75,'#000']});
    $.ajax({
        type: mkPlayer.method,
        url: mkPlayer.api,
        data: "action=userlist&uid=" + uid,
        dataType: mkPlayer.dataType,
        complete: function(XMLHttpRequest, textStatus) {
            if(tmpLoading) layer.close(tmpLoading);    // 关闭加载中动画
        },  // complete
        success: function(jsonData){
            if(jsonData.code == "-1" || jsonData.code == 400){
                layer.msg('用户 uid 输入有误', {anim:6});
                return false;
            }
            
            if(jsonData.playlist.length === 0 || typeof(jsonData.playlist.length) === "undefined")
            {
                layer.msg('没找到用户 ' + uid + ' 的歌单', {anim:6});
                return false;
            }else{
                var tempList,userList = [];
                $("#sheet-bar").remove();   // 移除登陆条
                rem.uid = uid;  // 记录已同步用户 uid
                rem.uname = jsonData.playlist[0].creator.nickname;  // 第一个列表(喜欢列表)的创建者即用户昵称
                layer.msg('欢迎您 '+rem.uname);
                // 记录登录用户
                playerSavedata('uid', rem.uid);
                playerSavedata('uname', rem.uname);
                
                for (var i = 0; i < jsonData.playlist.length; i++)
                {
                    var plItem = jsonData.playlist[i];
                    // HTTP→HTTPS 替换（在客户端处理）
                    var coverUrl = (plItem.coverImgUrl || '').replace(/http:\/\//g, 'https://');
                    var avatarUrl = plItem.creator ? (plItem.creator.avatarUrl || '').replace(/http:\/\//g, 'https://') : '';
                    var nickname = plItem.creator ? plItem.creator.nickname : '未知';
                    // 获取歌单信息
                    tempList = {
                        id: plItem.id,    // 列表的网易云 id
                        name: plItem.name,   // 列表名字
                        cover: coverUrl + "?param=200y200",   // 列表封面
                        creatorID: uid,   // 列表创建者id
                        creatorName: nickname,   // 列表创建者名字
                        creatorAvatar: avatarUrl,   // 列表创建者头像
                        item: []
                    };
                    // 存储并显示播放列表
                    addSheet(musicList.push(tempList) - 1, tempList.name, tempList.cover);
                    userList.push(tempList);
                }
                playerSavedata('ulist', userList);
                // 显示退出登录的提示条
                sheetBar();
            }
            // 调试信息输出
            if(mkPlayer.debug) {
                console.debug("用户歌单获取成功 [用户网易云ID：" + uid + "]");
            }
        },   //success
        error: function(XMLHttpRequest, textStatus, errorThrown) {
            layer.msg('歌单同步失败 - ' + XMLHttpRequest.status);
            console.error(XMLHttpRequest + textStatus + errorThrown);
        }   // error
    });//ajax
    return true;
}