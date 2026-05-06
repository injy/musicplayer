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
            
            // 调试信息输出
            if(mkPlayer.debug) {
                console.debug("搜索结果数：" + jsonData.length);
            }
            
            if(rem.loadPage == 1)   // 加载第一页，清空列表
            {
                if(jsonData.length === 0)   // 返回结果为零
                {
                    layer.msg('没有找到相关歌曲', {anim:6});
                    return false;
                }
                musicList[0].item = [];
                rem.mainList.html('');   // 清空列表中原有的元素
                addListhead();      // 加载列表头
            } else {
                $("#list-foot").remove();     //已经是加载后面的页码了，删除之前的“加载更多”提示
            }
            
            if(jsonData.length === 0)
            {
                addListbar("nomore");  // 加载完了
                return false;
            }
            
            var tempItem = [], no = musicList[0].item.length;
            
            for (var i = 0; i < jsonData.length; i++) {
                no ++;
                tempItem =  {
                    id: jsonData[i].id,  // 音乐ID
                    name: jsonData[i].name,  // 音乐名字
                    artist: jsonData[i].artist[0], // 艺术家名字
                    album: jsonData[i].album,    // 专辑名字
                    source: jsonData[i].source,     // 音乐来源
                    url_id: jsonData[i].url_id,  // 链接ID
                    pic_id: jsonData[i].pic_id,  // 封面ID
                    lyric_id: jsonData[i].lyric_id,  // 歌词ID
                    pic: null,    // 专辑图片
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
            // 修复：处理API返回的数组格式
            if(Array.isArray(jsonData) && jsonData.length > 0) {
                jsonData = jsonData[0]; // 取第一个元素
            }
            
            // 修复：确保jsonData是有效对象
            if(!jsonData || typeof jsonData !== 'object') {
                console.warn('API返回数据格式异常:', jsonData);
                music.url = "err";
                updateMinfo(music);
                callback(music);
                return true;
            }
            
            // 调试信息输出
            if(mkPlayer.debug) {
                console.debug("歌曲链接：" + (jsonData.url || 'undefined'));
            }
            
            // 解决网易云音乐部分歌曲无法播放问题
            if(music.source == "netease") {
                if(!jsonData.url || jsonData.url === "") {
                    jsonData.url = "https://music.163.com/song/media/outer/url?id=" + music.id + ".mp3";
                } else {
                    // 确保url是字符串才能调用replace
                    if(typeof jsonData.url === 'string') {
                        jsonData.url = jsonData.url.replace(/m7c.music./g, "m7.music.");
                        jsonData.url = jsonData.url.replace(/m8c.music./g, "m8.music.");
                    }
                }
            } else if(music.source == "baidu" && typeof jsonData.url === 'string') {    // 解决百度音乐防盗链
                jsonData.url = jsonData.url.replace(/http:\/\/zhangmenshiting.qianqian.com/g, "https://gss0.bdstatic.com/y0s1hSulBw92lNKgpU_Z2jR7b2w6buu");
            }
            
            if(!jsonData.url || jsonData.url === "") {
                music.url = "err";
            } else {
                music.url = jsonData.url;    // 记录结果
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
            // 修复：处理API返回的数组格式
            if(Array.isArray(jsonData) && jsonData.length > 0) {
                jsonData = jsonData[0]; // 取第一个元素
            }
            
            // 修复：确保jsonData是有效对象
            if(!jsonData || typeof jsonData !== 'object') {
                console.warn('封面API返回数据格式异常:', jsonData);
                music.pic = "err";
                updateMinfo(music);
                callback(music);
                return true;
            }
            
            // 调试信息输出
            if(mkPlayer.debug) {
                console.log("歌曲封面：" + (jsonData.url || 'undefined'));
            }
            
            if(jsonData.url && jsonData.url !== "") {
                music.pic = jsonData.url;    // 记录结果
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
            // 存储歌单信息
            var tempList = {
                id: lid,    // 列表的网易云 id
                name: jsonData.playlist.name,   // 列表名字
                cover: jsonData.playlist.coverImgUrl,   // 列表封面
                creatorName: jsonData.playlist.creator.nickname,   // 列表创建者名字
                creatorAvatar: jsonData.playlist.creator.avatarUrl,   // 列表创建者头像
                item: []
            };
            
            if(jsonData.playlist.coverImgUrl !== '') {
                tempList.cover = jsonData.playlist.coverImgUrl + "?param=200y200";
            } else {
                tempList.cover = musicList[id].cover;
            }
            
            if(typeof jsonData.playlist.tracks !== undefined || jsonData.playlist.tracks.length !== 0) {
                // 存储歌单中的音乐信息
                for (var i = 0; i < jsonData.playlist.tracks.length; i++) {
                    tempList.item[i] =  {
                        id: jsonData.playlist.tracks[i].id,  // 音乐ID
                        name: jsonData.playlist.tracks[i].name,  // 音乐名字
                        artist: jsonData.playlist.tracks[i].ar[0].name, // 艺术家名字
                        album: jsonData.playlist.tracks[i].al.name,    // 专辑名字
                        source: "netease",     // 音乐来源
                        url_id: jsonData.playlist.tracks[i].id,  // 链接ID
                        pic_id: null,  // 封面ID
                        lyric_id: jsonData.playlist.tracks[i].id,  // 歌词ID
                        pic: jsonData.playlist.tracks[i].al.picUrl + "?param=300y300",    // 专辑图片
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
            // 处理可能的数组格式并检查数据有效性
            if(Array.isArray(jsonData) && jsonData.length > 0) {
                jsonData = jsonData[0]; // 取第一个元素
            }

            if(!jsonData || typeof jsonData !== 'object') {
                console.warn('歌词API返回数据格式异常:', jsonData);
                callback('', music.id);
                return;
            }

            // 调试信息输出
            if (mkPlayer.debug) {
                console.debug("歌词获取成功");
            }

                if (jsonData.lyric && typeof jsonData.lyric === 'string') {
                callback(jsonData.lyric, music.id);    // 回调函数
            } else {
                // 如果未获取到歌词，尝试使用 name+artist 搜索回退一次
                if (!music.__lyric_search_tried && music.name && music.artist) {
                    music.__lyric_search_tried = true;
                    $.ajax({
                        type: mkPlayer.method,
                        url: mkPlayer.api,
                        data: "action=search&count=1&source=" + music.source + "&pages=1&name=" + encodeURIComponent(music.name + ' ' + music.artist),
                        dataType: mkPlayer.dataType,
                        success: function(searchData) {
                            if (Array.isArray(searchData) && searchData.length > 0) {
                                var first = searchData[0];
                                if (first && first.id) {
                                    // 使用第一条结果的 id 作为 lyric_id 再次请求歌词
                                    music.lyric_id = first.id;
                                    $.ajax({
                                        type: mkPlayer.method,
                                        url: mkPlayer.api,
                                        data: "action=lyric&id=" + music.lyric_id + "&source=" + music.source,
                                        dataType: mkPlayer.dataType,
                                        success: function(retryLyric) {
                                            if (Array.isArray(retryLyric) && retryLyric.length > 0) retryLyric = retryLyric[0];
                                            if (retryLyric && retryLyric.lyric && typeof retryLyric.lyric === 'string') {
                                                callback(retryLyric.lyric, music.id);
                                            } else {
                                                callback('', music.id);
                                            }
                                        },
                                        error: function() {
                                            callback('', music.id);
                                        }
                                    });
                                    return;
                                }
                            }
                            callback('', music.id);
                        },
                        error: function() {
                            callback('', music.id);
                        }
                    });
                    return;
                }
                callback('', music.id);    // 回调函数
            }
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
                    // 获取歌单信息
                    tempList = {
                        id: jsonData.playlist[i].id,    // 列表的网易云 id
                        name: jsonData.playlist[i].name,   // 列表名字
                        cover: jsonData.playlist[i].coverImgUrl  + "?param=200y200",   // 列表封面
                        creatorID: uid,   // 列表创建者id
                        creatorName: jsonData.playlist[i].creator.nickname,   // 列表创建者名字
                        creatorAvatar: jsonData.playlist[i].creator.avatarUrl,   // 列表创建者头像
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