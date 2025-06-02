const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const moment = require('moment');
const xml2js = require('xml2js');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors({ origin: '*' }));

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

// Helper: scrape ISWNews (english.iswnews.com)
async function fetchISWNews() {
    try {
        const { data } = await axios.get('https://english.iswnews.com/category/iraq/');
        const $ = cheerio.load(data);
        const news = [];
        $('.post-listing .post').each((i, el) => {
            const title = $(el).find('.post-title a').text().trim();
            const link = $(el).find('.post-title a').attr('href');
            const description = $(el).find('.post-content p').text().trim();
            const dateStr = $(el).find('.post-meta .post-date').text().trim();
            const date = moment(dateStr, ["MMMM D, YYYY", "YYYY-MM-DD", "DD/MM/YYYY"], true);
            news.push({
                title,
                description,
                date: date.isValid() ? date.format('YYYY-MM-DD') : moment().format('YYYY-MM-DD'),
                link,
                image: '',
                source: 'ISWNews'
            });
        });
        return news;
    } catch (e) {
        console.error('ISWNews error:', e.message);
        return [];
    }
}

// Helper: scrape alssaa.com
async function fetchAlssaa() {
    try {
        const { data } = await axios.get('https://alssaa.com/');
        const $ = cheerio.load(data);
        const news = [];
        $('.jeg_postblock_content .jeg_post_title a').each((i, el) => {
            const title = $(el).text().trim();
            const link = $(el).attr('href');
            news.push({
                title,
                description: '',
                date: moment().format('YYYY-MM-DD'),
                link,
                image: '',
                source: 'Alssaa'
            });
        });
        return news;
    } catch (e) {
        console.error('Alssaa error:', e.message);
        return [];
    }
}

// Helper: scrape amaj24news.com
async function fetchAmaj24() {
    try {
        const { data } = await axios.get('https://amaj24news.com/');
        const $ = cheerio.load(data);
        const news = [];
        $('.jeg_postblock_content .jeg_post_title a').each((i, el) => {
            const title = $(el).text().trim();
            const link = $(el).attr('href');
            news.push({
                title,
                description: '',
                date: moment().format('YYYY-MM-DD'),
                link,
                image: '',
                source: 'Amaj24News'
            });
        });
        return news;
    } catch (e) {
        console.error('Amaj24News error:', e.message);
        return [];
    }
}

// Helper: scrape saidshuhada.iq
async function fetchSaidShuhada() {
    try {
        const { data } = await axios.get('https://saidshuhada.iq/?cat=27');
        const $ = cheerio.load(data);
        const news = [];
        $('.post-title a').each((i, el) => {
            const title = $(el).text().trim();
            const link = $(el).attr('href');
            news.push({
                title,
                description: '',
                date: moment().format('YYYY-MM-DD'),
                link,
                image: '',
                source: 'SaidShuhada'
            });
        });
        return news;
    } catch (e) {
        console.error('SaidShuhada error:', e.message);
        return [];
    }
}

// Helper: scrape washingtoninstitute.org/ar
async function fetchWashingtonInstitute() {
    try {
        const { data } = await axios.get('https://www.washingtoninstitute.org/ar');
        const $ = cheerio.load(data);
        const news = [];
        $('.views-row .title a').each((i, el) => {
            const title = $(el).text().trim();
            const link = 'https://www.washingtoninstitute.org' + $(el).attr('href');
            news.push({
                title,
                description: '',
                date: moment().format('YYYY-MM-DD'),
                link,
                image: '',
                source: 'WashingtonInstitute'
            });
        });
        return news;
    } catch (e) {
        console.error('WashingtonInstitute error:', e.message);
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
            // תיאור קצר (אם יש)
            const description = $(el).closest('.jeg_postblock_content').find('.jeg_post_excerpt').text().trim();
            // תאריך (אם יש)
            const date = new Date().toISOString().slice(0, 10); // כרגע תאריך נוכחי, אפשר לשפר
            // תמונה (אם יש)
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

// Helper: translate text to Hebrew using Google Translate API
const axiosTranslate = axios.create({
    baseURL: 'https://translate.googleapis.com',
    timeout: 5000
});
async function translateToHebrew(text) {
    if (!text) return '';
    try {
        const res = await axiosTranslate.get('/translate_a/single', {
            params: {
                client: 'gtx',
                sl: 'auto',
                tl: 'he',
                dt: 't',
                q: text
            }
        });
        // The result is a nested array
        return res.data[0].map(x => x[0]).join(' ');
    } catch (e) {
        console.error('Translation error:', e.message);
        return '';
    }
}

// Helper: fetch single article from al-hashed.gov.iq
async function fetchSingleHashedArticle() {
    try {
        const url = 'https://al-hashed.gov.iq/?p=529880';
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        const title = $('h1.entry-title').text().trim();
        // Improved description extraction
        let description = $('div.td-post-content p').first().text().trim();
        if (!description) {
            const content = $('div.td-post-content').text().trim();
            description = content.split('\n').find(line => line.trim().length > 20) || content.slice(0, 200);
        }
        const date = $('time.entry-date').attr('datetime') || new Date().toISOString();
        const image = $('div.td-post-featured-image img').attr('src') || '';

        // Translate title and description to Hebrew
        const [titleHe, descriptionHe] = await Promise.all([
            translateToHebrew(title),
            translateToHebrew(description)
        ]);

        return [{
            title,
            titleHe,
            description,
            descriptionHe,
            date: date.slice(0, 10),
            link: url,
            image,
            source: 'אל-חאשד'
        }];
    } catch (e) {
        console.error('fetchSingleHashedArticle error:', e.message);
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

app.get('/api/news', async (req, res) => {
    try {
        // Fetch from iraqinews.com and multiple articles from al-hashed.gov.iq
        const [iraqi, hashed] = await Promise.all([
            fetchIraqiNews(),
            fetchHashedArticles()
        ]);
        let allNews = [...iraqi, ...hashed];

        // Filter by Arabic keywords in title or description
        allNews = allNews.filter(item => containsKeyword(item.title) || containsKeyword(item.description));

        // Translate only the title to Hebrew
        const translatedNews = await Promise.all(allNews.map(async item => {
            const titleHe = await translateToHebrew(item.title);
            return { ...item, titleHe };
        }));

        // Sort by date descending
        translatedNews.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        res.json(translatedNews);
    } catch (error) {
        console.error('Error fetching filtered & translated news:', error);
        res.status(500).json({ error: 'שגיאה באיסוף החדשות' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 