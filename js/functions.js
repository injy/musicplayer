/**************************************************
 * MKOnlinePlayer v2.4
 * 封装函数及UI交互模块
 * 编写：mengkun(https://mkblog.cn)
 * 时间：2018-3-11
 * 
 * 更新：2025-12-12 by 创意哥
 * 修复音乐URL和歌词获取问题，更新版本号防止缓存
 * 优化移动端体验：添加触摸手势、进度条拖拽、长按操作、触觉反馈
 * 修复移动端喜欢功能：优化菜单显示、图标样式和交互体验
 * 更新版本号为v2025121204防止缓存
 * 大幅优化代码冗余：删除重复代码块，从3374行减少到1865行，减少1509行重复代码（约45%）
 * 进一步优化：创建工具函数统一AJAX错误处理、数据验证、缓存破坏逻辑、云端数据处理和UI交互
 * 优化同步函数：消除重复的用户确认和加载提示逻辑，提高代码复用性
 *************************************************/

// ===============================================
// 通用工具函数
// ===============================================

// 触觉反馈工具函数
function triggerHapticFeedback(duration = 30) {
    if (navigator.vibrate) {
        navigator.vibrate(duration);
    }
}

// 移动端检测缓存
var isMobileCache = null;
function checkIsMobile() {
    if (isMobileCache === null) {
        isMobileCache = isMobile.any();
    }
    return isMobileCache;
}

// 音量默认值获取
function getDefaultVolume() {
    return rem.isMobile ? 1 : mkPlayer.volume;
}

// AJAX错误处理工具函数
function handleAjaxError(XMLHttpRequest, textStatus, errorThrown, customMessage) {
    const errorMsg = customMessage || '请求失败';
    layer.msg(errorMsg + ' - ' + XMLHttpRequest.status, {icon: 2, time: 3000});
    console.error(XMLHttpRequest + textStatus + errorThrown);
}

// 歌曲数据验证工具函数
function validateSongData(songs) {
    return songs.filter(song => {
        if (!song || !song.id || !song.source) {
            console.warn('跳过无效的歌曲数据:', song);
            return false;
        }
        return true;
    }).map(song => {
        if (!song.added_time) {
            song.added_time = Date.now();
        }
        return song;
    });
}

// 缓存破坏参数生成工具函数
function getCacheBuster() {
    return {
        timestamp: Date.now(),
        r: Math.random().toString(36).substring(7)
    };
}

// 获取和验证云端数据工具函数
function getValidatedCloudData(cloudFavorites) {
    if (!cloudFavorites) {
        return [];
    }
    
    return cloudFavorites.filter(song => {
        if (!song || !song.id || !song.source) {
            console.warn('跳过无效的云端歌曲数据:', song);
            return false; // 移除无效数据
        }
        return true;
    }).map(song => {
        // 确保 added_time 字段存在
        if (!song.added_time) {
            song.added_time = Date.now(); // 如果没有时间戳，使用当前时间
        }
        return song;
    });
}

// 创建加载提示工具函数
function createLoadingLoad() {
    return layer.load(1, {shade: [0.25, '#000']});
}

// 关闭加载提示并显示消息工具函数
function closeLoadingAndShow(loadingIndex, message, icon = 1, time = 3000) {
    layer.close(loadingIndex);
    if (message) {
        layer.msg(message, {icon: icon, time: time});
    }
}

// 显示同步确认对话框工具函数
function showSyncConfirm(message, onConfirm, title = '确认同步') {
    layer.confirm(
        message,
        {
            title: title,
            btn: ['确定', '取消']
        },
        function(index) {
            layer.close(index);
            onConfirm();
        },
        function(index) {
            layer.close(index);
        }
    );
}
// 判断是否是移动设备
var isMobile = {  
    Android: function() {  
        return navigator.userAgent.match(/Android/i) ? true : false;  
    },  
    BlackBerry: function() {  
        return navigator.userAgent.match(/BlackBerry/i) ? true : false;  
    },  
    iOS: function() {  
        return navigator.userAgent.match(/iPhone|iPad|iPod/i) ? true : false;  
    },  
    Windows: function() {  
        return navigator.userAgent.match(/IEMobile/i) ? true : false;  
    }, 
    Screen: function() {
        return document.documentElement.clientWidth < 900 ? true : false;
    }, 
    any: function() {
        return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Windows() || isMobile.Screen());  
    }
};

// 初始化layui（提供回退以防插件被移除）
var layer;
var form;
// 优先使用已经由 CDN 或其它脚本挂载到全局的 `layer`
if (typeof window.layer !== 'undefined' && window.layer) {
    layer = window.layer;
    // 如果同时有 layui 可用，尝试获取 form，否则保持空对象
    if (typeof layui !== 'undefined' && layui && typeof layui.use === 'function') {
        layui.use(['form'], function(){
            form = layui.form || {};
        });
    } else {
        form = window.form || {};
    }
} else if (typeof layui !== 'undefined' && layui && typeof layui.use === 'function') {
    // 使用 layui 模块加载 layer 与 form
    layui.use(['layer', 'form'], function(){
        layer = layui.layer;
        form = layui.form;
        if (mkPlayer.placard && layer) {
            try { layer.config({ shade: [0.25,'#000'], shadeClose: true }); } catch(e) {}
            window.onload = function () {
                try { layer.open({ btn: ['我知道了'], title: '公告', maxWidth: 320, content: $('#layer-placard-box').html() }); } catch(e) {}
            };
        }
    });
} else {
    // 简单回退实现，避免缺少 layui 导致脚本中断
    layer = {
        msg: function(text, opts) {
            if (console && console.log) console.log('[layer.msg] ' + text);
        },
        load: function() { return 0; },
        close: function() {},
        open: function(opt) {
            if (opt && opt.content) {
                var div = document.createElement('div');
                div.style.position = 'fixed';
                div.style.left = '50%';
                div.style.top = '20%';
                div.style.transform = 'translateX(-50%)';
                div.style.background = '#fff';
                div.style.padding = '12px';
                div.style.border = '1px solid #ccc';
                div.style.zIndex = 99999;
                div.innerHTML = opt.content;
                document.body.appendChild(div);
                setTimeout(function(){ try{ document.body.removeChild(div);}catch(e){} }, 4000);
            }
        },
        confirm: function(msg, opts, yes, no) {
            if (window.confirm(msg)) { if(typeof yes === 'function') yes(0); } else { if(typeof no === 'function') no(0); }
        }
    };
    form = {};
}

$(function(){
    if(mkPlayer.debug) {
        console.warn('播放器调试模式已开启，正常使用时请在 js/player.js 中按说明关闭调试模式');
    }
    
    rem.isMobile  = checkIsMobile();      // 判断是否是移动设备（使用缓存）
    rem.webTitle  = document.title;      // 记录页面原本的标题
    rem.errCount  = 0;                   // 连续播放失败的歌曲数归零
    rem.userAgent = navigator.userAgent; // 获取用户userAgent
    
    window.onresize = function () {
        if (navigator.userAgent !== rem.userAgent) {
            isMobileCache = null; // 清除缓存
            location.reload();
        }
    }

    initProgress();     // 初始化音量条、进度条（进度条初始化要在 Audio 前，别问我为什么……）
    initAudio();    // 初始化 audio 标签，事件绑定
    
    
    if(rem.isMobile) {  // 加了滚动条插件和没加滚动条插件所操作的对象是不一样的
        rem.sheetList = $("#sheet");
        rem.mainList = $("#main-list");
    } else {
        // 滚动条初始化(只在非移动端启用滚动条控件)
        $("#main-list,#sheet").mCustomScrollbar({
            theme:"minimal",
            advanced:{
                updateOnContentResize: true // 数据更新后自动刷新滚动条
            },
            callbacks:{
                onInit: function(){
                    // 优化滚动性能，使用passive事件监听器
                    var $this = $(this);
                    var content = $this.find('.mCSB_container');
                    content[0].addEventListener('wheel', function(e){
                        // 空的passive处理器，实际的滚动由插件处理
                    }, { passive: true });
                }
            }
        });
        
        rem.sheetList = $("#sheet .mCSB_container");
        rem.mainList = $("#main-list .mCSB_container");  
    }
    
    addListhead();  // 列表头
    addListbar("loading");  // 列表加载中
    
    // 顶部按钮点击处理 - 使用事件委托并防止重复绑定
    $(document).off("click.mainBtn").on("click.mainBtn", ".btn", function(e){
        e.preventDefault();
        switch($(this).data("action")) {
            case "player":    // 播放器
                dataBox("player");
            break;
            case "search":  // 搜索
                searchBox();
            break;
            
            case "playing": // 正在播放
                loadList(1); // 显示正在播放列表
            break;
            
            case "sheet":   // 播放列表
                dataBox("sheet");    // 在主界面显示出音乐专辑
            break;
        }
    });
    
    // 列表项双击播放（仅桌面端）
    if(!rem.isMobile) {
        $(".music-list").on("dblclick",".list-item", function() {
            var num = parseInt($(this).data("no"));
            if(isNaN(num)) return false;
            listClick(num);
        });
    }
    
    // 移动端列表项单击播放（优化触控体验）
    $(".music-list").on("click",".list-item", function(e) {
        if(rem.isMobile) {
            // 防止与移动菜单按钮冲突
            if($(e.target).hasClass('list-mobile-menu')) return;
            
            var num = parseInt($(this).data("no"));
            if(isNaN(num)) return false;
            
            // 移动端添加触觉反馈（如果支持）
            triggerHapticFeedback(50);
            
            listClick(num);
        }
    });
    
    // 添加移动端长按事件支持
    var touchTimer;
    $(".music-list").on("touchstart",".list-item", function(e) {
        if(rem.isMobile) {
            var $item = $(this);
            touchTimer = setTimeout(function() {
                // 长按显示歌曲信息
                var num = parseInt($item.data("no"));
                if(!isNaN(num)) {
                    musicInfo(rem.dislist, num);
                }
                // 添加触觉反馈
                triggerHapticFeedback(100);
            }, 800); // 800ms长按
        }
    });
    
    $(".music-list").on("touchend",".list-item", function() {
        if(rem.isMobile && touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
        }
    });
    
    // 小屏幕点击右侧小点查看歌曲详细信息
    $(".music-list").on("click",".list-mobile-menu", function() {
        var num = parseInt($(this).parent().data("no"));
        musicInfo(rem.dislist, num);
        return false;
    });
    
    // 列表鼠标移过显示对应的操作按钮（仅桌面端）
    if(!rem.isMobile) {
        $(".music-list").on("mousemove",".list-item", function() {
            var num = parseInt($(this).data("no"));
            if(isNaN(num)) return false;
            // 还没有追加菜单则加上菜单
            if(!$(this).data("loadmenu")) {
                var target = $(this).find(".music-name");
                var html = '<span class="music-name-cult">' + 
                target.html() + 
                '</span>' +
                '<div class="list-menu" data-no="' + num + '">' +
                    '<span class="list-icon icon-play" data-function="play" title="点击播放这首歌"></span>' +
                    '<span class="list-icon icon-download list-mobile-menu" title="点击下载这首歌"></span>' +
                    '<span class="list-icon icon-favorite" data-function="favorite" title="点击喜欢这首歌"></span>' +
                '</div>';
                target.html(html);
                $(this).data("loadmenu", true);
                
                // 检查并更新喜欢按钮状态
                if(rem.dislist !== undefined && musicList[rem.dislist] && musicList[rem.dislist].item[num]) {
                    const favoriteIcon = $(this).find('.icon-favorite');
                    updateFavoriteIcon(favoriteIcon, musicList[rem.dislist].item[num]);
                }
            }
        });
    }
    
    // 移动端：列表项加载时自动添加菜单
    if(rem.isMobile) {
        // 为已存在的列表项添加菜单
        $(".music-list .list-item").each(function() {
            const $item = $(this);
            const num = parseInt($item.data("no"));
            if(!isNaN(num) && !$item.data("loadmenu")) {
                const target = $item.find(".music-name");
                // 移动端只显示喜欢按钮
                const html = '<span class="music-name-cult">' + 
                target.html() + 
                '</span>' +
                '<div class="list-menu mobile-menu" data-no="' + num + '">' +
                    '<span class="list-icon icon-favorite" data-function="favorite" title="点击喜欢这首歌"></span>' +
                '</div>';
                target.html(html);
                $item.data("loadmenu", true);
                
                // 检查并更新喜欢按钮状态
                if(rem.dislist !== undefined && musicList[rem.dislist] && musicList[rem.dislist].item[num]) {
                    const favoriteIcon = $item.find('.icon-favorite');
                    updateFavoriteIcon(favoriteIcon, musicList[rem.dislist].item[num]);
                }
            }
        });
    }
    
    // 列表中的菜单点击
    $(".music-list").on("click",".icon-play,.icon-download,.icon-favorite", function() {
        var num = parseInt($(this).parent().data("no"));
        if(isNaN(num)) return false;
        switch($(this).data("function")) {
            case "play":    // 播放
                listClick(num);     // 调用列表点击处理函数
            break;
            case "favorite":   // 喜欢
                toggleFavorite(musicList[rem.dislist].item[num]);
                updateFavoriteIcon($(this), musicList[rem.dislist].item[num]);
            break;
        }
        return true;
    });
    
    // 点击加载更多
    $(".music-list").on("click",".list-loadmore", function() {
        $(".list-loadmore").removeClass('list-loadmore');
        $(".list-loadmore").html('加载中...');
        ajaxSearch();
    });
    
    // 点击专辑显示专辑歌曲
    $("#sheet").on("click",".sheet-cover,.sheet-name", function() {
        var num = parseInt($(this).parent().data("no"));
        // 是用户列表，但是还没有加载数据
        if(musicList[num].item.length === 0 && musicList[num].creatorID) {
            layer.msg('列表读取中...', {icon: 16,shade: [0.25,,'#000'],shadeClose: true,time: 500}); // 0代表加载的风格，支持0-2
            // ajax加载数据
            ajaxPlayList(musicList[num].id, num, loadList);
            return true;
        }
        loadList(num);
    });
    
    // 点击同步云音乐
    $("#sheet").on("click",".login-in", function() {
        layer.prompt(
        {
            title: '请输入您的网易云 UID',
            // value: '',  // 默认值
            btn: ['确定', '取消', '帮助'],
            shade: [0.25,,'#000'],
            shadeClose: true,
            btn3: function(index, layero){
                layer.open({
                    title: '如何获取您的网易云UID？'
                    ,shade: [0.25,,'#000'] //遮罩透明度
                    ,shadeClose: true
                    ,anim: 0 //0-6的动画形式，-1不开启
                    ,content: 
                    '1、首先<a href="http://music.163.com/" target="_blank">点我(http://music.163.com/)</a>打开网易云音乐官网<br>' +
                    '2、然后点击页面右上角的“登录”，登录您的账号<br>' + 
                    '3、点击您的头像，进入个人中心<br>' + 
                    '4、此时<span style="color:red">浏览器地址栏</span> <span style="color: green">/user/home?id=</span> 后面的<span style="color:red">数字</span>就是您的网易云 UID'
                });  
            }
        },
        function(val, index){   // 输入后的回调函数
            if(isNaN(val)) {
                layer.msg('uid 只能是数字',{anim: 6});
                return false;
            }
            layer.close(index);     // 关闭输入框
            ajaxUserList(val);
        });
    });
    
    // 刷新用户列表
    $("#sheet").on("click",".login-refresh", function() {
        playerSavedata('ulist', '');
        layer.msg('刷新歌单');
        clearUserlist();
    });
    
    // 退出登录
    $("#sheet").on("click",".login-out", function() {
        playerSavedata('uid', '');
        playerSavedata('ulist', '');
        layer.msg('已退出');
        clearUserlist();
    });
    
    // 同步喜欢歌单
    $("#sheet").on("click",".favorite-sync", function() {
        const userId = playerReaddata('user_id');
        if (!userId) {
            layer.msg('请先同步用户信息', {icon: 2});
            return;
        }
        
        layer.msg('正在同步喜欢歌单...', {icon: 16, time: 0});
        
        // 从云端获取最新的喜欢歌单
        syncFavoriteFromCloud().then(cloudFavorites => {
            layer.closeAll();
            
            const favoriteKey = 'favorite_' + userId;
            const localFavorites = playerReaddata(favoriteKey) || [];
            
            // 进行增量合并
            const mergedData = mergeFavoriteLists(localFavorites, cloudFavorites);
            
            // 询问用户如何处理
            let confirmMsg;
            if (cloudFavorites.length === 0) {
                confirmMsg = `云端暂无数据，是否将本地的${localFavorites.length}首喜欢的歌曲上传到云端？`;
            } else if (mergedData.added.length === 0 && mergedData.removed.length === 0) {
                layer.msg(`数据已同步，当前共有${mergedData.total}首喜欢的歌曲`, {icon: 1, time: 3000});
                return;
            } else {
                confirmMsg = `云端有${cloudFavorites.length}首，本地有${localFavorites.length}首。\n` +
                           `合并后将有${mergedData.total}首（新增${mergedData.added.length}首）。`;
            }
            
            layer.confirm(
                confirmMsg,
                {
                    title: '同步喜欢歌单',
                    btn: ['确定同步', '取消']
                },
                function(index) {
                    // 更新本地数据
                    playerSavedata(favoriteKey, mergedData.result);
                    if (musicList.length > 3) {
                        musicList[3].item = mergedData.result;
                        musicList[3].total = mergedData.result.length;
                    }
                    updateFavoriteSheet();
                    
                    // 上传到云端
                    syncFavoriteToCloud(mergedData.result);
                    
                    if (cloudFavorites.length === 0) {
                        // 云端无数据，上传本地数据
                        layer.msg(`已上传${mergedData.result.length}首喜欢的歌曲到云端`, {icon: 1, time: 3000});
                    } else {
                        // 云端有数据，上传合并后的数据
                        layer.msg(`同步成功！当前共有${mergedData.result.length}首喜欢的歌曲`, {icon: 1, time: 3000});
                    }
                    
                    layer.close(index);
                },
                function(index) {
                    layer.close(index);
                    layer.msg('已取消同步', {icon: 0, time: 2000});
                }
            );
            
        }).catch(error => {
            layer.closeAll();
            layer.msg('同步失败：' + error, {icon: 2, time: 3000});
        });
    });
    
    // 播放、暂停按钮的处理
    $("#music-info").click(function(){
        if(rem.playid === undefined) {
            layer.msg('请先播放歌曲');
            return false;
        }
        
        musicInfo(rem.playlist, rem.playid);
    });
    
    // 播放控制按钮 - 使用命名空间防止重复绑定
    $(document).off("click.playerBtn").on("click.playerBtn", ".btn-play", function(){
        pause();
    });
    
    $(document).off("click.orderBtn").on("click.orderBtn", ".btn-order", function(){
        orderChange();
    });
    
    $(document).off("click.prevBtn").on("click.prevBtn", ".btn-prev", function(){
        prevMusic();
    });
    
    $(document).off("click.nextBtn").on("click.nextBtn", ".btn-next", function(){
        nextMusic();
    });
    
    $(document).off("click.quietBtn").on("click.quietBtn", ".btn-quiet", function(){
        var oldVol;     // 之前的音量值
        if($(this).is('.btn-state-quiet')) {
            oldVol = $(this).data("volume");
            oldVol = oldVol? oldVol: getDefaultVolume();  // 没找到记录的音量，则重置为默认音量
            $(this).removeClass("btn-state-quiet");     // 取消静音
        } else {
            oldVol = volume_bar.percent;
            $(this).addClass("btn-state-quiet");        // 开启静音
            $(this).data("volume", oldVol); // 记录当前音量值
            oldVol = 0;
        }
        playerSavedata('volume', oldVol); // 存储音量信息
        volume_bar.goto(oldVol);    // 刷新音量显示
        if(rem.audio[0] !== undefined) rem.audio[0].volume = oldVol;  // 应用音量
    });
    
    if((mkPlayer.coverbg === true && !rem.isMobile) || (mkPlayer.mcoverbg === true && rem.isMobile)) { // 开启了封面背景
    
        if(rem.isMobile) {  // 移动端采用另一种模糊方案
            $('#blur-img').html('<div class="blured-img" id="mobile-blur"></div><div class="blur-mask mobile-mask"></div>');
        } else {
            // 背景图片初始化
            $('#blur-img').backgroundBlur({
                // imageURL : '', // URL to the image that will be used for blurring
                blurAmount : 50, // 模糊度
                imageClass : 'blured-img', // 背景区应用样式
                overlayClass : 'blur-mask', // 覆盖背景区class，可用于遮罩或额外的效果
                // duration: 0, // 图片淡出时间
                endOpacity : 1 // 图像最终的不透明度
            });
        }
        
        $('.blur-mask').fadeIn(1000);   // 遮罩层淡出
    }
    
    // 图片加载失败处理
    $('img').on('error', function(){
        $(this).attr('src', 'images/player_cover.png');
    });
    
    setInterval(function () {
        $('.audio-time').text(getAudioTime());
    }, 1000)
    // 初始化播放列表
    initList();
    
    // 调试信息：检查喜欢功能初始化状态
    if(mkPlayer.debug) {
        console.log('喜欢功能初始化检查:');
        console.log('用户ID:', getUserId());
        console.log('当前喜欢列表:', getFavoriteList());
        console.log('是否移动端:', rem.isMobile);
    }
    



});

// 播放时长处理函数
function getAudioTime () {
    var audio = $('audio')[0];
    var duration = audio.duration;
    var currentTime = audio.currentTime;
    if (duration && currentTime) {
        return (formatTime(currentTime) + '/' + formatTime(duration));
    } else {
        return '00:00/00:00';
    }
};

// 展现系统列表中任意首歌的歌曲信息
function musicInfo(list, index) {
    var music = musicList[list].item[index];
    var tempStr = '<span class="info-title">歌名：</span>' + music.name + 
    '<br><span class="info-title">歌手：</span>' + music.artist;
    
    if(list == rem.playlist && index == rem.playid) {   // 当前正在播放这首歌，那么还可以顺便获取一下时长。。
        tempStr += '<br><span class="info-title">时长：</span>' + formatTime(rem.audio[0].duration);
    }
    
    // 检查歌曲是否在喜欢列表中
    const favorites = getFavoriteList();
    const isFavorite = favorites.some(item => item.id === music.id && item.source === music.source);
    const favoriteText = isFavorite ? '取消喜欢' : '添加到喜欢';
    const favoriteClass = isFavorite ? 'info-btn-favorite-remove' : 'info-btn-favorite-add';
    
    tempStr += '<br><span class="info-title">操作：</span>' + 
    '<span class="info-btn ' + favoriteClass + '" onclick="toggleFavoriteFromInfo(this)" data-list="' + list + '" data-index="' + index + '">' + favoriteText + '</span>' +
    '<span style="margin-left: 10px" class="info-btn" onclick="thisDownload(this)" data-list="' + list + '" data-index="' + index + '">下载</span>' + 
    '<span style="margin-left: 10px" class="info-btn" onclick="thisDownloadLrc(this)" data-list="' + list + '" data-index="' + index + '">下载歌词</span>' + 
    '<span style="margin-left: 10px" class="info-btn" onclick="thisDownloadPic(this)" data-list="' + list + '" data-index="' + index + '">下载封面</span>' + 
    '<span style="margin-left: 10px" class="info-btn" onclick="thisShare(this)" data-list="' + list + '" data-index="' + index + '">外链</span>';
    
    layer.open({
        type: 0,
        shade: [0.25,,'#000'],
        shadeClose: true,
        title: false, //不显示标题
        btn: false,
        content: tempStr
    });
    
    if(mkPlayer.debug) {
        console.info('id: "' + music.id + '",\n' + 
        'name: "' + music.name + '",\n' +
        'artist: "' + music.artist + '",\n' +
        'album: "' + music.album + '",\n' +
        'source: "' + music.source + '",\n' +
        'url_id: "' + music.url_id + '",\n' + 
        'pic_id: "' + music.pic_id + '",\n' + 
        'lyric_id: "' + music.lyric_id + '",\n' + 
        'pic: "' + music.pic + '",\n' +
        'url: ""');
        // 'url: "' + music.url + '"');
    }
}

// 展现搜索弹窗
function searchBox() {
    layer.open({
        type: 1,
        title: false, // 不显示标题
        shade: [0.25,,'#000'],    // 遮罩颜色深度
        shadeClose: true,
        offset: 'auto',
        area: '360px',
        success: function(){
            // 恢复上一次的输入
            $("#search-wd").focus().val(rem.wd);
            $("#music-source input[name='source'][value='" + rem.source + "']").prop("checked", "checked");
            form.render();
        },
        content: $('#layer-form-box').html(),
        cancel: function(){}
    });
}



// 搜索提交
function searchSubmit() {
    var wd = $(".layui-layer #search-wd").val();
    if(!wd) {
        layer.msg('搜索内容不能为空', {anim:6, offset: 't'});
        $("#search-wd").focus();
        return false;
    }
    rem.source = $("#music-source input[name='source']:checked").val();
    
    layer.closeAll('page');     // 关闭搜索框
    
    rem.loadPage = 1;   // 已加载页数复位
    rem.wd = wd;    // 搜索词
    ajaxSearch();   // 加载搜索结果
    return false;
}

// 下载正在播放的这首歌
function thisDownload(obj) {
    ajaxUrl(musicList[$(obj).data("list")].item[$(obj).data("index")], download);
}



// 下载封面
function thisDownloadPic (obj) {
    var music = musicList[$(obj).data("list")].item[$(obj).data("index")];
    layer.closeAll();
    if (music.pic) {
        open(music.pic.split('?')[0].split('@')[0]);
    } else {
        $.ajax({ 
            type: mkPlayer.method, 
            url: mkPlayer.api,
            data: "action=pic&id=" + music.pic_id + "&source=" + music.source,
            dataType: mkPlayer.dataType,
            success: function(jsonData){
                // 适配网易 API 格式：{songs:[{al:{picUrl}}]}
                var picUrl = '';
                if(jsonData && jsonData.songs && jsonData.songs.length > 0) {
                    var song = jsonData.songs[0];
                    if(song.al && song.al.picUrl) picUrl = song.al.picUrl;
                    else if(song.album && song.album.picUrl) picUrl = song.album.picUrl;
                } else if(jsonData && jsonData.url) {
                    picUrl = jsonData.url;
                } else if(Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0].url) {
                    picUrl = jsonData[0].url;
                }
                picUrl = picUrl.replace(/http:\/\//g, 'https://');
                if(mkPlayer.debug) {
                    console.log("歌曲封面：" + picUrl);
                }
                if (picUrl) {
                    open(picUrl.split('?')[0].split('@')[0]);
                } else {
                    layer.msg('没有封面');
                }
            },
            error: function(XMLHttpRequest, textStatus, errorThrown) {
                handleAjaxError(XMLHttpRequest, textStatus, errorThrown, '歌曲封面获取失败');
            }
        });
    }
}

// 下载歌词
function thisDownloadLrc (obj) {
    var music = musicList[$(obj).data("list")].item[$(obj).data("index")];
    layer.closeAll();
    $.ajax({
        type: mkPlayer.method,
        url: mkPlayer.api,
        data: "action=lyric&id=" + music.lyric_id + "&source=" + music.source,
        dataType: mkPlayer.dataType,
        success: function(jsonData){
            // 调试信息输出
            if (mkPlayer.debug) {
                console.debug("歌词获取成功");
            }
            
            // 适配网易 API 格式：{lrc:{lyric:""}}
            var lyric = jsonData.lyric || (jsonData.lrc && jsonData.lrc.lyric) || '';
            if (mkPlayer.debug) {
                console.debug("歌词获取成功");
            }
            if (lyric) {
                var artist = music.artist ? ' - ' + music.artist : '';
                var filename = (music.name + artist + '.lrc').replace('/', '&');
                var element = document.createElement('a');
                element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(lyric));
                element.setAttribute('download', filename);
                element.style.display = 'none';
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
            } else {
                layer.msg('歌词获取失败');
            }
        },   //success
        error: function(XMLHttpRequest, textStatus, errorThrown) {
            handleAjaxError(XMLHttpRequest, textStatus, errorThrown, '歌词读取失败');
            // 此处没有传入 callback 参数，避免调用未定义的函数导致抛错
            // 如果需要回调处理，请改为在调用处提供回调函数
        }   // error   
    });//ajax
}

// 分享正在播放的这首歌
function thisShare(obj) {
    ajaxUrl(musicList[$(obj).data("list")].item[$(obj).data("index")], ajaxShare);
}

// 下载歌曲
// 参数：包含歌曲信息的数组
function download(music) {
    if(music.url == 'err' || music.url == "" || music.url == null) {
        layer.msg('这首歌不支持下载');
        return;
    }
    // 浏览器端直接下载，无需后端代理
    var artist = music.artist ? ' - ' + music.artist : '';
    var filename = (music.name + artist + '.mp3').replace(/[\/\\:*?"<>|]/g, '&');
    var element = document.createElement('a');
    element.setAttribute('href', music.url);
    element.setAttribute('download', filename);
    element.setAttribute('target', '_blank');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}



// 获取外链的ajax回调函数
// 参数：包含音乐信息的数组
function ajaxShare(music) {
    if(music.url == 'err' || music.url == "" || music.url == null) {
        layer.msg('这首歌不支持外链获取');
        return;
    }
    
    var tmpHtml = '<p>' + music.artist + ' - ' + music.name + ' 的外链地址为：</p>' + 
    '<input class="share-url" onmouseover="this.focus();this.select()" value="' + music.url + '">' + 
    '<p class="share-tips">* 获取到的音乐外链有效期较短，请按需使用。</p>';
    
    layer.open({
        title: '歌曲外链分享'
        ,shade: [0.25,,'#000']
        ,shadeClose: true
        ,content: tmpHtml
    });
}



// 改变右侧封面图像
// 新的图像地址
function changeCover(music) {
    var img = music.pic;    // 获取歌曲封面
    var animate = false,imgload = false;
    
    if(!img) {  // 封面为空
        ajaxPic(music, changeCover);    // 获取歌曲封面图
        img = "err";    // 暂时用无图像占个位...
    }
    
    if(img == "err") {
        img = "images/player_cover.png";
    } else {
            if(mkPlayer.mcoverbg === true && rem.isMobile)      // 移动端封面
        {    
            $("#music-cover").on('load', function(){
                $("#mobile-blur").css('background-image', 'url("' + img + '")');
            });
        } 
        else if(mkPlayer.coverbg === true && !rem.isMobile)     // PC端封面
        { 
            $("#music-cover").on('load', function(){
                if(animate) {   // 渐变动画也已完成
                    $("#blur-img").backgroundBlur(img);    // 替换图像并淡出
                    $("#blur-img").animate({opacity:"1"}, 2000); // 背景更换特效
                } else {
                    imgload = true;     // 告诉下面的函数，图片已准备好
                }
                
            });
            
            // 渐变动画
            $("#blur-img").animate({opacity: "0.2"}, 1000, function(){
                if(imgload) {   // 如果图片已经加载好了
                    $("#blur-img").backgroundBlur(img);    // 替换图像并淡出
                    $("#blur-img").animate({opacity:"1"}, 2000); // 背景更换特效
                } else {
                    animate = true;     // 等待图像加载完
                }
            });
        }
    }
    
    $("#music-cover").attr("src", img);     // 改变右侧封面
    $(".sheet-item[data-no='1'] .sheet-cover").attr('src', img);    // 改变正在播放列表的图像
}


// 向列表中载入某个播放列表
function loadList(list) {
    if(musicList[list].isloading === true) {
        layer.msg('列表读取中...', {icon: 16,shade: [0.25,,'#000'],time: 500});
        return true;
    }
    
    rem.dislist = list;     // 记录当前显示的列表
    
    dataBox("list");    // 在主界面显示出播放列表
    
    // 调试信息输出
    if(mkPlayer.debug) {
        if(musicList[list].id) {
            console.log('加载播放列表 ' + list + ' - ' + musicList[list].name + '\n' +
            'id: ' + musicList[list].id + ',\n' +
            'name: "' + musicList[list].name + '",\n' +
            'cover: "' + musicList[list].cover + '",\n' +
            'item: []');
        } else {
            console.log('加载播放列表 ' + list + ' - ' + musicList[list].name);
        }
    }
    
    rem.mainList.html('');   // 清空列表中原有的元素
    addListhead();      // 向列表中加入列表头
    
    if(musicList[list].item.length == 0) {
        if(list == 3) {    // 喜欢歌单即使为空也显示同步按钮
            addListbar("favorite_sync");    // 同步按钮
        } else {
            addListbar("nodata");   // 列表中没有数据
        }
    } else {
        
        // 逐项添加数据
        for(var i=0; i<musicList[list].item.length; i++) {
            var tmpMusic = musicList[list].item[i];
            
            addItem(i + 1, tmpMusic.name, tmpMusic.artist);
            
            // 音乐链接均有有效期限制,重新显示列表时清空处理
            if(list == 1 || list == 2) tmpMusic.url = "";
        }
        
        // 列表加载完成后的处理
        if(list == 1 || list == 2) {    // 历史记录和正在播放列表允许清空
            addListbar("clear");    // 清空列表
        } else if(list == 3) {    // 喜欢歌单添加同步按钮
            addListbar("favorite_sync");    // 同步按钮
        }
        
        if(rem.playlist === undefined) {    // 未曾播放过
            if(mkPlayer.autoplay == true) pause();  // 设置了自动播放，则自动播放
        } else {
            refreshList();  // 刷新列表，添加正在播放样式
        }
        
        listToTop();    // 播放列表滚动到顶部
    }
}

// 播放列表滚动到顶部
function listToTop() {
    if(rem.isMobile) {
        $("#main-list").animate({scrollTop: 0}, 200);
    } else {
        $("#main-list").mCustomScrollbar("scrollTo", 0, "top");
    }
}

// 向列表中加入列表头
function addListhead() {
    var html = '<div class="list-item list-head">' +
    '    <span class="auth-name">' +
    '        歌手' +
    '    </span>' +
    '    <span class="music-name">' +
    '        歌曲' +
    '    </span>' +
    '</div>';
    rem.mainList.append(html);

    // 如果当前显示的是“喜欢的歌”列表，则在顶部显示同步按钮（代替底部按钮）
    try {
        if (rem.dislist === 3) {
            const userId = playerReaddata('user_id');
            let topHtml = '';
            if (!userId) {
                topHtml = '<div class="list-item text-center" id="list-top">' +
                          '<div style="padding: 15px;">' +
                          '<div style="color: #666; margin-bottom: 15px;">使用喜欢功能需要设置用户ID</div>' +
                          '<button class="layui-btn layui-btn-sm layui-btn-normal" onclick="setupUserIdForFavorite()" style="margin: 5px;">设置用户ID</button>' +
                          '</div></div>';
            } else {
                topHtml = '<div class="list-item text-center" id="list-top">' +
                          '<div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">' +
                          '<button class="layui-btn layui-btn-sm layui-btn-normal" onclick="manualSyncFromCloud()" style="margin: 5px;">从云端同步</button>' +
                          '<button class="layui-btn layui-btn-sm layui-btn-warm" onclick="manualIncrementalSyncToCloud()" style="margin: 5px;">增量同步云端</button>' +
                          '<button class="layui-btn layui-btn-sm layui-btn-danger" onclick="manualFullSyncToCloud()" style="margin: 5px;">全量同步云端</button>' +
                          '</div></div>';
            }
            // 将顶部同步按钮插入到列表顶部，保证无论滚动容器如何包装都位于最前面
            rem.mainList.prepend(topHtml);
        }
    } catch (e) {
        // 保持容错性，任何异常不应阻塞列表渲染
        console.warn('添加顶部同步按钮失败', e);
    }
}

// 列表中新增一项
// 参数：编号、名字、歌手
function addItem(no, name, auth) {
    var html = '<div class="list-item" data-no="' + (no - 1) + '">' +
    '    <span class="list-num">' + no + '</span>' +
    '    <span class="list-mobile-menu"></span>' +
    '    <span class="auth-name">' + auth + '</span>' +
    '    <span class="music-name">' + name + '</span>' +
    '</div>'; 
    rem.mainList.append(html);
    
    // 为所有歌单添加菜单，移动端只显示喜欢按钮
    const itemElement = rem.mainList.find('.list-item[data-no="' + (no - 1) + '"]');
    const music = musicList[rem.dislist] && musicList[rem.dislist].item ? musicList[rem.dislist].item[no - 1] : null;
    
    if(music) {
        // 检查是否是移动端
        const isMobile = rem.isMobile;
        
        // 添加菜单图标 - 移动端只显示喜欢按钮
        const target = itemElement.find('.music-name');
        let menuHtml = '<span class="music-name-cult">' + name + '</span>' +
            '<div class="list-menu mobile-menu" data-no="' + (no - 1) + '">';
        
        if (isMobile) {
            // 移动端只显示喜欢按钮
            menuHtml += '<span class="list-icon icon-favorite" data-function="favorite" title="点击喜欢这首歌"></span>';
        } else {
            // 桌面端显示所有按钮
            menuHtml += '<span class="list-icon icon-play" data-function="play" title="点击播放这首歌"></span>' +
                '<span class="list-icon icon-download list-mobile-menu" title="点击下载这首歌"></span>' +
                '<span class="list-icon icon-favorite" data-function="favorite" title="点击喜欢这首歌"></span>';
        }
        
        menuHtml += '</div>';
        target.html(menuHtml);
        itemElement.data("loadmenu", true);
        
        // 更新喜欢图标状态
        const favoriteIcon = itemElement.find('.icon-favorite');
        updateFavoriteIcon(favoriteIcon, music);
    }
}

// 加载列表中的提示条
// 参数：类型（more、nomore、loading、nodata、clear）
function addListbar(types) {
    var html
    switch(types) {
        case "more":    // 还可以加载更多
            html = '<div class="list-item text-center list-loadmore list-clickable" title="点击加载更多数据" id="list-foot">点击加载更多...</div>';
        break;
        
        case "nomore":  // 数据加载完了
            html = '<div class="list-item text-center" id="list-foot">全都加载完了</div>';
        break;
        
        case "loading": // 加载中
            html = '<div class="list-item text-center" id="list-foot">播放列表加载中...</div>';
        break;
        
        case "nodata":  // 列表中没有内容
            html = '<div class="list-item text-center" id="list-foot">可能是个假列表，什么也没有</div>';
        break;
        
        case "clear":   // 清空列表
            html = '<div class="list-item text-center list-clickable" id="list-foot" onclick="clearDislist();">清空列表</div>';
        break;
        
        case "favorite_sync":   // 喜欢歌单同步按钮
            // 底部同步按钮已移至顶部（addListhead），此处不再在底部重复显示。
            html = '';
        break;
    }
    rem.mainList.append(html);
}

// 将时间格式化为 00:00 的格式
// 参数：原始时间
function formatTime(time){    
    var hour,minute,second;
    hour = String(parseInt(time/3600,10));
    if(hour.length == 1) hour='0' + hour;
    
    minute=String(parseInt((time%3600)/60,10));
    if(minute.length == 1) minute='0'+minute;
    
    second=String(parseInt(time%60,10));
    if(second.length == 1) second='0'+second;
    
    if(hour > 0) {
        return hour + ":" + minute + ":" + second;
    } else {
        return minute + ":" + second;
    }
}

// url编码
// 输入参数：待编码的字符串
function urlEncode(String) {
    return encodeURIComponent(String).replace(/'/g,"%27").replace(/"/g,"%22");  
}

// 在 ajax 获取了音乐的信息后再进行更新
// 参数：要进行更新的音乐
function updateMinfo(music) {
    // 不含有 id 的歌曲无法更新
    if(!music.id) return false;
    
    // 循环查找播放列表并更新信息
    for(var i=0; i<musicList.length; i++) {
        for(var j=0; j<musicList[i].item.length; j++) {
            // ID 对上了，那就更新信息
            if(musicList[i].item[j].id == music.id && musicList[i].item[j].source == music.source) {
                musicList[i].item[j] == music;  // 更新音乐信息
                j = musicList[i].item.length;   // 一个列表中只找一首，找到了就跳出
            }
        }
    }
}

// 刷新当前显示的列表，如果有正在播放则添加样式
function refreshList() {
    // 还没播放过，不用对比了
    if(rem.playlist === undefined) return true;
    
    $(".list-playing").removeClass("list-playing");        // 移除其它的正在播放
    
    if(rem.paused !== true) {   // 没有暂停
        for(var i=0; i<musicList[rem.dislist].item.length; i++) {
            // 与正在播放的歌曲 id 相同
            if((musicList[rem.dislist].item[i].id !== undefined) && 
              (musicList[rem.dislist].item[i].id == musicList[1].item[rem.playid].id) && 
              (musicList[rem.dislist].item[i].source == musicList[1].item[rem.playid].source)) {
                $(".list-item[data-no='" + i + "']").addClass("list-playing");  // 添加正在播放样式
                
                return true;    // 一般列表中只有一首，找到了赶紧跳出
            }
        }
    }
    
}
// 添加一个歌单
// 参数：编号、歌单名字、歌单封面
function addSheet(no, name, cover) {
    if(!cover) cover = "images/player_cover.png";
    if(!name) name = "读取中...";
    
    // 检查是否是"喜欢的歌"列表
    const userId = playerReaddata('user_id');
    let extraButton = '';
    let itemClass = '';
    
    if (no === 3) {
        if (!userId) {
            // 没有用户ID时显示设置按钮
            extraButton = '<div class="sheet-setup-btn" onclick="setupUserIdForFavorite()" title="设置用户ID">⚙️</div>';
        } else {
            // 有用户ID时添加特殊类用于隐藏设置按钮
            itemClass = 'has-user-id';
        }
    }
    
    var html = '<div class="sheet-item ' + itemClass + '" data-no="' + no + '" style="position: relative;">' +
    '    <img class="sheet-cover" src="' +cover+ '">' +
    '    <p class="sheet-name">' +name+ '</p>' +
    extraButton +
    '</div>'; 
    rem.sheetList.append(html);
}
// 清空歌单显示
function clearSheet() {
    rem.sheetList.html('');
}

// 歌单列表底部登陆条
function sheetBar() {
    var barHtml;
    if(playerReaddata('uid')) {
        barHtml = '已同步 ' + rem.uname + ' 的歌单 <span class="login-btn login-refresh">[刷新]</span> <span class="login-btn favorite-sync">[上传/下载喜欢歌单]</span> <span class="login-btn login-out">[退出]</span>';
    } else {
        barHtml = '我的歌单 <span class="login-btn login-in">[点击同步]</span>';
    }
    barHtml = '<span id="sheet-bar"><div class="clear-fix"></div>' +
    '<div id="user-login" class="sheet-title-bar">' + barHtml + 
    '</div></span>'; 
    rem.sheetList.append(barHtml);
}

// 选择要显示哪个数据区
// 参数：要显示的数据区（list、sheet、player）
function dataBox(choose) {
    $('.btn-box .active').removeClass('active');
    switch(choose) {
        case "list":    // 显示播放列表
            if($(".btn[data-action='player']").css('display') !== 'none') {
                $("#player").hide();
            } else if ($("#player").css('display') == 'none') {
                $("#player").fadeIn();
            }
            $("#main-list").fadeIn();
            $("#sheet").fadeOut();
            if(rem.dislist == 1 || rem.dislist == rem.playlist) {  // 正在播放
                $(".btn[data-action='playing']").addClass('active');
            } else if(rem.dislist == 0) {  // 搜索
                $(".btn[data-action='search']").addClass('active');
            }
        break;
        
        case "sheet":   // 显示专辑
            if($(".btn[data-action='player']").css('display') !== 'none') {
                $("#player").hide();
            } else if ($("#player").css('display') == 'none') {
                $("#player").fadeIn();
            }
            $("#sheet").fadeIn();
            $("#main-list").fadeOut();
            $(".btn[data-action='sheet']").addClass('active');
        break;
        
        case "player":  // 显示播放器
            $("#player").fadeIn();
            $("#sheet").fadeOut();
            $("#main-list").fadeOut();
            $(".btn[data-action='player']").addClass('active');
        break;
    }
}

// 将当前歌曲加入播放历史
// 参数：要添加的音乐
function addHis(music) {
    if(rem.playlist == 2) return true;  // 在播放“播放记录”列表则不作改变
    
    if(musicList[2].item.length > 300) musicList[2].item.length = 299; // 限定播放历史最多是 300 首
    
    if(music.id !== undefined && music.id !== '') {
        // 检查历史数据中是否有这首歌，如果有则提至前面
        for(var i=0; i<musicList[2].item.length; i++) {
            if(musicList[2].item[i].id == music.id && musicList[2].item[i].source == music.source) {
                musicList[2].item.splice(i, 1); // 先删除相同的
                i = musicList[2].item.length;   // 找到了，跳出循环
            }
        }
    }
    
    // 再放到第一位
    musicList[2].item.unshift(music);
    
    playerSavedata('his', musicList[2].item);  // 保存播放历史列表
}

// 验证用户ID格式（只允许字母和数字，长度大于1）
function validateUserId(userId) {
    if (!userId || typeof userId !== 'string') {
        return { valid: false, message: '用户ID不能为空' };
    }
    
    const trimmedId = userId.trim();
    if (trimmedId.length < 1 || trimmedId.length > 20) {
        return { valid: false, message: '用户ID长度必须在1-20个字符之间' };
    }
    
    // 只允许字母和数字
    if (!/^[a-zA-Z0-9]+$/.test(trimmedId)) {
        return { valid: false, message: '用户ID只能包含字母和数字' };
    }
    
    return { valid: true, userId: trimmedId };
}

// 获取用户ID，如果没有则生成一个默认ID
function getUserId() {
    let userId = playerReaddata('user_id');
    if (!userId) {
        // 生成一个基于时间戳的默认用户ID
        userId = 'user' + Date.now().toString(36);
        playerSavedata('user_id', userId);
    }
    return userId;
}

// 确认或设置用户ID（触发式）- 允许切换ID
function confirmUserIdForSync(callback) {
    let userId = playerReaddata('user_id');
    
    const showUserIdPrompt = function(defaultId = '') {
        layer.prompt({
            title: '请输入您的用户ID（用于跨设备同步）\n只支持字母和数字，长度1-20字符',
            formType: 0,
            value: defaultId,
            area: ['400px', '200px']
        }, function(value, index) {
            const validation = validateUserId(value);
            if (!validation.valid) {
                layer.msg(validation.message, {icon: 2});
                // 重新显示输入框
                setTimeout(() => showUserIdPrompt(value), 1000);
                return;
            }
            
            // 如果切换了ID，需要更新本地喜欢的歌单
            if (userId && validation.userId !== userId) {
                // 先备份当前用户的数据
                const oldFavoriteKey = 'favorite_' + userId;
                const oldFavorites = playerReaddata(oldFavoriteKey) || [];
                
                // 切换到新的用户ID
                playerSavedata('user_id', validation.userId);
                
                // 加载新用户的喜欢歌单
                const newFavoriteKey = 'favorite_' + validation.userId;
                const newFavorites = playerReaddata(newFavoriteKey) || [];
                
                // 更新音乐列表
                if (musicList.length > 3) {
                    musicList[3].item = newFavorites;
                    musicList[3].total = newFavorites.length;
                }
                
                updateFavoriteSheet();
                
                layer.close(index);
                layer.msg(`已切换到用户ID：${validation.userId}\n喜欢歌单已更新`, {icon: 1, time: 2000});
            } else {
                // 新用户或使用相同ID
                playerSavedata('user_id', validation.userId);
                layer.close(index);
                layer.msg('用户ID已设置：' + validation.userId, {icon: 1});
            }
            
            userId = validation.userId; // 更新本地userId变量
            if (callback) callback(validation.userId);
        });
    };
    
    if (userId) {
        // 如果已有ID，让用户确认或切换
        layer.confirm(
            `当前用户ID：${userId}\n可以选择使用此ID或切换到新ID`,
            {
                title: '确认用户ID',
                btn: ['使用此ID', '切换ID', '取消']
            },
            function(index) {
                layer.close(index);
                if (callback) callback(userId);
            },
            function(index) {
                layer.close(index);
                showUserIdPrompt(userId);
            },
            function(index) {
                layer.close(index);
                if (callback) callback(null);
            }
        );
    } else {
        // 如果没有ID，直接让用户设置
        showUserIdPrompt();
    }
}

// 获取用户的喜欢歌单
function getFavoriteList() {
    const userId = getUserId(); // 确保总是有用户ID
    if (!userId) {
        return []; // 如果没有用户ID，返回空数组
    }
    
    const favoriteKey = 'favorite_' + userId;
    let favorites = playerReaddata(favoriteKey);
    if (!favorites) {
        favorites = [];
        playerSavedata(favoriteKey, favorites);
    }
    
    // 确保每首歌曲都有必要的数据字段
    favorites = favorites.filter(song => {
        if (!song || !song.id || !song.source) {
            return false; // 移除无效数据
        }
        return true;
    }).map(song => {
        // 确保 added_time 字段存在
        if (!song.added_time) {
            song.added_time = Date.now(); // 如果没有时间戳，使用当前时间
        }
        return song;
    });
    
    return favorites;
}



// 合并本地和云端喜欢歌单，避免重复
function mergeFavoriteLists(localList, cloudList) {
    const result = [];
    const added = [];
    const removed = [];
    
    // 创建本地歌曲的标识集合，用于快速查找
    const localSongs = new Set();
    localList.forEach(song => {
        // 确保必要字段存在
        if (!song.id || !song.source) {
            console.warn('跳过无效的本地歌曲数据:', song);
            return; // 跳过无效数据
        }
        
        // 确保 added_time 字段存在
        if (!song.added_time) {
            song.added_time = Date.now(); // 如果没有时间戳，使用当前时间
        }
        
        const songKey = song.id + '_' + song.source;
        localSongs.add(songKey);
        result.push(song); // 先添加所有本地歌曲
    });
    
    // 检查云端歌曲，确保每首歌都有必要的数据字段
    cloudList.forEach(cloudSong => {
        // 确保必要字段存在，避免数据不一致导致的错误
        if (!cloudSong.id || !cloudSong.source) {
            console.warn('跳过无效的云端歌曲数据:', cloudSong);
            return; // 跳过无效数据
        }
        
        // 确保 added_time 字段存在
        if (!cloudSong.added_time) {
            cloudSong.added_time = Date.now(); // 如果没有时间戳，使用当前时间
        }
        
        const songKey = cloudSong.id + '_' + cloudSong.source;
        if (localSongs.has(songKey)) {
            // 本地和云端都有，比较添加时间，保留最新的
            const localSong = localList.find(s => s.id === cloudSong.id && s.source === cloudSong.source);
            // 确保找到了本地歌曲
            if (localSong) {
                // 确保本地歌曲也有 added_time 字段
                if (!localSong.added_time) {
                    localSong.added_time = 0; // 如果本地没有时间戳，设为0
                }
                
                if (cloudSong.added_time > localSong.added_time) {
                    // 云端的更新，替换本地的
                    const index = result.findIndex(s => s.id === cloudSong.id && s.source === cloudSong.source);
                    if (index > -1) {
                        result[index] = cloudSong;
                    }
                }
            }
        } else {
            // 云端有，本地没有，添加到结果
            result.push(cloudSong);
            added.push(cloudSong);
        }
    });
    
    // 检查本地有但云端没有的歌曲
    localList.forEach(localSong => {
        // 确保必要字段存在
        if (!localSong.id || !localSong.source) {
            return; // 跳过无效数据
        }
        
        // 确保 added_time 字段存在
        if (!localSong.added_time) {
            localSong.added_time = Date.now(); // 如果没有时间戳，使用当前时间
        }
        
        const songKey = localSong.id + '_' + localSong.source;
        const existsInCloud = cloudList.some(s => s.id === localSong.id && s.source === localSong.source);
        if (!existsInCloud) {
            removed.push(localSong);
        }
    });
    
    // 按添加时间排序，最新的在前面
    result.sort((a, b) => {
        const timeA = a.added_time || 0;
        const timeB = b.added_time || 0;
        return timeB - timeA; // 降序排列，最新的在前面
    });
    
    return {
        result: result,
        added: added,
        removed: removed,
        total: result.length
    };
}

// 保存用户的喜欢歌单（仅保存到本地，不再自动同步）
function saveFavoriteList(favorites) {
    const userId = playerReaddata('user_id');
    if (!userId) {
        return; // 如果没有用户ID，不保存
    }
    const favoriteKey = 'favorite_' + userId;
    playerSavedata(favoriteKey, favorites);
}

// 切换歌曲的喜欢状态
function toggleFavorite(music) {
    // 检查是否有用户ID，如果没有则提示设置
    const userId = playerReaddata('user_id');
    if (!userId) {
        // 提示用户设置用户ID才能使用喜欢功能
        layer.confirm(
            '使用喜欢功能需要设置用户ID用于跨设备同步。\n是否现在设置用户ID？',
            {
                title: '需要用户ID',
                btn: ['设置用户ID', '取消'],
                icon: 0
            },
            function(index) {
                layer.close(index);
                // 调用用户ID设置函数
                confirmUserIdForSync(function(newUserId) {
                    if (newUserId) {
                        // 用户设置了ID后，重新执行喜欢操作
                        setTimeout(() => {
                            toggleFavorite(music);
                        }, 500);
                    }
                });
            }
        );
        return;
    }
    
    const favorites = getFavoriteList();
    const musicId = music.id + '_' + music.source;
    const existingIndex = favorites.findIndex(item => item.id === music.id && item.source === music.source);
    
    if (existingIndex > -1) {
        // 如果已存在，则移除
        favorites.splice(existingIndex, 1);
        layer.msg('已从喜欢的歌中移除', {icon: 2, time: 1500});
    } else {
        // 如果不存在，则添加
        const favoriteMusic = {
            id: String(music.id),
            name: music.name,
            artist: music.artist,
            source: music.source,
            url_id: music.url_id || (music.id ? String(music.id) : ''),
            pic_id: music.pic_id || '',
            lyric_id: music.lyric_id || (music.id ? String(music.id) : ''),
            pic: '',
            url: '',
            added_time: new Date().getTime()
        };
        favorites.unshift(favoriteMusic);
        layer.msg('已添加到喜欢的歌', {icon: 1, time: 1500});
    }
    
    saveFavoriteList(favorites);
    updateFavoriteSheet();
    
    // 实时更新当前列表中所有相同歌曲的喜欢状态
    updateAllFavoriteIcons(music);
}

// 从歌曲详情弹窗中切换喜欢状态
function toggleFavoriteFromInfo(element) {
    const list = parseInt($(element).data('list'));
    const index = parseInt($(element).data('index'));
    const music = musicList[list].item[index];
    
    // 执行喜欢切换
    toggleFavorite(music);
    
    // 更新按钮文本和样式
    const favorites = getFavoriteList();
    const isFavorite = favorites.some(item => item.id === music.id && item.source === music.source);
    
    if (isFavorite) {
        $(element).text('取消喜欢').removeClass('info-btn-favorite-add').addClass('info-btn-favorite-remove');
    } else {
        $(element).text('添加到喜欢').removeClass('info-btn-favorite-remove').addClass('info-btn-favorite-add');
    }
    
    // 更新列表中对应的喜欢图标
    updateAllFavoriteIcons(music);
}

// 更新所有相同歌曲的喜欢状态
function updateAllFavoriteIcons(music) {
    $('.list-item').each(function() {
        const itemElement = $(this);
        const favoriteIcon = itemElement.find('.icon-favorite');
        if (favoriteIcon.length > 0) {
            // 获取当前歌曲信息来比较
            const musicName = itemElement.find('.music-name').text();
            const artistName = itemElement.find('.auth-name').text();
            
            // 如果歌曲名和艺术家名匹配，则更新图标状态
            if (musicName === music.name && artistName === music.artist) {
                updateFavoriteIcon(favoriteIcon, music);
            }
        }
    });
}



// 更新喜欢按钮的显示状态
function updateFavoriteIcon(iconElement, music) {
    const favorites = getFavoriteList();
    // 使用字符串比较以避免数字/字符串类型差异导致匹配失败
    const isFavorite = favorites.some(item => String(item.id) === String(music.id) && String(item.source) === String(music.source));
    
    if (isFavorite) {
        iconElement.addClass('active');
        iconElement.attr('title', '点击取消喜欢');
    } else {
        iconElement.removeClass('active');
        iconElement.attr('title', '点击喜欢这首歌');
    }
}

// 更新"喜欢的歌"歌单显示
function updateFavoriteSheet() {
    const userId = playerReaddata('user_id');
    if (!userId) {
        // 如果没有用户ID，显示提示信息
        if (musicList.length > 3) {
            musicList[3].item = [];
            musicList[3].total = 0;
            musicList[3].name = '喜欢的歌';
        }
        
        const favoriteSheetElement = $(".sheet-item[data-no='3']");
        if (favoriteSheetElement.length > 0) {
            favoriteSheetElement.find(".sheet-name").text('喜欢的歌 ⚙️');
            favoriteSheetElement.removeClass('has-user-id');
            // 确保设置按钮存在
            if (favoriteSheetElement.find('.sheet-setup-btn').length === 0) {
                favoriteSheetElement.append('<div class="sheet-setup-btn" onclick="setupUserIdForFavorite()" title="设置用户ID">⚙️</div>');
            }
        }
        return;
    }
    
    const favoriteKey = 'favorite_' + userId;
    const favorites = playerReaddata(favoriteKey);
    
    if (favorites && musicList.length > 3) {
        musicList[3].item = favorites;
        musicList[3].total = favorites.length;
        musicList[3].name = '喜欢的歌';
        
        // 更新歌单显示中"喜欢的歌"的显示信息
        const favoriteSheetElement = $(".sheet-item[data-no='3']");
        if (favoriteSheetElement.length > 0) {
            // 更新歌单名称，显示歌曲数量
            const sheetName = '喜欢的歌 (' + favorites.length + ')';
            favoriteSheetElement.find(".sheet-name").text(sheetName);
            // 移除设置按钮（因为有用户ID了）
            favoriteSheetElement.addClass('has-user-id');
            favoriteSheetElement.find('.sheet-setup-btn').remove();
        }
        
        // 如果当前正在显示"喜欢的歌"列表，则刷新显示
        if (rem.dislist === 3) {
            loadList(3);
        }
    }
}

// 初始化播放列表
function initList() {
    // 登陆过，那就读取出用户的歌单，并追加到系统歌单的后面
    if(playerReaddata('uid')) {
        rem.uid = playerReaddata('uid');
        rem.uname = playerReaddata('uname');
        // musicList.push(playerReaddata('ulist'));
        var tmp_ulist = playerReaddata('ulist');    // 读取本地记录的用户歌单
        
        if(tmp_ulist) musicList.push.apply(musicList, tmp_ulist);   // 追加到系统歌单的后面
    }
    
    // 显示所有的歌单
    for(var i=1; i<musicList.length; i++) {
        
        if(i == 1) {    // 正在播放列表
            // 读取正在播放列表
            var tmp_item = playerReaddata('playing');
            if(tmp_item) {  // 读取到了正在播放列表
                musicList[1].item = tmp_item;
                mkPlayer.defaultlist = 1;   // 默认显示正在播放列表
            }
            
        } else if(i == 2) { // 历史记录列表
            // 读取历史记录
            var tmp_item = playerReaddata('his');
            if(tmp_item) {
                musicList[2].item = tmp_item;
            }
            
        } else if(i == 3) { // 喜欢的歌列表
            // 读取喜欢的歌列表 - 确保总是有用户ID
            const userId = getUserId();
            if(userId) {
                const favoriteKey = 'favorite_' + userId;
                const tmp_item = playerReaddata(favoriteKey);
                if(tmp_item) {
                    musicList[3].item = tmp_item;
                    musicList[3].total = tmp_item.length;
                } else {
                    // 确保喜欢列表不为空
                    musicList[3].item = [];
                    musicList[3].total = 0;
                }
            }
            
         // 列表不是用户列表，并且信息为空，需要ajax读取列表
        }else if(!musicList[i].creatorID && (musicList[i].item == undefined || (i>2 && musicList[i].item.length == 0))) {   
            musicList[i].item = [];
            if(musicList[i].id) {   // 列表ID已定义
                // ajax获取列表信息
                ajaxPlayList(musicList[i].id, i);
            } else {    // 列表 ID 未定义
                if(!musicList[i].name) musicList[i].name = '未命名';
            }
        }
        
        // 在前端显示出来
        let sheetName = musicList[i].name;
        if (i == 3) {
            const userId = playerReaddata('user_id');
            if (!userId) {
                sheetName = '喜欢的歌 ⚙️'; // 添加设置图标提示
            } else if (musicList[i].item) {
                // 对于"喜欢的歌"，显示歌曲数量
                sheetName += ' (' + musicList[i].item.length + ')';
            }
        }
        addSheet(i, sheetName, musicList[i].cover);
    }
    
    // 登陆了，但歌单又没有，说明是在刷新歌单
    if(playerReaddata('uid') && !tmp_ulist) {
        ajaxUserList(rem.uid);
        return true;
    }
    
    // 首页显示默认列表
    if(mkPlayer.defaultlist >= musicList.length) mkPlayer.defaultlist = 1;  // 超出范围，显示正在播放列表
    
    if(musicList[mkPlayer.defaultlist].isloading !== true)  loadList(mkPlayer.defaultlist);
    
    // 显示最后一项登陆条
    sheetBar();
}

// 清空用户的同步列表
function clearUserlist() {
    if(!rem.uid) return false;
    
    // 查找用户歌单起点
    for(var i=1; i<musicList.length; i++) {
        if(musicList[i].creatorID !== undefined && musicList[i].creatorID == rem.uid) break;    // 找到了就退出
    }
    
    // 删除记忆数组
    musicList.splice(i, musicList.length - i); // 先删除相同的
    musicList.length = i;
    
    // 刷新列表显示
    clearSheet();
    initList();
}

// 清空当前显示的列表
function clearDislist() {
    musicList[rem.dislist].item.length = 0;  // 清空内容
    if(rem.dislist == 1) {  // 正在播放列表
        playerSavedata('playing', '');  // 清空本地记录
        $(".sheet-item[data-no='1'] .sheet-cover").attr('src', 'images/player_cover.png');    // 恢复正在播放的封面
    } else if(rem.dislist == 2) {   // 播放记录
        playerSavedata('his', '');  // 清空本地记录
    }
    layer.msg('列表已被清空');
    dataBox("sheet");    // 在主界面显示出音乐专辑
}

// 刷新播放列表，为正在播放的项添加正在播放中的标识
function refreshSheet() {
    // 调试信息输出
    if(mkPlayer.debug) {
        console.log("开始播放列表 " + musicList[rem.playlist].name + " 中的歌曲");
    }
    
    $(".sheet-playing").removeClass("sheet-playing");        // 移除其它的正在播放
    
    $(".sheet-item[data-no='" + rem.playlist + "']").addClass("sheet-playing"); // 添加样式
}

// 播放器本地存储信息
// 参数：键值、数据
function playerSavedata(key, data) {
    key = 'mkPlayer2_' + key;    // 添加前缀，防止串用
    data = JSON.stringify(data);
    // 存储，IE6~7 不支持HTML5本地存储
    if (window.localStorage) {
        localStorage.setItem(key, data);    
    }
}

// 播放器读取本地存储信息
// 参数：键值
// 返回：数据
function playerReaddata(key) {
    if(!window.localStorage) return '';
    key = 'mkPlayer2_' + key;
    return JSON.parse(localStorage.getItem(key));
}

// 同步喜欢歌单到云端
function syncFavoriteToCloud(favorites) {
    const userId = playerReaddata('user_id');
    if (!userId) return;
    
    // 确保上传的数据完整性
    const validatedFavorites = validateSongData(favorites);
    
    // 添加时间戳避免缓存
    const cacheBuster = getCacheBuster();
    
    $.ajax({
        url: mkPlayer.favoriteApi,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            action: 'save',
            user_id: userId,
            favorites: validatedFavorites,
            timestamp: cacheBuster.timestamp,
            r: cacheBuster.r
        }),
        dataType: 'json',
        success: function(response) {
            if (response.success) {
                if (mkPlayer.debug) {
                    console.log('喜欢歌单已同步到云端，数量：' + response.count);
                }
            } else {
                if (mkPlayer.debug) {
                    console.log('云端同步失败：' + response.message);
                }
            }
        },
        error: function(xhr, status, error) {
            if (mkPlayer.debug) {
                console.log('云端同步请求失败：' + error);
            }
        }
    });
}



// 从云端同步喜欢歌单
function syncFavoriteFromCloud() {
    return new Promise((resolve, reject) => {
        const userId = playerReaddata('user_id');
        if (!userId) {
            reject('用户ID为空');
            return;
        }
        
        // 添加时间戳避免缓存
        const cacheBuster = getCacheBuster();
        
        $.ajax({
            url: mkPlayer.favoriteApi,
            type: 'GET',
            data: {
                action: 'get',
                user_id: userId,
                timestamp: cacheBuster.timestamp,
                r: cacheBuster.r
            },
            dataType: 'json',
            success: function(response) {
                if (response && response.success) {
                    resolve(response.data);
                } else {
                    reject(response ? response.message : '获取云端数据失败');
                }
            },
            error: function(xhr, status, error) {
                reject(error || '网络请求失败');
            }
        });
    });
}



// 为喜欢功能设置用户ID
function setupUserIdForFavorite() {
    confirmUserIdForSync(function(userId) {
        if (!userId) {
            layer.msg('已取消设置', {icon: 0});
            return;
        }
        
        // 刷新"喜欢的歌"列表显示
        updateFavoriteSheet();
        if (rem.dislist === 3) {
            loadList(3);
        }
        
        layer.msg('用户ID设置成功！现在可以使用喜欢功能了', {icon: 1, time: 2000});
    });
}



// 手动从云端同步（增量同步）
function manualSyncFromCloud() {
    manualSyncToCloud(performIncrementalSyncFromCloud);
}



// 执行增量同步的具体操作（从云端同步到本地）
function performIncrementalSyncFromCloud(userId) {
    // 从云端只读获取云端数据，合并在客户端并保存到本地（避免在仅“从云端同步”时写入服务器）
    const favoriteKey = 'favorite_' + userId;
    let localFavorites = playerReaddata(favoriteKey) || [];
    localFavorites = validateSongData(localFavorites);

    const loadingIndex = createLoadingLoad();

    syncFavoriteFromCloud().then(cloudFavorites => {
        closeLoadingAndShow(loadingIndex);

        const mergedData = mergeFavoriteLists(localFavorites, getValidatedCloudData(cloudFavorites));

        // 更新本地数据为合并后的结果（仅本地保存）
        playerSavedata(favoriteKey, mergedData.result);
        if (musicList.length > 3) {
            musicList[3].item = mergedData.result;
            musicList[3].total = mergedData.result.length;
        }
        updateFavoriteSheet();
        loadList(3);

        let syncMsg = `从云端同步完成！当前共有${mergedData.total}首歌曲`;
        syncMsg += `（本地${localFavorites.length}首，云端${cloudFavorites.length}首）`;
        layer.msg(syncMsg, {icon: 1, time: 3000});
    }).catch(error => {
        closeLoadingAndShow(loadingIndex, '从云端同步请求失败: ' + error, 2);
    });
}



// 手动同步到云端工具函数
function manualSyncToCloud(performSyncFunction) {
    // 确认用户ID（允许切换）
    confirmUserIdForSync(function(userId) {
        if (!userId) {
            layer.msg('已取消同步', {icon: 0});
            return;
        }
        
        performSyncFunction(userId);
    });
}

// 手动增量同步到云端
function manualIncrementalSyncToCloud() {
    manualSyncToCloud(performIncrementalSyncToCloud);
}



// 执行增量同步到云端的具体操作
function performIncrementalSyncToCloud(userId) {
    const favoriteKey = 'favorite_' + userId;
    let localFavorites = playerReaddata(favoriteKey) || [];
    
    // 确保本地数据完整性
    localFavorites = validateSongData(localFavorites);
    
    if (localFavorites.length === 0) {
        layer.msg('本地暂无喜欢的歌曲', {icon: 0, time: 2000});
        return;
    }
    
    const loadingIndex = createLoadingLoad();
    
    // 直接发送本地全量数据到后端进行增量同步
    $.ajax({
        url: mkPlayer.favoriteApi,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            action: 'incremental_sync',
            user_id: userId,
            local_favorites: localFavorites
        }),
        dataType: 'json',
        success: function(response) {
            closeLoadingAndShow(loadingIndex);
            
            if (response && response.success) {
                // 更新本地数据为合并后的结果
                playerSavedata(favoriteKey, response.data);
                if (musicList.length > 3) {
                    musicList[3].item = response.data;
                    musicList[3].total = response.data.length;
                }
                updateFavoriteSheet();
                
                let syncMsg = `增量同步完成！当前共有${response.merged_count}首歌曲`;
                syncMsg += `（本地${response.local_count}首，云端${response.cloud_count}首）`;
                layer.msg(syncMsg, {icon: 1, time: 3000});
            } else {
                layer.msg('增量同步失败：' + (response ? response.message : '未知错误'), {icon: 2, time: 3000});
            }
        },
        error: function(xhr, status, error) {
            closeLoadingAndShow(loadingIndex, '增量同步请求失败: ' + error, 2);
        }
    });
}



// 手动全量同步到云端
function manualFullSyncToCloud() {
    manualSyncToCloud(performFullSyncToCloud);
}



// 执行全量同步到云端的具体操作
function performFullSyncToCloud(userId) {
    const favoriteKey = 'favorite_' + userId;
    let localFavorites = playerReaddata(favoriteKey) || [];
    
    // 确保本地数据完整性
    localFavorites = validateSongData(localFavorites);
    
    if (localFavorites.length === 0) {
        layer.msg('本地暂无喜欢的歌曲', {icon: 0, time: 2000});
        return;
    }
    
    showSyncConfirm(
        `确定将本地的${localFavorites.length}首喜欢的歌曲全量同步到云端吗？\n` +
        `这将覆盖云端的所有数据。`,
        function() {
            const loadingIndex = createLoadingLoad();
            
            // 直接上传本地数据
            syncFavoriteToCloud(localFavorites);
            
            setTimeout(() => {
                closeLoadingAndShow(loadingIndex, `已全量同步${localFavorites.length}首喜欢的歌曲到云端`);
            }, 1000);
        }
    );
}


