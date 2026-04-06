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
let currentFavoriteFilter = false;
let currentDateFilter = "";
let watchedPaths = [];
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
      
      // Check if API key is configured (first-run detection)
      checkFirstRun();
    } else {
      throw new Error("Bad response");
    }
  } catch (err) {
    dbStatsDot.classList.add('error');
    dbStatsText.textContent = "Daemon Connecting...";
    setTimeout(pingDaemon, 3000);
  }
}

let firstRunChecked = false;
async function checkFirstRun() {
  if (firstRunChecked) return;
  firstRunChecked = true;
  
  try {
    const res = await fetch(`${API_URL}/settings`);
    const data = await res.json();
    
    if (!data.api_key_set) {
      // Show welcome banner
      resultsContainer.innerHTML = `
        <div class="placeholder-state" style="flex-direction:column;gap:16px;">
          <div style="font-size:48px;">👋</div>
          <p style="font-size:20px;font-weight:500;color:#fff;">Welcome to VFinder!</p>
          <p>To get started, add your Gemini API key in <strong style="color:var(--accent);cursor:pointer;" onclick="document.getElementById('nav-settings').click()">Settings</strong>.</p>
          <p style="font-size:13px;">Get a free key at <em style="color:var(--accent);">aistudio.google.com</em></p>
        </div>
      `;
    }
  } catch(e) {
    // Server not ready yet, skip
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
  } else if (viewName === 'onboarding') {
    document.getElementById('view-onboarding').classList.add('active-view');
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
  if (isMeta && (e.key === ',' || e.key === 'S' && isMeta && e.shiftKey)) { e.preventDefault(); switchView('settings'); }
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
  if (!query && !activeFilter && !currentFavoriteFilter && !currentDateFilter) {
    resultsContainer.innerHTML = '<div class="placeholder-state"><p>Start typing to explore your multimodal memory.</p></div>';
    return;
  }

  resultsContainer.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const body = { query, media_type: activeFilter, favorite_only: currentFavoriteFilter };
    if (currentDateFilter) {
      const days = parseInt(currentDateFilter);
      const date = new Date();
      date.setDate(date.getDate() - days);
      body.date_after = date.toISOString();
    }
    
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
      const escapedId = (result.id || '').replace(/'/g, "\\'");
      
      return `
        <div class="result-card" title="Click to open: ${result.file_path}" onclick="openFile('${escapedPath}')">
          <div class="result-image-wrapper">
            ${fileIconHtml}
          </div>
          <div class="result-info">
            <div class="result-title" style="display:flex; justify-content:space-between; align-items:center;">
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80%;">${title}</span>
              <span class="favorite-star" onclick="toggleFavorite(event, '${escapedId}', ${result.favorite})">${result.favorite ? '⭐' : '☆'}</span>
            </div>
            <div class="result-actions" style="display:flex; gap:8px; margin-top:8px;">
              <button onclick="copyPath(event, '${escapedPath}')" title="Copy Path" style="background:rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:4px; padding:4px 8px; cursor:pointer;">📋</button>
              <button onclick="summarizeMemory(event, '${escapedId}')" title="Summarize AI" style="background:rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:4px; padding:4px 8px; cursor:pointer;">✨</button>
              <button onclick="revealInFinder(event, '${escapedPath}')" title="Reveal in Finder" style="background:rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:4px; padding:4px 8px; cursor:pointer;">🔍</button>
            </div>
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
    
    settingsApiKey.value = "";
    settingsApiKey.placeholder = data.api_key_set ? `Current: ${data.api_key_masked}` : "Enter your Gemini API key...";
    settingsDataDir.value = data.data_dir || "";
    watchedPaths = data.watched_paths || [];
    renderWatchedPaths();
    settingsStatus.textContent = "";
  } catch(e) {
    settingsStatus.innerHTML = `<span style="color: #ff4d4f">Could not load settings.</span>`;
  }
}

function renderWatchedPaths() {
  const list = document.getElementById("watched-list");
  if (!list) return;
  list.innerHTML = watchedPaths.map(p => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 6px; font-size: 13px;">
      <span title="${p}">${p.split("/").pop() || p}</span>
      <button class="btn-delete" style="padding: 2px 8px; border:none; background:none; color:#ff4d4f; cursor:pointer;" onclick="window.removeWatchedPath('${p.replace(/'/g, "\\'")}')">×</button>
    </div>
  `).join("");
}

window.removeWatchedPath = (path) => {
  watchedPaths = watchedPaths.filter(p => p !== path);
  renderWatchedPaths();
};

const btnAddWatched = document.getElementById("btn-add-watched");
if (btnAddWatched) {
    btnAddWatched.addEventListener("click", async () => {
      const selectedPath = await dialog.open({ directory: true, multiple: false });
      if (selectedPath) {
        if (!watchedPaths.includes(selectedPath)) {
          watchedPaths.push(selectedPath);
          renderWatchedPaths();
        }
      }
    });
}

async function saveSettings() {
  const body = { watched_paths: watchedPaths };
  if (settingsApiKey.value.trim()) body.api_key = settingsApiKey.value.trim();
  if (settingsDataDir.value.trim()) body.data_dir = settingsDataDir.value.trim();
  
  try {
    const res = await fetch(`${API_URL}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      settingsStatus.innerHTML = `<span style="color: #34c759;">✓ Settings saved!</span>`;
      loadSettings();
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

  const filterDate = document.getElementById("filter-date");
  if (filterDate) {
      filterDate.addEventListener("change", (e) => {
        currentDateFilter = e.target.value;
        performSearch(searchInput.value);
      });
  }

  const filterFavorite = document.getElementById("filter-favorite");
  if (filterFavorite) {
      filterFavorite.addEventListener("click", (e) => {
        currentFavoriteFilter = !currentFavoriteFilter;
        e.target.classList.toggle("active");
        performSearch(searchInput.value);
      });
  }

  btnRefreshDb.addEventListener("click", loadDbList);
  btnSaveSettings.addEventListener("click", saveSettings);
  
  switchView('search');
  setTimeout(pingDaemon, 1000);
  setupDragDrop();
});

// ─── Onboarding Wizard ──────────────────────────────────────────────
window.nextOnboardingStep = function(step) {
  const steps = document.querySelectorAll(".onboarding-step");
  steps.forEach(s => s.classList.remove("active"));
  const target = document.getElementById(`onboarding-step-${step}`);
  if (target) target.classList.add("active");
};

window.finishOnboarding = function() {
  localStorage.setItem("vfinder-onboarding-done", "true");
  switchView("search");
};

const onboardingApiKey = document.getElementById("onboarding-api-key");
const onboardingApiStatus = document.getElementById("onboarding-api-status");
const btnTestOnboardingKey = document.getElementById("btn-test-onboarding-key");

if (btnTestOnboardingKey) {
    btnTestOnboardingKey.addEventListener("click", async () => {
      const key = onboardingApiKey.value.trim();
      if (!key) {
        onboardingApiStatus.innerHTML = "<span style=\"color: #ff4d4f;\">Please enter an API key first.</span>";
        return;
      }

      onboardingApiStatus.innerHTML = "<span>Testing key...</span>";
      try {
        const res = await fetch(`${API_URL}/test-api-key`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: key })
        });
        const data = await res.json();

        if (data.success) {
          onboardingApiStatus.innerHTML = "<span style=\"color: #34c759;\">✓ API key is valid!</span>";
          // Save it automatically
          await fetch(`${API_URL}/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ api_key: key })
          });
          setTimeout(() => nextOnboardingStep(3), 1000);
        } else {
          onboardingApiStatus.innerHTML = `<span style="color: #ff4d4f;">Failed: ${data.error}</span>`;
        }
      } catch (e) {
        onboardingApiStatus.innerHTML = `<span style="color: #ff4d4f;">Connection Error: ${e.message}</span>`;
      }
    });
}

const btnOnboardingSetupFolder = document.getElementById("btn-onboarding-setup-folder");
const onboardingFolderStatus = document.getElementById("onboarding-folder-status");

if (btnOnboardingSetupFolder) {
    btnOnboardingSetupFolder.addEventListener("click", async () => {
      try {
        const selectedPath = await dialog.open({
          directory: true,
          multiple: false,
          title: "Select a folder to index first"
        });

        if (!selectedPath) return;
        onboardingFolderStatus.innerHTML = `Selected: ${selectedPath.split("/").pop()}. Ingesting...`;
        await startIngest(selectedPath);
        finishOnboarding();
      } catch (err) {
        onboardingFolderStatus.innerHTML = `<span style="color: #ff4d4f;">Dialog error: ${err}</span>`;
      }
    });
}

const navOnboardingTrigger = document.getElementById("nav-onboarding");
if (navOnboardingTrigger) {
    navOnboardingTrigger.addEventListener("click", () => {
      nextOnboardingStep(1);
      switchView("onboarding");
    });
}

// Check if onboarding is needed
setTimeout(() => {
  if (!localStorage.getItem("vfinder-onboarding-done")) {
    switchView("onboarding");
  }
}, 500);


window.toggleFavorite = async function(event, id, currentFavorite) {
  event.stopPropagation(); // Don't open the file
  try {
    const res = await fetch(`${API_URL}/favorite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, favorite: !currentFavorite })
    });
    const data = await res.json();
    if (data.success) {
      performSearch(searchInput.value); // Reload to show change
    }
  } catch (e) {
    console.error("Error toggling favorite", e);
  }
};

window.copyPath = (event, path) => {
  event.stopPropagation();
  navigator.clipboard.writeText(path);
  alert("Path copied to clipboard!");
};

window.revealInFinder = async (event, path) => {
  event.stopPropagation();
  try {
    // Open the folder containing the file
    const dir = path.substring(0, path.lastIndexOf("/"));
    await fetch(`${API_URL}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: dir })
    });
  } catch (e) {
    console.error("Error revealing in Finder", e);
  }
};

window.summarizeMemory = async (event, id) => {
  event.stopPropagation();
  const btn = event.target;
  const oldText = btn.textContent;
  btn.textContent = "...";
  try {
    const res = await fetch(`${API_URL}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.summary) {
      alert("AI Summary:\n\n" + data.summary);
    } else {
      alert("AI Error: " + data.error);
    }
  } catch (e) {
    alert("Error fetching summary: " + e.message);
  } finally {
    btn.textContent = oldText;
  }
};

const themeBtns = document.querySelectorAll(".theme-btn");
themeBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    themeBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const theme = btn.dataset.theme;
    if (theme === "light") {
      document.body.classList.add("light-theme");
      localStorage.setItem("vfinder-theme", "light");
    } else {
      document.body.classList.remove("light-theme");
      localStorage.setItem("vfinder-theme", "dark");
    }
  });
});

// Restore theme
if (localStorage.getItem("vfinder-theme") === "light") {
  document.body.classList.add("light-theme");
  const lightBtn = Array.from(themeBtns).find(b => b.dataset.theme === "light");
  if (lightBtn) {
    themeBtns.forEach(b => b.classList.remove("active"));
    lightBtn.classList.add("active");
  }
}
