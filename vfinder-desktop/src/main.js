const { convertFileSrc } = window.__TAURI__.core;
const dialog = window.__TAURI__.dialog;

// DOM Elements
const navSearch = document.getElementById('nav-search');
const navDb = document.getElementById('nav-db');
const navIngest = document.getElementById('nav-ingest');
const navSettings = document.getElementById('nav-settings');

const viewSearch = document.getElementById('view-search');
const viewDb = document.getElementById('view-db');
const viewIngest = document.getElementById('view-ingest');
const viewSettings = document.getElementById('view-settings');

const searchInput = document.getElementById('search-input');
const resultsContainer = document.getElementById('results');
const btnSelectFile = document.getElementById('btn-select-file');
const ingestStatus = document.getElementById('ingest-status');
const dbStatsText = document.getElementById('stats-text');
const dbStatsDot = document.querySelector('.status-dot');

const dbTbody = document.getElementById('db-tbody');
const btnRefreshDb = document.getElementById('btn-refresh-db');
const filterBar = document.getElementById('filter-bar');
const dropZone = document.getElementById('drop-zone');

// Progress bar elements
const ingestProgress = document.getElementById('ingest-progress');
const progressLabel = document.getElementById('progress-label');
const progressCount = document.getElementById('progress-count');
const progressFill = document.getElementById('progress-fill');
const progressCurrentFile = document.getElementById('progress-current-file');

// Settings elements
const settingsApiKey = document.getElementById('settings-api-key');
const settingsDataDir = document.getElementById('settings-data-dir');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnToggleKey = document.getElementById('btn-toggle-key');
const settingsStatus = document.getElementById('settings-status');

let searchTimeout;
let progressPollInterval = null;
let activeFilter = '';
const API_URL = 'http://127.0.0.1:32034';

// ─── Open File in macOS ─────────────────────────────────────────────
async function openFile(filePath) {
  if (!filePath) return;
  try {
    await fetch(`${API_URL}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath })
    });
  } catch (e) {
    console.error("Could not open file:", e);
  }
}

// ─── Daemon Health Ping ─────────────────────────────────────────────
async function pingDaemon() {
  try {
    const res = await fetch(`${API_URL}/stats`);
    if (res.ok) {
      const data = await res.json();
      dbStatsDot.classList.remove('error');
      const cacheLabel = data.cache_hits !== undefined ? ` · Cache ${data.cache_hits}/${data.cache_hits + data.cache_misses}` : '';
      dbStatsText.textContent = `${data.count || 0} Memories${cacheLabel}`;
    } else {
      throw new Error("Bad response");
    }
  } catch (err) {
    dbStatsDot.classList.add('error');
    dbStatsText.textContent = "Daemon Disconnected";
    setTimeout(pingDaemon, 3000);
  }
}

// ─── Navigation ─────────────────────────────────────────────────────
const allNavs = [navSearch, navDb, navIngest, navSettings];
const allViews = [viewSearch, viewDb, viewIngest, viewSettings];

function switchView(viewName) {
  allNavs.forEach(n => n.classList.remove('active'));
  allViews.forEach(v => v.classList.remove('active-view'));

  if (viewName === 'search') {
    navSearch.classList.add('active');
    viewSearch.classList.add('active-view');
    searchInput.focus();
  } else if (viewName === 'db') {
    navDb.classList.add('active');
    viewDb.classList.add('active-view');
    loadDbList();
  } else if (viewName === 'ingest') {
    navIngest.classList.add('active');
    viewIngest.classList.add('active-view');
  } else if (viewName === 'settings') {
    navSettings.classList.add('active');
    viewSettings.classList.add('active-view');
    loadSettings();
  }
}

navSearch.addEventListener('click', () => switchView('search'));
navDb.addEventListener('click', () => switchView('db'));
navIngest.addEventListener('click', () => switchView('ingest'));
navSettings.addEventListener('click', () => switchView('settings'));

// ─── Keyboard Shortcuts ─────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  const isMeta = e.metaKey || e.ctrlKey;
  
  if (isMeta && e.key === '1') { e.preventDefault(); switchView('search'); }
  if (isMeta && e.key === '2') { e.preventDefault(); switchView('db'); }
  if (isMeta && e.key === '3') { e.preventDefault(); switchView('ingest'); }
  if (isMeta && e.key === ',') { e.preventDefault(); switchView('settings'); }
  if (isMeta && (e.key === 'k' || e.key === 'f')) {
    e.preventDefault();
    switchView('search');
    searchInput.focus();
    searchInput.select();
  }
  if (e.key === 'Escape') {
    searchInput.value = '';
    resultsContainer.innerHTML = '<div class="placeholder-state"><p>Start typing to explore your multimodal memory.</p></div>';
    searchInput.blur();
  }
});

// ─── Search Filters ─────────────────────────────────────────────────
filterBar.addEventListener('click', (e) => {
  const pill = e.target.closest('.filter-pill');
  if (!pill) return;
  
  filterBar.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');
  activeFilter = pill.dataset.filter;
  
  const query = searchInput.value.trim();
  if (query) performSearch(query);
});

// ─── Search ─────────────────────────────────────────────────────────
async function performSearch(query) {
  if (!query.trim()) {
    resultsContainer.innerHTML = '<div class="placeholder-state"><p>Start typing to explore your multimodal memory.</p></div>';
    return;
  }

  resultsContainer.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const body = { query };
    if (activeFilter) body.media_type = activeFilter;
    
    const res = await fetch(`${API_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const response = await res.json();
    
    if (response.error) {
      resultsContainer.innerHTML = `<div class="placeholder-state"><p style="color: #ff4d4f">Backend Error: ${response.error}</p></div>`;
      return;
    }
    
    const results = response.results || [];
    if (results.length === 0) {
      resultsContainer.innerHTML = '<div class="placeholder-state"><p>No relevant memory matches found.</p></div>';
      return;
    }

    resultsContainer.innerHTML = results.map(result => {
      const isImage = result.media_category === 'image';
      let fileIconHtml = '';
      
      if (isImage && result.file_path) {
        try {
          const imageSrc = convertFileSrc(result.file_path);
          fileIconHtml = `<img src="${imageSrc}" class="result-image" alt="${result.file_name}" loading="lazy" />`;
        } catch(e) {
          fileIconHtml = '<div class="file-icon">🖼️</div>';
        }
      } else if (result.media_category === 'video') {
         fileIconHtml = '<div class="file-icon">🎥</div>';
      } else if (result.media_category === 'audio') {
         fileIconHtml = '<div class="file-icon">🎵</div>';
      } else if (result.media_category === 'document') {
         fileIconHtml = '<div class="file-icon">📄</div>';
      } else {
         const txtPreview = result.preview ? `...${result.preview.substring(0, 40)}...` : '';
         fileIconHtml = `<div class="file-icon" style="font-size:24px; padding:10px;text-align:center;">📝 ${txtPreview}</div>`;
      }

      const score = Math.round(result.similarity * 100);
      const title = result.file_name || 'Text Snippet';
      const escapedPath = (result.file_path || '').replace(/'/g, "\\'");
      
      return `
        <div class="result-card" title="Click to open: ${result.file_path}" onclick="openFile('${escapedPath}')">
          <div class="result-image-wrapper">
            ${fileIconHtml}
          </div>
          <div class="result-info">
            <div class="result-title">${title}</div>
            <div class="result-meta">
              <span class="result-type">${result.media_category}</span>
              <span class="result-score">${score}% Match</span>
            </div>
          </div>
        </div>
      `;
    }).join("");
    
    pingDaemon();

  } catch (error) {
    resultsContainer.innerHTML = `<div class="placeholder-state"><p style="color: #ff4d4f">Connection Error: Ensure Python Daemon is running.</p></div>`;
  }
}

// ─── Ingest with Progress ───────────────────────────────────────────
async function handleIngest() {
  try {
    const selectedPath = await dialog.open({
      directory: true,
      multiple: false,
      title: "Select a folder to embed into VFinder"
    });

    if (!selectedPath) return;
    await startIngest(selectedPath);
  } catch (err) {
    ingestStatus.innerHTML = `<span style="color: #ff4d4f;">Dialog error: ${err}</span>`;
  }
}

async function startIngest(path) {
  ingestStatus.innerHTML = '';
  ingestProgress.style.display = 'block';
  progressLabel.textContent = 'Starting...';
  progressCount.textContent = '';
  progressFill.style.width = '0%';
  progressCurrentFile.textContent = '';
  
  try {
    const res = await fetch(`${API_URL}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    
    const response = await res.json();
    
    if (response.error) {
      ingestProgress.style.display = 'none';
      ingestStatus.innerHTML = `<span style="color: #ff4d4f;">Failed: ${response.error}</span>`;
      return;
    }
    
    // Start polling progress
    pollProgress();
    
  } catch(e) {
    ingestProgress.style.display = 'none';
    ingestStatus.innerHTML = `<span style="color: #ff4d4f;">Ingest error: ${e}</span>`;
  }
}

function pollProgress() {
  if (progressPollInterval) clearInterval(progressPollInterval);
  
  progressPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API_URL}/ingest/status`);
      const data = await res.json();
      
      if (data.total > 0) {
        const pct = Math.round((data.current / data.total) * 100);
        progressFill.style.width = `${pct}%`;
        progressCount.textContent = `${data.current} / ${data.total}`;
        progressLabel.textContent = 'Embedding files...';
        
        if (data.current_file) {
          const fname = data.current_file.split('/').pop();
          progressCurrentFile.textContent = fname;
        }
      } else if (data.active) {
        progressLabel.textContent = 'Scanning directory...';
      }
      
      if (data.done) {
        clearInterval(progressPollInterval);
        progressPollInterval = null;
        progressFill.style.width = '100%';
        progressLabel.textContent = 'Complete!';
        
        if (data.error) {
          ingestStatus.innerHTML = `<span style="color: #ff4d4f;">Error: ${data.error}</span>`;
        } else {
          ingestStatus.innerHTML = `<span style="color: #34c759;">✓ All files embedded successfully!</span>`;
        }
        
        pingDaemon();
        
        // Auto-hide progress after 3s
        setTimeout(() => {
          ingestProgress.style.display = 'none';
        }, 3000);
      }
    } catch(e) {
      // Server might be busy, keep polling
    }
  }, 500);
}

// ─── Drag & Drop ────────────────────────────────────────────────────
function setupDragDrop() {
  try {
    const webviewWindow = window.__TAURI__.webviewWindow;
    if (webviewWindow && webviewWindow.getCurrentWebviewWindow) {
      const appWindow = webviewWindow.getCurrentWebviewWindow();
      appWindow.onDragDropEvent((event) => {
        if (event.payload.type === 'over') {
          dropZone.classList.add('drag-over');
        } else if (event.payload.type === 'drop') {
          dropZone.classList.remove('drag-over');
          const paths = event.payload.paths;
          if (paths && paths.length > 0) {
            switchView('ingest');
            startIngest(paths[0]);
          }
        } else {
          dropZone.classList.remove('drag-over');
        }
      });
    }
  } catch(e) {
    console.log("Drag-drop setup skipped:", e);
  }
}

// ─── Settings ───────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const res = await fetch(`${API_URL}/settings`);
    const data = await res.json();
    
    settingsApiKey.value = '';
    settingsApiKey.placeholder = data.api_key_set ? `Current: ${data.api_key_masked}` : 'Enter your Gemini API key...';
    settingsDataDir.value = data.data_dir || '';
    settingsStatus.textContent = '';
  } catch(e) {
    settingsStatus.innerHTML = `<span style="color: #ff4d4f">Could not load settings.</span>`;
  }
}

async function saveSettings() {
  const body = {};
  if (settingsApiKey.value.trim()) body.api_key = settingsApiKey.value.trim();
  if (settingsDataDir.value.trim()) body.data_dir = settingsDataDir.value.trim();
  
  if (Object.keys(body).length === 0) {
    settingsStatus.innerHTML = `<span style="color: var(--text-muted)">No changes to save.</span>`;
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    
    if (data.success) {
      settingsStatus.innerHTML = `<span style="color: #34c759;">✓ Settings saved securely to ~/.vfinder/</span>`;
      settingsApiKey.value = '';
      loadSettings(); // Reload to show masked key
    } else {
      settingsStatus.innerHTML = `<span style="color: #ff4d4f;">Error: ${data.error}</span>`;
    }
  } catch(e) {
    settingsStatus.innerHTML = `<span style="color: #ff4d4f;">Save failed: ${e}</span>`;
  }
}

// Toggle API key visibility
let keyVisible = false;
btnToggleKey.addEventListener('click', () => {
  keyVisible = !keyVisible;
  settingsApiKey.type = keyVisible ? 'text' : 'password';
  btnToggleKey.textContent = keyVisible ? 'Hide' : 'Show';
});

// ─── Database Manager ───────────────────────────────────────────────
async function loadDbList() {
    dbTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading database...</td></tr>';
    try {
        const res = await fetch(`${API_URL}/list`);
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);
        if (!data.results || data.results.length === 0) {
            dbTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Your memory database is empty. Add memories first!</td></tr>';
            return;
        }
        
        dbTbody.innerHTML = data.results.map(item => {
            const escapedId = item.id.replace(/'/g, "\\'");
            const escapedPath = (item.file_path || '').replace(/'/g, "\\'");
            return `
            <tr>
                <td class="db-filename" title="${item.file_path}" onclick="openFile('${escapedPath}')">${item.file_name || item.id}</td>
                <td style="text-transform: capitalize;">${item.category || 'unknown'}</td>
                <td>${item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A'}</td>
                <td><button class="btn-delete" onclick="deleteDocument('${escapedId}')">Delete</button></td>
            </tr>
        `}).join('');
    } catch(err) {
        dbTbody.innerHTML = `<tr><td colspan="4" style="color:#ff4d4f;text-align:center;">Error fetching database: ${err.message}</td></tr>`;
    }
}

window.deleteDocument = async function(id) {
    if(!confirm('Are you sure you want to permanently forget this memory?')) return;
    try {
        const res = await fetch(`${API_URL}/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if(data.success) {
            loadDbList();
            pingDaemon();
        } else {
            alert(`Failed: ${data.error}`);
        }
    } catch(e) {
        alert("Error making delete request");
    }
}

// Expose globally for onclick handlers
window.openFile = openFile;

// ─── Initialize ─────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(e.target.value);
    }, 1000);
  });
  
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === 'Enter') {
      clearTimeout(searchTimeout);
      performSearch(e.target.value);
    }
  });
  
  btnSelectFile.addEventListener("click", handleIngest);
  btnRefreshDb.addEventListener("click", loadDbList);
  btnSaveSettings.addEventListener("click", saveSettings);
  
  switchView('search');
  setTimeout(pingDaemon, 1000);
  setupDragDrop();
});
