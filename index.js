/**
 * @license
 * wordpress-to-markdown (https://github.com/wtff0nzie/wordpress-to-markdown)
 * Copyright Dez Iddon and other contributors
 * Released under MIT license
 */

'use strict';

const config = require('./package.json').settings,
    massager = require('./massager'),
    xml2json = require('xml2json'),
    request = require('request'),
    cheerio = require('cheerio'),
    upndown = require('upndown'),
    url = require('url'),
    baseHref = url.parse(config.sitemap),
    fs = require('fs'),
    failRequests = [];


// Write errors
let writeFetchErrs = (errPath) => {
    if (errPath) {
        console.error('ERR: ' + errPath);
        failRequests.push(errPath);
    }

    fs.writeFile('./extracts/err.json', failRequests.join('\n'), (err) => {
        if (err) {
            console.log('Could not save error log. Funny huh! ' + err);
        }
    });
};


// Fetch a page
let fetchPage = (URL) => {
    let page = {
            URL         : URL,
            markup      : '',
            markdown    : ''
        },
        uri = url.parse(URL),
        skip = false;

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
            return writeFetchErrs(URL);
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

    extractImages(page);

    $ = undefined;
};


// Extract metadata used by Hugo static site generator
let genHugoMeta = (page) => {
    let hugoMeta = '---\n';

    if (config.addHugoMetaData === "true") {
        hugoMeta += 'title: "' + page.title + '"\n';
        hugoMeta += 'description: "' + page.description + '"\n';
        hugoMeta += 'date: "' + page.published + '"\n';
        hugoMeta += 'pageclasses: "page-inner-page page-blog"\n';
        hugoMeta += 'css: "<link rel=\'stylesheet\' href=\'/media/css/critical-inner-page.css\'>"\n';
        hugoMeta += 'aliases:\n';
        hugoMeta += '    - "' + url.parse(page.URL).path + '"\n';
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
    return '';
};


// Grab images
let extractImages = (page) => {
    let $ = cheerio.load(page.markup);

    buildPath('img');

    $(config.selectors.content + ' img').each((index, img) => {
        let path = $(img).attr('src'),
            parsedPath = url.parse(path).path.split('/'),
            fileName = parsedPath[parsedPath.length - 1];

        // plump out relative URIs
        path = url.parse(path);
        if (!path.host) {
            path.href = baseHref.protocol + '//' + baseHref.host + path.href;
        }

        request
            .get(path.href)
            .on('error', (err) => {
                writeFetchErrs(path.href);
            })
            .pipe(fs.createWriteStream('./extracts/img/' + fileName));
    });
};


// Convert page to markdown
let toMarkdown = (page) => {
    // Pull any meta data
    discoverMeta(page);

    // Pre-markdown cleanup
    massager(page.content, (err, content) => {
        let und = new upndown();

        if (err) {
            return writeFetchErrs(err);
        }

        und.convert(content, (err, markdown) => {
            if (err) {
                return writeFetchErrs('Could not convert "' + page.URL + '" to MD');
            }

            page.markdown = genHugoMeta(page) + markdown;
            saveToDisk(page);
        });
    });
};


// Recursively build directories
let buildPath = (...paths) => {
    paths.forEach((path) => {
        let dirs = path.split('/'),
            currentPath = './extracts';

        dirs.pop();

        dirs.forEach((dir) => {
            currentPath += '/' + dir;

            if (!fs.existsSync(currentPath)) {
                fs.mkdirSync(currentPath);
            }
        });
    });
};


// Persist markdown to disk
let saveToDisk = (page) => {
    let uri = url.parse(page.URL),
        path = uri.path,
        writeConfig = {};

    if (path.slice(-1) === '/') {
        path = path.substr(0, path.length - 1) + '.md';
    }

    writeConfig['./extracts/md' + path] = page.markdown;
    writeConfig['./extracts/raw' + path.replace('.md', '.json')] = JSON.stringify(page);

    buildPath('md' + path, 'raw' + path);

    Object.keys(writeConfig).forEach((key) => {
        fs.writeFile(key, writeConfig[key], (err) => {
            if (err) {
                writeFetchErrs(page.URL);
            }
        });
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
    sitemap.urlset.url.forEach((link, index) => {
        setTimeout(() => {
            try {
                fetchPage(link.loc);
            } catch (evt) {
                console.log(evt);
            }
        }, index * parseInt(config.fetchInterval, 10));
    });
});