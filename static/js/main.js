document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const pdfFileInput = document.getElementById('pdfFileInput');
    
    const itemsCard = document.getElementById('itemsCard');
    const itemsContainer = document.getElementById('itemsContainer');
    const settingsCard = document.getElementById('settingsCard');
    
    const layoutModeSelect = document.getElementById('layoutMode');
    const rowGapMmSlider = document.getElementById('rowGapMm');
    const rowGapVal = document.getElementById('rowGapVal');
    const gapSpacesInput = document.getElementById('gapSpaces');
    const marginMmInput = document.getElementById('marginMm');
    const showCutLinesCheck = document.getElementById('showCutLines');

    const formatCards = document.querySelectorAll('.format-card');
    const btnGenerate = document.getElementById('btnGenerate');
    
    // Preview Elements
    const previewEmpty = document.getElementById('previewEmpty');
    const a4PaperSheet = document.getElementById('a4PaperSheet');
    const a4GridContainer = document.getElementById('a4GridContainer');
    const statCapacity = document.getElementById('statCapacity');
    const statPattern = document.getElementById('statPattern');

    // Loaded PCB items array
    let loadedItems = [];

    // Format Card Radio Toggle Listener
    formatCards.forEach(card => {
        card.addEventListener('click', () => {
            formatCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const radio = card.querySelector('input');
            if (radio) radio.checked = true;
        });
    });

    // Slider Row Gap Display Listener
    rowGapMmSlider.addEventListener('input', (e) => {
        rowGapVal.textContent = `${e.target.value} mm`;
        updateLiveA4Preview();
    });

    layoutModeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        statPattern.textContent = val === 'pair_top_bot' ? 'Pola: TOP + BOT Pair' : 'Pola: Grid Berurutan';
        updateLiveA4Preview();
    });

    showCutLinesCheck.addEventListener('change', updateLiveA4Preview);
    gapSpacesInput.addEventListener('input', updateLiveA4Preview);
    marginMmInput.addEventListener('input', updateLiveA4Preview);

    // Drag & Drop Handlers
    ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault(); e.stopPropagation();
            dropzone.style.borderColor = '#7dd3fc';
        });
    });

    ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault(); e.stopPropagation();
            dropzone.style.borderColor = 'var(--accent-blue)';
        });
    });

    dropzone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length > 0) {
            uploadPDFFiles(e.dataTransfer.files);
        }
    });

    pdfFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadPDFFiles(e.target.files);
        }
    });

    // Upload & Inspect API Handler
    async function uploadPDFFiles(files) {
        const formData = new FormData();
        let validCount = 0;

        for (let i = 0; i < files.length; i++) {
            if (files[i].name.toLowerCase().endsWith('.pdf')) {
                formData.append('pdf_files', files[i]);
                validCount++;
            }
        }

        if (validCount === 0) {
            alert('Silakan pilih file berformat PDF.');
            return;
        }

        try {
            const res = await fetch('/api/inspect', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                data.files.forEach(fileData => {
                    fileData.pages.forEach(pageInfo => {
                        loadedItems.push({
                            id: `${fileData.file_id}_p${pageInfo.page}_${Date.now()}_${Math.random()}`,
                            file_id: fileData.file_id,
                            filename: fileData.filename,
                            page_num: pageInfo.page,
                            detected_w: pageInfo.detected_width_mm,
                            detected_h: pageInfo.detected_height_mm,
                            width_mm: pageInfo.detected_width_mm,
                            height_mm: pageInfo.detected_height_mm,
                            copies: 4, // default 4 copies
                            mirror: fileData.filename.toUpperCase().includes('BOT') || fileData.filename.toUpperCase().includes('BOTTOM'),
                            preview_b64: pageInfo.preview_b64
                        });
                    });
                });

                renderItemsList();
                updateLiveA4Preview();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert(`Gagal membaca file PDF: ${err.message}`);
        }
    }

    // Render Loaded PCB Items in Sidebar
    function renderItemsList() {
        if (loadedItems.length === 0) {
            itemsCard.classList.add('hidden');
            settingsCard.classList.add('hidden');
            previewEmpty.classList.remove('hidden');
            a4PaperSheet.classList.add('hidden');
            return;
        }

        itemsCard.classList.remove('hidden');
        settingsCard.classList.remove('hidden');
        previewEmpty.classList.add('hidden');
        a4PaperSheet.classList.remove('hidden');

        itemsContainer.innerHTML = '';

        loadedItems.forEach((item, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = `item-card ${item.mirror ? 'mirror-active' : ''}`;
            cardEl.innerHTML = `
                <img src="${item.preview_b64}" class="item-thumb" style="${item.mirror ? 'transform: scaleX(-1);' : ''}" alt="PCB">
                <div class="item-details">
                    <div class="item-title">${item.filename} (Hal. ${item.page_num})</div>
                    
                    <div class="item-dim-inputs">
                        <label>
                            W: <input type="number" class="input-num-sm input-width" data-index="${index}" value="${item.width_mm}" step="0.1" min="1"> mm
                        </label>
                        <label>
                            H: <input type="number" class="input-num-sm input-height" data-index="${index}" value="${item.height_mm}" step="0.1" min="1"> mm
                        </label>
                    </div>

                    <div class="item-controls-row">
                        <div>
                            <span style="font-size: 11px; color: var(--text-muted);">Kopi:</span>
                            <input type="number" class="input-num-sm input-copies" data-index="${index}" value="${item.copies}" min="1" max="50">
                        </div>
                        <label class="toggle-mirror">
                            <input type="checkbox" class="check-mirror" data-index="${index}" ${item.mirror ? 'checked' : ''}>
                            <span>🪞 Mirror</span>
                        </label>
                        <button class="btn-autofill" data-index="${index}" style="margin-left: auto; background: none; border: 1px solid var(--border-color); color: var(--accent-blue); padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer;">
                            Auto-Max
                        </button>
                    </div>
                </div>
            `;

            itemsContainer.appendChild(cardEl);
        });

        // Input Dimension Listeners
        document.querySelectorAll('.input-width').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                loadedItems[idx].width_mm = parseFloat(e.target.value) || loadedItems[idx].detected_w;
                updateLiveA4Preview();
            });
        });

        document.querySelectorAll('.input-height').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                loadedItems[idx].height_mm = parseFloat(e.target.value) || loadedItems[idx].detected_h;
                updateLiveA4Preview();
            });
        });

        document.querySelectorAll('.input-copies').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                loadedItems[idx].copies = Math.max(1, parseInt(e.target.value) || 1);
                updateLiveA4Preview();
            });
        });

        document.querySelectorAll('.check-mirror').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                loadedItems[idx].mirror = e.target.checked;
                renderItemsList();
                updateLiveA4Preview();
            });
        });

        document.querySelectorAll('.btn-autofill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                calculateAutoFill(idx);
            });
        });
    }

    // Auto-Fill Calculation
    function calculateAutoFill(idx) {
        const item = loadedItems[idx];
        const printableW = 210.0 - (2 * (parseFloat(marginMmInput.value) || 12.7));
        const printableH = 297.0 - (2 * (parseFloat(marginMmInput.value) || 12.7));
        const rowGap = parseFloat(rowGapMmSlider.value) || 8.0;
        const colGap = 15.0; // TAB gap

        const cols = Math.floor((printableW + colGap) / (item.width_mm + colGap));
        const rows = Math.floor((printableH + rowGap) / (item.height_mm + rowGap));
        const maxCopies = Math.max(1, cols * rows);

        loadedItems[idx].copies = maxCopies;
        renderItemsList();
        updateLiveA4Preview();
    }

    // Update Live A4 Sheet Canvas Preview
    function updateLiveA4Preview() {
        a4GridContainer.innerHTML = '';
        
        const scalePxPerMm = 500.0 / 210.0; // ~2.38 px/mm
        const rowGapPx = (parseFloat(rowGapMmSlider.value) || 8.0) * scalePxPerMm;
        const mode = layoutModeSelect.value;
        const showCutLines = showCutLinesCheck.checked;

        a4GridContainer.style.rowGap = `${rowGapPx}px`;

        let sequence = [];

        if (mode === 'pair_top_bot') {
            const topItems = loadedItems.filter(it => !it.mirror);
            const botItems = loadedItems.filter(it => it.mirror);

            const topItem = topItems.length > 0 ? topItems[0] : loadedItems[0];
            const botItem = botItems.length > 0 ? botItems[0] : loadedItems[0];

            const totalPairs = Math.min(topItem.copies, botItem.copies);

            for (let i = 0; i < totalPairs; i++) {
                sequence.push({ item: topItem, is_pair_start: true });
                sequence.push({ item: botItem, is_pair_end: true });
            }
        } else {
            loadedItems.forEach(item => {
                for (let c = 0; c < item.copies; c++) {
                    sequence.push({ item: item, is_pair_start: false, is_pair_end: false });
                }
            });
        }

        let totalPlaced = 0;

        sequence.forEach((entry, idx) => {
            const item = entry.item;
            const itemEl = document.createElement('div');
            itemEl.className = 'a4-pcb-item';
            
            const wPx = item.width_mm * scalePxPerMm;
            const hPx = item.height_mm * scalePxPerMm;
            
            itemEl.style.width = `${wPx}px`;
            itemEl.style.height = `${hPx}px`;
            
            // Add right gap depending on pair position
            if (mode === 'pair_top_bot' && entry.is_pair_start) {
                itemEl.style.marginRight = '8px'; // 7 spaces gap
            } else {
                itemEl.style.marginRight = '20px'; // TAB gap
            }

            const imgEl = document.createElement('img');
            imgEl.src = item.preview_b64;
            if (item.mirror) {
                imgEl.style.transform = 'scaleX(-1)';
            }
            
            itemEl.appendChild(imgEl);
            a4GridContainer.appendChild(itemEl);

            if (showCutLines && entry.is_pair_end && idx < sequence.length - 1) {
                const divider = document.createElement('div');
                divider.className = 'a4-cut-divider';
                a4GridContainer.appendChild(divider);
            }

            totalPlaced++;
        });

        statCapacity.textContent = `Total Ditempatkan: ${totalPlaced} PCB`;
    }

    // Generate & Download API Request
    btnGenerate.addEventListener('click', async () => {
        if (loadedItems.length === 0) return;

        btnGenerate.disabled = true;
        btnGenerate.textContent = '⏳ Generating Dokumen PCB...';

        const exportFormat = document.querySelector('input[name="exportFormat"]:checked').value;
        const layoutMode = layoutModeSelect.value;
        const gapSpaces = parseInt(gapSpacesInput.value) || 7;
        const rowGapMm = parseFloat(rowGapMmSlider.value) || 8.0;
        const marginMm = parseFloat(marginMmInput.value) || 12.7;
        const showCutLines = showCutLinesCheck.checked;

        const payload = {
            export_format: exportFormat,
            layout_mode: layoutMode,
            gap_spaces: gapSpaces,
            tab_spaces: 12,
            row_gap_mm: rowGapMm,
            margin_mm: marginMm,
            show_cut_lines: showCutLines,
            items: loadedItems.map(item => ({
                file_id: item.file_id,
                filename: item.filename,
                page_num: item.page_num,
                width_mm: item.width_mm,
                height_mm: item.height_mm,
                copies: item.copies,
                mirror: item.mirror
            }))
        };

        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const blob = await res.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = exportFormat === 'docx' ? 'PCB_Layout_Tiled_A4.docx' : 'PCB_Layout_Tiled_A4.pdf';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(downloadUrl);
            } else {
                const errData = await res.json();
                alert(`Gagal meng-generate: ${errData.error}`);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            btnGenerate.disabled = false;
            btnGenerate.textContent = '⚡ Generate & Download Layout Dokumen';
        }
    });
});
