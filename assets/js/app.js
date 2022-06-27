self.addEventListener('install', function (event) {
    event.waitUntil(caches.open('sw-cache').then(function (cache) {
        return cache.add('/assets/css/page.css').add('/assets/css/darkly.css');
    }));
});

self.addEventListener('fetch', function (event) {
    event.respondWidth(caches.match(event.request).then(function (response) {
        return response || fetch(event.request);
    }));
});

$(function () {
    var app = new Vue({
        el: '#contain_el',
        data: {
            title: "",
            dayzlog: null,
            players_online: null,
            current_date_formatted: "",
            current_date: "",
            archive_files: [],
            player_list: [],
            selected_file: {
                file_name: '',
                date: '',
                date_formatted: ''
            },
            map: {
                'width': 0,
                'height': 0,
                'coords': []
            },
            displayMode: 'map',
            mapType: 'map_full',
            mapName: 'namalsk',
            deathCount: 0,
            timeoutInSec: 0.5,
            interval: null,
            currentLog: false,
        },
        mounted() {
            this.loadLog(false, this.update, this.selected_file.file_name);
            this.interval = setInterval(() => {
                this.loadLog(false, this.update, this.selected_file.file_name);
            }, 10000);

            this.draw();
        },
        created() {
            window.addEventListener("resize", this.draw);
        },
        destroyed() {
            window.removeEventListener("resize", this.draw);
        },
        watch: {
            selected_file: function (val) {
                clearInterval(this.interval);
                if (!val) {
                    this.changeDisplayMode('log');
                }
                this.loadLog(false, this.update, this.selected_file.file_name);

                if (this.displayMode !== 'archive') {
                    this.interval = setInterval(() => {
                        this.loadLog(false, this.update, this.selected_file.file_name);
                    }, 10000);
                }
            }
        },
        methods: {
            loadLog: function (init, callBack, archive_file) {
                if (archive_file === 'DayZServer_x64.ADM') {
                    this.currentLog = true;
                } else {
                    this.currentLog = false;
                }
                $.ajax({
                    url: './readLog.php',
                    dataType: 'json',
                    method: 'POST',
                    data: {
                        log_file: archive_file
                    },
                    success: function (data) {
                        callBack(data);
                    },
                    error: function (error) {
                        console.log(error);
                    }
                });
            },
            setMapType: function (type) {
                this.mapType = type;
                this.draw();
            },
            update: function (log) {
                this.title = log.title;
                this.players_online = log.players_online;
                this.dayzlog = log.log;
                this.current_date_formatted = log.current_date_formatted;
                this.current_date = log.current_date;
                this.archive_files = log.archive_files;
                this.player_list = log.player_list;

                if (!this.selected_file.file_name) {
                    this.selected_file = log.archive_files[0];
                }
                this.draw();
            },
            displayDateTime: function (dateTime) {
                var date = new Date('2020/09/28 ' + dateTime);
                return date.toLocaleTimeString();
            },
            convertMinutesToHoursAndMinutes: function (minutes) {
                var hours = Math.floor(minutes / 60);
                var minutes = Math.floor(minutes % 60);
                return hours + ' hrs. ' + minutes + ' min.';
            },
            draw: function () {
                if (this.displayMode === 'map') {
                    setTimeout(() => {
                        var img = document.getElementById(this.mapType);
                        img.src = '/maps/' + this.mapName + '/' + this.mapType + '.jpg';

                        var cnvs = document.getElementById("map_canvas");
                        cnvs.height = img.clientHeight;
                        cnvs.width = img.clientWidth;
                        cnvs.style.position = "absolute";
                        cnvs.style.left = img.offsetLeft + "px";
                        cnvs.style.top = img.offsetTop + "px";

                        var setPins = [];
                        var count = 2;
                        var now = new Date();
                        var nowHour = now.getHours();
                        var setCoords = [];

                        for (var entryIndex in this.dayzlog) {
                            var coords = this.dayzlog[entryIndex].coords;

                            var logDateArray = this.dayzlog[entryIndex].date.split(":");
                            var logHour = logDateArray[0];
                            var diff = nowHour - logHour;

                            if (((diff <= 1 && diff >= -1 && this.players_online > 0) || !this.currentLog) && coords.length && this.dayzlog[entryIndex].player && this.dayzlog[entryIndex].player.id && setPins.indexOf(this.dayzlog[entryIndex].player.id) === -1) {
                                if (this.isOnMap(coords)) {

                                    //create pointer circle to exact location
                                    var ctx = cnvs.getContext("2d");
                                    ctx.beginPath();
                                    ctx.arc(this.getLRCoord(coords[0]), this.getNSCoord(coords[1]), 3, 0, 2 * Math.PI, false);
                                    ctx.lineWidth = 3;
                                    ctx.fillStyle = this.dayzlog[entryIndex].player.color;
                                    ctx.fill();

                                    var flop = this.isNear(coords, setCoords);

                                    //Create square box
                                    var ctx = cnvs.getContext("2d");
                                    ctx.fillRect(this.getLRCoord(coords[0]) - (ctx.measureText(this.dayzlog[entryIndex].player.name + ' - ' + this.dayzlog[entryIndex].date).width + 10) / 2, (this.getNSCoord(coords[1]) - (flop ? -5 :15)), ctx.measureText(this.dayzlog[entryIndex].player.name + ' - ' + this.dayzlog[entryIndex].date).width + 10, 12);
                                    ctx.fillStyle = '#FFFFFF';
                                    ctx.font = "11px arial";

                                    //Write name ontop of square box
                                    var ctx = cnvs.getContext("2d");
                                    ctx.fillStyle = 'black';
                                    ctx.fillText(this.dayzlog[entryIndex].player.name + ' - ' + this.dayzlog[entryIndex].date, this.getLRCoord(coords[0]) - (ctx.measureText(this.dayzlog[entryIndex].player.name + ' - ' + this.dayzlog[entryIndex].date).width + 1) / 2, this.getNSCoord(coords[1]) - (flop ? -15 :5));
                                    console.log(entryIndex);
                                }
                                setPins.push(this.dayzlog[entryIndex].player.id);
                                setCoords.push(coords);

                                count++;
                            }
                        }
                    }, (this.timeoutInSec * 1000));
                }
            },
            isNear: function (coords, setCoords) {
                for (var cP of setCoords) {
                    var d = Math.sqrt(Math.pow(coords[0] - cP[0], 2) + Math.pow(coords[1] - cP[1], 2));
                    if (d < 150) {
                        return true;
                    }
                }
                return false;
            },
            isOnMap: function (coords) {
                var lr_value = this.getLRCoord(coords[0], true);
                var ns_value = this.getNSCoord(coords[1], true);
                var mp = (this.mapType == 'map_full' ? 1 : (this.mapType == 'map_nw' || this.mapType == 'map_sw') ? 2 : 0.5);
                if (this.mapType == 'map_full') {
                    return true;
                }
                if ((this.mapType == 'map_nw' && lr_value < 50 && ns_value < 50)) {
                    return true;
                }
                if ((this.mapType == 'map_sw' && lr_value < 50 && ns_value >= 50)) {
                    return true;
                }
                if ((this.mapType == 'map_ne' && lr_value >= 50 && ns_value < 50)) {
                    return true;
                }
                if ((this.mapType == 'map_se' && lr_value >= 50 && ns_value >= 50)) {
                    return true;
                }
                return false;
            },
            getLRCoord: function (sCoord, returnPercent = false) {
                var mp = (this.mapType == 'map_full' ? 1 : ((this.mapType == 'map_ne' || this.mapType == 'map_se') ? 0.5 : 2));
                sCoord = Math.round(sCoord);
                var img = document.getElementById(this.mapType);
                var maxMapX = 12800;
                var maxImg = img.clientWidth;
                var percX = (100 / maxMapX) * (sCoord);
                var imgCoord = Math.floor(percX / (100 / maxImg)) * mp;
                if (returnPercent) {
                    return percX;
                }
                return imgCoord;
            },
            getNSCoord: function (sCoord, returnPercent = false) {
                var img = document.getElementById(this.mapType);
                var maxMapY = 12800;
                sCoord = Math.round(maxMapY - sCoord);
                var maxImg = img.clientHeight;
                var percY = ((100 / maxMapY) * (sCoord)) * 1.53;
                var mp = (this.mapType == 'map_full' ? 1 : ((this.mapType == 'map_se' || this.mapType == 'map_sw') ? 0.5 : 2));
                var imgCoord = Math.floor(percY / (100 / maxImg)) * mp;
                if (returnPercent) {
                    return percY;
                }
                return imgCoord;
            },
            changeDisplayMode: function (mode) {
                this.displayMode = mode;
                if (this.displayMode === 'archive') {
                    this.selected_file = this.archive_files[0] ? this.archive_files[0] : {file_name: '', date: null};
                } else {
                    this.selected_file = {file_name: '', date: null};
                }

                if (this.displayMode === 'map') {
                    this.draw();
                }
            },
            checkDevice: function () {
                const userAgent = window.navigator.userAgent.toLowerCase();

                // Detects if device is on iOS 
                const isIos = () => {
                    return /iphone|ipad|ipod/.test(userAgent);
                }

                const isAndroid = () => {
                    return /android/.test(userAgent);
                }

                // Detects if device is in standalone mode
                const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

                // Checks if should display install popup notification:
                if (isIos() && !isInStandaloneMode()) {
                    $.toast({
                        text: "To install this app on your iOS device, click the share button and choose Add to Homescreen",
                        position: "bottom-center",
                        heading: "Install Webapp",
                        bgColor: "#303030",
                        textColor: "#fff",
                        hideAfter: false,
                        stack: false
                    });
                }

                if (isAndroid() && !isInStandaloneMode()) {
                    $.toast({
                        text: "To install this app on your Android device, go to settings and choose INSTALL APP or ADD TO HOMESCREEN",
                        position: "bottom-center",
                        heading: "Install Webapp",
                        bgColor: "#303030",
                        textColor: "#fff",
                        hideAfter: false,
                        stack: false
                    });
                    this.setState({showInstallMessage: true});
                }

            }
        },
        computed: {
            getLog: function () {
                this.deathCount = 0;
                var logArray = [];
                var previousLog = null;
                if (this.dayzlog != null) {
                    for (logEntry of this.dayzlog) {
                        if (logEntry.type.type != 'update' && (previousLog === null || previousLog.msg !== logEntry.msg || previousLog.date !== logEntry.date)) {
                            logArray.push(logEntry);
                            previousLog = logEntry;
                        }

                        if (logEntry.type.type === "death" || logEntry.type.status === "kill") {
                            this.deathCount++;
                        }
                    }
                }
                return logArray;
            }
        }
    });
});