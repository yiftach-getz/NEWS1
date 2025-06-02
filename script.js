// News sources configuration
const newsSources = [
    {
        name: 'אל-חאשד',
        url: 'http://localhost:3000/api/news',
        type: 'api'
    }
];

let allNewsData = [];
let currentFilter = '';
let currentTag = '';

// Auto-tagging function
function autoTagNewsItem(item) {
    if (!item.tags) item.tags = [];
    // Add source as a tag
    if (item.source && !item.tags.includes(item.source)) item.tags.push(item.source);
    // Add default tag "עיראק"
    if (!item.tags.includes("עיראק")) item.tags.push("עיראק");
    // Add key words from title
    if (item.title) {
        const stopWords = ['של', 'עם', 'על', 'זה', 'הוא', 'היא', 'את', 'או', 'ו', 'לא', 'כן', 'מה', 'מי', 'ה'];
        item.title.split(/\s+/).forEach(word => {
            if (word.length > 2 && !stopWords.includes(word) && !item.tags.includes(word)) {
                item.tags.push(word);
            }
        });
    }
}

// Fetch and display news in two sections: latest and history
async function fetchNews() {
    const feedContainer = document.getElementById('newsFeedContainer');
    const historyContainer = document.getElementById('newsHistoryContainer');
    const galleryContainer = document.getElementById('newsGallery');
    feedContainer.innerHTML = '<div class="loading">טוען חדשות...</div>';
    historyContainer.innerHTML = '<div class="loading">טוען חדשות...</div>';
    galleryContainer.innerHTML = '';

    try {
        const response = await fetch('/api/news');
        const news = await response.json();
        if (news.error) throw new Error(news.error);
        allNewsData = news;
        // Apply auto-tagging
        allNewsData.forEach(autoTagNewsItem);
        // Debug log
        console.log("news from server:", allNewsData);
        renderAll();
        updateLastUpdateTime();
    } catch (error) {
        feedContainer.innerHTML = '<div class="error">אירעה שגיאה בטעינת החדשות. אנא נסה שוב.</div>';
        historyContainer.innerHTML = '<div class="error">אירעה שגיאה בטעינת החדשות. אנא נסה שוב.</div>';
        galleryContainer.innerHTML = '';
    }
}

function renderAll() {
    const feedContainer = document.getElementById('newsFeedContainer');
    const historyContainer = document.getElementById('newsHistoryContainer');
    const galleryContainer = document.getElementById('newsGallery');
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    // Changed from start2025 to oneMonthAgo
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let filtered = allNewsData;
    if (currentFilter) {
        const kw = currentFilter.toLowerCase();
        filtered = filtered.filter(item =>
            (item.title && item.title.toLowerCase().includes(kw)) ||
            (item.description && item.description.toLowerCase().includes(kw)) ||
            (item.source && item.source.toLowerCase().includes(kw)) ||
            (item.tags && item.tags.some(tag => tag.toLowerCase().includes(kw)))
        );
    }
    if (currentTag) {
        filtered = filtered.filter(item => item.tags && item.tags.includes(currentTag));
    }

    const latest = filtered.filter(item => {
        const d = new Date(item.date);
        return d >= twoDaysAgo;
    });
    const history = filtered.filter(item => {
        const d = new Date(item.date);
        return d >= oneMonthAgo && d < twoDaysAgo;
    });

    displayNews(feedContainer, latest, true);
    displayNews(historyContainer, history, false);
    buildGallery(galleryContainer, filtered);
}

// Display news items in a given container
function displayNews(container, newsItems, isFeed) {
    container.innerHTML = '';
    if (newsItems.length === 0) {
        container.innerHTML = `<div class="loading">${isFeed ? 'אין חדשות מהיומיים האחרונים.' : 'אין חדשות היסטוריות מ-2025.'}</div>`;
        return;
    }
    newsItems.forEach((item, idx) => {
        const newsElement = document.createElement('div');
        newsElement.className = 'news-item';
        newsElement.style.cursor = 'pointer';
        newsElement.onclick = () => window.open(item.link, '_blank');
        // Tags
        let tagsHtml = '';
        if (item.tags && item.tags.length) {
            tagsHtml = '<div class="tags">' + item.tags.map(tag => `<span class="tag" onclick="filterByTag('${tag}')">${tag}</span>`).join('') + '</div>';
        }
        // Hebrew/Arabic toggle
        const hasHebrew = item.titleHe && item.descriptionHe;
        const langId = `lang-toggle-${isFeed ? 'feed' : 'hist'}-${idx}`;
        newsElement.innerHTML = `
            <h2 id="${langId}-title">${hasHebrew ? item.titleHe : item.title}</h2>
            <p id="${langId}-desc" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${hasHebrew ? item.descriptionHe : (item.description || '')}</p>
            <button class="lang-toggle-btn" onclick="toggleLang('${langId}', ${hasHebrew ? 'true' : 'false'}, '${escapeQuotes(item.titleHe || '')}', '${escapeQuotes(item.descriptionHe || '')}', '${escapeQuotes(item.title || '')}', '${escapeQuotes(item.description || '')}')">הצג ${hasHebrew ? 'ערבית' : 'עברית'}</button>
            ${tagsHtml}
            <div class="source">מקור: <a href="${item.link}" target="_blank">${item.source}</a></div>
            <div class="date">${item.date}</div>
        `;
        container.appendChild(newsElement);
    });
}

// Helper to escape quotes for inline JS
function escapeQuotes(str) {
    return (str || '').replace(/'/g, "&#39;").replace(/\"/g, '&quot;');
}

// Toggle language for a news item
window.toggleLang = function(langId, hasHebrew, titleHe, descHe, titleAr, descAr) {
    const titleEl = document.getElementById(`${langId}-title`);
    const descEl = document.getElementById(`${langId}-desc`);
    const btn = document.querySelector(`#${langId}-title`).parentElement.querySelector('.lang-toggle-btn');
    if (btn.dataset.lang === 'he' || !btn.dataset.lang) {
        // Switch to Arabic
        titleEl.textContent = titleAr;
        descEl.textContent = descAr;
        btn.textContent = 'הצג עברית';
        btn.dataset.lang = 'ar';
    } else {
        // Switch to Hebrew
        titleEl.textContent = titleHe;
        descEl.textContent = descHe;
        btn.textContent = 'הצג ערבית';
        btn.dataset.lang = 'he';
    }
}

// Build gallery from news images
function buildGallery(container, newsItems) {
    container.innerHTML = '';
    const images = newsItems.filter(item => item.image).map(item => ({
        src: item.image,
        alt: item.title,
        link: item.link
    }));
    if (images.length === 0) {
        container.innerHTML = '<div class="loading">אין תמונות זמינות מהחדשות.</div>';
        return;
    }
    images.forEach(img => {
        const imgEl = document.createElement('img');
        imgEl.src = img.src;
        imgEl.alt = img.alt;
        imgEl.title = img.alt;
        imgEl.onclick = () => window.open(img.link, '_blank');
        container.appendChild(imgEl);
    });
}

// Tag filtering (global for inline onclick)
window.filterByTag = function(tag) {
    currentTag = tag;
    renderAll();
}

// Search bar logic
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
searchBtn.addEventListener('click', () => {
    currentFilter = searchInput.value.trim();
    currentTag = '';
    renderAll();
});
searchInput.addEventListener('keyup', e => {
    if (e.key === 'Enter') {
        currentFilter = searchInput.value.trim();
        currentTag = '';
        renderAll();
    }
});

function updateLastUpdateTime() {
    const lastUpdate = document.getElementById('lastUpdate');
    const now = new Date();
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    lastUpdate.textContent = now.toLocaleDateString('he-IL', options);
}

document.getElementById('refreshNews').addEventListener('click', fetchNews);
fetchNews();
setInterval(fetchNews, 5 * 60 * 1000); 