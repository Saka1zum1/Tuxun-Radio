var originalOpen = window.XMLHttpRequest.prototype.open;
var currentRound = 0;
var mode, newRound, country;
var radioPlayer = null;
var radioStations = [];
var playerContainer = null;
var switchButton = null;
var closeButton = null;
var reOpenButton = null;
var currentStationIndex = 0;
 
window.XMLHttpRequest.prototype.open = function(method, url) {
        if (url.includes('getGooglePanoInfoPost') || url.includes('getGameInfo') || url.includes('next?gameId')) {
            var self = this;
            this.addEventListener('readystatechange', function() {
                if (self.readyState === 4 && self.status === 200) {
                    handleResponse(self.responseText, url);
                }
            });
        }
        return originalOpen.apply(this, arguments);
    };
 
function handleResponse(responseText, url) {
        try {
            var responseData = JSON.parse(responseText);
            if (url.includes('next?gameId') || url.includes('getGameInfo')) {
                mode = responseData.data.type;
                newRound = responseData.data.currentRound;
            }
 
            if (url.includes('getGooglePanoInfoPost')) {
                var newCountry = responseData[1][0][5][0][1][4];
                if (newCountry === null) {
                    var lat = responseData[1][0][5][0][1][0][2];
                    var lng = responseData[1][0][5][0][1][0][3];
                    getCountryCode(lat, lng).then(function(countryCode) {
                        if (mode && newRound && countryCode && mode !== 'solo_match' && mode!=='daily_challenge'&&newRound !== currentRound && countryCode !== country) {
                            currentRound = newRound;
                            country = countryCode;
                            searchRadioStations(countryCode);
                        }
                    });
                } else {
                    if (mode && newRound && newCountry && mode !== 'solo_match' &&mode!=='daily_challenge'&& newRound !== currentRound && newCountry !== country) {
                        currentRound = newRound;
                        country = newCountry;
                        searchRadioStations(newCountry);
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing response:', error);
        }
    }
 
function getCountryCode(lat, lng) {
        return new Promise(function(resolve, reject) {
            var apiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
            GM_xmlhttpRequest({
                method: "GET",
                url: apiUrl,
                onload: function(response) {
                    if (response.status == 200) {
                        var data = JSON.parse(response.responseText);
                        var countryCode = data.address.country_code;
                        resolve(countryCode);
                    } else {
                        console.error("OSM request failed:", response.statusText);
                        reject(response.statusText);
                    }
                },
                onerror: function(err) {
                    console.error("OSM request error:", err);
                    reject(err);
                }
            });
        });
    }
 
function searchRadioStations(country) {
        var params = {
            format: "json",
            hidebroken: true,
            order: "clickcount",
            reverse: true,
            limit: 50,
            countrycode: country,
        };
        var apiUrl = "https://de1.api.radio-browser.info/json/stations/search";
        var queryParams = new URLSearchParams(params).toString();
        var requestUrl = `${apiUrl}?${queryParams}`;
        GM_xmlhttpRequest({
            method: "GET",
            url: requestUrl,
            onload: function(response) {
                if (response.status == 200) {
                    var data = JSON.parse(response.responseText);
                    if (data.length > 0) {
                        radioStations = data;
                        createRadioPlayer(data);
                        autoPlayRadio();
                    } else {
                        console.error("No available radio stations.");
                    }
                } else {
                    console.error("API request failed:", response.statusText);
                }
            },
            onerror: function(err) {
                console.error("API request error:", err);
            }
        });
    }
 
function createRadioPlayer(data) {
        if (radioPlayer) {
            removeRadioPlayer();
        }
        playerContainer = document.createElement('div');
        playerContainer.style.position = 'fixed';
        playerContainer.style.top = '10px';
        playerContainer.style.left = '100px';
        playerContainer.style.opacity = '0.7';
        radioPlayer = document.createElement('audio');
        var station = getCurrentStation(data);
        var source = document.createElement('source');
 
        radioPlayer.appendChild(source);
        radioPlayer.controls = true;
        playerContainer.appendChild(radioPlayer);
        switchButton = createButton('换台', switchStation);
        closeButton = createButton('关闭', closeRadio);
        switchButton.style.color = 'orange';
        switchButton.style.fontSize = '12px';
        switchButton.style.position = 'fixed';
        switchButton.style.opacity = '0.7';
        switchButton.style.top = '12px';
        switchButton.style.left = '410px';
        closeButton.style.position = 'fixed';
        closeButton.style.opacity = '0.7';
        closeButton.style.top = '42px';
        closeButton.style.left = '410px';
        closeButton.style.color = 'orange';
        closeButton.style.fontSize = '12px';
        document.body.appendChild(switchButton);
        document.body.appendChild(closeButton);
        document.body.appendChild(playerContainer);
    }
 
function removeRadioPlayer() {
        radioPlayer.pause();
        radioPlayer.parentNode.removeChild(radioPlayer);
        playerContainer.parentNode.removeChild(playerContainer);
        switchButton.parentNode.removeChild(switchButton);
        closeButton.parentNode.removeChild(closeButton);
        if (reOpenButton) {
            reOpenButton.parentNode.removeChild(reOpenButton);
        }
    }
 
function createButton(text, onClick) {
        var button = document.createElement('button');
        button.textContent = text;
        button.addEventListener('click', onClick);
        return button;
    }
 
function autoPlayRadio() {
        if (radioPlayer && radioStations.length > 0) {
            var maxAttempts = 5;
            var attempts = 0;
            var playNextStation = function() {
                currentStationIndex = (currentStationIndex + 1) % radioStations.length;
                var station = getCurrentStation(radioStations);
                if (station) {
                    radioPlayer.src = station.url_resolved;
                    radioPlayer.play()
                        .then(function() {
                            console.log("Radio playback successful.");
                        })
                        .catch(function(error) {
                            attempts++;
                            if (attempts < maxAttempts) {
                                console.error("Failed to play radio. Trying next station...");
                                playNextStation();
                            } else {
                                console.error("Max attempts reached. Failed to play radio.");
                            }
                        });
                } else {
                    console.error("Invalid station index");
                }
            };
            playNextStation();
        } else {
            console.error("Player or station list not ready");
        }
    }
 
function switchStation() {
        currentStationIndex = (currentStationIndex + 1) % radioStations.length;
        playNextStation();
    }
 
function playNextStation() {
        var station = getCurrentStation(radioStations);
        if (station) {
            radioPlayer.src = station.url_resolved;
            radioPlayer.play();
        } else {
            console.error("Invalid station index");
        }
    }
 
function closeRadio() {
        if (radioPlayer) {
            removeRadioPlayer();
        }
    }
 
function getCurrentStation(stations) {
        return stations[currentStationIndex];
    }
