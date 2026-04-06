const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const filePath = `file://${path.resolve('src/index.html')}`;
  await page.goto(filePath);

  // 1. Light Mode Settings
  await page.evaluate(() => {
    localStorage.setItem('theme', 'light');
    document.body.classList.add('light-theme');
    // Force show settings
    const views = ['search-view', 'database-view', 'add-memory-view', 'settings-view'];
    views.forEach(v => document.getElementById(v).classList.add('hidden'));
    document.getElementById('settings-view').classList.remove('hidden');
  });
  await page.screenshot({ path: 'settings_light.png' });

  // 2. Mock Search Results in Dark Mode
  await page.evaluate(() => {
    localStorage.setItem('theme', 'dark');
    document.body.classList.remove('light-theme');

    const views = ['search-view', 'database-view', 'add-memory-view', 'settings-view'];
    views.forEach(v => document.getElementById(v).classList.add('hidden'));
    document.getElementById('search-view').classList.remove('hidden');

    const resultsGrid = document.getElementById('results-grid');
    resultsGrid.innerHTML = `
        <div class="result-item" style="width: 200px;">
            <div class="result-preview">
                <div style="width:100%; height:120px; background:#333; display:flex; align-items:center; justify-content:center; color: #666;">Image Preview</div>
                <div class="favorite-toggle active">★</div>
            </div>
            <div class="result-info">
                <div class="result-name">vacation_photo.jpg</div>
                <div class="result-meta">Image • 2023-10-01</div>
                <div class="result-actions">
                    <button class="action-btn" title="Copy Path"><span class="material-symbols-outlined" style="font-size: 16px;">content_copy</span></button>
                    <button class="action-btn" title="Reveal in Finder"><span class="material-symbols-outlined" style="font-size: 16px;">folder</span></button>
                    <button class="action-btn" title="AI Summarize"><span class="material-symbols-outlined" style="font-size: 16px;">auto_awesome</span></button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('results-grid').classList.remove('hidden');
    document.getElementById('results-grid').style.display = 'grid';
  });
  await page.screenshot({ path: 'search_results_dark.png' });

  await browser.close();
})();
