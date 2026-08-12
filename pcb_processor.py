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
    Grid Layout Tiling, and Exporting to PDF & DOCX.
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
    def calculate_max_capacity(pcb_w_mm: float, pcb_h_mm: float, gap_mm: float = 5.0, margin_mm: float = DEFAULT_MARGIN_MM) -> dict:
        """
        Calculates how many PCB copies fit in portrait and landscape orientation on an A4 page.
        """
        printable_w = A4_WIDTH_MM - (2 * margin_mm)
        printable_h = A4_HEIGHT_MM - (2 * margin_mm)

        # Portrait orientation
        cols_p = math.floor((printable_w + gap_mm) / (pcb_w_mm + gap_mm))
        rows_p = math.floor((printable_h + gap_mm) / (pcb_h_mm + gap_mm))
        total_p = max(0, cols_p * rows_p)

        # Landscape orientation
        cols_l = math.floor((printable_w + gap_mm) / (pcb_h_mm + gap_mm))
        rows_l = math.floor((printable_h + gap_mm) / (pcb_w_mm + gap_mm))
        total_l = max(0, cols_l * rows_l)

        return {
            "portrait": {"cols": max(0, cols_p), "rows": max(0, rows_p), "total": total_p},
            "landscape": {"cols": max(0, cols_l), "rows": max(0, rows_l), "total": total_l},
            "max_copies": max(total_p, total_l)
        }

    @staticmethod
    def generate_docx(items: list, gap_spaces: int = 7, margin_mm: float = DEFAULT_MARGIN_MM) -> bytes:
        """
        Generates a DOCX document formatted on A4 paper with Narrow margins.
        Items list contains dicts: { "image": PIL.Image, "width_mm": float, "height_mm": float, "copies": int, "label": str }
        Pastes copies separated by specified number of spaces (default 7 spaces).
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

        # Create paragraph for PCB items
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.0

        item_count = 0
        for item in items:
            img = item["image"]
            width_mm = item["width_mm"]
            height_mm = item["height_mm"]
            copies = item.get("copies", 1)
            label = item.get("label", "")

            # Convert PIL image to bytes for python-docx
            img_buf = io.BytesIO()
            img.save(img_buf, format="PNG")
            img_buf.seek(0)

            for c in range(copies):
                if item_count > 0:
                    # Add spaces between items
                    run_space = p.add_run(spaces_str)

                # Add picture with exact width and height
                img_buf.seek(0)
                run_img = p.add_run()
                run_img.add_picture(img_buf, width=Mm(width_mm), height=Mm(height_mm))

                item_count += 1

        output_buf = io.BytesIO()
        doc.save(output_buf)
        return output_buf.getvalue()

    @staticmethod
    def generate_pdf(items: list, gap_mm: float = 5.0, margin_mm: float = DEFAULT_MARGIN_MM) -> bytes:
        """
        Generates a 1:1 scale Print-Ready PDF on A4 paper using ReportLab.
        Arranges items neatly in grid order.
        """
        output_buf = io.BytesIO()
        c = canvas.Canvas(output_buf, pagesize=A4)
        
        printable_w = A4_WIDTH_MM - (2 * margin_mm)
        printable_h = A4_HEIGHT_MM - (2 * margin_mm)

        curr_x = margin_mm
        # ReportLab Y origin is at BOTTOM of page!
        curr_y = A4_HEIGHT_MM - margin_mm

        for item in items:
            img = item["image"]
            w_mm = item["width_mm"]
            h_mm = item["height_mm"]
            copies = item.get("copies", 1)

            # Convert PIL image to temporary bytes
            img_buf = io.BytesIO()
            img.save(img_buf, format="PNG")
            img_buf.seek(0)

            from reportlab.lib.utils import ImageReader
            rl_img = ImageReader(img_buf)

            for copy_idx in range(copies):
                # Check if item fits in current line
                if curr_x + w_mm > A4_WIDTH_MM - margin_mm + 0.1:
                    # Move to next line
                    curr_x = margin_mm
                    curr_y -= (h_mm + gap_mm)

                # Check if item fits on current page height
                if curr_y - h_mm < margin_mm - 0.1:
                    # Create new page
                    c.showPage()
                    curr_x = margin_mm
                    curr_y = A4_HEIGHT_MM - margin_mm

                # Draw PCB image at exact location
                # ReportLab drawImage uses bottom-left point as (x, y)
                draw_y = curr_y - h_mm
                c.drawImage(
                    rl_img,
                    curr_x * reportlab_mm,
                    draw_y * reportlab_mm,
                    width=w_mm * reportlab_mm,
                    height=h_mm * reportlab_mm,
                    mask='auto'
                )

                # Advance X for next item
                curr_x += (w_mm + gap_mm)

        c.save()
        return output_buf.getvalue()
