import os
import io
import base64
from flask import Flask, render_template, request, jsonify, send_file
from pcb_processor import PCBProcessor

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024  # 64MB max upload limit

# In-memory storage for uploaded PDF files during active session
UPLOAD_CACHE = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/inspect', methods=['POST'])
def inspect_endpoint():
    """
    Receives PDF files, extracts pages, bounding box dimensions (mm), and base64 preview images.
    """
    if 'pdf_files' not in request.files:
        return jsonify({'error': 'Tidak ada file PDF yang diunggah.'}), 400

    files = request.files.getlist('pdf_files')
    if not files or files[0].filename == '':
        return jsonify({'error': 'File PDF tidak boleh kosong.'}), 400

    results = []

    for file in files:
        if not file.filename.lower().endswith('.pdf'):
            continue

        try:
            pdf_bytes = file.read()
            file_id = f"{file.filename}_{len(pdf_bytes)}"
            UPLOAD_CACHE[file_id] = pdf_bytes

            inspect_data = PCBProcessor.inspect_pdf(pdf_bytes)
            
            pages_list = []
            for p in inspect_data['pages']:
                b64_img = base64.b64encode(p['png_bytes']).decode('utf-8')
                pages_list.append({
                    'page': p['page'],
                    'page_width_mm': p['page_width_mm'],
                    'page_height_mm': p['page_height_mm'],
                    'detected_width_mm': p['detected_width_mm'],
                    'detected_height_mm': p['detected_height_mm'],
                    'preview_b64': f"data:image/png;base64,{b64_img}"
                })

            results.append({
                'file_id': file_id,
                'filename': file.filename,
                'total_pages': inspect_data['total_pages'],
                'pages': pages_list
            })

        except Exception as e:
            return jsonify({'error': f"Gagal membaca PDF {file.filename}: {str(e)}"}), 500

    return jsonify({
        'success': True,
        'files': results
    })

@app.route('/api/generate', methods=['POST'])
def generate_endpoint():
    """
    Generates PDF or DOCX layout document with 600 DPI binarization, 14mm default row gap, cut lines,
    and optional fixed-position slots_visibility for TEST mode.
    """
    try:
        data = request.get_json() or {}
        export_format = data.get('export_format', 'pdf').lower()  # 'pdf' or 'docx'
        layout_mode = data.get('layout_mode', 'pair_top_bot')      # 'pair_top_bot' or 'grid'
        
        gap_spaces = int(data.get('gap_spaces', 7))
        tab_spaces = int(data.get('tab_spaces', 12))
        row_gap_mm = float(data.get('row_gap_mm', 14.0))
        margin_mm = float(data.get('margin_mm', 12.7))
        show_cut_lines = bool(data.get('show_cut_lines', True))
        auto_center = bool(data.get('auto_center', True))
        slots_visibility = data.get('slots_visibility', None)

        items_config = data.get('items', [])

        if not items_config:
            return jsonify({'error': 'Tidak ada item PCB yang dipilih.'}), 400

        processed_items = []

        for item in items_config:
            file_id = item.get('file_id')
            page_num = int(item.get('page_num', 1))
            override_w = float(item.get('width_mm', 0))
            override_h = float(item.get('height_mm', 0))
            copies = int(item.get('copies', 1))
            crop_content = bool(item.get('crop_content', True))

            if file_id not in UPLOAD_CACHE:
                return jsonify({'error': f'File session {file_id} tidak ditemukan. Silakan upload ulang file.'}), 400

            pdf_bytes = UPLOAD_CACHE[file_id]
            pil_img, detected_w, detected_h = PCBProcessor.render_pcb_image(
                pdf_bytes=pdf_bytes,
                page_num=page_num,
                crop_content=crop_content
            )

            final_w = override_w if override_w > 0 else detected_w
            final_h = override_h if override_h > 0 else detected_h

            processed_items.append({
                'image': pil_img,
                'width_mm': final_w,
                'height_mm': final_h,
                'copies': copies,
                'label': item.get('filename', 'PCB')
            })

        if export_format == 'docx':
            docx_bytes = PCBProcessor.generate_docx(
                processed_items,
                gap_spaces=gap_spaces,
                tab_spaces=tab_spaces,
                row_gap_mm=row_gap_mm,
                margin_mm=margin_mm,
                layout_mode=layout_mode,
                show_cut_lines=show_cut_lines,
                auto_center=auto_center,
                slots_visibility=slots_visibility
            )
            return send_file(
                io.BytesIO(docx_bytes),
                mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                as_attachment=True,
                download_name='PCB_Layout_Tiled_A4.docx'
            )
        else:
            pdf_bytes = PCBProcessor.generate_pdf(
                processed_items,
                gap_spaces=gap_spaces,
                tab_gap_mm=15.0,
                row_gap_mm=row_gap_mm,
                margin_mm=margin_mm,
                layout_mode=layout_mode,
                show_cut_lines=show_cut_lines,
                auto_center=auto_center,
                slots_visibility=slots_visibility
            )
            return send_file(
                io.BytesIO(pdf_bytes),
                mimetype='application/pdf',
                as_attachment=True,
                download_name='PCB_Layout_Tiled_A4.pdf'
            )

    except Exception as e:
        return jsonify({'error': f"Gagal meng-generate dokumen: {str(e)}"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5050))
    print(f"🚀 PCB Layout Tiler running on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
