import https from 'https';
import fs from 'fs';
import path from 'path';

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const getJSON = (url) => new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': userAgent } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
        res.on('error', reject);
    }).on('error', reject);
});

const downloadImage = (url, filepath) => new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': userAgent } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
            return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) return reject(new Error('Status ' + res.statusCode));
        const fileStream = fs.createWriteStream(filepath);
        res.pipe(fileStream);
        fileStream.on('finish', () => resolve());
        fileStream.on('error', reject);
    }).on('error', reject);
});

async function main() {
    try {
        console.log("Fetching pages...");
        const titles = ['Rakuten_Girls', 'Passion_Sisters', 'Fubon_Angels'];
        let fileTitles = [];

        for (const title of titles) {
            const listUrl = `https://zh.wikipedia.org/w/api.php?action=query&prop=images&titles=${title}&format=json&imlimit=50`;
            const listData = await getJSON(listUrl);
            const pages = listData.query.pages;
            for (const pid in pages) {
                if (pages[pid].images) {
                    pages[pid].images.forEach(img => {
                        if (img.title.match(/\.(jpg|jpeg|png)$/i)) {
                            fileTitles.push(img.title);
                        }
                    });
                }
            }
        }

        console.log(`Found ${fileTitles.length} images. Fetching URLs...`);
        let count = 0;
        
        for (const ftitle of fileTitles) {
            if (count >= 15) break;
            const encodedTitle = encodeURIComponent(ftitle);
            const infoUrl = `https://zh.wikipedia.org/w/api.php?action=query&titles=${encodedTitle}&prop=imageinfo&iiprop=url&format=json`;
            try {
                const infoData = await getJSON(infoUrl);
                const pages = infoData.query.pages;
                for (const pid in pages) {
                    const iinfo = pages[pid].imageinfo;
                    if (iinfo && iinfo.length > 0) {
                        const dlUrl = iinfo[0].url;
                        console.log(`Downloading ${dlUrl}...`);
                        await downloadImage(dlUrl, path.join('public', 'cheerleaders', `real_${count + 1}.jpg`));
                        count++;
                    }
                }
            } catch (e) {
                console.error(e.message);
            }
        }
        console.log("Finished downloading 15 images.");
    } catch(err) {
        console.error(err);
    }
}

main();
