document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([-1.474, 124.842], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    let selectedMarker = null;

    // Fungsi untuk memuat data mobil di peta
    function loadMapData() {
        fetch('/api/tes_lokasi_mobil')
            .then(response => {
                if (!response.ok) throw new Error('Gagal mengambil data lokasi mobil');
                return response.json();
            })
            .then(data => {
                console.log('Data lokasi mobil:', data);
                // Hapus marker yang ada
                map.eachLayer(layer => {
                    if (layer instanceof L.Marker) map.removeLayer(layer);
                });
                data.lokasi_mobil.forEach(mobil => {
                    if (mobil.lat && mobil.lon) {
                        const marker = L.marker([mobil.lat, mobil.lon]).addTo(map);
                        marker.bindPopup(`
                            <b>${mobil.merek} - ${mobil.plat}</b><br>
                            Status: ${mobil.status}<br>
                            Alamat: ${mobil.alamat || 'Memuat...'}<br>
                            ${mobil.order_id ? `<a href="/transaction/detail?order_id=${mobil.order_id}" target="_blank">Lihat Transaksi</a>` : ''}
                        `);
                    }
                });
                // Fokus pada mobil yang dipilih jika ada
                const selectedId = document.getElementById('mobil-select').value;
                if (selectedId) {
                    const selectedMobil = data.lokasi_mobil.find(m => m.id_mobil === selectedId);
                    if (selectedMobil && selectedMobil.lat && selectedMobil.lon) {
                        map.setView([selectedMobil.lat, selectedMobil.lon], 12);
                    }
                }
            })
            .catch(error => {
                console.error('Error:', error);
                toastr.error('Gagal memuat data lokasi: ' + error);
            });
    }

    // Tangani perubahan pilihan mobil
    document.getElementById('mobil-select').addEventListener('change', () => {
        const idMobil = document.getElementById('mobil-select').value;
        if (idMobil) {
            fetch(`/api/tes_lokasi_mobil`)
                .then(response => response.json())
                .then(data => {
                    const mobil = data.lokasi_mobil.find(m => m.id_mobil === idMobil);
                    if (mobil) {
                        document.getElementById('id_mobil').value = idMobil;
                        document.getElementById('mobil-name').textContent = `${mobil.merek} - ${mobil.plat}`;
                        document.getElementById('mobil-info').style.display = 'block';
                        if (mobil.lat && mobil.lon) {
                            map.setView([mobil.lat, mobil.lon], 12);
                        }
                    }
                })
                .catch(error => toastr.error('Gagal memuat data mobil: ' + error));
            // Redirect untuk memperbarui halaman dengan id_mobil baru
            window.location.href = `/tes_lacak?id_mobil=${idMobil}`;
        } else {
            document.getElementById('mobil-info').style.display = 'none';
            document.getElementById('id_mobil').value = '';
            document.getElementById('mobil-name').textContent = '';
            loadMapData();
        }
    });

    // Tangani klik pada peta
    map.on('click', (e) => {
        const lat = e.latlng.lat.toFixed(6);
        const lon = e.latlng.lng.toFixed(6);

        // Hapus marker sebelumnya jika ada
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
        }

        // Tambahkan marker baru di lokasi yang diklik
        selectedMarker = L.marker([lat, lon]).addTo(map);
        selectedMarker.bindPopup(`Lokasi terpilih: ${lat}, ${lon}`).openPopup();

        // Isi koordinat ke form
        document.getElementById('lat').value = lat;
        document.getElementById('lon').value = lon;
        document.getElementById('selected-coords').textContent = `Latitude: ${lat}, Longitude: ${lon}`;

        // Aktifkan tombol Perbarui Lokasi
        document.getElementById('update-btn').disabled = false;
    });

    // Muat data peta saat halaman dimuat
    loadMapData();
});

function updateLokasi() {
    const id_mobil = document.getElementById('id_mobil').value;
    const lat = document.getElementById('lat').value;
    const lon = document.getElementById('lon').value;

    if (!lat || !lon || !id_mobil) {
        toastr.warning('Silakan pilih mobil dan klik pada peta untuk memilih lokasi');
        return;
    }

    const formData = new FormData();
    formData.append('id_mobil', id_mobil);
    formData.append('lat', lat);
    formData.append('lon', lon);

    fetch('/api/update_lokasi_mobil', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.result === 'success') {
                toastr.success(data.msg);
                // Refresh peta
                document.getElementById('selected-coords').textContent = 'Klik pada peta untuk memilih lokasi';
                document.getElementById('lat').value = '';
                document.getElementById('lon').value = '';
                document.getElementById('update-btn').disabled = true;
                // Muat ulang data peta
                document.getElementById('mobil-select').dispatchEvent(new Event('change'));
            } else {
                toastr.error(data.msg);
            }
        })
        .catch(error => toastr.error('Gagal memperbarui lokasi: ' + error));
}