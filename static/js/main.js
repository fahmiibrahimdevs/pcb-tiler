document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const pdfFileInput = document.getElementById('pdfFileInput');
    
    const itemsCard = document.getElementById('itemsCard');
    const itemsContainer = document.getElementById('itemsContainer');
    const settingsCard = document.getElementById('settingsCard');
    
    const btnTabFinal = document.getElementById('btnTabFinal');
    const btnTabTest = document.getElementById('btnTabTest');
    const modeFinalView = document.getElementById('modeFinalView');
    const modeTestView = document.getElementById('modeTestView');

    const slotsContainer = document.getElementById('slotsContainer');
    const btnSelectSlot1 = document.getElementById('btnSelectSlot1');
    const btnSelectAllSlots = document.getElementById('btnSelectAllSlots');
    const btnClearAllSlots = document.getElementById('btnClearAllSlots');

    const layoutModeSelect = document.getElementById('layoutMode');
    
    const rowGapMmSlider = document.getElementById('rowGapMm');
    const rowGapVal = document.getElementById('rowGapVal');
    
    const gapSpacesSlider = document.getElementById('gapSpaces');
    const gapSpacesVal = document.getElementById('gapSpacesVal');
    
    const marginMmSlider = document.getElementById('marginMm');
    const marginMmVal = document.getElementById('marginMmVal');

    const zoomPaperSlider = document.getElementById('zoomPaperSlider');
    const zoomPaperVal = document.getElementById('zoomPaperVal');
    const btnResetZoom = document.getElementById('btnResetZoom');
    
    const autoCenterCheck = document.getElementById('autoCenter');
    const showCutLinesCheck = document.getElementById('showCutLines');
    const btnAutoMaxPage = document.getElementById('btnAutoMaxPage');

    const formatCards = document.querySelectorAll('.format-card');
    const btnGenerate = document.getElementById('btnGenerate');
    
    // Preview Elements
    const previewEmpty = document.getElementById('previewEmpty');
    const a4PaperSheet = document.getElementById('a4PaperSheet');
    const a4GridContainer = document.getElementById('a4GridContainer');
    const statCapacity = document.getElementById('statCapacity');
    const statPattern = document.getElementById('statPattern');

    // App State
    let loadedItems = [];
    let activeMode = 'final'; // 'final' or 'test'
    let slotsVisibilityMap = []; // Array of booleans for TEST mode

    // Restore Saved Zoom Level from localStorage
    const savedZoom = localStorage.getItem('pcb_tiler_zoom');
    if (savedZoom && zoomPaperSlider) {
        const parsedZoom = parseInt(savedZoom, 10);
        if (!isNaN(parsedZoom) && parsedZoom >= 70 && parsedZoom <= 220) {
            zoomPaperSlider.value = parsedZoom;
            if (zoomPaperVal) zoomPaperVal.textContent = `${parsedZoom}%`;
        }
    }

    // Zoom Paper Slider Listener with LocalStorage Persistence
    if (zoomPaperSlider) {
        zoomPaperSlider.addEventListener('input', (e) => {
            const zoomVal = parseInt(e.target.value, 10);
            if (zoomPaperVal) zoomPaperVal.textContent = `${zoomVal}%`;
            localStorage.setItem('pcb_tiler_zoom', zoomVal);
            updateLiveA4Preview();
        });
    }

    if (btnResetZoom) {
        btnResetZoom.addEventListener('click', () => {
            if (zoomPaperSlider) zoomPaperSlider.value = 100;
            if (zoomPaperVal) zoomPaperVal.textContent = '100%';
            localStorage.setItem('pcb_tiler_zoom', 100);
            updateLiveA4Preview();
        });
    }

    // Mode Switcher Listener
    btnTabFinal.addEventListener('click', () => {
        activeMode = 'final';
        btnTabFinal.classList.add('active');
        btnTabTest.classList.remove('active');
        modeFinalView.classList.remove('hidden');
        modeTestView.classList.add('hidden');
        updateLiveA4Preview();
    });

    btnTabTest.addEventListener('click', () => {
        activeMode = 'test';
        btnTabTest.classList.add('active');
        btnTabFinal.classList.remove('active');
        modeTestView.classList.remove('hidden');
        modeFinalView.classList.add('hidden');
        renderSlotsList();
        updateLiveA4Preview();
    });

    // Quick Actions for TEST Mode Slots
    if (btnSelectSlot1) {
        btnSelectSlot1.addEventListener('click', () => {
            for (let i = 0; i < slotsVisibilityMap.length; i++) {
                slotsVisibilityMap[i] = (i === 0);
            }
            renderSlotsList();
            updateLiveA4Preview();
        });
    }

    if (btnSelectAllSlots) {
        btnSelectAllSlots.addEventListener('click', () => {
            for (let i = 0; i < slotsVisibilityMap.length; i++) {
                slotsVisibilityMap[i] = true;
            }
            renderSlotsList();
            updateLiveA4Preview();
        });
    }

    if (btnClearAllSlots) {
        btnClearAllSlots.addEventListener('click', () => {
            for (let i = 0; i < slotsVisibilityMap.length; i++) {
                slotsVisibilityMap[i] = false;
            }
            renderSlotsList();
            updateLiveA4Preview();
        });
    }

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

    // Slider Gap Spaces Display Listener
    gapSpacesSlider.addEventListener('input', (e) => {
        if (gapSpacesVal) gapSpacesVal.textContent = `${e.target.value} Spasi`;
        updateLiveA4Preview();
    });

    // Slider Margin A4 Display Listener
    marginMmSlider.addEventListener('input', (e) => {
        if (marginMmVal) marginMmVal.textContent = `${e.target.value} mm`;
        updateLiveA4Preview();
    });

    layoutModeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        statPattern.textContent = val === 'pair_top_bot' ? 'Pola: Pasangan (Top + Bot)' : 'Pola: Grid Berurutan';
        renderSlotsList();
        updateLiveA4Preview();
    });

    autoCenterCheck.addEventListener('change', updateLiveA4Preview);
    showCutLinesCheck.addEventListener('change', updateLiveA4Preview);

    if (btnAutoMaxPage) {
        btnAutoMaxPage.addEventListener('click', calculateAutoMaxOnePage);
    }

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
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Format Tidak Sesuai',
                    text: 'Silakan pilih file berformat PDF.',
                    icon: 'warning',
                    background: '#1e293b',
                    color: '#f8fafc',
                    confirmButtonColor: '#38bdf8'
                });
            } else {
                alert('Silakan pilih file berformat PDF.');
            }
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
                            copies: 1, // Default 1 copy per design
                            preview_b64: pageInfo.preview_b64
                        });
                    });
                });

                renderItemsList();
                renderSlotsList();
                updateLiveA4Preview();
            } else {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        title: 'Error PDF',
                        text: data.error,
                        icon: 'error',
                        background: '#1e293b',
                        color: '#f8fafc',
                        confirmButtonColor: '#ef4444'
                    });
                } else {
                    alert(`Error: ${data.error}`);
                }
            }
        } catch (err) {
            alert(`Gagal membaca file PDF: ${err.message}`);
        }
    }

    // Render Loaded PCB Items in Sidebar (Mode FINAL) with Delete Button
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
            cardEl.className = 'item-card';
            cardEl.innerHTML = `
                <img src="${item.preview_b64}" class="item-thumb" alt="PCB">
                <div class="item-details">
                    <div class="item-title flex-between">
                        <span>${item.filename} (Hal. ${item.page_num})</span>
                        <button class="btn-delete-item" data-index="${index}" style="background: none; border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; transition: all 0.2s;" title="Hapus Desain ini">🗑️ Hapus</button>
                    </div>
                    
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
                renderSlotsList();
                updateLiveA4Preview();
            });
        });

        document.querySelectorAll('.input-height').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                loadedItems[idx].height_mm = parseFloat(e.target.value) || loadedItems[idx].detected_h;
                renderSlotsList();
                updateLiveA4Preview();
            });
        });

        document.querySelectorAll('.input-copies').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                loadedItems[idx].copies = Math.max(1, parseInt(e.target.value) || 1);
                renderSlotsList();
                updateLiveA4Preview();
            });
        });

        document.querySelectorAll('.btn-autofill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                calculateAutoFill(idx);
            });
        });

        // Delete Item Button Listener with SweetAlert2 Confirmation
        document.querySelectorAll('.btn-delete-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const itemToDelete = loadedItems[idx];

                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        title: 'Hapus Desain PCB?',
                        html: `Apakah Anda yakin ingin menghapus <strong>"${itemToDelete.filename}"</strong> (Hal. ${itemToDelete.page_num})?`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#ef4444',
                        cancelButtonColor: '#334155',
                        confirmButtonText: 'Ya, Hapus!',
                        cancelButtonText: 'Batal',
                        background: '#1e293b',
                        color: '#f8fafc'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            loadedItems.splice(idx, 1);
                            renderItemsList();
                            renderSlotsList();
                            updateLiveA4Preview();
                            Swal.fire({
                                title: 'Berhasil Dihapus!',
                                text: 'Desain PCB telah dihapus dari daftar.',
                                icon: 'success',
                                timer: 1400,
                                showConfirmButton: false,
                                background: '#1e293b',
                                color: '#f8fafc'
                            });
                        }
                    });
                } else {
                    if (confirm(`Hapus "${itemToDelete.filename}"?`)) {
                        loadedItems.splice(idx, 1);
                        renderItemsList();
                        renderSlotsList();
                        updateLiveA4Preview();
                    }
                }
            });
        });
    }

    // Build Current Layout Sequence for Universal N-File Support
    function buildSequence() {
        const mode = layoutModeSelect.value;
        let seq = [];

        if (mode === 'pair_top_bot') {
            let allUnits = [];
            loadedItems.forEach(item => {
                const copies = item.copies || 1;
                for (let c = 0; c < copies; c++) {
                    allUnits.push(item);
                }
            });

            let i = 0;
            while (i < allUnits.length) {
                const isPair = (i + 1 < allUnits.length);
                const itemA = allUnits[i];

                seq.push({
                    item: itemA,
                    is_pair_start: isPair,
                    is_pair_end: false,
                    label: `${itemA.filename} (Hal. ${itemA.page_num})`
                });

                if (isPair) {
                    const itemB = allUnits[i + 1];
                    seq.push({
                        item: itemB,
                        is_pair_start: false,
                        is_pair_end: true,
                        label: `${itemB.filename} (Hal. ${itemB.page_num})`
                    });
                    i += 2;
                } else {
                    i += 1;
                }
            }
        } else {
            loadedItems.forEach(item => {
                for (let c = 0; c < item.copies; c++) {
                    seq.push({
                        item: item,
                        is_pair_start: false,
                        is_pair_end: false,
                        label: `${item.filename} (Hal. ${item.page_num})`
                    });
                }
            });
        }

        return seq;
    }

    // Render TEST Mode Slots Checkboxes List
    function renderSlotsList() {
        if (loadedItems.length === 0) return;

        const seq = buildSequence();
        
        // Synchronize slotsVisibilityMap length with sequence length
        if (slotsVisibilityMap.length !== seq.length) {
            const newMap = [];
            for (let i = 0; i < seq.length; i++) {
                newMap.push(i < slotsVisibilityMap.length ? slotsVisibilityMap[i] : true);
            }
            slotsVisibilityMap = newMap;
        }

        slotsContainer.innerHTML = '';

        seq.forEach((entry, idx) => {
            const isChecked = slotsVisibilityMap[idx];
            const slotCard = document.createElement('div');
            slotCard.className = `slot-card ${isChecked ? 'slot-active' : ''}`;
            slotCard.innerHTML = `
                <div class="slot-info">
                    <div class="slot-title">Slot #${idx + 1}: ${entry.label}</div>
                    <div class="slot-sub">${entry.item.width_mm} x ${entry.item.height_mm} mm</div>
                </div>
                <label class="checkbox-label" style="margin: 0;">
                    <input type="checkbox" class="chk-slot-vis" data-slot="${idx}" ${isChecked ? 'checked' : ''}>
                    <span>👁️ Cetak</span>
                </label>
            `;

            slotsContainer.appendChild(slotCard);
        });

        // Slot Checkbox Click Listeners
        document.querySelectorAll('.chk-slot-vis').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const sIdx = parseInt(e.target.dataset.slot);
                slotsVisibilityMap[sIdx] = e.target.checked;
                renderSlotsList();
                updateLiveA4Preview();
            });
        });
    }

    // Auto-Max Fill 1 Page Calculation for Multi-Design Layout
    function calculateAutoMaxOnePage() {
        if (loadedItems.length === 0) return;

        const marginMm = parseFloat(marginMmSlider.value) || 12.7;
        const printableW = 210.0 - (2 * marginMm);
        const printableH = 297.0 - (2 * marginMm);
        const rowGap = parseFloat(rowGapMmSlider.value) || 14.0;
        const mode = layoutModeSelect.value;
        const gapSpaces = parseInt(gapSpacesSlider.value) || 7;
        const pairGapMm = (gapSpaces / 7.0) * 5.0;
        const tabGapMm = 15.0;

        let maxW = 0;
        let maxH = 0;
        loadedItems.forEach(it => {
            if (it.width_mm > maxW) maxW = it.width_mm;
            if (it.height_mm > maxH) maxH = it.height_mm;
        });

        if (mode === 'pair_top_bot' && loadedItems.length >= 2) {
            const pairW = (maxW * 2) + pairGapMm;
            const cols = Math.floor((printableW + tabGapMm) / (pairW + tabGapMm));
            const rows = Math.floor((printableH + rowGap) / (maxH + rowGap));
            const maxPairs = Math.max(1, cols * rows);

            loadedItems.forEach(it => {
                it.copies = maxPairs;
            });
        } else {
            loadedItems.forEach(item => {
                const cols = Math.floor((printableW + tabGapMm) / (item.width_mm + tabGapMm));
                const rows = Math.floor((printableH + rowGap) / (item.height_mm + rowGap));
                item.copies = Math.max(1, cols * rows);
            });
        }

        renderItemsList();
        renderSlotsList();
        updateLiveA4Preview();
    }

    function calculateAutoFill(idx) {
        calculateAutoMaxOnePage();
    }

    // Update Live A4 Sheet Canvas Preview with Dynamic Zoom & Margin Support
    function updateLiveA4Preview() {
        a4GridContainer.innerHTML = '';
        
        // Base width for A4 sheet visualizer at 100% zoom
        const baseSheetWidthPx = 560;
        const zoomPercent = parseInt(zoomPaperSlider ? zoomPaperSlider.value : 120, 10) || 120;
        
        const currentSheetWidthPx = (baseSheetWidthPx * (zoomPercent / 100.0));
        const currentSheetHeightPx = currentSheetWidthPx * (297.0 / 210.0); // Exact 1 : 1.414 ratio

        // Apply dynamic canvas dimensions
        a4PaperSheet.style.width = `${currentSheetWidthPx}px`;
        a4PaperSheet.style.height = `${currentSheetHeightPx}px`;

        const marginMm = parseFloat(marginMmSlider.value) || 12.7;
        const marginPx = (marginMm / 210.0) * currentSheetWidthPx;
        a4PaperSheet.style.padding = `${marginPx}px`;

        const printableWidthPx = currentSheetWidthPx - (2 * marginPx);
        const scalePxPerMm = printableWidthPx / (210.0 - (2 * marginMm));

        const rowGapPx = (parseFloat(rowGapMmSlider.value) || 14.0) * scalePxPerMm;
        const printableW_mm = 210.0 - (2 * marginMm);

        const mode = layoutModeSelect.value;
        const showCutLines = showCutLinesCheck.checked;
        const autoCenter = autoCenterCheck.checked;

        a4GridContainer.style.rowGap = '0px';

        const sequence = buildSequence();

        // Calculate dynamic pair gap in mm from spaces input (7 spaces = 5mm -> 0.714mm per space)
        const gapSpaces = parseInt(gapSpacesSlider.value) || 7;
        const pairGapMm = (gapSpaces / 7.0) * 5.0;
        const tabGapMm = 15.0;

        // Group sequence into rows based on printable width with automatic line wrapping
        let rows = [];
        let currentRow = [];
        let currentW = 0;

        sequence.forEach((entry, idx) => {
            const item = entry.item;
            const w_mm = item.width_mm;
            
            let gap_before = 0;
            if (currentW > 0) {
                gap_before = (mode === 'pair_top_bot' && !entry.is_pair_start) ? pairGapMm : tabGapMm;
            }

            if (currentW + gap_before + w_mm > printableW_mm + 0.1) {
                rows.push(currentRow);
                currentRow = [];
                currentW = 0;
                gap_before = 0;
            }

            entry.gap_before = gap_before;
            entry.slot_index = idx;
            entry.visible = (activeMode === 'test') ? (slotsVisibilityMap[idx] !== false) : true;

            currentRow.push(entry);
            currentW += (gap_before + w_mm);
        });

        if (currentRow.length > 0) {
            rows.push(currentRow);
        }

        let totalPlaced = 0;
        let totalActivePrinted = 0;

        rows.forEach((row, rowIdx) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'a4-grid-row';
            if (autoCenter) {
                rowEl.style.justifyContent = 'center';
            } else {
                rowEl.style.justifyContent = 'flex-start';
            }

            row.forEach((entry, entryIdx) => {
                const item = entry.item;
                const isStart = entry.is_pair_start;
                const gapBeforeMm = entry.gap_before;
                const isVisible = entry.visible;

                if (entryIdx > 0) {
                    if (showCutLines && (mode !== 'pair_top_bot' || isStart)) {
                        const halfGapPx = (gapBeforeMm / 2.0) * scalePxPerMm;
                        const divider = document.createElement('div');
                        divider.className = 'a4-cut-divider-vert';
                        divider.style.marginLeft = `${halfGapPx}px`;
                        divider.style.marginRight = `${halfGapPx}px`;
                        rowEl.appendChild(divider);
                    } else {
                        const gapPx = gapBeforeMm * scalePxPerMm;
                        const spacer = document.createElement('div');
                        spacer.style.width = `${gapPx}px`;
                        rowEl.appendChild(spacer);
                    }
                }

                const itemEl = document.createElement('div');
                const wPx = item.width_mm * scalePxPerMm;
                const hPx = item.height_mm * scalePxPerMm;

                itemEl.style.width = `${wPx}px`;
                itemEl.style.height = `${hPx}px`;

                if (isVisible) {
                    itemEl.className = 'a4-pcb-item';
                    const imgEl = document.createElement('img');
                    imgEl.src = item.preview_b64;
                    itemEl.appendChild(imgEl);
                    totalActivePrinted++;
                } else {
                    itemEl.className = 'a4-pcb-item slot-hidden';
                    itemEl.innerHTML = `<span>Slot #${entry.slot_index + 1}<br>(Kosong)</span>`;
                }
                
                rowEl.appendChild(itemEl);
                totalPlaced++;
            });

            a4GridContainer.appendChild(rowEl);

            if (rowIdx < rows.length - 1) {
                if (showCutLines) {
                    const halfRowGapPx = rowGapPx / 2.0;
                    const horizDivider = document.createElement('div');
                    horizDivider.className = 'a4-cut-divider-horiz';
                    horizDivider.style.marginTop = `${halfRowGapPx}px`;
                    horizDivider.style.marginBottom = `${halfRowGapPx}px`;
                    a4GridContainer.appendChild(horizDivider);
                } else {
                    rowEl.style.marginBottom = `${rowGapPx}px`;
                }
            }
        });

        if (activeMode === 'test') {
            statCapacity.textContent = `Mode TEST: ${totalActivePrinted} dari ${totalPlaced} Slot Dicetak`;
        } else {
            statCapacity.textContent = `Total Ditempatkan: ${totalPlaced} PCB (${rows.length} Baris)`;
        }
    }

    // Generate & Download API Request
    btnGenerate.addEventListener('click', async () => {
        if (loadedItems.length === 0) return;

        btnGenerate.disabled = true;
        btnGenerate.textContent = '⏳ Generating Dokumen PCB...';

        const exportFormat = document.querySelector('input[name="exportFormat"]:checked').value;
        const layoutMode = layoutModeSelect.value;
        const gapSpaces = parseInt(gapSpacesSlider.value) || 7;
        const rowGapMm = parseFloat(rowGapMmSlider.value) || 14.0;
        const marginMm = parseFloat(marginMmSlider.value) || 12.7;
        const showCutLines = showCutLinesCheck.checked;
        const autoCenter = autoCenterCheck.checked;

        const payload = {
            export_format: exportFormat,
            layout_mode: layoutMode,
            gap_spaces: gapSpaces,
            tab_spaces: 12,
            row_gap_mm: rowGapMm,
            margin_mm: marginMm,
            show_cut_lines: showCutLines,
            auto_center: autoCenter,
            items: loadedItems.map(item => ({
                file_id: item.file_id,
                filename: item.filename,
                page_num: item.page_num,
                width_mm: item.width_mm,
                height_mm: item.height_mm,
                copies: item.copies
            }))
        };

        if (activeMode === 'test') {
            payload.slots_visibility = slotsVisibilityMap;
        }

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
