# Demo singkat RoboScope Lite

Tujuannya menunjukkan bagaimana rekaman membantu membaca gangguan robot.
Data berasal dari simulator, belum dari robot fisik. Diagnosis memakai aturan
sensor, bukan model ML yang dilatih.

1. Buka https://roboscope-lite.vercel.app/. Untuk menjalankan lokal, gunakan
   `npm ci`, `npm run build`, lalu `npm start`.
2. Klik **Start simulation**. Tunggu sekitar 35 detik untuk mengisi riwayat normal.
3. Klik **Motor Stall**, lalu tunggu 20 detik. Bandingkan arus motor dan kecepatan.
   Satu insiden muncul setelah pola gangguan bertahan. Klik **Pause**.
4. Buka insidennya. Tunjukkan bukti sebelum/sesudah, **Jump to detection**, dan
   replay. Jelaskan bahwa kesimpulan merupakan dugaan berdasarkan sinyal.
   Klik **Export telemetry CSV** untuk membuka paket insiden di Excel atau Python.
   Waktu relatif nol adalah saat deteksi. Paket yang hilang tetap tidak diisi.
5. Kembali ke overview. Di **Recording files**, klik **Export JSON**.
6. Buka browser lain atau jendela privat. Pilih **Import JSON**, periksa ringkasan,
   lalu terapkan rekamannya. Perhatian: ini mengganti rekaman browser tujuan.
7. Buka insiden yang diimpor dan reload halaman. Bukti dan replay tetap tersedia.

Untuk gangguan lain, reset sesi lalu ulangi langkah 2–4 dengan **Wheel Slip** atau
**Network Degradation**. Reset mempertahankan arsip, maksimal 12 insiden.
Jangan menyebut hasil simulator sebagai akurasi deteksi pada robot nyata.
