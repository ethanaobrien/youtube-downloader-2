const https = require('https');

function fetch(url, cookies) {
    return new Promise(function(resolve, reject) {
        var req = https.request(url, {method: "GET"});
        if (cookies) {
            req.setHeader('cookie', cookies);
        }
        req.on('response', async function(res) {
            if ([301,302,307,308].includes(res.statusCode)) {
                if (res.headers.location) {
                    try {
                        resolve(await fetch(res.headers.location));
                    } catch(e) {
                        reject(e);
                    }
                } else {
                    reject();
                }
                return;
            }
            if (!res.statusCode.toString().startsWith('2')) {
                reject(new Error('status code is not ok'));
            }
            var body = Buffer.from('');
            res.on('data', function(chunk) {
                if (chunk) {
                    body = Buffer.concat([body, chunk])
                }
            })
            res.on('end', function() {
                resolve(body.toString());
            })
        })
        req.end();
    })
}


async function getSigFunc() {
    var body = await fetch('https://www.youtube.com/');
    var a = body.split('base.js')[0];
    var b = a.split('/s/player/').pop();
    var ytBaseLink = 'https://www.youtube.com/s/player/' + b + 'base.js';
    var body = await fetch(ytBaseLink);
    var func1 = body.split('a=a.split("")').pop().split('}')[0];
    var mainFunc = eval('(function() {return function(a) {a=a.split("")'+func1+'}})();');
    var varibaleName = func1.split('.')[0].split(';').pop();
    var func1 = func1.replaceAll(varibaleName + '.', '');
    var modules = func1.split(';');
    for (var i=0; i<modules.length; i++) {
        modules[i] = modules[i].split('(')[0];
    };
    modules.splice(modules.length-1, 1);
    modules.splice(0, 1);
    var a = [];
    for (var i=0; i<modules.length; i++) {
        if (! a.includes(modules[i])) {
            a.push(modules[i]);
        };
    };
    var p = {};
    p.mainFunc = mainFunc;
    p.varName = varibaleName;
    for (var i=0; i<a.length; i++) {
        var y = body.split(a[i] + ':function').pop().split('}')[0];
        var c = 'function ' + y + '}';
        p[a[i]] = eval('(function() {return '+c+'})();');
    };
    return p;
};

async function decryptURL(e) {
    if (! global['yt_decrypt_function_loaded']) {
        var u = await getSigFunc();
        global[u.varName] = u;
        global['yt_decrypt_function_loaded'] = true;
        setTimeout(function() {
            global['yt_decrypt_function_loaded'] = false;
        }, 7200000) //refresh every 2 hours
        global.decryptSig = u.mainFunc;
    };
    var url = e.split('&');
    var a = {};
    for (var i=0; i<url.length; i++) {
        var b = url[i].split('=');
        a[b[0]] = b[1];
    };
    a.s = decodeURIComponent(a.s);
    a.url = decodeURIComponent(a.url);
    return a.url+'&'+a.sp+'='+decryptSig(a.s);
};

async function getVideo(link, opts) {
    if (!opts) opts={};
    var v;
    if (link.includes('v=')) {
        v = link.split('v=').pop();
    } else if (link.includes('embed/')) {
        v = link.split('embed/').pop().split('?')[0].split('/')[0];
    } else if (link.includes('youtu.be')) {
        v = link.split('youtu.be/').pop().split('?')[0].split('/')[0];
    } else {
        v = link;
    }
    var ytLink = 'https://www.youtube.com/watch?v='+v;
    try {
        var body = await fetch(ytLink, opts.cookie||opts.cookies);
    } catch(e) {
        console.error(e);
        throw new Error('failed to fetch');
    }
    try {
        var scriptPt1 = body.split('<script' + body.split('var ytInitialPlayerResponse = ')[0].split('<script').pop() + 'var ytInitialPlayerResponse = ')[1].split('</script>')[0];
        var info = eval('(function() {return '+scriptPt1+'})();');
    } catch(e) {
        console.error(e);
        throw new Error('error parsing data');
    }
    //console.log(info)
    if (!info.streamingData) {
        throw new Error('This video requires signin');
    }
    try {
        var urls = info.streamingData.formats;
        var adaptiveUrls = info.streamingData.adaptiveFormats;
        var videoTitle = info.videoDetails.title;
    } catch(e) {
        console.error(e);
        throw new Error('Error reading video details');
    };
    try {
        for (var i=0; i<urls.length; i++) {
            var a = urls[i].cipher || urls[i].signatureCipher;
            if (a) {
                urls[i].url = await decryptURL(a);
                delete urls[i].cipher;
                delete urls[i].signatureCipher;
            };
        };
        for (var i=0; i<adaptiveUrls.length; i++) {
            var a = adaptiveUrls[i].cipher || adaptiveUrls[i].signatureCipher;
            if (a) {
                adaptiveUrls[i].url = await decryptURL(a);
                delete adaptiveUrls[i].cipher;
                delete adaptiveUrls[i].signatureCipher;
            };
        };
    } catch(e) {
        console.error(e);
        throw new Error('Error decrypting urls');
    }
    var out = {urls:urls,audio:[],video:[],videoTitle:videoTitle};
    for (var i=0; i<adaptiveUrls.length; i++) {
        if (adaptiveUrls[i].mimeType.split('/')[0] === 'video') {
            out.video.push(adaptiveUrls[i]);
        } else if (adaptiveUrls[i].mimeType.split('/')[0] === 'audio') {
            out.audio.push(adaptiveUrls[i]);
        }
    }
    return out;
}

module.exports = getVideo;
