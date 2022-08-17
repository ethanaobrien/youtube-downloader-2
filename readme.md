# youtube downloader

A simple function that will return the urls of a youtube video

```js
var dl = require('youtube-downloader-ethanaobrien');
dl('https://www.youtube.com/watch?v=y2jYeFCIpRY').then(function(info) {
    console.log(info.urls); //Array of video info objects
    console.log(info.video); //Array of video info objects
    console.log(info.audio); //Array of video info objects
    console.log(info.videoTitle); //the title of the video
})
```

## video info object

`item.url`: The url of the media

`item.mimeType`: The mimetype of the media

`item.bitrate`: The bitrate of the media

`item.width`: The width of the media

`item.height`: The height of the media

`item.fps`: The fps of the media

`item.contentLength`: The size (in bytes) of the media

`item.qualityLabel`: Example `360p`, `1080p`

`item.approxDurationMs`: Duration of audio (in miliseconds)

`item.audioChannels`: Number of audio channels
