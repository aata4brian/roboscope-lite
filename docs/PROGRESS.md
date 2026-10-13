# Progres RoboScope Lite

Checkpoint: 13 Oktober 2026. Branch kerja: `fix/replay-clock`.
Dasar: main `6258aa4`. Tidak ada perubahan lokal pengguna saat mulai.

## Sudah selesai

- PR #1 transfer JSON sudah masuk main; CI pasca-merge lulus.
- Brian sudah deploy https://roboscope-lite.vercel.app/.
- Demo publik diuji langsung: tiga gangguan, rekaman selesai, replay motor-stall
  pada 2×, jump to detection, serta rekaman bertahan setelah reload.
- PR portofolio #1 sudah masuk main (`fa67133`); dua build Vercel lulus.
- Preview portofolio diperiksa di desktop: gambar, filter, bahasa, tema, dan
  studi kasus. Produksi tetap memakai holding page; privasi tidak diubah.

- PR #2 CSV sudah masuk main (`6258aa4`); 29 tes perilaku dan 12 pemeriksaan
  browser lulus. Deployment publik diuji dengan CSV jaringan 177 baris/24 kolom;
  semua 17 nilai cocok dengan JSON, 23 paket hilang tetap hilang, dan JSON setelah
  ekspor/replay tidak berubah.
- PR portofolio #2 masuk main (`be3158e`) untuk menyelaraskan bukti CSV.

## Pekerjaan branch sebelumnya

- Ekspor paket telemetri insiden ke CSV, tanpa interpolasi atau pembulatan.
- Header mencantumkan satuan, waktu UTC, waktu relatif deteksi, dan status capture.
- Data ditandai simulasi. Unduhan tidak mengubah rekaman atau replay.
- 29 tes perilaku lulus; CI juga menguji unduhan CSV lewat tombol untuk tiga fault.
- README dan panduan demo diperbarui sesuai deployment publik yang sudah diuji.

## Pekerjaan branch ini

- Replay mengikuti waktu monotonic yang berlalu, tidak menghitung jumlah callback.
- Pause, seek, dan pergantian kecepatan mempertahankan posisi yang tepat.
- 36 tes perilaku lulus. Browser CI menguji timer terlambat, tiga kecepatan,
  perubahan jam sistem, serta kontrol slider keyboard dan mouse.

## Berikutnya

- Periksa browser CI dan deployment sebelum menyatakan perbaikan timing dirilis.
- Tentukan jalur validasi hardware sebelum membuat klaim untuk robot fisik.
- Proyek portofolio berikutnya yang Brian pilih: Predictive Maintenance for
  Aircraft Engines. Jangan mengklaim dataset, training, atau hasil sebelum diuji.

Jangan mengubah privasi repo atau perlindungan website. Jangan menyentuh
folder eksperimen akademik, laptop, atau server di luar tugas ini.
