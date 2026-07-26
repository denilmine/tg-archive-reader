const TRANSLATIONS = {
    ru: { load_title: "История Чата", load_sub: "Восстановите историю из ZIP", drop_text: "Перетащите <span>ZIP</span> сюда", click_info: "информация о чате", sidebar_info: "Информация", total_msg: "сообщений", media_photos: "Фото", media_videos: "Видео", media_voices: "Голосовые", loading: "Чтение архива...", search_ph: "Поиск..." },
    en: { load_title: "Chat History", load_sub: "Restore history from ZIP", drop_text: "Drag & Drop <span>ZIP</span> here", click_info: "click for info", sidebar_info: "Information", total_msg: "messages", media_photos: "Photos", media_videos: "Videos", media_voices: "Voices", loading: "Reading archive...", search_ph: "Search..." },
    uk: { load_title: "Історія Чату", load_sub: "Відновіть історію з ZIP", drop_text: "Перетягніть <span>ZIP</span> сюди", click_info: "інформація про чат", sidebar_info: "Інформація", total_msg: "повідомлень", media_photos: "Фото", media_videos: "Відео", media_voices: "Голосові", loading: "Читання архіву...", search_ph: "Пошук..." },
    pl: { load_title: "Historia Czatu", load_sub: "Przywróć historię z ZIP", drop_text: "Przeciągnij <span>ZIP</span> tutaj", click_info: "kliknij po info", sidebar_info: "Informacje", total_msg: "wiadomości", media_photos: "Zdjęcia", media_videos: "Wideo", media_voices: "Głosowe", loading: "Wczytywanie...", search_ph: "Szukaj..." }
};

class ChatApp {
    constructor() {
        this.zip = null;
        this.chatRoot = "";
        this.blobs = new Map();
        this.messagesDB = {};
        this.media = { photos: [], videos: [], voices: [], files: [] };
        this.audioPlayer = new Audio();
        this.myName = "Me";
        this.lang = 'ru';
        
        this.ui = {
            landing: document.getElementById('landing-screen'),
            chat: document.getElementById('chat-interface'),
            history: document.getElementById('history'),
            dropZone: document.getElementById('drop-zone'),
            loading: document.getElementById('loading-state'),
            sidebar: document.getElementById('right-sidebar'),
            player: document.getElementById('sticky-player'),
            lightbox: document.getElementById('lightbox')
        };

        this.initEventListeners();
    }

    initEventListeners() {
        const dz = this.ui.dropZone;
        dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = '#40a7e3'; });
        dz.addEventListener('dragleave', e => { e.preventDefault(); dz.style.borderColor = ''; });
        dz.addEventListener('drop', e => this.handleDrop(e));
        dz.addEventListener('click', () => document.getElementById('file-input').click());
        document.getElementById('file-input').addEventListener('change', e => this.handleFiles(e.target.files));

        document.getElementById('theme-btn').onclick = () => this.toggleTheme();
        document.getElementById('lang-btn').onclick = (e) => { e.stopPropagation(); document.getElementById('lang-dropdown').classList.toggle('active'); };
        document.querySelectorAll('.lang-item').forEach(el => el.onclick = () => this.setLang(el.dataset.val));
        document.addEventListener('click', () => document.getElementById('lang-dropdown').classList.remove('active'));

        document.getElementById('sidebar-toggle').onclick = () => this.toggleSidebar(true);
        document.getElementById('header-info').onclick = () => this.toggleSidebar(true);
        document.getElementById('sidebar-close').onclick = () => this.toggleSidebar(false);
        document.getElementById('search-toggle').onclick = () => {
            const bar = document.getElementById('search-bar');
            bar.classList.toggle('active');
            if(bar.classList.contains('active')) document.getElementById('search-input').focus();
        };

        document.querySelectorAll('.media-link').forEach(link => {
            link.onclick = () => this.openMediaTab(link.dataset.type);
        });
        document.getElementById('media-back').onclick = () => {
            document.getElementById('sidebar-content').classList.remove('active');
            document.getElementById('sidebar-main').classList.add('active');
        };

        document.getElementById('player-play-btn').onclick = () => this.toggleAudio();
        document.getElementById('player-close').onclick = () => this.closePlayer();
        const slider = document.getElementById('audio-slider');
        this.audioPlayer.ontimeupdate = () => {
            if(isNaN(this.audioPlayer.duration)) return;
            slider.value = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
            document.getElementById('cur-time').innerText = this.formatTime(this.audioPlayer.currentTime);
            document.getElementById('dur-time').innerText = this.formatTime(this.audioPlayer.duration);
        };
        slider.oninput = (e) => {
            this.audioPlayer.currentTime = (e.target.value / 100) * this.audioPlayer.duration;
        };
        this.audioPlayer.onended = () => {
            document.getElementById('play-icon').style.display = 'block';
            document.getElementById('pause-icon').style.display = 'none';
        };

        document.getElementById('search-input').addEventListener('input', (e) => this.search(e.target.value));
        const scrollBtn = document.getElementById('scroll-down-btn');
        scrollBtn.onclick = () => document.getElementById('chat-container').scrollTo({ top: document.getElementById('chat-container').scrollHeight, behavior: 'smooth' });
        document.getElementById('chat-container').onscroll = (e) => {
             const atBottom = e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight < 100;
             scrollBtn.style.display = atBottom ? 'none' : 'flex';
        };

        document.getElementById('lb-close').onclick = () => this.ui.lightbox.classList.remove('active');
        this.ui.lightbox.onclick = (e) => { if(e.target === this.ui.lightbox) this.ui.lightbox.classList.remove('active'); };
    }

    async handleDrop(e) {
        e.preventDefault();
        this.handleFiles(e.dataTransfer.files);
    }

    async handleFiles(files) {
        const file = Array.from(files).find(f => f.name.endsWith('.zip'));
        if (!file) return alert("Пожалуйста, выберите .zip файл");

        this.ui.dropZone.style.display = 'none';
        this.ui.loading.style.display = 'flex';
        
        this.blobs.forEach(url => URL.revokeObjectURL(url));
        this.blobs.clear();
        this.ui.history.innerHTML = '';
        this.messagesDB = {};
        this.media = { photos: [], videos: [], voices: [], files: [] };

        try {
            this.zip = await JSZip.loadAsync(file);
            await this.parseChat();
        } catch (err) {
            console.error(err);
            alert("Ошибка: " + err.message);
            location.reload();
        }
    }

    async parseChat() {
        const files = Object.keys(this.zip.files).filter(n => n.match(/(^|\/)messages(\d*)?\.html$/));
        if (!files.length) throw new Error("messages.html не найден");

        files.sort((a, b) => {
            const getN = s => parseInt(s.match(/messages(\d*)\.html/)?.[1] || 1);
            return getN(a) - getN(b);
        });

        const mainFile = files[0];
        this.chatRoot = mainFile.substring(0, mainFile.lastIndexOf('/') + 1);

        const parser = new DOMParser();
        const fragment = document.createDocumentFragment();

        const firstHtml = await this.zip.file(mainFile).async("string");
        const doc0 = parser.parseFromString(firstHtml, 'text/html');
        this.extractMeta(doc0);

        for (const fName of files) {
            const content = await this.zip.file(fName).async("string");
            const safeContent = content.replace(/ src=/g, ' data-src=');
            const doc = parser.parseFromString(safeContent, 'text/html');
            this.renderMessages(doc, fragment);
        }

        this.ui.history.appendChild(fragment);
        this.updateStats();
        
        this.ui.landing.style.display = 'none';
        this.ui.chat.style.display = 'flex';
        this.initObserver();
        
        setTimeout(() => document.getElementById('chat-container').scrollTop = 99999999, 100);
    }

    extractMeta(doc) {
        const title = doc.querySelector('.page_header .text.bold')?.innerText.trim() || "Chat";
        document.getElementById('chat-title').innerText = title;
        document.getElementById('profile-name').innerText = title;
        document.getElementById('profile-avatar').innerText = title.substring(0, 2).toUpperCase();
        
        const service = doc.querySelector('.message.service .body');
        if (service) {
            const m = service.innerText.match(/^(.+?) (created|создал)/);
            if (m) this.myName = m[1].trim();
        }
    }

    renderMessages(doc, fragment) {
        let lastSender = "Unknown";
        doc.querySelectorAll('.message').forEach(msg => {
            if (!msg.querySelector('.body') && !msg.classList.contains('service')) return;
            
            const id = msg.id.replace('message', '');
            if (msg.classList.contains('service')) {
                const text = msg.querySelector('.body').innerText.trim();
                const div = document.createElement('div');
                div.className = 'msg-row service';
                div.innerHTML = `<div class="service-pill">${text}</div>`;
                fragment.appendChild(div);
                return;
            }

            const fromNode = msg.querySelector('.from_name');
            let sender = fromNode ? fromNode.innerText.trim() : lastSender;
            if (fromNode) lastSender = sender;
            
            const isOut = msg.classList.contains('out') || sender === this.myName;
            const div = document.createElement('div');
            div.className = `msg-row ${isOut ? 'out' : 'in'}`;
            div.id = 'msg-' + id;

            let avatar = '';
            if (!isOut) {
                const color = this.getColor(sender);
                const showAvatar = !!fromNode;
                avatar = `<div class="avatar-box" style="visibility:${showAvatar ? 'visible' : 'hidden'}"><div class="avatar-circle" style="background:${color}">${sender[0]}</div></div>`;
            }

            let contentHtml = '';
            const reply = msg.querySelector('.reply_to');
            if (reply) {
                const rName = reply.querySelector('.reply_to_name')?.innerText || "Сообщение";
                contentHtml += `<div class="reply" onclick="app.scrollToMsg('${reply.querySelector('a')?.getAttribute('href').split('message')[1]}')"><div class="reply-name">${rName}</div><div class="reply-text">Ответ...</div></div>`;
            }

            const mediaWrap = msg.querySelector('.media_wrap');
            if (mediaWrap) contentHtml += this.processMedia(mediaWrap, sender);

            const textEl = msg.querySelector('.text');
            if (textEl) contentHtml += `<div class="text">${textEl.innerHTML}</div>`;

            const time = msg.querySelector('.date')?.innerText.trim() || "";
            const nameHtml = (!isOut && fromNode) ? `<div class="name" style="color:${this.getColor(sender)}">${sender}</div>` : '';

            div.innerHTML = `${avatar}<div class="bubble">${nameHtml}${contentHtml}<span class="time">${time}</span></div>`;
            fragment.appendChild(div);
        });
    }

    processMedia(wrap, sender) {
        let html = '';
        const foundPaths = new Set(); 
        const normalize = (p) => p ? decodeURIComponent(p).trim().toLowerCase() : '';
        let videoRendered = false; 
        const checkIsRound = (path, el) => {
            const lowerPath = path.toLowerCase();
            const wrapHTML = wrap.innerHTML.toLowerCase();
            
            return lowerPath.includes('round') || 
                   lowerPath.includes('video note') || 
                   lowerPath.includes('video_note') ||
                   wrapHTML.includes('video note') ||
                   wrapHTML.includes('видеосообщение') ||
                   wrapHTML.includes('round_video') ||
                   (el && el.classList.contains('round')) ||
                   wrap.classList.contains('round');
        };

        const createVideoHtml = (fullPath, isRound) => {
            const extraClass = isRound ? 'round' : '';
            const attrs = isRound ? 'autoplay loop muted playsinline' : 'controls preload="metadata"';
            this.media.videos.push({ src: fullPath });
            videoRendered = true;
            return `<video class="chat-video ${extraClass}" ${attrs} data-zip-src="${fullPath}"></video>`;
        };

        wrap.querySelectorAll('video, a').forEach(el => {
            let src = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('href');
            if (!src) return;

            const cleanPath = normalize(src);
            const ext = cleanPath.split('.').pop();
            if (ext === 'mp4' || ext === 'mov') {
                if (foundPaths.has(cleanPath)) return;
                foundPaths.add(cleanPath);

                const fullPath = this.chatRoot + decodeURIComponent(src);
                const isRound = checkIsRound(cleanPath, el);
                html += createVideoHtml(fullPath, isRound);
            }
        });

        wrap.querySelectorAll('img').forEach(el => {
            let src = el.getAttribute('src') || el.getAttribute('data-src');
            if (!src) return;

            const cleanPath = normalize(src);
            if (foundPaths.has(cleanPath)) return;
            if (videoRendered) return;

            const fullPath = this.chatRoot + decodeURIComponent(src);
            if (cleanPath.endsWith('.tgs')) {
                foundPaths.add(cleanPath);
                const uid = 'sticker-' + Math.random().toString(36).substr(2, 9);
                setTimeout(() => this.loadTgsSticker(fullPath, uid), 0);
                html += `<div class="sticker-wrap" id="${uid}"></div>`;
            }
            else if (cleanPath.endsWith('.webm')) {
                foundPaths.add(cleanPath);
                html += `<div class="sticker-wrap">
                            <video class="chat-sticker-video" data-zip-src="${fullPath}" autoplay loop muted playsinline></video>
                         </div>`;
            }
            else {
                foundPaths.add(cleanPath);
                this.media.photos.push({ src: fullPath });
                html += `<img class="chat-media" data-zip-src="${fullPath}" onclick="app.openLightbox('image', '${fullPath}')">`;
            }
        });

        wrap.querySelectorAll('a').forEach(el => {
            let href = el.getAttribute('href');
            if (!href) return;

            const cleanPath = normalize(href);

            if (foundPaths.has(cleanPath)) return; 

            if (el.querySelector('img') || el.querySelector('video')) return;

            const fullPath = this.chatRoot + decodeURIComponent(href);
            const filename = decodeURIComponent(href.split('/').pop());
            const ext = cleanPath.split('.').pop();

            if (ext === 'webm') {
                foundPaths.add(cleanPath);
                html += `<div class="sticker-wrap">
                            <video class="chat-sticker-video" data-zip-src="${fullPath}" autoplay loop muted playsinline></video>
                         </div>`;
            }
            else if (cleanPath.includes('voice') || href.includes('Voice') || ext === 'ogg' || ext === 'mp3') {
                foundPaths.add(cleanPath);
                const idx = this.media.voices.length;
                const dur = el.querySelector('.duration')?.innerText || "Voice";
                this.media.voices.push({ src: fullPath, sender: sender });
                html += `<div class="file-attach" onclick="app.playVoice(${idx})">
                            <div class="file-icon">▶</div>
                            <div class="file-info"><div class="file-name">Голосовое</div><div class="file-size">${dur}</div></div>
                         </div>`;
            }
            else {
                foundPaths.add(cleanPath);
                html += this.renderFileBlock(fullPath, filename, '📄');
            }
        });

        return html;
    }

    renderFileBlock(path, name, icon) {
        return `<div class="file-attach" onclick="app.downloadFile('${path}', '${name}')"><div class="file-icon">${icon}</div><div class="file-info"><div class="file-name">${name}</div><div class="file-size">Скачать</div></div></div>`;
    }

    async loadTgsSticker(path, containerId) {
        const container = document.getElementById(containerId);
        if(!container) return;
        try {
            const file = this.zip.file(path);
            if(file) {
                const compressed = await file.async('uint8array');
                const jsonStr = pako.ungzip(compressed, { to: 'string' });
                lottie.loadAnimation({ container: container, renderer: 'svg', loop: true, autoplay: true, animationData: JSON.parse(jsonStr) });
            }
        } catch(e) { console.warn("TGS Error:", e); }
    }

    async downloadFile(path, filename) {
        const url = await this.getBlob(path);
        if(url) {
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }
    }

    async getBlob(path) {
        if (this.blobs.has(path)) return this.blobs.get(path);
        
        try {
            const file = this.zip.file(path);
            if (!file) {
                const lowerPath = path.toLowerCase();
                const matchedFile = Object.keys(this.zip.files).find(k => k.toLowerCase() === lowerPath);
                if (matchedFile) {
                    return await this.getBlob(matchedFile); 
                }
                return null;
            }
            
            const ext = path.split('.').pop().toLowerCase();
            let type = 'application/octet-stream';
            
            if (ext === 'jpg' || ext === 'jpeg') type = 'image/jpeg';
            if (ext === 'png') type = 'image/png';
            if (ext === 'webp') type = 'image/webp';
            if (ext === 'gif') type = 'image/gif';
            if (ext === 'mp4') type = 'video/mp4';
            if (ext === 'webm') type = 'video/webm';
            if (ext === 'ogg') type = 'audio/ogg';
            if (ext === 'mp3') type = 'audio/mpeg';

            const blob = await file.async('blob');
            const url = URL.createObjectURL(new Blob([blob], {type}));
            this.blobs.set(path, url);
            return url;
        } catch(e) { 
            console.error("Ошибка Blob:", e);
            return null; 
        }
    }

    initObserver() {
        const obs = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if(entry.isIntersecting) {
                    const el = entry.target;
                    const path = el.dataset.zipSrc;
                    if(path) {
                        this.getBlob(path).then(url => { if(url) el.src = url; });
                        observer.unobserve(el);
                    }
                }
            });
        }, { rootMargin: "500px" });
        document.querySelectorAll('[data-zip-src]').forEach(el => obs.observe(el));
    }

    toggleTheme() {
        const html = document.documentElement;
        html.setAttribute('data-theme', html.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
    }

    setLang(lang) {
        this.lang = lang;
        document.getElementById('current-lang').innerText = lang.toUpperCase();
        document.querySelectorAll('[data-lang]').forEach(el => {
            const k = el.getAttribute('data-lang');
            if(TRANSLATIONS[lang][k]) el.innerHTML = TRANSLATIONS[lang][k];
        });
        document.getElementById('search-input').placeholder = TRANSLATIONS[lang].search_ph;
    }

    toggleSidebar(show) {
        if(show) {
            this.ui.sidebar.classList.add('active');
            document.getElementById('sidebar-main').classList.add('active');
            document.getElementById('sidebar-content').classList.remove('active');
        } else {
            this.ui.sidebar.classList.remove('active');
        }
    }
    
    updateStats() {
        document.getElementById('msg-count').innerText = Object.keys(this.messagesDB).length;
        document.getElementById('cnt-photos').innerText = this.media.photos.length;
        document.getElementById('cnt-videos').innerText = this.media.videos.length;
        document.getElementById('cnt-voices').innerText = this.media.voices.length;
    }

    openMediaTab(type) {
        document.getElementById('sidebar-main').classList.remove('active');
        document.getElementById('sidebar-content').classList.add('active');
        document.getElementById('media-tab-title').innerText = type.toUpperCase();
        
        const grid = document.getElementById('media-grid');
        grid.innerHTML = '';
        this.media[type].slice(0, 50).forEach(item => {
            const div = document.createElement('div');
            div.className = 'grid-item';
            const el = document.createElement(type === 'videos' ? 'video' : 'img');
            this.getBlob(item.src).then(url => { if(url) el.src = url; });
            div.appendChild(el);
            div.onclick = () => this.openLightbox(type === 'videos' ? 'video' : 'image', item.src);
            grid.appendChild(div);
        });
    }

    async openLightbox(type, path) {
        this.ui.lightbox.classList.add('active');
        const content = document.getElementById('lb-content');
        content.innerHTML = '<div class="spinner"></div>';
        const url = await this.getBlob(path);
        if(type === 'image') content.innerHTML = `<img src="${url}">`;
        else content.innerHTML = `<video src="${url}" controls autoplay></video>`;
    }

    async playVoice(idx) {
        const item = this.media.voices[idx];
        const url = await this.getBlob(item.src);
        if(url) {
            this.audioPlayer.src = url;
            this.audioPlayer.play();
            this.ui.player.classList.add('active');
            document.getElementById('player-title').innerText = item.sender || "Голосовое";
            document.getElementById('play-icon').style.display = 'none';
            document.getElementById('pause-icon').style.display = 'block';
        }
    }

    toggleAudio() {
        if(this.audioPlayer.paused) {
            this.audioPlayer.play();
            document.getElementById('play-icon').style.display = 'none';
            document.getElementById('pause-icon').style.display = 'block';
        } else {
            this.audioPlayer.pause();
            document.getElementById('play-icon').style.display = 'block';
            document.getElementById('pause-icon').style.display = 'none';
        }
    }
    
    closePlayer() {
        this.audioPlayer.pause();
        this.ui.player.classList.remove('active');
    }

    formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0'+s : s}`;
    }

    scrollToMsg(id) {
        if(!id) return;
        const el = document.getElementById('msg-' + id);
        if(el) {
            el.scrollIntoView({block: 'center', behavior: 'smooth'});
            const b = el.querySelector('.bubble');
            b.style.transition = 'background 0.5s';
            const oldBg = b.style.background;
            b.style.background = 'var(--accent)';
            setTimeout(() => b.style.background = oldBg, 1000);
        }
    }

    search(val) {
        val = val.toLowerCase();
        let count = 0;
        document.querySelectorAll('.msg-row:not(.service)').forEach(row => {
            const match = row.innerText.toLowerCase().includes(val);
            row.style.display = match ? 'flex' : 'none';
            if(match) count++;
        });
        document.getElementById('search-count').innerText = val ? count : '';
    }

    getColor(name) {
        const colors = ['#e17076', '#7bc862', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb'];
        let hash = 0; for(let i=0; i<name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    }
}

const app = new ChatApp();