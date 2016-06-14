var sitemap = require('./package.json').sitemap,
    xml2json = require('xml2json'),
    request = require('request'),
    cheerio = require('cheerio');


console.log('Fetching ' + sitemap);

function extractContent(page) {

};



// Grab sitemap
request(sitemap, function (err, response, body) {
    if (err || response.statusCode !== 200) {
        return console.log(err);
    }

    // Parse a sitemap
    sitemap = JSON.parse(xml2json.toJson(data));

    // Spider linkes
    sitemap.urlset.url.forEach(function (link, index) {
        setTimeout(function () {
            console.log('Grabbing ' + link.loc);
        }, index * 3 * 1000);
    });
});