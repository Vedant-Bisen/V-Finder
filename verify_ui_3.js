const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // Using absolute path for vfinder-desktop/src/index.html
  const filePath = `file://${path.resolve('vfinder-desktop/src/index.html')}`;
  await page.goto(filePath);

  // 1. Light Mode Settings
  await page.evaluate(() => {
    localStorage.setItem('theme', 'light');
    document.body.classList.add('light-theme');
    // Force show settings
    const views = ['search-view', 'database-view', 'add-memory-view', 'settings-view'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });
    const settings = document.getElementById('settings-view');
    if (settings) settings.classList.remove('hidden');
  });
  await page.screenshot({ path: 'settings_light_v2.png' });

  // 2. Mock Search Results in Dark Mode
  await page.evaluate(() => {
    localStorage.setItem('theme', 'dark');
    document.body.classList.remove('light-theme');

    const views = ['search-view', 'database-view', 'add-memory-view', 'settings-view'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });
    const search = document.getElementById('search-view');
    if (search) search.classList.remove('hidden');

    const resultsGrid = document.getElementById('results-grid');
    if (resultsGrid) {
        resultsGrid.innerHTML = `
            <div class="result-item" style="width: 200px; display: block;">
                <div class="result-preview" style="position: relative;">
                    <div style="width:100%; height:120px; background:#333; display:flex; align-items:center; justify-content:center; color: #666;">Image Preview</div>
                    <div class="favorite-toggle active" style="position: absolute; top: 8px; right: 8px;">★</div>
                </div>
                <div class="result-info">
                    <div class="result-name">vacation_photo.jpg</div>
                    <div class="result-meta">Image • 2023-10-01</div>
                    <div class="result-actions" style="display: flex; gap: 4px; margin-top: 8px;">
                        <button class="action-btn" title="Copy Path" style="background:none; border:1px solid #444; color:white; padding: 4px; cursor:pointer;">C</button>
                        <button class="action-btn" title="Reveal in Finder" style="background:none; border:1px solid #444; color:white; padding: 4px; cursor:pointer;">R</button>
                        <button class="action-btn" title="AI Summarize" style="background:none; border:1px solid #444; color:white; padding: 4px; cursor:pointer;">S</button>
                    </div>
                </div>
            </div>
        `;
        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.classList.add('hidden');
        resultsGrid.classList.remove('hidden');
        resultsGrid.style.display = 'grid';
    }
  });
  await page.screenshot({ path: 'search_results_dark_v2.png' });

  await browser.close();
})();
