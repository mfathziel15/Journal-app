let notes = JSON.parse(localStorage.getItem('pro_notes_v2')) || [];
let routines = JSON.parse(localStorage.getItem('pro_routines_v2')) || [];
let deferredPrompt;

const categoryColors = {
    'Pribadi': 'bg-primary bg-opacity-10 text-primary',
    'Pekerjaan': 'bg-danger bg-opacity-10 text-danger',
    'Ide': 'bg-success bg-opacity-10 text-success',
    'Belajar': 'bg-info bg-opacity-10 text-info'
};

document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 60000);
    
    document.getElementById('btnSaveNote').addEventListener('click', saveNote);
    document.getElementById('routineForm').addEventListener('submit', function(e) {
        e.preventDefault(); saveRoutine();
    });
    document.getElementById('btnNotif').addEventListener('click', requestNotificationPermission);
    
    // Fitur Search untuk semua view
    document.querySelectorAll('.searchInput').forEach(input => {
        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            renderNotes(query);
            renderRoutines(query);
            if(query !== '') {
                // Auto switch ke notes saat ngetik kalo lagi di dashboard
                if(document.getElementById('view-dashboard').classList.contains('active')) {
                    switchView('notes');
                }
            }
        });
    });
    
    // Sidebar Toggle
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const openBtn = document.getElementById('openSidebarBtn');
    const closeBtn = document.getElementById('closeSidebarBtn');

    window.toggleSidebar = function() {
        sidebar.classList.toggle('show');
        overlay.classList.toggle('show');
    }

    if(openBtn) openBtn.addEventListener('click', toggleSidebar);
    if(closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if(overlay) overlay.addEventListener('click', toggleSidebar); 
    
    renderNotes();
    renderRoutines();
    updateStats();
    
    // PWA AUTO PROMPT LOGIC
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        // Tampilkan banner otomatis dari bawah setelah 1 detik web diload
        setTimeout(() => {
            const banner = document.getElementById('autoInstallBanner');
            banner.classList.remove('d-none');
            // Sedikit delay agar transisi CSS berjalan
            setTimeout(() => {
                banner.style.transform = 'translateY(0)';
            }, 50);
        }, 1000);
    });

    const btnAutoInstall = document.getElementById('btnAutoInstall');
    if(btnAutoInstall) {
        btnAutoInstall.addEventListener('click', async (e) => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    closeInstallBanner();
                }
                deferredPrompt = null;
            }
        });
    }
    
    if ('serviceWorker' in navigator) {
        const swPath = window.location.pathname.includes('index.html') 
            ? window.location.pathname.replace('index.html', 'sw.js') 
            : window.location.pathname + (window.location.pathname.endsWith('/') ? 'sw.js' : '/sw.js');
        navigator.serviceWorker.register(swPath).catch(() => {});
    }
});

// View Switcher (SPA Logic)
window.switchView = function(viewName) {
    document.querySelectorAll('.view-section').forEach(el => {
        el.classList.add('d-none');
        el.classList.remove('active');
    });
    const target = document.getElementById(`view-${viewName}`);
    target.classList.remove('d-none');
    target.classList.add('active');
    
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`nav-${viewName}`).classList.add('active');
    
    if (window.innerWidth <= 768) {
        toggleSidebar(); 
    }
}

window.closeInstallBanner = function() {
    const banner = document.getElementById('autoInstallBanner');
    banner.style.transform = 'translateY(100%)';
    setTimeout(() => { banner.classList.add('d-none'); }, 400);
}

function updateClock() {
    const now = new Date();
    document.getElementById('currentDate').innerText = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('currentTime').innerText = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function updateStats() {
    document.getElementById('statNotes').innerText = notes.length;
    const now = new Date().getTime();
    document.getElementById('statRoutines').innerText = routines.filter(r => new Date(r.time).getTime() > now).length;
}

function showToast(title, message, type = 'primary') {
    const toastContainer = document.getElementById('toastContainer');
    const toastId = 'toast-' + Date.now();
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-bg-${type} border-0 mb-2 shadow-lg" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body"><strong>${title}</strong><br>${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>`;
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    const toast = new bootstrap.Toast(document.getElementById(toastId), { delay: 3000 });
    toast.show();
    setTimeout(() => document.getElementById(toastId).remove(), 4000);
}

// ================= NOTES LOGIC (CREATE & EDIT) =================
const noteModalObj = () => new bootstrap.Modal(document.getElementById('noteModal'));

window.openNoteModal = function(id = null) {
    const titleEl = document.getElementById('noteTitle');
    const contentEl = document.getElementById('noteContent');
    const catEl = document.getElementById('noteCategory');
    const idEl = document.getElementById('editNoteId');
    const modalTitle = document.getElementById('noteModalTitle');
    
    if(id) {
        modalTitle.innerText = "Edit Catatan";
        const note = notes.find(n => n.id === id);
        if(note) {
            titleEl.value = note.title;
            contentEl.value = note.content;
            catEl.value = note.category;
            idEl.value = note.id;
        }
    } else {
        modalTitle.innerText = "Buat Catatan Baru";
        titleEl.value = ''; contentEl.value = ''; catEl.value = 'Pribadi'; idEl.value = '';
    }
    
    noteModalObj().show();
}

function saveNote() {
    const title = document.getElementById('noteTitle').value;
    const content = document.getElementById('noteContent').value;
    const category = document.getElementById('noteCategory').value;
    const id = document.getElementById('editNoteId').value;
    
    if(!title || !content) { showToast('Gagal', 'Judul/Isi tidak boleh kosong!', 'danger'); return; }
    
    if(id) {
        // Edit existing
        const noteIndex = notes.findIndex(n => n.id == id);
        if(noteIndex > -1) {
            notes[noteIndex].title = title;
            notes[noteIndex].content = content;
            notes[noteIndex].category = category;
            showToast('Diperbarui', 'Catatan berhasil diubah.', 'success');
        }
    } else {
        // Create new
        notes.unshift({
            id: Date.now(), title, content, category,
            date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
        });
        showToast('Berhasil', 'Catatan baru disimpan.', 'success');
    }
    
    localStorage.setItem('pro_notes_v2', JSON.stringify(notes));
    renderNotes(); updateStats();
}

window.deleteNote = function(id) {
    if(confirm('Hapus catatan permanen?')) {
        notes = notes.filter(n => n.id !== id);
        localStorage.setItem('pro_notes_v2', JSON.stringify(notes));
        renderNotes(); updateStats(); showToast('Dihapus', 'Catatan telah dihapus.', 'secondary');
    }
}

function renderNotes(searchQuery = '') {
    const container = document.getElementById('notesContainer');
    container.innerHTML = '';
    const filteredNotes = notes.filter(note => note.title.toLowerCase().includes(searchQuery) || note.content.toLowerCase().includes(searchQuery));
    if (filteredNotes.length === 0) {
        container.innerHTML = `<div class="col-12 text-center py-5 text-muted"><i class="fas fa-folder-open fs-1 mb-3 opacity-50"></i><p>Tidak ada catatan.</p></div>`; return;
    }
    filteredNotes.forEach(note => {
        const badgeColor = categoryColors[note.category] || categoryColors['Pribadi'];
        container.innerHTML += `
            <div class="col-md-6">
                <div class="card note-card h-100 p-3 p-md-4 shadow-sm border-0 position-relative">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="badge-category ${badgeColor}">${note.category}</span>
                        <div class="dropdown">
                            <button class="btn btn-sm text-muted border-0 bg-transparent p-0" type="button" data-bs-toggle="dropdown"><i class="fas fa-ellipsis-v"></i></button>
                            <ul class="dropdown-menu dropdown-menu-end border-0 shadow-sm">
                                <li><a class="dropdown-item" href="#" onclick="openNoteModal(${note.id})"><i class="fas fa-edit me-2 text-primary"></i>Edit</a></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="deleteNote(${note.id})"><i class="fas fa-trash me-2"></i>Hapus</a></li>
                            </ul>
                        </div>
                    </div>
                    <h5 class="note-title mt-2 mb-1">${note.title}</h5>
                    <small class="text-muted mb-3 d-block"><i class="fas fa-calendar-alt me-1"></i>${note.date}</small>
                    <p class="note-content m-0" style="white-space:pre-wrap;">${note.content}</p>
                </div>
            </div>`;
    });
}

// ================= ROUTINE LOGIC (CREATE & EDIT) =================
const routineModalObj = () => new bootstrap.Modal(document.getElementById('routineModal'));

window.openRoutineModal = function(id = null) {
    const titleEl = document.getElementById('routineTitle');
    const timeEl = document.getElementById('routineTime');
    const idEl = document.getElementById('editRoutineId');
    const modalTitle = document.getElementById('routineModalTitle');
    
    if(id) {
        modalTitle.innerText = "Edit Agenda";
        const routine = routines.find(r => r.id === id);
        if(routine) {
            titleEl.value = routine.title;
            timeEl.value = routine.time;
            idEl.value = routine.id;
        }
    } else {
        modalTitle.innerText = "Tambah Agenda Baru";
        titleEl.value = ''; timeEl.value = ''; idEl.value = '';
    }
    
    routineModalObj().show();
}

function saveRoutine() {
    const title = document.getElementById('routineTitle').value;
    const time = document.getElementById('routineTime').value;
    const id = document.getElementById('editRoutineId').value;
    
    if(!title || !time) return;
    
    if(id) {
        const idx = routines.findIndex(r => r.id == id);
        if(idx > -1) {
            routines[idx].title = title;
            routines[idx].time = time;
            routines[idx].notified = false; // Reset notif jika waktu diubah
            showToast('Diperbarui', 'Agenda berhasil diubah.', 'success');
        }
    } else {
        routines.push({ id: Date.now(), title, time, notified: false });
        showToast('Alarm Disetel', 'Agenda ditambahkan.', 'success');
    }
    
    routines.sort((a, b) => new Date(a.time) - new Date(b.time)); 
    localStorage.setItem('pro_routines_v2', JSON.stringify(routines));
    renderRoutines(); updateStats();
}

window.deleteRoutine = function(id) {
    if(confirm('Hapus agenda ini?')) {
        routines = routines.filter(r => r.id !== id);
        localStorage.setItem('pro_routines_v2', JSON.stringify(routines));
        renderRoutines(); updateStats(); showToast('Dihapus', 'Agenda dibatalkan.', 'secondary');
    }
}

function renderRoutines(searchQuery = '') {
    const containerFull = document.getElementById('routinesContainer');
    const containerDash = document.getElementById('dashboardActiveRoutines');
    
    containerFull.innerHTML = ''; 
    containerDash.innerHTML = '';
    
    const now = new Date().getTime();
    const filteredRoutines = routines.filter(r => r.title.toLowerCase().includes(searchQuery));
    
    if (filteredRoutines.length === 0) { 
        const emptyMsg = `<div class="text-center py-4 text-muted small"><i class="fas fa-check-circle fs-2 mb-2 opacity-25"></i><br>Tidak ada agenda.</div>`;
        containerFull.innerHTML = emptyMsg; 
        containerDash.innerHTML = emptyMsg;
        return; 
    }
    
    let dashboardCount = 0;

    filteredRoutines.forEach(routine => {
        const dateObj = new Date(routine.time);
        const isPast = dateObj.getTime() < now;
        const opacity = isPast ? 'opacity-50' : '';
        const fDate = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        const fTime = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        
        const htmlCard = `
            <div class="routine-item p-3 border-0 shadow-sm d-flex justify-content-between align-items-center ${opacity}">
                <div>
                    <h6 class="mb-1 fw-bold text-dark ${isPast ? 'text-decoration-line-through' : ''}">${routine.title}</h6>
                    <span class="routine-time-badge"><i class="fas fa-clock me-1"></i>${fDate}, ${fTime}</span>
                </div>
                <div>
                    <button class="btn btn-sm text-primary border-0 bg-transparent p-2 me-1" onclick="openRoutineModal(${routine.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm text-danger border-0 bg-transparent p-2" onclick="deleteRoutine(${routine.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
            
        containerFull.innerHTML += htmlCard;
        
        // Hanya tampilkan max 4 agenda yang belum lewat di Dashboard
        if(!isPast && dashboardCount < 4) {
            containerDash.innerHTML += htmlCard;
            dashboardCount++;
        }
    });
    
    if (dashboardCount === 0) {
        containerDash.innerHTML = `<div class="text-center py-4 text-muted small">Semua agenda hari ini telah selesai.</div>`;
    }
}

function requestNotificationPermission() {
    if (Notification.permission !== 'granted') {
        Notification.requestPermission().then(p => { if (p === 'granted') showToast('Akses Diberikan', 'Notifikasi aktif!', 'success'); });
    } else showToast('Info', 'Notifikasi sudah aktif.', 'info');
}

setInterval(() => {
    const now = new Date().getTime(); let requiresUpdate = false;
    routines.forEach(routine => {
        if (now >= new Date(routine.time).getTime() && !routine.notified) {
            if (Notification.permission === 'granted') new Notification("Alarm ProJournal", { body: routine.title });
            showToast('⏰ ALARM!', routine.title, 'warning');
            routine.notified = true; requiresUpdate = true;
        }
    });
    if(requiresUpdate) { localStorage.setItem('pro_routines_v2', JSON.stringify(routines)); renderRoutines(); updateStats(); }
}, 1000);
