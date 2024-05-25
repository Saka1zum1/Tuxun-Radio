(function() {
    'use strict';
    async function runScript() {

        const { value: option,dismiss: inputDismiss } = await Swal.fire({
            title: 'Input JSON Data',
            text: 'Do you want to input data from the clipboard? If you click "Cancel", you will need to upload a JSON file.',
            icon: 'question',
            showCancelButton: true,
            showCloseButton:true,
            allowOutsideClick: false,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes',
            cancelButtonText: 'Cancel'
        });

        let data;
        if (option) {

            const text = await navigator.clipboard.readText();
            try {
                data = JSON.parse(text);
            } catch (error) {
                Swal.fire('Error parsing JSON data! ', 'The input JSON data is invalid or incorrectly formatted.','error');
                return;
            }
        } else if(inputDismiss==='cancel'){

            const input = document.createElement('input');
            input.type = 'file';
            input.style.display = 'none'
            document.body.appendChild(input);

            data = await new Promise((resolve) => {
                input.addEventListener('change', async () => {
                    const file = input.files[0];
                    const reader = new FileReader();

                    reader.onload = (event) => {
                        try {
                            const result = JSON.parse(event.target.result);
                            resolve(result);

                            document.body.removeChild(input);
                        } catch (error) {
                            Swal.fire('Error Parsing JSON Data!', 'The input JSON data is invalid or incorrectly formatted.','error');
                        }
                    };

                    reader.readAsText(file);
                });


                input.click();
            });
        }
            async function downloadPanoramaImage(panoId, fileName,panoramaWidth,panoramaHeight) {
                return new Promise(async (resolve, reject) => {
                    try {
                        const imageUrl = `https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=apiv3&panoid=${panoId}&output=tile&zoom=5&nbt=1&fover=2`;
                        const tileWidth = 512;
                        const tileHeight = 512;

                        const tilesPerRow = Math.min(Math.ceil(panoramaWidth / tileWidth),32);
                        const tilesPerColumn = Math.min(Math.ceil(panoramaHeight / tileHeight),16);

                        const canvasWidth = tilesPerRow * tileWidth;
                        const canvasHeight = tilesPerColumn * tileHeight;

                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = canvasWidth;
                        canvas.height = canvasHeight;

                        for (let y = 0; y < tilesPerColumn; y++) {
                            for (let x = 0; x < tilesPerRow; x++) {
                                const tileUrl = `${imageUrl}&x=${x}&y=${y}`;
                                const tile = await loadImage(tileUrl);
                                ctx.drawImage(tile, x * tileWidth, y * tileHeight, tileWidth, tileHeight);
                            }
                        }

                        canvas.toBlob(blob => {
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = fileName;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            resolve();
                        }, 'image/jpeg');
                    } catch (error) {
                        reject(error);
                    }
                });
            }


            async function loadImage(url) {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error(`Failed to load image from ${url}`));
                    img.src = url;
                });
            }

            var CHUNK_SIZE = 5;
            var promises = [];

            async function processChunk(chunk) {
            var service = new google.maps.StreetViewService();
            var promises = chunk.map(async coord => {
                let panoId = coord.panoId;
                if (!panoId && coord.extra.panoId) {
                    panoId = coord.extra.panoId;
                }
                let latLng = {lat: coord.lat, lng: coord.lng};
                let svData;

                if ((panoId || latLng)) {
                    svData = await getSVData(service, panoId ? {pano: panoId} : {location: latLng, radius: 50});
                }


                if (svData.tiles.worldSize) {
                    const w=svData.tiles.worldSize.width
                    const h=svData.tiles.worldSize.height
                    const fileName = `${panoId}.jpg`;
                    await downloadPanoramaImage(panoId, fileName,w,h);
                }

            });

            await Promise.all(promises);
        }

            function getSVData(service, options) {
                return new Promise(resolve => service.getPanorama({...options}, (data, status) => {
                    resolve(data);
                }));
            }

            async function processData() {
                try {
                    const totalChunks = Math.ceil(data.customCoordinates.length / CHUNK_SIZE);
                    let processedChunks = 0;

                    const swal = Swal.fire({
                        title: 'Downloading',
                        text: 'Please wait...',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        showConfirmButton: false,
                        didOpen: () => {
                            Swal.showLoading();
                        }
                    });

                    for (let i = 0; i < data.customCoordinates.length; i += CHUNK_SIZE) {
                        let chunk = data.customCoordinates.slice(i, i + CHUNK_SIZE);
                        await processChunk(chunk);
                        processedChunks++;

                        const progress = Math.min((processedChunks / data.customCoordinates.length) * 100, 100);
                        Swal.update({
                            html: `<div>${progress.toFixed(2)}% completed</div>
                       <div class="swal2-progress">
                           <div class="swal2-progress-bar" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100" style="width: ${progress}%;">
                           </div>
                       </div>`
                        });
                    }
                    swal.close();
                    Swal.fire({
                        title: 'Success!',
                        text: 'Download completed',
                        icon: 'success'
                    });
                } catch (error) {
                    swal.close();
                    Swal.fire({
                        title: 'Error!',
                        text: 'Download failed,please check if your panoId is valid.',
                        icon: 'error'
                    });
                    console.error('Error processing JSON data:', error);
                }
            }
        if(data.customCoordinates){
            if(data.customCoordinates.length>=1){processData();}
            else{Swal.fire('Error Parsing JSON Data!', 'The input JSON data is empty.','error');}
        }else{Swal.fire('Error Parsing JSON Data!', 'The input JSON data is invaild or incorrectly formatted.','error');}
    }
    var downloadButton=document.createElement('button');
    downloadButton.textContent='Download StreetView'
    downloadButton.addEventListener('click', runScript);
    downloadButton.style.position = 'fixed';
    downloadButton.style.right = '140px';
    downloadButton.style.bottom = '20px';
    downloadButton.style.borderRadius = "18px";
    downloadButton.style.fontSize ="14px";
    downloadButton.style.padding = "10px 20px";
    downloadButton.style.border = "none";
    downloadButton.style.color = "white";
    downloadButton.style.cursor = "pointer";
    downloadButton.style.backgroundColor = "#4CAF50";
    document.body.appendChild(downloadButton);
