// Fungsi untuk membatalkan transaksi secara manual
function cancelPayment(order_id) {
    Swal.fire({
        position: "top",
        text: "Anda yakin ingin membatalkan transaksi?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Ya",
    }).then((result) => {
        if (result.isConfirmed) {
            const button = $(`button[data-order-id="${order_id}"]`);
            button.prop('disabled', true);
            button.find('span').addClass('d-none');
            button.find('.loading-icon').removeClass('d-none');
            $.ajax({
                url: "/api/cancelPayment",
                type: "POST",
                data: { order_id: order_id },
                success: function (response) {
                    if (response.result === 'success') {
                        toastr.success(response.message || 'Transaksi berhasil dibatalkan');
                        localStorage.setItem('dataDeleted', 'true');
                        location.reload();
                    } else {
                        toastr.error(response.message || 'Gagal membatalkan transaksi');
                        button.prop('disabled', false);
                        button.find('span').removeClass('d-none');
                        button.find('.loading-icon').addClass('d-none');
                    }
                },
                error: function (xhr) {
                    let errorMessage = 'Terjadi kesalahan saat membatalkan transaksi. Silakan coba lagi.';
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        errorMessage = xhr.responseJSON.message;
                    }
                    toastr.error(errorMessage);
                    button.prop('disabled', false);
                    button.find('span').removeClass('d-none');
                    button.find('.loading-icon').addClass('d-none');
                }
            });
        }
    });
}

// Fungsi untuk menambahkan kelas CSS berdasarkan status transaksi
function addStatusLabel() {
    $('.transaksi-unpaid').addClass('table-warning');
    $('.transaksi-canceled').addClass('table-danger');
}

// Fungsi untuk menampilkan notifikasi setelah pembatalan
function alertAfter() {
    if (localStorage.getItem('dataDeleted') === 'true') {
        toastr.success('Pesanan sudah dibatalkan');
        localStorage.removeItem('dataDeleted');
    }
}

// Fungsi untuk memeriksa status transaksi setiap 10 detik
function checkTransactionStatus() {
    $('.transaksi-unpaid').each(function () {
        const order_id = $(this).attr('id');
        if (order_id) {
            $.ajax({
                url: `/api/check_transaction_status/${order_id}`,
                type: "GET",
                success: function (response) {
                    if (response.result === 'success' && response.status === 'canceled') {
                        toastr.warning(`Transaksi ${order_id} dibatalkan otomatis karena melebihi batas waktu pembayaran (2 menit)`);
                        localStorage.setItem('dataDeleted', 'true');
                        location.reload();
                    }
                },
                error: function (xhr) {
                    console.error(`Gagal memeriksa status transaksi ${order_id}: ${xhr.statusText}`);
                }
            });
        }
    });
}

// Fungsi untuk memulai hitungan mundur berdasarkan created_at
function startCountdown() {
    $('.transaksi-unpaid').each(function () {
        const order_id = $(this).attr('id');
        if (order_id) {
            $.ajax({
                url: `/api/check_transaction_status/${order_id}`,
                type: "GET",
                success: function (response) {
                    if (response.result === 'success' && response.status === 'unpaid' && response.created_at) {
                        const createdAt = new Date(response.created_at);
                        const expiryTime = new Date(createdAt.getTime() + 2 * 60 * 1000); // 2 menit untuk pengujian
                        const countdownElement = $(`#countdown-${order_id}`);

                        function updateCountdown() {
                            const now = new Date();
                            const timeLeft = expiryTime - now;

                            if (timeLeft <= 0) {
                                countdownElement.text('Transaksi telah kedaluwarsa');
                                countdownElement.addClass('text-danger');
                                checkTransactionStatus();
                                return;
                            }

                            const minutes = Math.floor(timeLeft / 1000 / 60);
                            const seconds = Math.floor((timeLeft / 1000) % 60);
                            countdownElement.text(`${minutes} menit ${seconds} detik tersisa`);
                            setTimeout(updateCountdown, 1000);
                        }

                        updateCountdown();
                    }
                },
                error: function (xhr) {
                    console.error(`Gagal mengambil created_at untuk transaksi ${order_id}: ${xhr.statusText}`);
                    $(`#countdown-${order_id}`).text('Gagal memuat batas waktu');
                }
            });
        }
    });
}

// Fungsi untuk mengurutkan tabel berdasarkan tanggal
function sortTableByDate() {
    const table = $('table.table');
    const tbody = table.find('tbody');
    const rows = tbody.find('tr').get();

    rows.sort(function (a, b) {
        const dateA = $(a).find('td[data-label="Tanggal"]').text().trim();
        const dateB = $(b).find('td[data-label="Tanggal"]').text().trim();

        const dateObjA = parseDate(dateA);
        const dateObjB = parseDate(dateB);

        return dateObjB - dateObjA;
    });

    tbody.empty();
    $.each(rows, function (index, row) {
        tbody.append(row);
    });
}

// Fungsi untuk mengonversi string tanggal (DD-MMMM-YYYY) ke objek Date
function parseDate(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date(0);

    const day = parseInt(parts[0], 10);
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = monthNames.indexOf(parts[1]);
    const year = parseInt(parts[2], 10);

    if (isNaN(day) || month === -1 || isNaN(year)) return new Date(0);

    return new Date(year, month, day);
}

$(document).ready(function () {
    addStatusLabel();
    alertAfter();
    $('.cancel-button').on('click', function () {
        const order_id = $(this).data('order-id');
        cancelPayment(order_id);
    });
    checkTransactionStatus();
    startCountdown();
    setInterval(checkTransactionStatus, 10000); // 10 detik untuk pengujian
    setInterval(startCountdown, 10000); // 10 detik untuk mendeteksi transaksi baru
    sortTableByDate();
});