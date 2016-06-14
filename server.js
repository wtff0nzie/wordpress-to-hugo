var config = require('./package.json'),
    xml2json = require('xml2json'),
    request = require('request'),
    cheerio = require('cheerio'),
    upndown = require('upndown'),
    sitemapURL = config.sitemap,
    fetchInterval = 3 * 1000,
    contentSelector,
    tagsSelector;


contentSelector = '.section-content';
tagsSelector  = '.post-tags a[rel=tag]';


// Fetch a page
function fetchPage(URL) {
    var exclude = [
            '/category/',
            '/tag/'
        ],
        page = {
            URL         : URL,
            markup      : '',
            markdown    : ''
        },
        skip = false;

    // Is this portion of the site on the skip list?
    exclude.forEach(function (excludeURL) {
        if (URL.indexOf(excludeURL) > -1) {
            skip = true;
        }
    });

    if (skip) {
        return;
    }

    console.log('Grabbing ' + URL);

    // Grab page, begin the transformation (MUHAHHAHAHAHAHAHA *THUNDER CLAP*)
    request(URL, function (err, response, body) {
        if (err || response.statusCode !== 200) {
            return console.log(err);
        }

        page.markup = body;
        toMarkdown(page);
    });
}


// Extract any useful metadata
function discoverMeta(page) {
    var $ = cheerio.load(page.markup),
        pageTags = [];

    page.content = $(contentSelector).html();

    $(tagsSelector).each(function(index, element) {
        if (!element || !element.html) {
            return;
        }
        pageTags.push(element.html());
    });

    page.tags = pageTags;
    console.log(pageTags);

    $ = null;
}


// Convert page to markdown
function toMarkdown(page) {
    var und = new upndown();

    discoverMeta(page);

    und.convert(page.content, function(err, markdown) {
        if (err) {
            console.log('Could not convert to MD');
            return console.err(err);
        }
        page.markdown = markdown;
        saveToDisk(page);
    });
}


// Persist markdown to disk
function saveToDisk(page) {
    console.log('Saved ' + page.URL);
    console.log(page.markdown);
}


// Grab sitemap
request(sitemapURL, function (err, response, body) {
    if (err || response.statusCode !== 200) {
        return console.log(err);
    }

    // Parse a sitemap
    sitemap = JSON.parse(xml2json.toJson(body));

    // Spider links
    sitemap.urlset.url.forEach(function (link, index) {
        setTimeout(function () {
            fetchPage(link.loc);
        }, index * fetchInterval);
    });
});