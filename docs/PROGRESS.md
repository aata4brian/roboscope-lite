# Progres RoboScope Lite

Checkpoint: 13 Oktober 2026. Branch kerja: `improve/incident-csv`.
Dasar: main `2ab49b0`. Tidak ada perubahan lokal pengguna saat mulai.

## Sudah selesai

- PR #1 transfer JSON sudah masuk main; CI pasca-merge lulus.
- Brian sudah deploy https://roboscope-lite.vercel.app/.
- Demo publik diuji langsung: tiga gangguan, rekaman selesai, replay motor-stall
  pada 2×, jump to detection, serta rekaman bertahan setelah reload.
- PR portofolio #1 sudah masuk main (`fa67133`); dua build Vercel lulus.
- Preview portofolio diperiksa di desktop: gambar, filter, bahasa, tema, dan
  studi kasus. Produksi tetap memakai holding page; privasi tidak diubah.

## Pekerjaan branch ini

- Ekspor paket telemetri insiden ke CSV, tanpa interpolasi atau pembulatan.
- Header mencantumkan satuan, waktu UTC, waktu relatif deteksi, dan status capture.
- Data ditandai simulasi. Unduhan tidak mengubah rekaman atau replay.
- 29 tes perilaku lulus; CI juga menguji unduhan CSV lewat tombol untuk tiga fault.
- README dan panduan demo diperbarui sesuai deployment publik yang sudah diuji.

## Berikutnya

- Periksa CI dan preview sebelum merge/release fitur CSV.
- Lengkapi QA playback waktu nyata 0.5×/1× serta slider keyboard/drag.
- Tentukan jalur validasi hardware sebelum membuat klaim untuk robot fisik.
- Proyek portofolio berikutnya yang Brian pilih: Predictive Maintenance for
  Aircraft Engines. Jangan mengklaim dataset, training, atau hasil sebelum diuji.

Jangan mengubah privasi repo atau perlindungan website. Jangan menyentuh
folder eksperimen akademik, laptop, atau server di luar tugas ini.
