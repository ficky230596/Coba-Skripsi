// lokasi_mobil.js
let map;
const markers = {};

const OFFICE_LAT = 1.4738648372207512;
const OFFICE_LON = 124.84044402840449;

// Definisikan updateCountdown di lingkup global
function updateCountdown() {
    const $modalCountdown = $('#modal-countdown');
    if ($modalCountdown.length && $('#transactionDetailModal').hasClass('show')) {
        const endRent = $('#modal-end-rent').text();
        const endTime = $('#modal-end-rent').data('end-time') || '';
        const statusMobil = $('#modal-status').text();
        const returnStatus = $modalCountdown.data('return-status') || '';
        const actualReturnDate = $modalCountdown.data('actual-return-date') || '';
        const actualReturnTime = $modalCountdown.data('actual-return-time') || '';

        console.log(`Processing modal countdown, end_rent: ${endRent}, end_time: ${endTime}, status: ${statusMobil}, return_status: ${returnStatus}, actual_return_date: ${actualReturnDate}, actual_return_time: ${actualReturnTime}`);

        if (statusMobil === 'Digunakan') {
            if (!endRent || !endTime) {
                console.warn(`Data end_rent atau end_time kosong untuk modal`);
                $modalCountdown.text('-');
                return;
            }

            // Pastikan format end_time adalah HH:mm:ss
            const normalizedEndTime = endTime.padEnd(8, ':00');
            const endDateTimeStr = `${endRent} ${normalizedEndTime}`;
            const endDateTime = new Date(endDateTimeStr);

            if (isNaN(endDateTime)) {
                console.error(`Tanggal tidak valid untuk modal, endDateTimeStr: ${endDateTimeStr}`);
                $modalCountdown.text('Tanggal tidak valid');
                return;
            }

            const now = new Date();
            const timeDiff = endDateTime - now;

            if (timeDiff <= 0) {
                $modalCountdown.html('<span class="text-danger">Terlambat</span>');
            } else {
                const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
                $modalCountdown.text(`${days}h ${hours}j ${minutes}m ${seconds}d`);
            }
        } else if (statusMobil === 'selesai' && actualReturnDate && actualReturnTime && returnStatus) {
            const normalizedEndTime = endTime.padEnd(8, ':00');
            const endDateTimeStr = `${endRent} ${normalizedEndTime}`;
            const endDateTime = new Date(endDateTimeStr);
            const actualReturnDateTimeStr = `${actualReturnDate} ${actualReturnTime}`;
            const actualReturnDateTime = new Date(actualReturnDateTimeStr);

            if (isNaN(endDateTime) || isNaN(actualReturnDateTime)) {
                console.error(`Tanggal tidak valid untuk modal, endDateTimeStr: ${endDateTimeStr}, actualReturnDateTimeStr: ${actualReturnDateTimeStr}`);
                $modalCountdown.text('Tanggal tidak valid');
                return;
            }

            const timeDiff = endDateTime - actualReturnDateTime;
            const absTimeDiff = Math.abs(timeDiff);
            const minutes = Math.floor(absTimeDiff / (1000 * 60));
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            const remainingHours = hours % 24;
            const remainingMinutes = minutes % 60;

            let displayText = '';
            if (returnStatus === 'terlambat') {
                displayText = `Terlambat ${days > 0 ? days + 'h ' : ''}${remainingHours}j ${remainingMinutes}m`;
            } else if (returnStatus === 'lebih cepat') {
                displayText = `Lebih cepat ${days > 0 ? days + 'h ' : ''}${remainingHours}j ${remainingMinutes}m`;
            } else {
                displayText = 'Tepat waktu';
            }
            $modalCountdown.text(displayText);
        } else {
            $modalCountdown.text('-');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Konfigurasi Toastr
    toastr.options = {
        closeButton: true,
        progressBar: true,
        positionClass: 'toast-top-right',
        timeOut: 5000,
        extendedTimeOut: 1000,
        showMethod: 'fadeIn',
        hideMethod: 'fadeOut',
        showDuration: 300,
        hideDuration: 300,
        toastClass: 'toast-custom'
    };

    // Inisialisasi peta
    map = L.map('map').setView([OFFICE_LAT, OFFICE_LON], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const carIcon = L.icon({
        iconUrl: '/static/icon/gps.png',
        iconSize: [32, 36],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });

    function updateMapAndDropdown() {
        fetch('/api/daftar_lokasi_mobil')
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.msg || 'Gagal mengambil data lokasi mobil');
                    });
                }
                return response.json();
            })
            .then(data => {
                // Hapus marker lama
                Object.values(markers).forEach(marker => map.removeLayer(marker));
                Object.keys(markers).forEach(key => delete markers[key]);

                // Tambahkan marker baru
                data.lokasi_mobil.forEach(mobil => {
                    if (mobil.lat && mobil.lon) {
                        const marker = L.marker([mobil.lat, mobil.lon], { icon: carIcon }).addTo(map);
                        marker.bindPopup(`
                            <b>${mobil.merek} - ${mobil.plat}</b><br>
                            Status: ${mobil.status}<br>
                            Alamat: ${mobil.alamat || 'Memuat...'}<br>
                            Timestamp: ${mobil.timestamp || 'Tidak tersedia'}<br>
                            ${mobil.order_id ? `<a href="#" class="transaction-link" data-order-id="${mobil.order_id}" onclick="showTransactionDetail('${mobil.order_id}', this); return false;">Lihat Transaksi</a>` : ''}
                        `);
                        markers[mobil.id_mobil] = marker;
                    }
                });

                // Perbarui dropdown
                const select = document.getElementById('mobil-select');
                const selectedValue = select.value;
                const options = select.querySelectorAll('option:not([value=""])');
                options.forEach(option => option.remove());

                data.lokasi_mobil.forEach(mobil => {
                    const option = document.createElement('option');
                    option.value = mobil.id_mobil;
                    option.setAttribute('data-lat', mobil.lat || OFFICE_LAT);
                    option.setAttribute('data-lon', mobil.lon || OFFICE_LON);
                    option.setAttribute('data-merek', mobil.merek);
                    option.setAttribute('data-plat', mobil.plat);
                    option.textContent = `${mobil.merek} - ${mobil.plat}${!mobil.lat || !mobil.lon ? ' (Lokasi default)' : ''}`;
                    if (mobil.id_mobil === selectedValue) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });

                document.getElementById('find-mobil-btn').disabled = !select.value;

                // Render ulang peta untuk mencegah pemotongan
                map.invalidateSize();
            })
            .catch(error => {
                console.error('Error:', error);
                toastr.error('Gagal memperbarui peta atau dropdown: ' + error.message);
            });
    }

    // Jalankan updateCountdown setiap detik
    setInterval(updateCountdown, 1000);

    // Inisialisasi peta dan dropdown
    updateMapAndDropdown();
    setInterval(updateMapAndDropdown, 10000);

    // Handler untuk dropdown
    document.getElementById('mobil-select').addEventListener('change', () => {
        const select = document.getElementById('mobil-select');
        document.getElementById('find-mobil-btn').disabled = !select.value;
        map.invalidateSize();
    });

    // Handler untuk gambar yang dapat diklik
    $(document).on('click', '.img-clickable', function () {
        const src = $(this).attr('src');
        $('#zoomed-image').attr('src', src);
        $('#imageZoomModal').modal('show');
    });

    // Handler untuk menutup modal
    $('#transactionDetailModal').on('hidden.bs.modal', function () {
        const lastFocusedElement = document.querySelector('.transaction-link:focus');
        if (lastFocusedElement) {
            lastFocusedElement.focus();
        } else {
            document.getElementById('mobil-select').focus();
        }
        map.invalidateSize();
    });

    $('#imageZoomModal').on('hidden.bs.modal', function () {
        const lastFocusedElement = document.querySelector('.img-clickable:focus');
        if (lastFocusedElement) {
            lastFocusedElement.focus();
        } else {
            document.getElementById('mobil-select').focus();
        }
    });
});

window.temukanMobil = function () {
    const select = document.getElementById('mobil-select');
    const id_mobil = select.value;
    const selectedOption = select.options[select.selectedIndex];
    const lat = parseFloat(selectedOption.getAttribute('data-lat'));
    const lon = parseFloat(selectedOption.getAttribute('data-lon'));
    const merek = selectedOption.getAttribute('data-merek');
    const plat = selectedOption.getAttribute('data-plat');

    if (!id_mobil || isNaN(lat) || isNaN(lon)) {
        toastr.error('Mobil tidak memiliki koordinat yang valid');
        return;
    }

    map.setView([lat, lon], 15);
    if (markers[id_mobil]) {
        markers[id_mobil].openPopup();
        toastr.success(`Menampilkan lokasi ${merek} - ${plat}`);
    } else {
        toastr.error('Marker mobil tidak ditemukan di peta');
    }
    map.invalidateSize();
};

window.showTransactionDetail = function (order_id, element) {
    fetch(`/api/transaction_detail/${order_id}`)
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.msg || 'Gagal mengambil detail transaksi');
                });
            }
            return response.json();
        })
        .then(response => {
            if (response.result === 'success') {
                const data = response.data;
                $('#modal-order-id').text(data.order_id || '');
                $('#modal-item').text(data.item || '');
                $('#modal-type-mobil').text(data.type_mobil || '');
                $('#modal-plat').text(data.plat || '');
                $('#modal-penyewa').text(data.penyewa || '');
                $('#modal-lama-rental').text(data.lama_rental || '');
                $('#modal-total').text(data.total ? `Rp ${data.total.toLocaleString('id-ID')}` : '');
                $('#modal-date-rent').text(data.date_rent || 'Menunggu konfirmasi');
                $('#modal-end-rent').text(data.end_rent || 'Menunggu konfirmasi').data('end-time', data.end_time || '');
                $('#modal-status').text(data.status).removeClass('status-digunakan status-selesai status-pembayaran').addClass(`status-${data.status}`);
                $('#modal-countdown')
                    .data('return-status', data.return_status || '')
                    .data('actual-return-date', data.actual_return_date || '')
                    .data('actual-return-time', data.actual_return_time || '');
                $('#modal-biaya-sopir').text(data.biaya_sopir ? `Rp ${data.biaya_sopir.toLocaleString('id-ID')}` : '');
                $('#modal-gunakan-pengantaran').text(data.gunakan_pengantaran ? 'Ya' : 'Tidak');
                $('#modal-delivery-cost').text(data.delivery_cost ? `Rp ${data.delivery_cost.toLocaleString('id-ID')}` : '');
                $('#modal-delivery-location').text(data.delivery_location || 'Tidak tersedia');
                $('#modal-profile-image').attr('src', data.profile_image_path || '/static/icon/user.jpg');
                $('#modal-sim-image').attr('src', data.image_path || '/static/icon/default_sim.png');
                $('#transactionDetailModal').modal('show');
                $('#transactionDetailModal .btn-close').focus();
                // Perbarui countdown setelah modal terbuka
                setTimeout(() => updateCountdown(), 0);
                // Render ulang peta setelah modal terbuka
                setTimeout(() => map.invalidateSize(), 100);
            } else {
                toastr.error(response.msg || 'Gagal menampilkan detail transaksi');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            toastr.error('Gagal mengambil detail transaksi: ' + error.message);
        });
};