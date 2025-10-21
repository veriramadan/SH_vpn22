// script.js (v4.0 - Final, User-Friendly)

document.addEventListener('DOMContentLoaded', function() {
    // --- PENGATURAN ---
    const PROXY_LIST_URL = 'https://raw.githubusercontent.com/FoolVPN-ID/Nautica/main/proxyList.txt';

    // --- Referensi Elemen DOM ---
    const serverListContainer = document.getElementById('server-list');
    const countryFilter = document.getElementById('country-filter');
    const searchInput = document.getElementById('search-input');
    const selectedCountBtn = document.getElementById('selected-count-btn');
    const ispInfo = document.getElementById('isp-info');
    const locationInfo = document.getElementById('location-info');
    const settingsBtn = document.getElementById('settings-btn');
    const exportBtn = document.getElementById('export-btn');
    const modalOverlay = document.getElementById('settings-modal-overlay');
    const settingsDoneBtn = document.getElementById('settings-done-btn');

    const bugCdnInput = document.getElementById('bug-cdn-input');
    const workerHostInput = document.getElementById('worker-host-input');
    const uuidInput = document.getElementById('uuid-input');
    const protocolSelect = document.getElementById('protocol-select');
    const tlsSelect = document.getElementById('tls-select');
    
    // --- State Aplikasi ---
    let allServers = [];
    let selectedServers = new Set();
    let isShowingOnlySelected = false;

    // =======================================================
    // FUNGSI INTI & PEMBANTU
    // =======================================================

    /**
     * [UPGRADE] Fungsi untuk membuat UUID v4 secara acak.
     */
    function generateUUIDv4() {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    /**
     * [UPGRADE] Fungsi untuk menampilkan notifikasi toast.
     */
    function showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '90px'; // Di atas footer
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = isError ? 'var(--danger-color)' : 'var(--primary-green)';
        toast.style.color = 'var(--text-dark)';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '8px';
        toast.style.zIndex = '3000';
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        
        document.body.appendChild(toast);
        
        // Animasi fade-in dan fade-out
        setTimeout(() => { toast.style.opacity = '1'; }, 10);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => { document.body.removeChild(toast); }, 300);
        }, 2700);
    }

    async function initializeApp() {
        detectUserInfo();
        
        // [UPGRADE] Panggil fungsi untuk mengisi input dari URL & generate UUID
        populateSettingsFromUrl();
        
        try {
            serverListContainer.innerHTML = '<p>Mengunduh daftar server...</p>';
            const response = await fetch(PROXY_LIST_URL);
            if (!response.ok) throw new Error(`Gagal mengunduh daftar: ${response.statusText}`);
            const textData = await response.text();
            allServers = parseProxyList(textData);
            populateCountryFilter(allServers);
            renderServers(allServers);
        } catch (error) {
            console.error("Initialization Error:", error);
            serverListContainer.innerHTML = `<p style="color: var(--danger-color);">Gagal memuat data server. <br><small>${error.message}</small></p>`;
        }
    }

    function parseProxyList(text) {
        return text.trim().split('\n').map(line => {
            const parts = line.split(',');
            if (parts.length < 4) return null;
            return {
                id: `${parts[0].trim()}:${parts[1].trim()}`, // Buat ID unik
                ip: parts[0].trim(),
                port: parts[1].trim(),
                country_code: parts[2].trim(),
                provider: parts[3].trim()
            };
        }).filter(Boolean);
    }

    function populateCountryFilter(servers) {
        const countries = [...new Set(servers.map(s => s.country_code))].sort();
        countries.forEach(code => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = code;
            countryFilter.appendChild(option);
        });
    }

    function renderServers(serversToRender) {
        serverListContainer.innerHTML = '';
        if (serversToRender.length === 0) {
            serverListContainer.innerHTML = '<p>Tidak ada server yang ditemukan.</p>';
            return;
        }

        const groupedByProvider = serversToRender.reduce((acc, server) => {
            (acc[server.provider] = acc[server.provider] || []).push(server);
            return acc;
        }, {});

        for (const provider in groupedByProvider) {
            const groupTitle = document.createElement('h3');
            groupTitle.className = 'server-group-title';
            groupTitle.textContent = provider;
            serverListContainer.appendChild(groupTitle);
            
            groupedByProvider[provider].forEach(server => {
                const card = document.createElement('div');
                card.className = 'server-card';
                card.dataset.serverId = server.id;
                if (selectedServers.has(server.id)) {
                    card.classList.add('selected');
                }

                card.innerHTML = `
                    <div class="server-details">
                        <p class="provider">
                            <img src="https://flagcdn.com/16x12/${server.country_code.toLowerCase()}.png" alt="${server.country_code}">
                            ${server.provider}
                        </p>
                        <p class="address">${server.ip}:${server.port}</p>
                    </div>
                    <span class="ping-badge">...</span>
                `;
                card.addEventListener('click', () => toggleServerSelection(card, server.id));
                serverListContainer.appendChild(card);
            });
        }
    }

    // =======================================================
    // FUNGSI INTERAKTIVITAS
    // =======================================================

    function toggleServerSelection(cardElement, serverId) {
        if (selectedServers.has(serverId)) {
            selectedServers.delete(serverId);
            cardElement.classList.remove('selected');
        } else {
            selectedServers.add(serverId);
            cardElement.classList.add('selected');
        }
        updateSelectedCount();

        // Jika kita sedang dalam mode "hanya tampilkan yang dipilih" dan pengguna membatalkan pilihan terakhir,
        // kembali ke mode "tampilkan semua".
        if (isShowingOnlySelected && selectedServers.size === 0) {
            isShowingOnlySelected = false;
            applyAllFilters();
        }
    }

    function updateSelectedCount() {
        selectedCountBtn.textContent = `${selectedServers.size} proxies`;
    }

    /**
     * Fungsi utama yang menerapkan semua filter (pencarian, negara)
     */
    function applyAllFilters() {
        const query = searchInput.value.toLowerCase();
        const selectedCountry = countryFilter.value;
        
        let serversToDisplay = allServers;

        // Terapkan filter berdasarkan mode tampilan (semua atau hanya yang dipilih)
        if (isShowingOnlySelected) {
            serversToDisplay = allServers.filter(s => selectedServers.has(s.id));
        }

        // Terapkan filter negara
        if (selectedCountry !== 'all') {
            serversToDisplay = serversToDisplay.filter(s => s.country_code === selectedCountry);
        }

        // Terapkan filter pencarian
        if (query) {
            serversToDisplay = serversToDisplay.filter(s => 
                s.provider.toLowerCase().includes(query) ||
                s.country_code.toLowerCase().includes(query) ||
                s.ip.includes(query)
            );
        }
        
        renderServers(serversToDisplay);
    }

    /**
     * [UPGRADE] Mendeteksi info pengguna menggunakan API HTTPS.
     */
    async function detectUserInfo() {
        try {
            // Menggunakan API https://ipinfo.io yang lebih andal
            const response = await fetch('https://ipinfo.io/json?token=YOUR_OPTIONAL_TOKEN');
            if (!response.ok) throw new Error('Response not OK');
            const data = await response.json();
            ispInfo.textContent = data.org || 'N/A';
            locationInfo.textContent = `${data.city || ''}, ${data.country || ''}`;
        } catch (error) {
            console.warn("Gagal mendeteksi info pengguna:", error);
            ispInfo.textContent = 'N/A';
            locationInfo.textContent = 'N/A';
        }
    }
    
    // =======================================================
    // FUNGSI EXPORT & MODAL (YANG DI-UPGRADE)
    // =======================================================
    
    /**
     * [UPGRADE] Mengambil nilai dari URL dan mengisi input Settings.
     */
    function populateSettingsFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const hostFromUrl = urlParams.get('host');

        if (hostFromUrl) {
            workerHostInput.value = hostFromUrl;
        }

        // Generate dan isi UUID jika kosong
        if (!uuidInput.value) {
            uuidInput.value = generateUUIDv4();
        }
    }

    function exportProxies() {
        if (selectedServers.size === 0) {
            showToast("Pilih setidaknya satu server!", true);
            return;
        }

        const bugCdn = bugCdnInput.value.trim();
        const workerHost = workerHostInput.value.trim();
        const uuid = uuidInput.value.trim();
        if (!bugCdn || !workerHost || !uuid) {
            showToast("Harap isi semua kolom di Settings.", true);
            openSettingsModal();
            return;
        }
        
        let outputUris = [];
        selectedServers.forEach(serverId => {
            const server = allServers.find(s => s.id === serverId);
            if (server) {
                const path = `/${server.ip}-${server.port}`;
                const name = `${server.country_code} ${server.provider} [${server.ip}]`;
                const useTls = tlsSelect.value === 'true';
                
                const uri = `${protocolSelect.value}://${uuid}@${bugCdn}:${useTls ? 443 : 80}` +
                            `?encryption=none&type=ws` +
                            `&host=${workerHost}` +
                            `&security=${useTls ? 'tls' : 'none'}` +
                            `&sni=${workerHost}` +
                            `&path=${encodeURIComponent(path)}` +
                            `#${encodeURIComponent(name)}`;
                outputUris.push(uri);
            }
        });

        // [UPGRADE] Salin ke clipboard dan tampilkan toast
        const resultString = outputUris.join('\n');
        navigator.clipboard.writeText(resultString).then(() => {
            showToast("Konfigurasi berhasil disalin!");
        }).catch(err => {
            console.error('Gagal menyalin: ', err);
            showToast("Gagal menyalin ke clipboard.", true);
        });
    }

    function openSettingsModal() { modalOverlay.classList.add('visible'); }
    function closeSettingsModal() { modalOverlay.classList.remove('visible'); }
    
    // =======================================================
    // EVENT LISTENERS
    // =======================================================
    
    countryFilter.addEventListener('change', applyAllFilters);
    searchInput.addEventListener('input', applyAllFilters);

    // --- LOGIKA BARU: Event listener untuk tombol penghitung ---
    selectedCountBtn.addEventListener('click', () => {
        // Jika tidak ada server yang dipilih, jangan lakukan apa-apa
        if (selectedServers.size === 0) return;
        
        // Ubah state
        isShowingOnlySelected = !isShowingOnlySelected;
        
        // Terapkan semua filter lagi dengan state yang baru
        applyAllFilters();
        
        // Beri feedback visual pada tombol
        if (isShowingOnlySelected) {
            selectedCountBtn.style.backgroundColor = 'var(--primary-green)';
            selectedCountBtn.style.color = 'var(--text-dark)';
        } else {
            selectedCountBtn.style.backgroundColor = '';
            selectedCountBtn.style.color = '';
        }
    });
    
    settingsBtn.addEventListener('click', openSettingsModal);
    settingsDoneBtn.addEventListener('click', closeSettingsModal);
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) closeSettingsModal();
    });
    exportBtn.addEventListener('click', exportProxies);
    
    // Jalankan aplikasi
    initializeApp();
});