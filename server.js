/**
 * @license
 * lodash <https://lodash.com/>
 * Copyright Dez Iddon and other contributors
 * Released under MIT license
 */

'use strict';

const config = require('./package.json').settings,
    xml2json = require('xml2json'),
    request = require('request'),
    cheerio = require('cheerio'),
    upndown = require('upndown'),
    url = require('url'),
    fs = require('fs');


// Fetch a page
let fetchPage = (URL) => {
    let page = {
            URL         : URL,
            markup      : '',
            markdown    : ''
        },
        skip = false,
        uri = url.parse(URL);

    // Is this portion of the site on the skip list?
    config.excludePaths.forEach((excludeURL) => {
        if (uri.path.indexOf(excludeURL) > -1) {
            skip = true;
        }
    });

    if (skip) {
        return;
    }

    console.log('Grabbing ' + URL);

    // Grab page, begin the transformation (MUHAHHAHAHAHAHAHA *THUNDER CLAP*)
    request(URL, (err, response, body) => {
        if (err || response.statusCode !== 200) {
            return console.log(err);
        }

        page.markup = body;
        toMarkdown(page);
    });
};


// Extract any useful metadata
let discoverMeta = (page) => {
    let $ = cheerio.load(page.markup),
        pageCategories = [],
        pageTags = [];

    page.title = $(config.selectors.title).text();
    page.published = $(config.selectors.published).attr('content');
    page.description = $(config.selectors.description).attr('content');

    page.content = $(config.selectors.content).html();

    // Extract post specific tags
    $(config.selectors.tags).each((index, element) => {
        pageTags.push($(element).text());
    });

    // Extract post categories
    $(config.selectors.categories).each((index, element) => {
        pageCategories.push($(element).text());
    });

    page.tags = pageTags;
    page.categories = pageCategories;

    $ = null;
};


// Extract metadata used by Hugo static site generator
let genHugoMeta = (page) => {
    let hugoMeta = '---\n';

    if (config.addHugoMetaData === "true") {
        hugoMeta += 'title: "' + page.title + '"\n';
        hugoMeta += 'description: "' + page.description + '"\n';
        hugoMeta += 'date: "' + page.published + '"\n';
        hugoMeta += 'categories:\n';
        page.categories.forEach((category) => {
            hugoMeta += '   - "' + category + '"\n';
        });
        hugoMeta += 'tags:\n';
        page.tags.forEach((tag) => {
            hugoMeta += '   - "' + tag + '"\n';
        });
        hugoMeta += '---\n';
        return hugoMeta;
    }
    return "";
};


// Convert page to markdown
let toMarkdown = (page) => {
    let und = new upndown();

    discoverMeta(page);

    und.convert(page.content, (err, markdown) => {
        if (err) {
            console.log('Could not convert to MD');
            return console.err(err);
        }

        page.markdown = genHugoMeta(page) + markdown;
        saveToDisk(page);
    });
};


// Recursively build directories
let buildPath = (path) => {
    let dirs = path.split('/'),
        currentPath = './extracts';

    dirs.pop();

    dirs.forEach((dir) => {
        currentPath += '/' + dir;

        if (!fs.existsSync(currentPath)) {
            fs.mkdirSync(currentPath);
        }
    });
};


// Persist markdown to disk
let saveToDisk = (page) => {
    let uri = url.parse(page.URL),
        path = uri.path;

    if (path.slice(-1) === '/') {
        path += 'index.md';
    }

    buildPath('md' + path);
    buildPath('raw' + path);

    fs.writeFile('./extracts/md' + path, page.markdown, (err) => {
        if (err) {
            console.log('Could not save ' + path);
            console.log(err);
        }
    });

    fs.writeFile('./extracts/raw' + path.replace('.md', '.json'), JSON.stringify(page), (err) => {
        if (err) {
            console.log('Could not save ' + path);
            console.log(err);
        }
    });

    return;

    fs.writeFile('/extracts/md' + path, page.markdown, function (err){
        if (err) {
            console.log('Could not save ' + path);
            console.log(err);
        }
    });
};


// Grab sitemap
request(config.sitemap, (err, response, body) => {
    let sitemap;

    if (err || response.statusCode !== 200) {
        return console.log(err);
    }

    // Parse a sitemap
    sitemap = JSON.parse(xml2json.toJson(body));

    // Spider links
    fetchPage('https://www.taxamo.com/2015-vat-changes/');
    return;
    sitemap.urlset.url.forEach((link, index) => {
        setTimeout(() => {
            fetchPage(link.loc);
        }, index * parseInt(config.fetchInterval, 10));
    });
});