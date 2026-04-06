from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        abs_path = os.path.abspath('vfinder-desktop/src/index.html')
        file_url = f'file://{abs_path}'
        page.goto(file_url)

        # 1. Light Mode Settings
        page.evaluate("""() => {
            localStorage.setItem('theme', 'light');
            document.body.classList.add('light-theme');
            ['search-view', 'database-view', 'add-memory-view', 'settings-view'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            const settings = document.getElementById('settings-view');
            if (settings) settings.classList.remove('hidden');
        }""")
        page.screenshot(path='settings_light_v4.png')

        # 2. Mock Search Results in Dark Mode
        page.evaluate("""() => {
            localStorage.setItem('theme', 'dark');
            document.body.classList.remove('light-theme');
            ['search-view', 'database-view', 'add-memory-view', 'settings-view'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            const search = document.getElementById('search-view');
            if (search) search.classList.remove('hidden');

            const resultsGrid = document.getElementById('results-grid');
            if (resultsGrid) {
                resultsGrid.innerHTML = `
                    <div class="result-item" style="width: 250px; display: block; background: #1e1e1e; border-radius: 8px; overflow: hidden; border: 1px solid #333; margin: 20px;">
                        <div class="result-preview" style="position: relative;">
                            <div style="width:100%; height:140px; background:#333; display:flex; align-items:center; justify-content:center; color: #666; font-family: sans-serif;">Image Preview</div>
                            <div class="favorite-toggle active" style="position: absolute; top: 8px; right: 8px; color: #ffd700; font-size: 20px;">★</div>
                        </div>
                        <div class="result-info" style="padding: 12px; font-family: sans-serif;">
                            <div class="result-name" style="color: white; font-size: 14px; font-weight: 500; margin-bottom: 4px;">vacation_photo.jpg</div>
                            <div class="result-meta" style="color: #888; font-size: 12px; margin-bottom: 12px;">Image • 2023-10-01</div>
                            <div class="result-actions" style="display: flex; gap: 8px;">
                                <div style="color: #eee; font-size: 11px; border: 1px solid #444; padding: 4px 8px; border-radius: 4px; background: #2a2a2a;">Copy Path</div>
                                <div style="color: #eee; font-size: 11px; border: 1px solid #444; padding: 4px 8px; border-radius: 4px; background: #2a2a2a;">Reveal</div>
                                <div style="color: #eee; font-size: 11px; border: 1px solid #444; padding: 4px 8px; border-radius: 4px; background: #2a2a2a;">Summarize</div>
                            </div>
                        </div>
                    </div>
                `;
                const emptyState = document.getElementById('empty-state');
                if (emptyState) emptyState.classList.add('hidden');
                resultsGrid.classList.remove('hidden');
                resultsGrid.style.display = 'grid';
            }
        }""")
        page.screenshot(path='search_results_dark_v4.png')

        browser.close()

if __name__ == "__main__":
    run()
