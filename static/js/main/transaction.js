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

$(document).ready(function () {
    // Format currency untuk elemen dengan data-target="currency"
    function formatCurrency() {
        $('[data-target="currency"]').each(function () {
            const value = parseFloat($(this).data('original-value') || $(this).text());
            if (!isNaN(value)) {
                $(this).text(new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value));
            } else {
                console.warn('Invalid currency value:', $(this).text());
                $(this).text('Tidak Valid');
            }
        });
    }

    // Panggil formatCurrency saat halaman dimuat
    formatCurrency();

    // Handler untuk tombol Batalkan
    $(document).on('click', '.cancel-button', function () {
        const orderId = $(this).data('order-id');
        const $button = $(this);
        const $loadingIcon = $button.find('.loading-icon');
        const $span = $button.find('span');

        if (confirm('Apakah Anda yakin ingin membatalkan transaksi ini?')) {
            $loadingIcon.removeClass('d-none');
            $span.text('Membatalkan...');
            $button.prop('disabled', true);

            $.ajax({
                type: 'POST',
                url: '/api/cancel_transaction',
                data: JSON.stringify({ order_id: orderId }),
                contentType: 'application/json',
                success: function (response) {
                    if (response.result === 'success') {
                        alert('Transaksi berhasil dibatalkan');
                        location.reload();
                    } else {
                        alert(response.msg || 'Gagal membatalkan transaksi');
                        $loadingIcon.addClass('d-none');
                        $span.text('Batalkan');
                        $button.prop('disabled', false);
                    }
                },
                error: function (xhr, status, error) {
                    console.error('Error cancelling transaction:', status, error, xhr.responseText);
                    alert('Gagal membatalkan transaksi');
                    $loadingIcon.addClass('d-none');
                    $span.text('Batalkan');
                    $button.prop('disabled', false);
                }
            });
        }
    });

    // Handler untuk tombol Download PDF
    $(document).on('click', '.download-pdf-button', function () {
        const id = $(this).data('id');
        const orderId = $(this).data('order-id');
        const modalBody = $(`#modal-${id} .modal-body`);

        if (!modalBody.length) {
            console.error(`Modal body untuk ID modal-${id} tidak ditemukan`);
            alert('Gagal menghasilkan PDF: Detail transaksi tidak ditemukan.');
            return;
        }

        // Ambil data dari modal
        const data = {};
        modalBody.find('li').each(function () {
            const label = $(this).find('.label').text().trim();
            const value = $(this).find('.value').text().trim();
            data[label] = value;
        });

        // Perbaiki pemrosesan Total
        if (data['Total']) {
            const totalElement = modalBody.find('.value[data-target="currency"]');
            let totalValue = parseFloat(totalElement.data('original-value'));
            if (isNaN(totalValue)) {
                totalValue = parseFloat(totalElement.text().replace(/[^\d]/g, '')) || 0;
            }
            console.log('Raw Total Value:', totalValue); // Debugging
            if (!isNaN(totalValue)) {
                data['Total'] = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalValue);
            } else {
                data['Total'] = 'Tidak Valid';
                console.error('Total value is invalid:', totalElement.text());
            }
        }

        // Template PDF dengan tampilan rapi dan fallback untuk logo
        const logoSrc = '/static/gambar/login3.png';
        const pdfTemplate = `
            <div style="font-family: Arial, sans-serif; padding: 20px; width: 180mm; color: #333;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div>
                        <h1 style="font-size: 24px; margin: 0; color: #1a73e8;">Invoice Transaksi</h1>
                        <p style="margin: 5px 0; font-size: 14px;"><strong>Order ID:</strong> ${orderId}</p>
                        <p style="margin: 5px 0; font-size: 14px;"><strong>Tanggal:</strong> ${new Date().toLocaleDateString('id-ID')}</p>
                    </div>
                    <img src="${logoSrc}" style="width: 80px; height: auto;" alt="Logo" onerror="this.style.display='none';">
                </div>
                <hr style="border: 1px solid #1a73e8; margin: 10px 0;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tbody>
                        ${Object.entries(data).map(([label, value]) => `
                            <tr>
                                <td style="padding: 8px; font-weight: bold; width: 30%; border-bottom: 1px solid #ddd;">${label}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${value}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="margin-top: 20px; font-size: 12px; color: #666; text-align: center;">
                    <p>Terima kasih atas transaksi Anda!</p>
                    <p>Rental Rental Mobil Manado - Jl. Manado No. 123, Manado, Indonesia</p>
                    <p>Email: contact @fickyrahanubun@gmail.com.com | Telepon: (021) 123-4567</p>
                </div>
            </div>
        `;

        // Buat elemen sementara untuk render PDF
        const tempDiv = $('<div>').html(pdfTemplate).css({
            position: 'absolute',
            left: '-9999px',
            width: '180mm'
        }).appendTo('body');

        // Gunakan html2canvas untuk render template
        html2canvas(tempDiv[0], {
            scale: 2,
            useCORS: true
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            // Tambahkan halaman tambahan jika konten terlalu panjang
            if (pdfHeight > pdf.internal.pageSize.getHeight() - 20) {
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth - 20, pdfHeight);
            } else {
                pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth - 20, pdfHeight);
            }

            pdf.save(`invoice_${orderId}.pdf`);
            tempDiv.remove();
        }).catch(error => {
            console.error('Error generating PDF:', error);
            alert('Gagal menghasilkan PDF. Silakan coba lagi.');
            tempDiv.remove();
        });
    });
});