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

function addStatusLabel() {
    $('.transaksi-unpaid').addClass('table-warning'); // Kuning untuk unpaid
    $('.transaksi-canceled, .transaksi-dibatalkan, .transaksi-dibatalkan-sendiri').addClass('table-danger'); // Merah untuk canceled, dibatalkan, dibatalkan-sendiri
    $('.transaksi-digunakan').addClass('table-info'); // Biru muda untuk digunakan
    $('.transaksi-completed').addClass('table-secondary'); // Abu-abu untuk completed
    $('.transaksi-sudah-bayar').addClass('table-success'); // Hijau untuk pembayaran (sudah bayar)
}

function alertAfter() {
    if (localStorage.getItem('dataDeleted') === 'true') {
        toastr.success('Pesanan sudah dibatalkan');
        localStorage.removeItem('dataDeleted');
    }
}

function checkTransactionStatus() {
    $('.transaksi-unpaid').each(function () {
        const order_id = $(this).attr('id'); // Ambil order_id dari atribut id
        if (order_id) {
            $.ajax({
                url: `/api/check_transaction_status/${order_id}`,
                type: "GET",
                success: function (response) {
                    if (response.result === 'success' && response.status === 'canceled') {
                        toastr.warning(`Transaksi ${order_id} dibatalkan otomatis karena melebihi batas waktu pembayaran`);
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

// Fungsi baru untuk mengurutkan tabel berdasarkan tanggal
function sortTableByDate() {
    const table = $('table.table'); // Pilih tabel
    const tbody = table.find('tbody');
    const rows = tbody.find('tr').get(); // Ambil semua baris tabel

    rows.sort(function (a, b) {
        // Ambil nilai tanggal dari kolom "Tanggal" (indeks 0)
        const dateA = $(a).find('td[data-label="Tanggal"]').text().trim();
        const dateB = $(b).find('td[data-label="Tanggal"]').text().trim();

        // Konversi string tanggal (format DD-MMMM-YYYY) ke objek Date
        const dateObjA = parseDate(dateA);
        const dateObjB = parseDate(dateB);

        // Urutkan dari terbaru ke terlama (descending)
        return dateObjB - dateObjA;
    });

    // Kosongkan tbody dan tambahkan kembali baris yang sudah diurutkan
    tbody.empty();
    $.each(rows, function (index, row) {
        tbody.append(row);
    });
}

// Fungsi untuk mengonversi string tanggal (DD-MMMM-YYYY) ke objek Date
function parseDate(dateStr) {
    // Contoh dateStr: "10-July-2025"
    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date(0); // Default jika format salah

    const day = parseInt(parts[0], 10);
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = monthNames.indexOf(parts[1]);
    const year = parseInt(parts[2], 10);

    if (isNaN(day) || month === -1 || isNaN(year)) return new Date(0); // Default jika parsing gagal

    return new Date(year, month, day);
}

$(document).ready(function () {
    addStatusLabel();
    alertAfter();
    // Tambahkan event listener untuk tombol cancel
    $('.cancel-button').on('click', function () {
        const order_id = $(this).data('order-id');
        cancelPayment(order_id);
    });
    // Periksa status transaksi setiap 30 detik
    setInterval(checkTransactionStatus, 30000);
    // Urutkan tabel saat halaman dimuat
    sortTableByDate();
});