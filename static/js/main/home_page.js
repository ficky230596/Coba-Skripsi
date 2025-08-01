$(document).ready(function () {
    // Inisialisasi Owl Carousel dengan navigasi responsif
    $('.owl-carousel').owlCarousel({
        loop: false,
        margin: 10,
        nav: true,
        navText: [
            '<i class="fas fa-chevron-left"></i>',
            '<i class="fas fa-chevron-right"></i>'
        ],
        responsive: {
            0: { items: 1, nav: true },
            600: { items: 2, nav: true },
            1000: { items: 4, nav: true }
        }
    });

    // Fungsi untuk memperbarui rating dan komentar pada kartu mobil
    function updateRatingAndComment(card, mobilId) {
        fetch(`/get_rating_and_comment?car_id=${mobilId}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error(data.error);
                    return;
                }
                const ratingStars = card.querySelector('#rating-stars');
                const currentRating = card.querySelector('#current-rating');
                const comment = card.querySelector('#comment');
                if (ratingStars && currentRating && comment) {
                    ratingStars.innerHTML = '';
                    for (let i = 1; i <= 5; i++) {
                        const star = document.createElement('i');
                        star.className = `fa fa-star ${i <= data.rating ? 'star-rated' : 'star'}`;
                        ratingStars.appendChild(star);
                    }
                    currentRating.textContent = `${data.rating}/5`;
                    comment.textContent = data.comment || 'Belum ada komentar.';
                }
            })
            .catch(error => console.error('Error fetching rating and comment:', error));
    }

    // Perbarui rating dan komentar untuk kartu mobil saat halaman dimuat
    document.querySelectorAll('.card').forEach(function (card) {
        let mobilId = card.querySelector('a').href.split('=')[1];
        updateRatingAndComment(card, mobilId);
    });

    // Fungsi untuk memuat ulang daftar mobil awal
    function loadInitialCars() {
        $.ajax({
            url: '/search_mobil',
            method: 'GET',
            data: {},
            success: function (data) {
                $('.car-list').empty();
                if (data.length === 0) {
                    $('.car-list').append('<p>Tidak ada mobil yang tersedia.</p>');
                } else {
                    data.forEach(function (dt) {
                        $('.car-list').append(`
                            <div class="card border-1 rounded-4 overflow-hidden">
                                <img src="/static/Gambar/mobil/${dt.gambar}" alt="${dt.gambar}" id="gambar_mobil" class="card-img-top">
                                <div class="card-body">
                                    <h3 class="mb-2 text-primary">${dt.merek} ${dt.type_mobil}</h3>
                                    <div class="car-info d-flex justify-content-between align-items-center">
                                        <div class="car-info-item d-flex align-items-center">
                                            <i class="eicon-seat pe-2 fs-5"></i>
                                            <span>Seat: ${dt.seat}</span>
                                        </div>
                                        <div class="car-info-item d-flex align-items-center">
                                            <i class="fa-solid fa-gas-pump pe-2 fs-5"></i>
                                            <span>${dt.bahan_bakar}</span>
                                        </div>
                                        <div class="car-info-item d-flex align-items-center">
                                            <i class="eicon-transmission pe-2 fs-5"></i>
                                            <span>${dt.transmisi}</span>
                                        </div>
                                    </div>
                                    <div class="border-top mt-3 py-3">
                                        <div class="row">
                                            <div class="col">Harga</div>
                                            <div class="col-auto"><span data-target="currency">${dt.harga}</span>/ Hari</div>
                                        </div>
                                    </div>
                                    <div class="d-flex align-items-center mt-2">
                                        <span class="me-2">Rating:</span>
                                        <div id="rating-stars"></div>
                                        <span id="current-rating" class="ms-2">0/5</span>
                                    </div>
                                    <div class="d-flex align-items-center mt-2">
                                        <span class="me-2">Komentar:</span>
                                        <div id="comment" class="m-0">Belum ada komentar.</div>
                                    </div>
                                    <div class="d-flex">
                                        <a class="btn car-btn btn-primary m-auto w-100 rounded-5" href="/detail-mobil?id=${dt.id_mobil || dt._id}">Detail</a>
                                    </div>
                                </div>
                            </div>
                        `);
                        const newCard = $('.car-list .card').last()[0];
                        updateRatingAndComment(newCard, dt.id_mobil || dt._id);
                    });
                }
                $('.owl-carousel').owlCarousel('destroy');
                $('.owl-carousel').owlCarousel({
                    loop: false,
                    margin: 10,
                    nav: true,
                    navText: [
                        '<i class="fas fa-chevron-left"></i>',
                        '<i class="fas fa-chevron-right"></i>'
                    ],
                    responsive: {
                        0: { items: 1, nav: true },
                        600: { items: 2, nav: true },
                        1000: { items: 4, nav: true }
                    }
                });
            },
            error: function (xhr, status, error) {
                console.error('Error fetching cars:', error);
                $('.car-list').empty().append('<p>Error saat memuat data mobil.</p>');
            }
        });
    }

    // Fungsi untuk mengisi dropdown filter
    function populateFilterOptions() {
        $.ajax({
            url: '/get_filter_options',
            method: 'GET',
            success: function (data) {
                // Isi dropdown merek
                const brandSelect = $('#brand');
                brandSelect.empty().append('<option value="">Pilih Merek</option>');
                data.brands.forEach(brand => {
                    brandSelect.append(`<option value="${brand}">${brand}</option>`);
                });

                // Isi dropdown bahan bakar
                const fuelSelect = $('#bahan_bakar');
                fuelSelect.empty().append('<option value="">Pilih Bahan Bakar</option>');
                data.fuels.forEach(fuel => {
                    fuelSelect.append(`<option value="${fuel}">${fuel}</option>`);
                });

                // Isi dropdown transmisi
                const transmissionSelect = $('#transmisi');
                transmissionSelect.empty().append('<option value="">Pilih Transmisi</option>');
                data.transmissions.forEach(transmission => {
                    transmissionSelect.append(`<option value="${transmission}">${transmission}</option>`);
                });

                // Isi dropdown seat
                const seatSelect = $('#seat');
                seatSelect.empty().append('<option value="">Pilih Jumlah Seat</option>');
                data.seats.forEach(seat => {
                    seatSelect.append(`<option value="${seat}">${seat} Seat</option>`);
                });
            },
            error: function (xhr, status, error) {
                console.error('Error fetching filter options:', error);
            }
        });
    }

    // Fungsi untuk memperbarui dropdown tipe berdasarkan merek
    function updateTypeOptions() {
        const brand = $('#brand').val();
        const typeSelect = $('#type');
        typeSelect.empty().append('<option value="">Pilih Tipe</option>');
        if (brand) {
            $.ajax({
                url: '/get_car_types',
                method: 'GET',
                data: { merek: brand },
                success: function (data) {
                    data.types.forEach(type => {
                        typeSelect.append(`<option value="${type}">${type}</option>`);
                    });
                },
                error: function (xhr, status, error) {
                    console.error('Error fetching car types:', error);
                }
            });
        }
    }

    // Event listener untuk filter
    $('#brand').on('change', updateTypeOptions);

    $('#apply-filters').on('click', function () {
        const brand = $('#brand').val();
        const type = $('#type').val();
        const bahan_bakar = $('#bahan_bakar').val();
        const seat = $('#seat').val();
        const transmisi = $('#transmisi').val();
        const rating = $('#rating').val();
        const min_price = $('#min_price').val();
        const max_price = $('#max_price').val();

        $.ajax({
            url: '/filter_mobil',
            method: 'GET',
            data: {
                merek: brand,
                type_mobil: type,
                bahan_bakar: bahan_bakar,
                seat: seat,
                transmisi: transmisi,
                rating: rating,
                min_price: min_price,
                max_price: max_price
            },
            success: function (data) {
                $('.car-list').empty();
                if (data.length === 0) {
                    $('.car-list').append('<p>Tidak ada mobil yang cocok dengan filter.</p>');
                } else {
                    data.forEach(function (dt) {
                        $('.car-list').append(`
                            <div class="card border-1 rounded-4 overflow-hidden">
                                <img src="/static/Gambar/mobil/${dt.gambar}" alt="${dt.gambar}" id="gambar_mobil" class="card-img-top">
                                <div class="card-body">
                                    <h3 class="mb-2 text-primary">${dt.merek} ${dt.type_mobil}</h3>
                                    <div class="car-info d-flex justify-content-between align-items-center">
                                        <div class="car-info-item d-flex align-items-center">
                                            <i class="eicon-seat pe-2 fs-5"></i>
                                            <span>Seat: ${dt.seat}</span>
                                        </div>
                                        <div class="car-info-item d-flex align-items-center">
                                            <i class="fa-solid fa-gas-pump pe-2 fs-5"></i>
                                            <span>${dt.bahan_bakar}</span>
                                        </div>
                                        <div class="car-info-item d-flex align-items-center">
                                            <i class="eicon-transmission pe-2 fs-5"></i>
                                            <span>${dt.transmisi}</span>
                                        </div>
                                    </div>
                                    <div class="border-top mt-3 py-3">
                                        <div class="row">
                                            <div class="col">Harga</div>
                                            <div class="col-auto"><span data-target="currency">${dt.harga}</span>/ Hari</div>
                                        </div>
                                    </div>
                                    <div class="d-flex align-items-center mt-2">
                                        <span class="me-2">Rating:</span>
                                        <div id="rating-stars"></div>
                                        <span id="current-rating" class="ms-2">0/5</span>
                                    </div>
                                    <div class="d-flex align-items-center mt-2">
                                        <span class="me-2">Komentar:</span>
                                        <div id="comment" class="m-0">Belum ada komentar.</div>
                                    </div>
                                    <div class="d-flex">
                                        <a class="btn car-btn btn-primary m-auto w-100 rounded-5" href="/detail-mobil?id=${dt.id_mobil || dt._id}">Detail</a>
                                    </div>
                                </div>
                            </div>
                        `);
                        const newCard = $('.car-list .card').last()[0];
                        updateRatingAndComment(newCard, dt.id_mobil || dt._id);
                    });
                }
                $('.owl-carousel').owlCarousel('destroy');
                $('.owl-carousel').owlCarousel({
                    loop: false,
                    margin: 10,
                    nav: true,
                    navText: [
                        '<i class="fas fa-chevron-left"></i>',
                        '<i class="fas fa-chevron-right"></i>'
                    ],
                    responsive: {
                        0: { items: 1, nav: true },
                        600: { items: 2, nav: true },
                        1000: { items: 4, nav: true }
                    }
                });
                $('#filterModal').modal('hide');
            },
            error: function (xhr, status, error) {
                console.error('Error fetching filtered cars:', error);
                $('.car-list').empty().append('<p>Error saat memuat data mobil.</p>');
                $('#filterModal').modal('hide');
            }
        });
    });

    // Reset filter
    $('#reset-filters').on('click', function () {
        $('#brand').val('');
        $('#type').val('');
        $('#bahan_bakar').val('');
        $('#seat').val('');
        $('#transmisi').val('');
        $('#rating').val('');
        $('#min_price').val('');
        $('#max_price').val('');
        updateTypeOptions();
        loadInitialCars();
        $('#filterModal').modal('hide');
    });

    // Alihkan fokus sebelum modal ditutup untuk menghindari peringatan aria-hidden
    $('#filterModal').on('hide.bs.modal', function () {
        const carListSection = document.querySelector('#list-mobil');
        if (carListSection) {
            carListSection.focus();
        }
    });

    // Panggil fungsi untuk mengisi opsi filter saat halaman dimuat
    populateFilterOptions();

    // Pencarian otomatis saat mengetik
    $('input[name="search"]').on('keyup', debounce(function () {
        const search = $(this).val();
        $.ajax({
            url: '/search_mobil',
            method: 'GET',
            data: { search: search },
            success: function (data) {
                $('.car-list').empty();
                if (data.length === 0) {
                    $('.car-list').append('<p>Tidak ada mobil yang cocok dengan pencarian.</p>');
                } else {
                    data.forEach(function (dt) {
                        $('.car-list').append(`
                            <div class="card border-1 rounded-4 overflow-hidden">
                                <img src="/static/Gambar/mobil/${dt.gambar}" alt="${dt.gambar}" id="gambar_mobil" class="card-img-top">
                                <div class="card-body">
                                    <h3 class="mb-2 text-primary">${dt.merek} ${dt.type_mobil}</h3>
                                    <div class="car-info d-flex justify-content-between align-items-center">
                                        <div class="car-info-item d-flex align-items-center">
                                            <i class="eicon-seat pe-2 fs-5"></i>
                                            <span>Seat: ${dt.seat}</span>
                                        </div>
                                        <div class="car-info-item d-flex align-items-center">
                                            <i class="fa-solid fa-gas-pump pe-2 fs-5"></i>
                                            <span>${dt.bahan_bakar}</span>
                                        </div>
                                        <div class="car-info-item d-flex align-items-center">
                                            <i class="eicon-transmission pe-2 fs-5"></i>
                                            <span>${dt.transmisi}</span>
                                        </div>
                                    </div>
                                    <div class="border-top mt-3 py-3">
                                        <div class="row">
                                            <div class="col">Harga</div>
                                            <div class="col-auto"><span data-target="currency">${dt.harga}</span>/ Hari</div>
                                        </div>
                                    </div>
                                    <div class="d-flex align-items-center mt-2">
                                        <span class="me-2">Rating:</span>
                                        <div id="rating-stars"></div>
                                        <span id="current-rating" class="ms-2">0/5</span>
                                    </div>
                                    <div class="d-flex align-items-center mt-2">
                                        <span class="me-2">Komentar:</span>
                                        <div id="comment" class="m-0">Belum ada komentar.</div>
                                    </div>
                                    <div class="d-flex">
                                        <a class="btn car-btn btn-primary m-auto w-100 rounded-5" href="/detail-mobil?id=${dt.id_mobil || dt._id}">Detail</a>
                                    </div>
                                </div>
                            </div>
                        `);
                        const newCard = $('.car-list .card').last()[0];
                        updateRatingAndComment(newCard, dt.id_mobil || dt._id);
                    });
                }
                $('.owl-carousel').owlCarousel('destroy');
                $('.owl-carousel').owlCarousel({
                    loop: false,
                    margin: 10,
                    nav: true,
                    navText: [
                        '<i class="fas fa-chevron-left"></i>',
                        '<i class="fas fa-chevron-right"></i>'
                    ],
                    responsive: {
                        0: { items: 1, nav: true },
                        600: { items: 2, nav: true },
                        1000: { items: 4, nav: true }
                    }
                });
            },
            error: function (xhr, status, error) {
                console.error('Error fetching search results:', error);
                $('.car-list').empty().append('<p>Error saat memuat data mobil.</p>');
            }
        });
    }, 300));

    // Tombol batal untuk pencarian
    $('#cancel-search').on('click', function () {
        $('input[name="search"]').val('');
        loadInitialCars();
    });

    // Pemeriksaan status transaksi
    function getCookie(name) {
        let value = `; ${document.cookie}`;
        let parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    const token = getCookie('tokenMain');
    if (token) {
        const checkStatus = function () {
            $.ajax({
                url: '/api/check_transaction_status',
                type: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                success: function (data) {
                    if (data.result === 'redirect') {
                        window.location.href = `/rating?car_id=${data.car_id}&order_id=${data.order_id}`;
                    } else if (data.result === 'no_action') {
                        console.log(data.msg);
                    } else {
                        console.error('Error:', data.msg);
                    }
                },
                error: function (xhr) {
                    console.error('Error checking transaction status:', xhr.responseJSON?.msg || xhr.statusText);
                    if (xhr.status === 401) {
                        console.warn('Sesi kedaluwarsa, mengarahkan ke halaman login...');
                        clearInterval(interval);
                        window.location.href = '/';
                    }
                }
            });
        };
        const interval = setInterval(checkStatus, 10000);
        $(window).on('pagehide', function () {
            clearInterval(interval);
        });
    } else {
        console.log('Harap melakukan login, polling tidak dijalankan.');
    }

    // Fungsi untuk gulir ke daftar mobil dengan offset
    window.scrollToCarList = function () {
        const carListSection = document.querySelector('#list-mobil');
        const offset = 100;
        const carListPosition = carListSection.getBoundingClientRect().top + window.pageYOffset - offset;

        window.scrollTo({
            top: carListPosition,
            behavior: 'smooth'
        });
    };
});

// Fungsi debounce untuk membatasi frekuensi AJAX
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}