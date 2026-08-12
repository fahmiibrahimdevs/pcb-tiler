import io
import math
import pymupdf as fitz  # PyMuPDF
from PIL import Image, ImageOps
from docx import Document
from docx.shared import Mm, Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm as reportlab_mm

# A4 Constants in mm
A4_WIDTH_MM = 210.0
A4_HEIGHT_MM = 297.0

# Margin Narrow in mm (0.5 inch = 12.7 mm)
DEFAULT_MARGIN_MM = 12.7

class PCBProcessor:
    """
    Core Engine for PCB PDF Extraction, Dimension Detection,
    Grid Layout Tiling, Pair Patterning, and Exporting to PDF & DOCX.
    """

    @staticmethod
    def inspect_pdf(pdf_bytes: bytes) -> dict:
        """
        Inspects PDF bytes and extracts PCB dimensions, bounding boxes,
        and high-res previews for each page.
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages_info = []

        for page_num in range(len(doc)):
            page = doc[page_num]

            # Standard page dimensions (in points: 72 points = 1 inch = 25.4 mm)
            rect = page.rect
            page_w_mm = round(rect.width * 25.4 / 72.0, 2)
            page_h_mm = round(rect.height * 25.4 / 72.0, 2)

            # Try to detect actual non-white drawing bounding box
            pix = page.get_pixmap(dpi=300)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            
            # Convert to grayscale for bounding box detection
            gray = img.convert("L")
            # Find non-white pixels (threshold 250)
            bw = gray.point(lambda p: 255 if p < 250 else 0)
            bbox = bw.getbbox() # (left, top, right, bottom)

            if bbox:
                left, top, right, bottom = bbox
                crop_w_px = right - left
                crop_h_px = bottom - top
                crop_w_mm = round((crop_w_px / 300.0) * 25.4, 2)
                crop_h_mm = round((crop_h_px / 300.0) * 25.4, 2)
                
                # Crop actual PCB drawing
                cropped_img = img.crop(bbox)
            else:
                crop_w_mm = page_w_mm
                crop_h_mm = page_h_mm
                cropped_img = img

            # Convert preview to base64 or PNG bytes
            buffer = io.BytesIO()
            cropped_img.save(buffer, format="PNG")
            img_png_bytes = buffer.getvalue()

            pages_info.append({
                "page": page_num + 1,
                "page_width_mm": page_w_mm,
                "page_height_mm": page_h_mm,
                "content_width_mm": crop_w_mm,
                "content_height_mm": crop_h_mm,
                "detected_width_mm": crop_w_mm,
                "detected_height_mm": crop_h_mm,
                "png_bytes": img_png_bytes
            })

        doc.close()
        return {
            "total_pages": len(pages_info),
            "pages": pages_info
        }

    @staticmethod
    def render_pcb_image(pdf_bytes: bytes, page_num: int = 1, crop_content: bool = True, mirror: bool = False) -> tuple:
        """
        Renders a specific PCB PDF page into a high-DPI (300 DPI) PIL Image and returns (PIL.Image, width_mm, height_mm).
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if page_num < 1 or page_num > len(doc):
            page_num = 1
        page = doc[page_num - 1]

        pix = page.get_pixmap(dpi=300)
        img = Image.open(io.BytesIO(pix.tobytes("png")))

        rect = page.rect
        w_mm = rect.width * 25.4 / 72.0
        h_mm = rect.height * 25.4 / 72.0

        if crop_content:
            gray = img.convert("L")
            bw = gray.point(lambda p: 255 if p < 250 else 0)
            bbox = bw.getbbox()
            if bbox:
                left, top, right, bottom = bbox
                w_mm = round(((right - left) / 300.0) * 25.4, 2)
                h_mm = round(((bottom - top) / 300.0) * 25.4, 2)
                img = img.crop(bbox)

        if mirror:
            img = ImageOps.mirror(img)

        doc.close()
        return img, round(w_mm, 2), round(h_mm, 2)

    @staticmethod
    def generate_docx(
        items: list,
        gap_spaces: int = 7,
        tab_spaces: int = 12,
        row_gap_mm: float = 8.0,
        margin_mm: float = DEFAULT_MARGIN_MM,
        layout_mode: str = "pair_top_bot",
        show_cut_lines: bool = True
    ) -> bytes:
        """
        Generates a DOCX document formatted on A4 paper with Narrow margins.
        Supports TOP/BOT pair layout (TOP [7 spaces] BOT [TAB] TOP [7 spaces] BOT),
        adjustable vertical row gap, and optional dashed cut guidelines.
        """
        doc = Document()
        
        # Configure A4 Page & Narrow Margins
        section = doc.sections[0]
        section.page_width = Mm(A4_WIDTH_MM)
        section.page_height = Mm(A4_HEIGHT_MM)
        section.top_margin = Mm(margin_mm)
        section.bottom_margin = Mm(margin_mm)
        section.left_margin = Mm(margin_mm)
        section.right_margin = Mm(margin_mm)

        spaces_str = " " * gap_spaces
        tab_str = " " * tab_spaces  # Tab spacing between pairs

        # Flatten sequence of images according to layout mode
        sequence = []
        if layout_mode == "pair_top_bot":
            # Separate TOP and BOT items
            top_items = [it for it in items if not it.get("mirror", False)]
            bot_items = [it for it in items if it.get("mirror", False)]

            if not top_items and items:
                top_items = items
            if not bot_items and items:
                bot_items = items

            top_item = top_items[0]
            bot_item = bot_items[0]

            total_pairs = min(top_item.get("copies", 1), bot_item.get("copies", 1))

            for i in range(total_pairs):
                sequence.append({"item": top_item, "is_pair_start": True})
                sequence.append({"item": bot_item, "is_pair_end": True})
        else:
            # Sequential Grid Mode
            for item in items:
                copies = item.get("copies", 1)
                for c in range(copies):
                    sequence.append({"item": item, "is_pair_start": False, "is_pair_end": False})

        # Build paragraphs line by line
        printable_w_mm = A4_WIDTH_MM - (2 * margin_mm)
        current_p = doc.add_paragraph()
        current_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        current_p.paragraph_format.space_before = Pt(0)
        # Convert row_gap_mm to points (1mm ≈ 2.83465 pt)
        current_p.paragraph_format.space_after = Pt(row_gap_mm * 2.83465)
        current_p.paragraph_format.line_spacing = 1.0

        current_line_w_mm = 0.0

        for idx, entry in enumerate(sequence):
            item = entry["item"]
            is_start = entry["is_pair_start"]
            is_end = entry["is_pair_end"]

            img = item["image"]
            w_mm = item["width_mm"]
            h_mm = item["height_mm"]

            # Convert PIL image to PNG bytes
            img_buf = io.BytesIO()
            img.save(img_buf, format="PNG")
            img_buf.seek(0)

            # Determine spacing before this image
            add_gap = ""
            gap_w_mm = 0.0

            if current_line_w_mm > 0:
                if layout_mode == "pair_top_bot" and is_end:
                    # Inside same pair: 7 spaces (~5mm)
                    add_gap = spaces_str
                    gap_w_mm = 5.0
                else:
                    # Between different pairs or items: TAB gap (~15mm)
                    add_gap = tab_str
                    gap_w_mm = 15.0

            # Check if image + gap fits on current line
            if current_line_w_mm + gap_w_mm + w_mm > printable_w_mm + 1.0:
                # Wrap to next row paragraph
                current_p = doc.add_paragraph()
                current_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                current_p.paragraph_format.space_before = Pt(0)
                current_p.paragraph_format.space_after = Pt(row_gap_mm * 2.83465)
                current_p.paragraph_format.line_spacing = 1.0
                
                current_line_w_mm = 0.0
                add_gap = ""
                gap_w_mm = 0.0

            if add_gap:
                current_p.add_run(add_gap)
                current_line_w_mm += gap_w_mm

            run_img = current_p.add_run()
            run_img.add_picture(img_buf, width=Mm(w_mm), height=Mm(h_mm))
            current_line_w_mm += w_mm

            # Draw optional divider text guideline if enabled
            if show_cut_lines and is_end and idx < len(sequence) - 1:
                current_p.add_run("  ┆  ")
                current_line_w_mm += 4.0

        output_buf = io.BytesIO()
        doc.save(output_buf)
        return output_buf.getvalue()

    @staticmethod
    def generate_pdf(
        items: list,
        gap_spaces: int = 7,
        tab_gap_mm: float = 15.0,
        row_gap_mm: float = 8.0,
        margin_mm: float = DEFAULT_MARGIN_MM,
        layout_mode: str = "pair_top_bot",
        show_cut_lines: bool = True
    ) -> bytes:
        """
        Generates a 1:1 scale Print-Ready PDF on A4 paper using ReportLab.
        Draws exact TOP/BOT pairs, vertical row gaps, and dashed cutting guidelines.
        """
        output_buf = io.BytesIO()
        c = canvas.Canvas(output_buf, pagesize=A4)
        
        printable_w = A4_WIDTH_MM - (2 * margin_mm)
        printable_h = A4_HEIGHT_MM - (2 * margin_mm)

        curr_x = margin_mm
        curr_y = A4_HEIGHT_MM - margin_mm  # Y origin at top

        # Build sequence of items
        sequence = []
        if layout_mode == "pair_top_bot":
            top_items = [it for it in items if not it.get("mirror", False)]
            bot_items = [it for it in items if it.get("mirror", False)]

            if not top_items and items:
                top_items = items
            if not bot_items and items:
                bot_items = items

            top_item = top_items[0]
            bot_item = bot_items[0]
            total_pairs = min(top_item.get("copies", 1), bot_item.get("copies", 1))

            for i in range(total_pairs):
                sequence.append({"item": top_item, "is_pair_start": True})
                sequence.append({"item": bot_item, "is_pair_end": True})
        else:
            for item in items:
                for cp in range(item.get("copies", 1)):
                    sequence.append({"item": item, "is_pair_start": False, "is_pair_end": False})

        pair_gap_mm = 5.0  # 7 spaces equivalent ~5mm

        max_row_height = 0.0

        for idx, entry in enumerate(sequence):
            item = entry["item"]
            is_start = entry["is_pair_start"]
            is_end = entry["is_pair_end"]

            img = item["image"]
            w_mm = item["width_mm"]
            h_mm = item["height_mm"]

            # Convert PIL image to PNG bytes
            img_buf = io.BytesIO()
            img.save(img_buf, format="PNG")
            img_buf.seek(0)

            from reportlab.lib.utils import ImageReader
            rl_img = ImageReader(img_buf)

            # Determine gap before item
            current_gap = 0.0
            if curr_x > margin_mm:
                if layout_mode == "pair_top_bot" and is_end:
                    current_gap = pair_gap_mm
                else:
                    current_gap = tab_gap_mm

            # Check line overflow
            if curr_x + current_gap + w_mm > A4_WIDTH_MM - margin_mm + 0.1:
                # Wrap to next row
                curr_x = margin_mm
                curr_y -= (max_row_height + row_gap_mm)
                max_row_height = 0.0
                current_gap = 0.0

            # Check page overflow
            if curr_y - h_mm < margin_mm - 0.1:
                c.showPage()
                curr_x = margin_mm
                curr_y = A4_HEIGHT_MM - margin_mm
                max_row_height = 0.0
                current_gap = 0.0

            curr_x += current_gap
            max_row_height = max(max_row_height, h_mm)

            # Draw PCB Image
            draw_y = curr_y - h_mm
            c.drawImage(
                rl_img,
                curr_x * reportlab_mm,
                draw_y * reportlab_mm,
                width=w_mm * reportlab_mm,
                height=h_mm * reportlab_mm,
                mask='auto'
            )

            # Draw optional dashed cut line between pairs
            if show_cut_lines:
                c.saveState()
                c.setDash(2, 3)
                c.setStrokeColor(colors.HexColor('#94a3b8'))
                c.setLineWidth(0.4)

                if is_end:
                    # Draw vertical cut line after pair
                    cut_x = (curr_x + w_mm + (tab_gap_mm / 2.0)) * reportlab_mm
                    c.line(cut_x, (draw_y - 2) * reportlab_mm, cut_x, (curr_y + 2) * reportlab_mm)

                c.restoreState()

            curr_x += w_mm

        c.save()
        return output_buf.getvalue()
