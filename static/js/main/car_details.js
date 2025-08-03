// Variabel global untuk menyimpan id_mobil dan user_id
let currentIdMobil;
let currentUserId;

// Variabel untuk peta
let map;
let marker;
let officeMarker;
let selectedLocation = null;

// Lokasi kantor rental
const OFFICE_LOCATION = { lat: 1.288495, lng: 124.883161 };

// Fungsi Haversine untuk menghitung jarak garis lurus (dalam km)
function haversineDistance(coord1, coord2) {
    const R = 6371; // Radius bumi dalam km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Jarak dalam km
}

// Fungsi hitungTotalHarga
function hitungTotalHarga() {
    const inputHari = document.getElementById("hari");
    const hargaPerHari = parseFloat(document.getElementById("harga_per_hari").value);
    const gunakanSopir = document.getElementById("gunakan_sopir");
    const gunakanPengantaran = document.getElementById("gunakan_pengantaran");
    const totalPriceElement = document.getElementById("total_price");
    const agreeTerms = document.getElementById("agree_terms");
    const btnPesan = document.getElementById("btn_pesan");

    let hari = parseInt(inputHari.value) || 0;
    let hargaSopir = gunakanSopir.checked ? 100000 * hari : 0;
    let deliveryCost = 0;
    if (gunakanPengantaran.checked) {
        const deliveryCostRaw = document.getElementById("delivery-cost").value;
        deliveryCost = parseInt(deliveryCostRaw.replace(/\D/g, '')) || 0;
        // Validasi biaya pengantaran maksimum
        const MAX_DELIVERY_COST = 50000;
        if (deliveryCost > MAX_DELIVERY_COST) {
            console.error('Biaya pengantaran tidak valid:', deliveryCost);
            toastr.error(`Biaya pengantaran (Rp ${deliveryCost.toLocaleString('id-ID')}) melebihi batas maksimum. Silakan pilih lokasi lain.`, 'Error');
            resetDeliveryInfo();
            return;
        }
    }
    let totalHarga = (hargaPerHari * hari) + hargaSopir + deliveryCost;

    // Logging untuk debugging
    console.log('Hari:', hari, 'Harga Sopir:', hargaSopir, 'Delivery Cost:', deliveryCost, 'Total:', totalHarga);

    totalPriceElement.innerText = `Total Harga: Rp ${totalHarga.toLocaleString('id-ID')}`;

    // Aktifkan tombol jika jumlah hari valid dan syarat disetujui
    btnPesan.disabled = hari < 1 || (agreeTerms && !agreeTerms.checked);
}

// Inisialisasi peta
function initMap() {
    map = L.map('mapFrame').setView([OFFICE_LOCATION.lat, OFFICE_LOCATION.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    officeMarker = L.marker([OFFICE_LOCATION.lat, OFFICE_LOCATION.lng], {
        icon: L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        })
    }).addTo(map).bindPopup('Kantor Rental').openPopup();

    map.on('click', function (e) {
        placeMarker(e.latlng);
        updateDeliveryInfo(e.latlng);
    });

    const searchInput = document.getElementById('pac-input');
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            searchLocation(searchInput.value);
        }
    });

    document.querySelector('#mapModal .btn-primary').disabled = true;
}

// Tempatkan marker di lokasi yang dipilih
function placeMarker(latlng) {
    if (marker) {
        marker.setLatLng(latlng);
    } else {
        marker = L.marker(latlng).addTo(map);
    }
    selectedLocation = latlng;
}

// Temukan lokasi pengguna menggunakan geolocation
function findMyLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function (position) {
                const latlng = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                map.setView(latlng, 12);
                placeMarker(latlng);
                updateDeliveryInfo(latlng);
            },
            function (error) {
                console.error('Error geolocation:', error);
                toastr.error('Gagal menemukan lokasi. Pastikan izin lokasi diaktifkan.', 'Error');
            }
        );
    } else {
        toastr.error('Browser Anda tidak mendukung geolocation.', 'Error');
    }
}

// Cari lokasi menggunakan Nominatim
function searchLocation(query) {
    fetch(`/api/search_geocode?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === "error") {
                throw new Error(data.message);
            }
            if (data.length > 0) {
                const latlng = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                map.setView(latlng, 12);
                placeMarker(latlng);
                updateDeliveryInfo(latlng);
            } else {
                toastr.error('Lokasi tidak ditemukan!', 'Error');
            }
        })
        .catch(error => {
            console.error('Error pencarian lokasi:', error);
            toastr.error('Gagal mencari lokasi!', 'Error');
        });
}

// Update informasi pengantaran
// Update informasi pengantaran
function updateDeliveryInfo(latlng) {
    if (!latlng || isNaN(latlng.lat) || isNaN(latlng.lng) ||
        latlng.lat < -90 || latlng.lat > 90 || latlng.lng < -180 || latlng.lng > 180) {
        console.error('Koordinat tidak valid:', latlng);
        toastr.error('Koordinat tidak valid. Silakan pilih lokasi lain.', 'Error');
        hitungTotalHarga();
        return;
    }

    // Validasi wilayah geografis (sekitar Manado)
    const REGION_BOUNDS = {
        minLat: 0,
        maxLat: 3,
        minLng: 123,
        maxLng: 126
    };
    if (latlng.lat < REGION_BOUNDS.minLat || latlng.lat > REGION_BOUNDS.maxLat ||
        latlng.lng < REGION_BOUNDS.minLng || latlng.lng > REGION_BOUNDS.maxLng) {
        console.error('Lokasi di luar wilayah pengantaran:', latlng);
        toastr.error('Lokasi di luar wilayah pengantaran yang diizinkan. Silakan pilih lokasi di sekitar Manado.', 'Error');
        resetDeliveryInfo();
        return;
    }

    // Simpan koordinat
    selectedLocation = latlng;
    console.log('Koordinat yang dipilih:', latlng);

    fetch(`/api/reverse_geocode?lat=${latlng.lat}&lon=${latlng.lng}`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.status === "error") {
                throw new Error(data.message);
            }
            document.getElementById('delivery-location').value = data.display_name || `Koordinat: ${latlng.lat}, ${latlng.lng}`;
            const distance = haversineDistance(OFFICE_LOCATION, latlng);
            document.getElementById('delivery-distance').value = distance.toFixed(2) + ' km';

            let deliveryCost = 0;
            const FREE_DELIVERY_DISTANCE = 5; // Batas untuk pengantaran gratis
            const MAX_DELIVERY_DISTANCE = 8; // Batas maksimum untuk pengantaran

            if (distance > MAX_DELIVERY_DISTANCE) {
                console.error('Jarak pengantaran melebihi 10 km:', distance);
                toastr.error('Jarak pengantaran melebihi 10 km. Pengantaran tidak tersedia untuk lokasi ini.', 'Error');
                resetDeliveryInfo();
                return;
            }

            if (distance <= FREE_DELIVERY_DISTANCE) {
                deliveryCost = 0; // Gratis untuk jarak < 8 km
            } else {
                deliveryCost = 50000; // Biaya Rp 50.000 untuk jarak > 8 km dan ≤ 10 km
            }

            document.getElementById('delivery-cost').value = 'Rp ' + deliveryCost.toLocaleString('id-ID');
            document.getElementById('delivery-info').style.display = 'block';
            document.getElementById('use-delivery').style.display = 'block';
            document.querySelector('#mapModal .btn-primary').disabled = false;

            hitungTotalHarga();
        })
        .catch(error => {
            console.error('Error reverse geocoding:', error);
            toastr.error(`Gagal mendapatkan alamat: ${error.message}. Menggunakan koordinat sebagai gantinya.`, 'Error');
            document.getElementById('delivery-location').value = `Koordinat: ${latlng.lat}, ${latlng.lng}`;
            const distance = haversineDistance(OFFICE_LOCATION, latlng);
            document.getElementById('delivery-distance').value = distance.toFixed(2) + ' km';

            let deliveryCost = 0;
            const FREE_DELIVERY_DISTANCE = 5; // Batas untuk pengantaran gratis
            const MAX_DELIVERY_DISTANCE = 8; // Batas maksimum untuk pengantaran

            if (distance > MAX_DELIVERY_DISTANCE) {
                console.error('Jarak pengantaran melebihi 10 km:', distance);
                toastr.error('Jarak pengantaran melebihi 10 km. Pengantaran tidak tersedia untuk lokasi ini.', 'Error');
                resetDeliveryInfo();
                return;
            }

            if (distance <= FREE_DELIVERY_DISTANCE) {
                deliveryCost = 0; // Gratis untuk jarak < 8 km
            } else {
                deliveryCost = 50000; // Biaya Rp 50.000 untuk jarak > 8 km dan ≤ 10 km
            }

            document.getElementById('delivery-cost').value = 'Rp ' + deliveryCost.toLocaleString('id-ID');
            document.getElementById('delivery-info').style.display = 'block';
            document.getElementById('use-delivery').style.display = 'block';
            document.querySelector('#mapModal .btn-primary').disabled = false;
            hitungTotalHarga();
        });
}

// Buka modal peta
function openMapPopup(event) {
    event.preventDefault();
    const mapModal = new bootstrap.Modal(document.getElementById('mapModal'));
    mapModal.show();

    setTimeout(() => {
        map.invalidateSize();
    }, 200);

    document.querySelector('#mapModal .btn-primary').disabled = true;
}

// Tutup modal peta
function closeMapModal() {
    const mapModal = bootstrap.Modal.getInstance(document.getElementById('mapModal'));
    mapModal.hide();
    const openMapButton = document.querySelector('a[data-url="/maps"]');
    if (openMapButton) openMapButton.focus();
    hitungTotalHarga();
}

// Reset informasi pengantaran
function resetDeliveryInfo() {
    document.getElementById('delivery-distance').value = '';
    document.getElementById('delivery-location').value = '';
    document.getElementById('delivery-cost').value = '';
    document.getElementById('delivery-info').style.display = 'none';
    document.getElementById('use-delivery').style.display = 'none';
    document.getElementById('gunakan_pengantaran').checked = false;

    if (marker) {
        map.removeLayer(marker);
        marker = null;
    }
    selectedLocation = null;

    hitungTotalHarga();
}

// Fungsi untuk membuat transaksi dengan animasi loading
function createTransaction(id_mobil, user_id) {
    $('#btn_pesan').attr('disabled', true);
    $('#rentalModal').modal('hide'); // Tutup modal rental

    // Ambil data transaksi
    var hari = $("#hari").val();
    var gunakanSopir = $("#gunakan_sopir").is(':checked');
    var gunakanPengantaran = $("#gunakan_pengantaran").is(':checked');
    var totalHarga = $("#total_price").text().replace(/\D/g, '');
    var deliveryCost = parseInt($("#delivery-cost").val().replace(/\D/g, '')) || 0;
    var deliveryLocation = $("#delivery-location").val();
    var deliveryLat = selectedLocation ? selectedLocation.lat : null;
    var deliveryLon = selectedLocation ? selectedLocation.lng : null;

    // Validasi data
    if (!hari || parseInt(hari) < 1) {
        toastr.error('Masukkan jumlah hari rental yang valid.', 'Error');
        $('#btn_pesan').attr('disabled', false);
        return;
    }
    if (gunakanPengantaran && (!deliveryLocation || !deliveryLat || !deliveryLon)) {
        toastr.error('Lokasi pengantaran tidak lengkap. Silakan pilih lokasi.', 'Error');
        $('#btn_pesan').attr('disabled', false);
        return;
    }

    console.log('Data transaksi:', {
        hari,
        id_mobil,
        user_id,
        gunakan_sopir: gunakanSopir,
        gunakan_pengantaran: gunakanPengantaran,
        total_harga: totalHarga,
        delivery_cost: deliveryCost,
        delivery_location: deliveryLocation,
        delivery_lat: deliveryLat,
        delivery_lon: deliveryLon
    });

    // Tampilkan spinner dan pesan loading
    const spinner = $('#spinner');
    const loadingMessage = $('#loading-message');
    const countdown = $('#countdown');
    spinner.show();
    loadingMessage.show();
    let timeLeft = 10;
    countdown.text(`Waktu tersisa: ${timeLeft} detik`);
    const countdownInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            countdown.text('');
            clearInterval(countdownInterval);
        } else {
            countdown.text(`Waktu tersisa: ${timeLeft} detik`);
        }
    }, 1000);

    // Kirim permintaan ke /api/create_transaction
    $.ajax({
        url: "/api/create_transaction",
        type: "POST",
        data: {
            hari: hari,
            id_mobil: id_mobil,
            user_id: user_id,
            gunakan_sopir: gunakanSopir,
            gunakan_pengantaran: gunakanPengantaran,
            total_harga: totalHarga,
            delivery_cost: deliveryCost,
            delivery_location: deliveryLocation,
            delivery_lat: deliveryLat,
            delivery_lon: deliveryLon
        },
        timeout: 70000,
        success: function (response) {
            spinner.hide();
            loadingMessage.hide();
            clearInterval(countdownInterval);
            countdown.text('');

            if (response.status === "success") {
                toastr.success('Transaksi berhasil dibuat! Mengarahkan ke halaman pembayaran...', 'Sukses');
                setTimeout(() => {
                    window.location.replace(`/transaksi/${response.id}`);
                }, 2000);
            } else if (response.status === "unpaid_transaction") {
                toastr.warning(response.message, 'Peringatan', {
                    onHidden: function () {
                        $('#btn_pesan').attr('disabled', false);
                        window.location.href = '/'; // Alihkan ke "/"
                    }
                });
            } else if (response.status === "active_rental") {
                toastr.warning(response.message, 'Peringatan', {
                    onHidden: function () {
                        $('#btn_pesan').attr('disabled', false);
                        window.location.href = '/'; // Alihkan ke "/"
                    }
                });
            } else if (response.status === "error") {
                toastr.error(response.message, 'Error', {
                    onHidden: function () {
                        $('#btn_pesan').attr('disabled', false);
                        window.location.href = '/'; // Alihkan ke "/"
                    }
                });
            }
        },
        error: function (xhr) {
            spinner.hide();
            loadingMessage.hide();
            clearInterval(countdownInterval);
            countdown.text('');

            let errorMsg = 'Terjadi kesalahan, silakan coba lagi nanti.';
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMsg = xhr.responseJSON.message;
            }
            toastr.error(errorMsg, 'Error', {
                onHidden: function () {
                    $('#btn_pesan').attr('disabled', false);
                    window.location.href = '/'; // Alihkan ke "/"
                }
            });
        }
    });
}

// Tampilkan modal verifikasi kata sandi
function showPasswordVerificationModal(id_mobil, user_id) {
    if (!document.getElementById('agree_terms').checked) {
        toastr.warning('Harap setuju dengan syarat dan ketentuan.', 'Peringatan');
        return;
    }
    currentIdMobil = id_mobil;
    currentUserId = user_id;
    $('#passwordVerificationModal').modal('show');
}

document.addEventListener("DOMContentLoaded", function () {
    // Inisialisasi peta
    initMap();

    // Event listener untuk perhitungan harga
    const inputHari = document.getElementById("hari");
    const gunakanSopir = document.getElementById("gunakan_sopir");
    const gunakanPengantaran = document.getElementById("gunakan_pengantaran");
    const agreeTerms = document.getElementById("agree_terms");

    inputHari.addEventListener("input", hitungTotalHarga);
    gunakanSopir.addEventListener("change", hitungTotalHarga);
    gunakanPengantaran.addEventListener("change", hitungTotalHarga);
    if (agreeTerms) agreeTerms.addEventListener("change", hitungTotalHarga);

    // Event listener untuk verifikasi password
    document.getElementById('passwordVerificationForm').addEventListener('submit', function (event) {
        event.preventDefault();

        var password = document.getElementById('password').value;

        $.ajax({
            url: '/api/verify_password',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                password: password,
                user_id: currentUserId
            }),
            success: function (response) {
                if (response.status === 'success') {
                    $('#passwordVerificationModal').modal('hide');
                    createTransaction(currentIdMobil, currentUserId);
                } else {
                    toastr.error('Password salah, silakan coba lagi.', 'Error');
                }
            },
            error: function () {
                toastr.error('Terjadi kesalahan, silakan coba lagi nanti.', 'Error');
            }
        });
    });

    // Inisialisasi Owl Carousel
    $('.owl-carousel').owlCarousel({
        loop: false,
        margin: 15,
        nav: true,
        dots: true,
        responsive: {
            0: { items: 1 },
            576: { items: 2 },
            768: { items: 3 },
            1000: { items: 4 }
        }
    });

    // Tangani penutupan modal peta untuk mencegah warning ARIA
    document.getElementById('mapModal').addEventListener('hidden.bs.modal', function () {
        const openMapButton = document.querySelector('a[data-url="/maps"]');
        if (openMapButton) openMapButton.focus();
    });
});

function updateDetailRating(mobilId) {
    console.log('Mengambil rating untuk mobil ID:', mobilId);
    fetch(`/get_rating_and_comment?car_id=${mobilId}`)
        .then(response => {
            if (!response.ok) {
                console.error('HTTP error:', response.status, response.statusText);
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Data dari server:', data);
            if (data.error) {
                console.error('Error dari server:', data.error);
                return;
            }
            const ratingStars = document.querySelector('#rating-stars');
            const currentRating = document.querySelector('#current-rating');
            const comment = document.querySelector('#comment');
            if (ratingStars && currentRating && comment) {
                ratingStars.innerHTML = '';
                const rating = data.rating || 0;
                for (let i = 1; i <= 5; i++) {
                    const star = document.createElement('i');
                    star.className = `fa fa-star ${i <= rating ? 'star-rated' : 'star'}`;
                    ratingStars.appendChild(star);
                }
                currentRating.textContent = `${Math.round(rating)}/5`; // Bulatkan rating tanpa desimal
                comment.textContent = data.comment || 'Belum ada komentar.';
            } else {
                console.error('Elemen tidak ditemukan:', {
                    ratingStars: !!ratingStars,
                    currentRating: !!currentRating,
                    comment: !!comment
                });
            }
        })
        .catch(error => console.error('Error fetching rating and comment:', error));
}

// Inisialisasi rating saat DOM dimuat
document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const mobilId = urlParams.get('id');
    console.log('Mobil ID dari URL:', mobilId);
    if (mobilId) {
        updateDetailRating(mobilId);
    } else {
        console.error('Mobil ID tidak ditemukan di URL');
    }
});