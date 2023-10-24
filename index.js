(async () => {
    const https = require('https');
    let yt_decrypt_function_loaded = false;
    let decryptSig;
    let yt_player_url_loaded = false;
    let playerUrl;

    function fetch(url, cookies, opts) {
        return new Promise(function(resolve, reject) {
            const req = https.request(url, {method: (opts && opts.method) || "GET"});
            if (cookies) {
                req.setHeader('cookie', cookies);
            }
            req.on('response', async function(res) {
                if ([301, 302, 307, 308].includes(res.statusCode)) {
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
                let body = Buffer.from('');
                res.on('data', function(chunk) {
                    if (chunk) {
                        body = Buffer.concat([body, chunk])
                    }
                })
                res.on('end', function() {
                    resolve(body.toString());
                })
            })
            if (opts && opts.method === "POST") {
                req.setHeader("content-length", opts.body.length);
                req.write(opts.body);
            }
            req.end();
        })
    }
/* todo - as there is no DOMParser
    async function xml2vtt(url, videoTitle) {
        if (Array.isArray(url)) {
            let rv = '<h2>Vtt files (subtitles)</h2><ul>';
            for (let i=0; i<url.length; i++) {
                rv += '<p>'+url[i].name.simpleText+' - <a href="'+URL.createObjectURL(new Blob([await xml2vtt(url[i].baseUrl)], {type: 'text/vtt; chartset=utf-8'}))+'" download="'+videoTitle.htmlEscape()+'-'+url[i].name.simpleText+'.vtt">Download</a></p>\n';
            }
            rv += '</ul>';
            return rv;
        }
        let xml = await fetch(url);
        xml = await xml.text();
        if (!xml.trim()) {
            return null;
        }
        function decodeHtml(html) {
            let txt = document.createElement("textarea");
            txt.innerHTML = html;
            return txt.value;
        };
        // function from https://www.codegrepper.com/code-examples/javascript/javascript+convert+seconds+into+hours+and+minutes
        function numberStuff(value) {
            const sec = parseInt(value, 10);
            let hours   = Math.floor(sec / 3600);
            let minutes = Math.floor((sec - (hours * 3600)) / 60);
            let seconds = sec - (hours * 3600) - (minutes * 60);
            if (hours   < 10) {hours   = "0"+hours;}
            if (minutes < 10) {minutes = "0"+minutes;}
            if (seconds < 10) {seconds = "0"+seconds;}
            return hours+':'+minutes+':'+seconds;
        }
        function parseTime(time, duration) {
            let decimal = time.split('.').pop();
            while (decimal.length < 3) {
                decimal += '0';
            };
            let number = time.split('.')[0];
            duration = parseInt(time) + parseInt(duration);
            duration = duration.toString();
            let totalDecimal = duration.split('.').pop();
            while (totalDecimal.length < 3) {
                totalDecimal += '0';
            };
            totalDecimal = parseInt(totalDecimal)+parseInt(decimal);
            totalDecimal = totalDecimal.toString();
            let totalNumber = duration.split('.')[0];
            if (totalDecimal.length > 3) {
                totalDecimal = totalDecimal.substring(1);
                totalNumber = (parseInt(totalNumber)+1).toString();
            }
            number = numberStuff(number);
            totalNumber = numberStuff(totalNumber);
            let newLine = number + '.' + decimal + ' --> ' + totalNumber + '.' + totalDecimal;
            return newLine;
        };
        let parser = new DOMParser();
        let xml = parser.parseFromString(xml, "application/xml");
        let vttData = 'WEBVTT';
        let x = xml.getElementsByTagName('text');
        for (let i = 0; i < x.length; i++) {
            let time = parseTime(x[i].getAttribute('start'), x[i].getAttribute('dur'));
            let text = x[i].innerHTML;
            vttData += '\n\n' + time + '\n' + decodeHtml(text);
        };
        return vttData;
    };
*/
    async function getBaseJSFile() {
        let body = await fetch('https://www.youtube.com/');
        let a = body.split('base.js')[0];
        let b = a.split('/s/player/').pop();
        const ytBaseLink = 'https://www.youtube.com/s/player/' + b + 'base.js';
        return await fetch(ytBaseLink);
    }

    async function getSigFunc() {
        let body = await getBaseJSFile();
        let func1 = body.split('a=a.split("")').pop().split('}')[0];
        const mainFunc = eval('(function() {return function(a) {a=a.split("")'+func1+'}})();');
        const varibaleName = func1.split('.')[0].split(';').pop();
        func1 = func1.replaceAll(varibaleName + '.', '');
        const modules = func1.split(';');
        for (let i=0; i<modules.length; i++) {
            modules[i] = modules[i].split('(')[0];
        };
        modules.splice(modules.length-1, 1);
        modules.splice(0, 1);
        let a = [];
        for (let i=0; i<modules.length; i++) {
            if (!a.includes(modules[i])) {
                a.push(modules[i]);
            };
        };
        let p = {};
        p.mainFunc = mainFunc;
        p.varName = varibaleName;
        for (let i=0; i<a.length; i++) {
            const y = body.split(a[i] + ':function').pop().split('}')[0];
            const c = 'function ' + y + '}';
            p[a[i]] = eval('(function() {return '+c+'})();');
        };
        return p;
    };

    async function decryptURL(e) {
        if (!yt_decrypt_function_loaded) {
            const u = await getSigFunc();
            global[u.varName] = u;
            yt_decrypt_function_loaded = true;
            setTimeout(() => {
                yt_decrypt_function_loaded = false;
            }, 7200000) //refresh every 2 hours
            decryptSig = u.mainFunc;
        };
        const url = e.split('&');
        const a = {};
        for (let i=0; i<url.length; i++) {
            const b = url[i].split('=');
            a[b[0]] = b[1];
        };
        a.s = decodeURIComponent(a.s);
        a.url = decodeURIComponent(a.url);
        return a.url+'&'+a.sp+'='+decryptSig(a.s);
    }
    /*
    async function getPlayerUrl() {
        if (!yt_player_url_loaded) {
            const key = (await getBaseJSFile()).split("https://www.youtube.com/youtubei/v1/player?key=").pop().split('"')[0];
            playerUrl = "https://www.youtube.com/youtubei/v1/player?key=" + key
            yt_player_url_loaded = true;
            setTimeout(() => {
                yt_player_url_loaded = false;
            }, 7200000) //refresh every 2 hours
        }
        return playerUrl;
    }

    async function fetchFromPlayer(videoId, cookies) {
        let url = await getPlayerUrl();
        let data = await fetch(url, cookies, {method: "POST", body: JSON.stringify({"context":{"client":{"hl":"en","gl":"US","deviceMake":"Google","deviceModel":"ChromeBook","visitorData":"","userAgent":"Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36","clientName":"WEB","clientVersion":"2.20231020.00.01","osName":"CrOS","osVersion":"14541.0.0","originalUrl":"https://www.youtube.com/watch?v="+videoId,"screenPixelDensity":1,"platform":"DESKTOP","clientFormFactor":"UNKNOWN_FORM_FACTOR","configInfo":{},"screenDensityFloat":1.188118815422058,"userInterfaceTheme":"USER_INTERFACE_THEME_DARK","timeZone":"America/Chicago","browserName":"Chrome","browserVersion":"118.0.0.0","acceptHeader":"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,* / *;q=0.8,application/signed-exchange;v=b3;q=0.7","deviceExperimentId":"","screenWidthPoints":961,"screenHeightPoints":801,"utcOffsetMinutes":-300,"memoryTotalKbytes":"8000000","clientScreen":"WATCH","mainAppWebInfo":{"graftUrl":"/watch?v="+videoId,"pwaInstallabilityStatus":"PWA_INSTALLABILITY_STATUS_CAN_BE_INSTALLED","webDisplayMode":"WEB_DISPLAY_MODE_BROWSER","isWebNativeShareAvailable":true}},"user":{"lockedSafetyMode":false},"request":{"useSsl":true,"internalExperimentFlags":[],"consistencyTokenJars":[]}},"videoId":videoId,"params":"","playbackContext":{"contentPlaybackContext":{"currentUrl":"/watch?v="+videoId,"vis":0,"splay":false,"autoCaptionsDefaultOn":false,"autonavState":"STATE_NONE","html5Preference":"HTML5_PREF_WANTS","autoplay":true,"autonav":true,"referer":"https://www.youtube.com/","lactMilliseconds":"-1","watchAmbientModeContext":{"hasShownAmbientMode":true,"watchAmbientModeEnabled":true}}},"racyCheckOk":false,"contentCheckOk":false})});
        return JSON.parse(data);
    }*/

    async function fetchFromPage(videoId, cookies) {
        const ytLink = "https://www.youtube.com/watch?v=" + videoId;
        let body;
        try {
            body = await fetch(ytLink, cookies);
        } catch(e) {
            console.error(e);
            throw new Error('failed to fetch');
        }
        const scriptPt1 = body.split('<script' + body.split('var ytInitialPlayerResponse = ')[0].split('<script').pop() + 'var ytInitialPlayerResponse = ')[1].split('</script>')[0];
        return eval('(function() {return '+scriptPt1+'})();');
    }

    async function getInfoJSON(videoId, cookies) {
        return await fetchFromPage(videoId, cookies);
        //console.log(JSON.parse(JSON.stringify(info)));
    }

    async function getVideo(link, opts) {
        if (!opts) opts={};
        let v;
        if (link.includes('v=')) {
            v = link.split('v=').pop().split("&")[0];
        } else if (link.includes('embed/')) {
            v = link.split('embed/').pop().split('?')[0].split('/')[0];
        } else if (link.includes('youtu.be')) {
            v = link.split('youtu.be/').pop().split('?')[0].split('/')[0];
        } else {
            v = link;
        }
        let info = await getInfoJSON(v, opts.cookie||opts.cookies);
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
            for (let i=0; i<urls.length; i++) {
                let a = urls[i].cipher || urls[i].signatureCipher;
                if (a) {
                    urls[i].url = await decryptURL(a);
                    delete urls[i].cipher;
                    delete urls[i].signatureCipher;
                };
            };
            for (let i=0; i<adaptiveUrls.length; i++) {
                let a = adaptiveUrls[i].cipher || adaptiveUrls[i].signatureCipher;
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
        let out = {urls:urls,audio:[],video:[],videoTitle:videoTitle};
        for (let i=0; i<adaptiveUrls.length; i++) {
            if (adaptiveUrls[i].mimeType.split('/')[0] === 'video') {
                out.video.push(adaptiveUrls[i]);
            } else if (adaptiveUrls[i].mimeType.split('/')[0] === 'audio') {
                out.audio.push(adaptiveUrls[i]);
            }
        }
        return out;
    }

    
    //todo, a "stream" feature, to pull data like youtube to speed things up?
    //console.log((await getVideo("6SSBZWBRYng")).urls[0]);

    module.exports = getVideo;

})();

