const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment');
const xml2js = require('xml2js');

// Helper: fetch and parse RSS
async function fetchRSS(url, sourceName) {
    try {
        const { data } = await axios.get(url);
        const parsed = await xml2js.parseStringPromise(data, { mergeAttrs: true });
        const items = parsed.rss?.channel?.[0]?.item || parsed.feed?.entry || [];
        return items.map(item => ({
            title: item.title?.[0] || '',
            description: item.description?.[0] || item.summary?.[0] || '',
            date: moment(item.pubDate?.[0] || item.published?.[0] || item.updated?.[0] || new Date()).format('YYYY-MM-DD'),
            link: item.link?.[0]?.href || item.link?.[0] || '',
            image: '',
            source: sourceName
        }));
    } catch (e) {
        console.error(`RSS error for ${sourceName}:`, e.message);
        return [];
    }
}

// Helper: scrape iraqinews.com with browser User-Agent
async function fetchIraqiNews() {
    try {
        const { data } = await axios.get('https://www.iraqinews.com/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);
        const news = [];
        $('.jeg_postblock_content .jeg_post_title a').each((i, el) => {
            const title = $(el).text().trim();
            const link = $(el).attr('href');
            const description = $(el).closest('.jeg_postblock_content').find('.jeg_post_excerpt').text().trim();
            const date = new Date().toISOString().slice(0, 10);
            const image = $(el).closest('.jeg_post').find('img').attr('src');
            news.push({
                title,
                description,
                date,
                link,
                image: image || '',
                source: 'IraqiNews'
            });
        });
        return news;
    } catch (e) {
        console.error('IraqiNews error:', e.message);
        return [];
    }
}

// Helper: fetch multiple articles from al-hashed.gov.iq
async function fetchHashedArticles() {
    try {
        const url = 'https://al-hashed.gov.iq/';
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const news = [];
        $('li.post-item.tie-standard').each((i, el) => {
            const title = $(el).find('.post-title a').text().trim();
            const link = $(el).find('.post-title a').attr('href');
            const description = $(el).find('.post-excerpt').text().trim();
            const date = $(el).find('time.entry-date').attr('datetime') || new Date().toISOString();
            const imageRaw = $(el).find('img').attr('src') || '';
            const image = imageRaw.startsWith('http') ? imageRaw : ('https://al-hashed.gov.iq/' + imageRaw.replace(/^\//, ''));
            news.push({
                title,
                description,
                date: date.slice(0, 10),
                link,
                image,
                source: 'אל-חאשד'
            });
        });
        return news;
    } catch (e) {
        console.error('fetchHashedArticles error:', e.message);
        return [];
    }
}

// Arabic keywords for filtering
const ARABIC_KEYWORDS = [
    'العراق', 'الحشد', 'كتائب', 'تفجير', 'عبوة', 'الحدود', 'تهريب', 'ميليشيا', 'اشتباك',
    'صاروخ', 'درون', 'عمليات', 'قوات', 'انتشار', 'انسحاب', 'تعزيزات', 'استخبارات', 'أمن', 'نينوى', 'كركوك'
];

function containsKeyword(text) {
    if (!text) return false;
    return ARABIC_KEYWORDS.some(kw => text.includes(kw));
}

module.exports = async (req, res) => {
    try {
        // Fetch from iraqinews.com and multiple articles from al-hashed.gov.iq
        const [iraqi, hashed] = await Promise.all([
            fetchIraqiNews(),
            fetchHashedArticles()
        ]);
        let allNews = [...iraqi, ...hashed];

        // Filter by Arabic keywords in title or description
        allNews = allNews.filter(item => containsKeyword(item.title) || containsKeyword(item.description));

        // Sort by date descending
        allNews.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        res.status(200).json(allNews);
    } catch (error) {
        console.error('Error fetching filtered news:', error);
        res.status(500).json({ error: 'שגיאה באיסוף החדשות' });
    }
}; 