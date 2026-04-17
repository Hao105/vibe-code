import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

const query = '台灣 韓籍啦啦隊 李多慧 李雅英 李珠珢 高畫質寫真';
const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`;
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

const download = (url, filepath) => new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': userAgent } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
            return download(res.headers.location, filepath).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) return reject(new Error('Status ' + res.statusCode));
        const fileStream = fs.createWriteStream(filepath);
        res.pipe(fileStream);
        fileStream.on('finish', () => resolve());
        fileStream.on('error', reject);
    }).on('error', reject);
});

https.get(url, { headers: { 'User-Agent': userAgent } }, (res) => {
    let html = '';
    res.on('data', chunk => html += chunk);
    res.on('end', async () => {
        const regex = /murl&quot;:&quot;(https?:\/\/[^&"]+\.jpg)&quot;/ig;
        const urls = [];
        let match;
        while ((match = regex.exec(html)) !== null) {
            urls.push(match[1]);
        }
        
        console.log(`Found ${urls.length} images.`);
        let count = 0;
        for (const imgUrl of urls) {
            if (count >= 15) break; // Download at least 10+
            try {
                console.log(`Downloading: ${imgUrl}`);
                await download(imgUrl, path.join('public', 'cheerleaders', `web_${count + 1}.jpg`));
                count++;
            } catch (e) {
                console.error(`Failed: ${imgUrl}`);
            }
        }
        console.log(`Downloaded ${count} images successfully.`);
    });
});
