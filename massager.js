/**
 * @license
 * wordpress-to-markdown (https://github.com/wtff0nzie/wordpress-to-markdown)
 * Copyright Dez Iddon and other contributors
 * Released under MIT license
 */

'use strict';

const config = require('./package.json').settings,
    cheerio = require('cheerio'),
    url = require('url'),
    fs = require('fs');


// Site specific cleaning
let massager = (markup, callback) => {
    let $;

    if (!markup) {
        return callback('Markup is empty');
    }

    $ = cheerio.load(markup);

    // Update image src
    $('img').each((index, img) => {
        let src = url.parse($(img).attr('src')).path.split('/');

        $(img).attr('src', '/media/img/blog/' + src[src.length - 1])
    });

    // Remove scripts
    $('script').each((index, script) => {
        $(script).remove();
    });

    // Remove old comments el
    $('#disqus_thread').remove();

    markup = $('.blog-text').html();

    callback(null, markup);
};


module.exports = massager;