# ⚡ PCB Layout Tiler & Auto-Panelizer Web App

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Flask](https://img.shields.io/badge/Framework-Flask_3.0-green.svg)
![PyMuPDF](https://img.shields.io/badge/Engine-PyMuPDF_1.28-red.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

Aplikasi web untuk **otomatisasi penataan multiple desain PCB** (misalnya `TOP_PCB.pdf` dan `BOT_PCB.pdf`) ke dalam **lembar kertas A4** dengan skala 1:1 murni yang presisi untuk kebutuhan cetak *transfer paper*, *toner transfer*, atau *etching PCB*.

---

## 🌟 Fitur Utama

- **Multi-PDF & Multi-Layer Support**: Dapat mengunggah beberapa file PDF sekaligus (TOP & BOTTOM layer).
- **Auto-Detect Physical Dimensions**: Deteksi otomatis ukuran fisik PCB (Lebar x Tinggi mm) dari metadata/bounding box PDF.
- **Mirror Toggle (Cermin Horizontal)**: Opsi pencerminan khusus layer Bottom agar jalur tembaga tidak terbalik saat ditransfer.
- **Interactive Live A4 Preview**: Visualisasi penataan gambar PCB di lembar A4 secara *real-time*.
- **Auto-Fill Maximum Copies**: Menghitung otomatis jumlah maksimum PCB yang muat dalam 1 lembar A4.
- **Dual Export (PDF & DOCX)**:
  - **PDF 1:1 Print-Ready (300 DPI)**: Siap langsung diprint tanpa risiko terdistorsi.
  - **Word Document (.docx)**: Format Kertas A4, Margin Narrow (12.7 mm), dan spasi antar gambar (default 7 spasi).

---

## 🚀 Cara Menjalankan

Aplikasi ini sudah berjalan otomatis di latar belakang (*systemd service*).

Akses langsung melalui browser:
👉 **[http://pcb-tiler.test](http://pcb-tiler.test)**

Atau melalui perintah script:
```bash
cd ~/Projects/Python/pcb-layout-tiler
./run.sh
```
