// הגדרות גלובליות
const API_BASE_URL = 'https://www.call2all.co.il/ym/api/';
const TOKEN = 'WU1BUElL.apik_H5dQJ0e4Fdyc8NiRvSWMdw.jhS6PXCTir0yTsW-ydHKZ45Mu3P3_e-RYTsoEg9p4eo';
let currentPath = 'ivr2:/';  // שינוי הנתיב ההתחלתי
let currentView = 'grid';
let currentData = null;

// טעינת דף בטעינה ראשונית
document.addEventListener('DOMContentLoaded', () => {
    loadDirectory();
    loadSidebarTree();
});

// החלפת תצוגה
function setView(view) {
    currentView = view;
    document.getElementById('gridView').classList.toggle('active', view === 'grid');
    document.getElementById('listView').classList.toggle('active', view === 'list');
    if (currentData) {
        renderContent(currentData);
    }
}

// טעינת תיקייה
async function loadDirectory(path = currentPath) {
    currentPath = path;
    updateBreadcrumb();
    
    const sortBy = document.getElementById('sortBy').value;
    const sortDir = document.getElementById('sortDir').value;
    
    const params = new URLSearchParams({
        token: TOKEN,
        path: path,
        orderBy: sortBy,
        orderDir: sortDir
    });

    const url = `${API_BASE_URL}GetIVR2Dir?${params}`;
    console.log('🔄 Loading directory:', path);
    console.log('📡 API URL:', url);

    try {
        showLoading();
        const response = await fetch(url);
        console.log('📊 Response status:', response.status, response.statusText);
        
        const data = await response.json();
        console.log('📦 Response data:', data);
        
        if (data.responseStatus === 'SUCCESS' || data.responseStatus === 'OK') {
            currentData = data;
            renderContent(data);
            updateSidebarActive();
            console.log('✅ Directory loaded successfully');
        } else {
            const errorMsg = data.message || data.exceptionMessage || 'שגיאה לא ידועה';
            console.error('❌ API Error:', data);
            showError('שגיאה בטעינת הנתונים: ' + errorMsg);
        }
    } catch (error) {
        console.error('❌ Fetch Error:', error);
        showError('שגיאת תקשורת: ' + error.message);
    }
}

// עדכון ניווט (breadcrumb)
function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    const parts = currentPath.split('/').filter(p => p);
    
    let html = '<a href="#" onclick="loadDirectory(\'/\'); return false;"><i class="fas fa-home"></i> ראשי</a>';
    let accumulatedPath = '';
    
    parts.forEach(part => {
        accumulatedPath += '/' + part;
        const displayPath = accumulatedPath;
        html += ` <span class="breadcrumb-separator">/</span> <a href="#" onclick="loadDirectory('${displayPath}'); return false;">${part}</a>`;
    });
    
    breadcrumb.innerHTML = html;
}

// הצגת תוכן
function renderContent(data) {
    const content = document.getElementById('content');
    
    if (currentView === 'grid') {
        content.innerHTML = renderGridView(data);
    } else {
        content.innerHTML = renderListView(data);
    }
}

// תצוגת רשת
function renderGridView(data) {
    let html = '<div class="file-grid">';
    
    // הצגת תיקייה אב
    if (data.parentPath) {
        html += `
            <div class="folder-item" onclick="loadDirectory('${data.parentPath}')">
                <div class="item-icon"><i class="fas fa-level-up-alt"></i></div>
                <div class="item-name">.. (חזור)</div>
            </div>
        `;
    }
    
    // הצגת תיקיות ושלוחות
    if (data.dirs && data.dirs.length > 0) {
        data.dirs.forEach(dir => {
            const extInfo = dir.extTitle ? `<span class="ext-badge">${dir.extType || 'שלוחה'}</span>` : '';
            html += `
                <div class="folder-item" onclick="loadDirectory('${dir.what}')">
                    <div class="item-icon"><i class="fas fa-folder"></i></div>
                    <div class="item-name">${extInfo}${dir.name}</div>
                    ${dir.extTitle ? `<div class="item-details">${dir.extTitle}</div>` : ''}
                </div>
            `;
        });
    }
    
    // הצגת קבצים
    if (data.files && data.files.length > 0) {
        data.files.forEach(file => {
            const icon = getFileIcon(file.fileType);
            const size = formatFileSize(file.size);
            const duration = file.durationStr ? `<i class="far fa-clock"></i> ${file.durationStr}` : '';
            const isAudio = file.fileType === 'WAV' || file.fileType === 'MP3';
            
            html += `
                <div class="file-item">
                    <div class="item-icon">${icon}</div>
                    <div class="item-name">${file.name}</div>
                    <div class="item-details">
                        ${size}
                        ${duration ? '<br>' + duration : ''}
                        ${file.mtime ? '<br>' + file.mtime : ''}
                    </div>
                    ${isAudio ? `
                        <button class="play-file-btn" onclick="event.stopPropagation(); playAudioFile('${file.what}', '${file.name}')">
                            <i class="fas fa-play"></i> הפעל
                        </button>
                    ` : ''}
                    <button class="view-file-btn" onclick="event.stopPropagation(); viewFile('${file.what}', '${file.fileType}')">
                        <i class="fas fa-eye"></i> ${isAudio ? 'פרטים' : 'צפה'}
                    </button>
                </div>
            `;
        });
    }
    
    // הצגת קבצי INI
    if (data.ini && data.ini.length > 0) {
        data.ini.forEach(file => {
            html += `
                <div class="file-item" onclick="viewFile('${file.what}', 'INI')">
                    <div class="item-icon"><i class="fas fa-cog" style="color: #ff9800;"></i></div>
                    <div class="item-name">${file.name}</div>
                    <div class="item-details">
                        ${formatFileSize(file.size)}
                        ${file.mtime ? '<br>' + file.mtime : ''}
                    </div>
                </div>
            `;
        });
    }
    
    // הצגת הודעות מערכת
    if (data.messages && data.messages.length > 0) {
        data.messages.forEach(file => {
            const desc = data.msgDescriptions && data.msgDescriptions[file.name] 
                ? data.msgDescriptions[file.name] 
                : '';
            
            html += `
                <div class="file-item" onclick="viewFile('${file.what}', 'MESSAGE')">
                    <div class="item-icon"><i class="fas fa-volume-up" style="color: #4caf50;"></i></div>
                    <div class="item-name">${file.name}</div>
                    <div class="item-details">
                        ${desc ? desc + '<br>' : ''}
                        ${file.durationStr ? '<i class="far fa-clock"></i> ' + file.durationStr : ''}
                    </div>
                </div>
            `;
        });
    }
    
    html += '</div>';
    
    if (!data.dirs?.length && !data.files?.length && !data.ini?.length && !data.messages?.length) {
        html = '<div class="loading">התיקייה ריקה</div>';
    }
    
    return html;
}

// תצוגת רשימה
function renderListView(data) {
    let html = '<table class="file-table">';
    html += `
        <thead>
            <tr>
                <th>סוג</th>
                <th>שם</th>
                <th>גודל</th>
                <th>משך</th>
                <th>תאריך שינוי</th>
                <th>פרטים</th>
                <th>פעולות</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    // תיקייה אב
    if (data.parentPath) {
        html += `
            <tr onclick="loadDirectory('${data.parentPath}')" style="cursor: pointer;">
                <td><i class="fas fa-level-up-alt" style="color: #4caf50;"></i></td>
                <td colspan="5"><strong>.. (חזור)</strong></td>
            </tr>
        `;
    }
    
    // תיקיות
    if (data.dirs && data.dirs.length > 0) {
        data.dirs.forEach(dir => {
            html += `
                <tr onclick="loadDirectory('${dir.what}')" style="cursor: pointer;">
                    <td><i class="fas fa-folder" style="color: #ffc107;"></i></td>
                    <td><strong>${dir.name}</strong></td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>${dir.extTitle || ''} ${dir.extType ? `<span class="ext-badge">${dir.extType}</span>` : ''}</td>
                </tr>
            `;
        });
    }
    
    // קבצים
    const allFiles = [
        ...(data.files || []),
        ...(data.ini || []),
        ...(data.messages || []),
        ...(data.html || [])
    ];
    
    allFiles.forEach(file => {
        const icon = getFileIcon(file.fileType);
        const desc = data.msgDescriptions && data.msgDescriptions[file.name] 
            ? data.msgDescriptions[file.name] 
            : '';
        const isAudio = file.fileType === 'WAV' || file.fileType === 'MP3';
        
        html += `
            <tr>
                <td>${icon}</td>
                <td>${file.name}</td>
                <td>${formatFileSize(file.size)}</td>
                <td>${file.durationStr || '-'}</td>
                <td>${file.mtime || '-'}</td>
                <td>${desc}</td>
                <td>
                    ${isAudio ? `
                        <button class="table-action-btn play-btn" onclick="playAudioFile('${file.what}', '${file.name}')" title="הפעל">
                            <i class="fas fa-play"></i>
                        </button>
                    ` : ''}
                    <button class="table-action-btn view-btn" onclick="viewFile('${file.what}', '${file.fileType}')" title="צפה">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    
    if (!data.dirs?.length && allFiles.length === 0) {
        html = '<div class="loading">התיקייה ריקה</div>';
    }
    
    return html;
}

// קבלת אייקון לפי סוג קובץ
function getFileIcon(fileType) {
    const icons = {
        'WAV': '<i class="fas fa-volume-up" style="color: #4caf50;"></i>',
        'MP3': '<i class="fas fa-music" style="color: #9c27b0;"></i>',
        'INI': '<i class="fas fa-cog" style="color: #ff9800;"></i>',
        'HTML': '<i class="fas fa-file-code" style="color: #2196f3;"></i>',
        'TXT': '<i class="fas fa-file-alt" style="color: #607d8b;"></i>',
        'PDF': '<i class="fas fa-file-pdf" style="color: #f44336;"></i>'
    };
    return icons[fileType] || '<i class="fas fa-file" style="color: #9e9e9e;"></i>';
}

// פורמט גודל קובץ
function formatFileSize(bytes) {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// הצגת קובץ
async function viewFile(path, fileType) {
    if (fileType === 'INI' || fileType === 'TXT' || fileType === 'HTML') {
        try {
            const params = new URLSearchParams({
                token: TOKEN,
                what: path
            });
            
            const response = await fetch(`${API_BASE_URL}GetTextFile?${params}`);
            const data = await response.json();
            
            if (data.responseStatus === 'SUCCESS') {
                alert('תוכן הקובץ:\n\n' + data.contents);
            } else {
                alert('שגיאה בטעינת הקובץ');
            }
        } catch (error) {
            alert('שגיאה: ' + error.message);
        }
    } else {
        alert('פתיחת קובץ: ' + path + '\nסוג: ' + fileType);
    }
}

// הצגת טעינה
function showLoading() {
    document.getElementById('content').innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> טוען...</div>';
}

// הצגת שגיאה
function showError(message) {
    document.getElementById('content').innerHTML = `
        <div style="background: linear-gradient(135deg, rgba(255, 235, 238, 0.98) 0%, rgba(255, 245, 245, 0.98) 100%); 
                    backdrop-filter: blur(10px); 
                    padding: 2rem; 
                    border-radius: 15px; 
                    box-shadow: 0 4px 20px rgba(244, 67, 54, 0.15); 
                    border: 2px solid rgba(244, 67, 54, 0.2); 
                    text-align: center;
                    color: #c62828;
                    font-weight: 600;">
            <i class="fas fa-exclamation-triangle" style="font-size: 2em; margin-bottom: 1rem; color: #f44336;"></i>
            <div>${message}</div>
        </div>
    `;
}


// טעינת עץ תיקיות לסרגל צד
async function loadSidebarTree() {
    const sidebar = document.getElementById('sidebarTree');
    
    try {
        const params = new URLSearchParams({
            token: TOKEN,
            path: 'ivr2:/',
            orderBy: 'name',
            orderDir: 'asc'
        });

        const response = await fetch(`${API_BASE_URL}GetIVR2Dir?${params}`);
        const data = await response.json();
        
        if (data.responseStatus === 'SUCCESS' || data.responseStatus === 'OK') {
            renderSidebarTree(data.dirs || []);
        } else {
            sidebar.innerHTML = '<div style="padding: 1rem; color: #c62828; text-align: center;">שגיאה בטעינת העץ</div>';
        }
    } catch (error) {
        console.error('Error loading sidebar tree:', error);
        sidebar.innerHTML = '<div style="padding: 1rem; color: #c62828; text-align: center;">שגיאה בטעינה</div>';
    }
}

// הצגת עץ תיקיות
function renderSidebarTree(dirs) {
    const sidebar = document.getElementById('sidebarTree');
    
    if (!dirs || dirs.length === 0) {
        sidebar.innerHTML = '<div style="padding: 1rem; color: #5a6c57; text-align: center;">אין תיקיות</div>';
        return;
    }
    
    const html = dirs.map(dir => {
        const isActive = currentPath === dir.what;
        const badge = dir.extType ? `<span class="tree-item-badge">${dir.extType}</span>` : '';
        
        return `
            <div class="tree-item ${isActive ? 'active' : ''}" onclick="loadDirectory('${dir.what}')">
                <i class="fas fa-folder"></i>
                <span class="tree-item-name" title="${dir.name}">${dir.name}</span>
                ${badge}
            </div>
        `;
    }).join('');
    
    sidebar.innerHTML = html;
}

// עדכון הסרגל הצדי כשמשנים תיקייה
function updateSidebarActive() {
    document.querySelectorAll('.tree-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeItem = Array.from(document.querySelectorAll('.tree-item')).find(item => {
        const onclick = item.getAttribute('onclick');
        return onclick && onclick.includes(currentPath);
    });
    
    if (activeItem) {
        activeItem.classList.add('active');
    }
}


// פתיחת חלון יצירת שלוחה
function showCreateExtensionDialog() {
    const modal = document.getElementById('createExtensionModal');
    modal.classList.add('show');
    
    // איפוס שדות
    document.getElementById('extNumber').value = '';
    document.getElementById('extType').value = '';
    document.getElementById('extTitle').value = '';
    document.getElementById('extEnterId').value = 'no';
}

// פתיחת חלון העלאת קובץ
function showUploadDialog() {
    const modal = document.getElementById('uploadModal');
    modal.classList.add('show');
    
    // הצגת הנתיב הנוכחי
    document.getElementById('currentPathDisplay').textContent = currentPath;
    
    // איפוס שדות
    document.getElementById('uploadFileName').value = '';
    document.getElementById('uploadFileContent').value = '';
}

// סגירת מודל
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
}

// סגירת מודל בלחיצה מחוץ לתוכן
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
    }
}

// יצירת שלוחה חדשה
async function createExtension() {
    const extNumber = document.getElementById('extNumber').value.trim();
    const extType = document.getElementById('extType').value;
    const extTitle = document.getElementById('extTitle').value.trim();
    const extEnterId = document.getElementById('extEnterId').value;
    
    // בדיקת שדות חובה
    if (!extNumber || !extType || !extTitle) {
        alert('נא למלא את כל השדות החובה');
        return;
    }
    
    // בדיקת תקינות מספר שלוחה
    if (!/^\d+$/.test(extNumber)) {
        alert('מספר שלוחה חייב להכיל ספרות בלבד');
        return;
    }
    
    const params = new URLSearchParams({
        token: TOKEN,
        path: `ivr2:${extNumber}`,
        type: extType,
        title: extTitle,
        enter_id: extEnterId
    });
    
    const url = `${API_BASE_URL}UpdateExtension?${params}`;
    console.log('🔄 Creating extension:', url);
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('📦 Response:', data);
        
        if (data.responseStatus === 'SUCCESS' || data.responseStatus === 'OK') {
            alert(`✅ שלוחה ${extNumber} נוצרה בהצלחה!`);
            closeModal('createExtensionModal');
            
            // רענון הדף והסרגל הצדי
            await loadSidebarTree();
            await loadDirectory();
        } else {
            const errorMsg = data.message || data.exceptionMessage || 'שגיאה לא ידועה';
            alert('❌ שגיאה ביצירת שלוחה: ' + errorMsg);
        }
    } catch (error) {
        console.error('❌ Error:', error);
        alert('❌ שגיאת תקשורת: ' + error.message);
    }
}

// העלאת קובץ טקסט
async function uploadFile() {
    const fileName = document.getElementById('uploadFileName').value.trim();
    const fileContent = document.getElementById('uploadFileContent').value;
    
    // בדיקת שדות חובה
    if (!fileName || !fileContent) {
        alert('נא למלא את כל השדות');
        return;
    }
    
    // בניית הנתיב המלא
    const fullPath = `${currentPath}/${fileName}`;
    
    const params = new URLSearchParams({
        token: TOKEN,
        what: fullPath,
        contents: fileContent
    });
    
    const url = `${API_BASE_URL}UploadTextFile?${params}`;
    console.log('🔄 Uploading file:', fullPath);
    
    try {
        const response = await fetch(url, {
            method: 'POST'
        });
        const data = await response.json();
        
        console.log('📦 Response:', data);
        
        if (data.responseStatus === 'SUCCESS' || data.responseStatus === 'OK') {
            alert(`✅ הקובץ "${fileName}" הועלה בהצלחה!`);
            closeModal('uploadModal');
            
            // רענון התיקייה הנוכחית
            await loadDirectory();
        } else {
            const errorMsg = data.message || data.exceptionMessage || 'שגיאה לא ידועה';
            alert('❌ שגיאה בהעלאת קובץ: ' + errorMsg);
        }
    } catch (error) {
        console.error('❌ Error:', error);
        alert('❌ שגיאת תקשורת: ' + error.message);
    }
}

// סגירת מודל עם ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
        });
    }
});


// הפעלת קובץ שמע
function playAudioFile(filePath, fileName) {
    console.log('🎵 Playing audio:', filePath);
    
    // בניית URL להורדת הקובץ
    const downloadUrl = `${API_BASE_URL}DownloadFile?token=${TOKEN}&path=${encodeURIComponent(filePath)}`;
    console.log('📡 Audio URL:', downloadUrl);
    
    // פתיחת המודל
    const modal = document.getElementById('audioPlayerModal');
    modal.classList.add('show');
    
    // עדכון פרטי הקובץ
    document.getElementById('audioFileName').textContent = fileName;
    document.getElementById('audioFilePath').textContent = filePath;
    
    // הגדרת מקור השמע
    const audioPlayer = document.getElementById('audioPlayer');
    const audioSource = document.getElementById('audioSource');
    
    // זיהוי סוג הקובץ
    const fileExt = fileName.split('.').pop().toLowerCase();
    if (fileExt === 'mp3') {
        audioSource.type = 'audio/mpeg';
    } else if (fileExt === 'wav') {
        audioSource.type = 'audio/wav';
    } else {
        audioSource.type = 'audio/mpeg'; // ברירת מחדל
    }
    
    audioSource.src = downloadUrl;
    audioPlayer.load();
    
    // ניסיון להפעיל אוטומטית
    audioPlayer.play().then(() => {
        console.log('✅ Audio playing');
    }).catch(error => {
        console.log('⚠️ Auto-play prevented (click play button):', error);
    });
}

// עצירת השמע
function stopAudio() {
    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
}
