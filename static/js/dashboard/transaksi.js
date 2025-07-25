import { addStatusLabel, changeCurrency } from "./function.js";

$(document).ready(function () {
  addStatusLabel();
  changeCurrency();

  // Fungsi untuk menghitung waktu hitung mundur dan selisih waktu
  function updateCountdown() {
    $('.countdown').each(function () {
      const $this = $(this);
      const orderId = $this.closest('tr').data('order-id');
      const endRent = $this.data('end-rent');
      const endTime = $this.data('end-time');
      const statusMobil = $this.data('status');
      const returnStatus = $this.data('return-status') || '';
      const actualReturnDate = $this.data('actual-return-date') || '';
      const actualReturnTime = $this.data('actual-return-time') || '';

      console.log(`Processing countdown for order_id: ${orderId}, end_rent: ${endRent}, end_time: ${endTime}, status: ${statusMobil}, return_status: ${returnStatus}, actual_return_date: ${actualReturnDate}, actual_return_time: ${actualReturnTime}`);

      if (statusMobil === 'digunakan') {
        if (!endRent || !endTime) {
          console.warn(`Data end_rent atau end_time kosong untuk order_id: ${orderId}`);
          $this.text('-');
          return;
        }

        const endDateTimeStr = `${endRent} ${endTime}`;
        const endDateTime = new Date(endDateTimeStr.replace(/-/, ' '));

        if (isNaN(endDateTime)) {
          console.error(`Tanggal tidak valid untuk order_id: ${orderId}, endDateTimeStr: ${endDateTimeStr}`);
          $this.text('Tanggal tidak valid');
          return;
        }

        const now = new Date();
        const timeDiff = endDateTime - now;

        if (timeDiff <= 0) {
          $this.html('<span class="text-danger">Terlambat</span>');
        } else {
          const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
          $this.text(`${days}h ${hours}j ${minutes}m ${seconds}d`);
        }
      } else if (statusMobil === 'selesai' && actualReturnDate && actualReturnTime && returnStatus) {
        const endDateTimeStr = `${endRent} ${endTime}`;
        const endDateTime = new Date(endDateTimeStr.replace(/-/, ' '));
        const actualReturnDateTimeStr = `${actualReturnDate} ${actualReturnTime}`;
        const actualReturnDateTime = new Date(actualReturnDateTimeStr.replace(/-/, ' '));

        if (isNaN(endDateTime) || isNaN(actualReturnDateTime)) {
          console.error(`Tanggal tidak valid untuk order_id: ${orderId}, endDateTimeStr: ${endDateTimeStr}, actualReturnDateTimeStr: ${actualReturnDateTimeStr}`);
          $this.text('Tanggal tidak valid');
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
        $this.text(displayText);
      } else {
        $this.text('-');
      }
    });

    // Perbarui countdown di modal
    const $modalCountdown = $('#modal-countdown');
    if ($modalCountdown.length && $('#transactionDetailModal').hasClass('show')) {
      const endRent = $('#modal-end-rent').text();
      const endTime = $('#modal-end-rent').data('end-time') || '';
      const statusMobil = $('#modal-status').text();
      const returnStatus = $('#modal-countdown').data('return-status') || '';
      const actualReturnDate = $('#modal-countdown').data('actual-return-date') || '';
      const actualReturnTime = $('#modal-countdown').data('actual-return-time') || '';

      console.log(`Processing modal countdown, end_rent: ${endRent}, end_time: ${endTime}, status: ${statusMobil}, return_status: ${returnStatus}, actual_return_date: ${actualReturnDate}, actual_return_time: ${actualReturnTime}`);

      if (statusMobil === 'digunakan') {
        if (!endRent || !endTime) {
          console.warn(`Data end_rent atau end_time kosong untuk modal`);
          $modalCountdown.text('-');
          return;
        }

        const endDateTimeStr = `${endRent} ${endTime}`;
        const endDateTime = new Date(endDateTimeStr.replace(/-/, ' '));

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
        const endDateTimeStr = `${endRent} ${endTime}`;
        const endDateTime = new Date(endDateTimeStr.replace(/-/, ' '));
        const actualReturnDateTimeStr = `${actualReturnDate} ${actualReturnTime}`;
        const actualReturnDateTime = new Date(actualReturnDateTimeStr.replace(/-/, ' '));

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

  // Fungsi untuk menyortir tabel agar transaksi dengan status "digunakan" di atas
  function sortTableByStatus() {
    const $tbody = $('#list-data');
    const $rows = $tbody.find('tr').get();

    $rows.sort(function (a, b) {
      const statusA = $(a).find('.countdown').data('status');
      const statusB = $(b).find('.countdown').data('status');
      if (statusA === 'digunakan' && statusB !== 'digunakan') return -1;
      if (statusB === 'digunakan' && statusA !== 'digunakan') return 1;
      return 0;
    });

    $tbody.empty();
    $.each($rows, function (index, row) {
      $tbody.append(row);
      $(row).find('td:first').text(index + 1);
    });
  }

  // Fungsi untuk menetapkan kelas CSS berdasarkan merek mobil
  function applyCarColorClasses() {
    const $rows = $('#list-data tr');
    const carColors = {
      'Toyota Avanza': 'car-color-1',
      'Honda Jazz': 'car-color-2',
      'Daihatsu Xenia': 'car-color-3',
      'Suzuki Ertiga': 'car-color-4',
      'Mitsubishi Xpander': 'car-color-5'
    };

    $rows.each(function () {
      const item = $(this).data('item');
      const colorClass = carColors[item] || 'car-color-default';
      $(this).addClass(colorClass);
    });
  }

  // Fungsi untuk menetapkan kelas CSS berdasarkan status transaksi
  function applyStatusClasses() {
    const $rows = $('#list-data tr');
    const statusClasses = {
      'digunakan': 'status-digunakan',
      'selesai': 'status-selesai',
      'pembayaran': 'status-pembayaran'
    };
    const statusBadgeClasses = {
      'digunakan': 'status-badge status-badge-digunakan',
      'selesai': 'status-badge status-badge-selesai',
      'pembayaran': 'status-badge status-badge-pembayaran'
    };

    $rows.each(function () {
      const status = $(this).find('.countdown').data('status');
      const statusClass = statusClasses[status] || '';
      const badgeClass = statusBadgeClasses[status] || 'status-badge';
      $(this).addClass(statusClass);
      // Ganti isi kolom status dengan badge
      const $statusCell = $(this).find('td#status');
      const statusText = $statusCell.find('span').text() || status;
      $statusCell.html(`<span class="${badgeClass}">${statusText}</span>`);
    });
  }

  // Jalankan updateCountdown setiap detik
  setInterval(updateCountdown, 1000);

  // Panggil sekali saat halaman dimuat
  updateCountdown();
  sortTableByStatus();
  applyCarColorClasses();
  applyStatusClasses();

  // Handler untuk tombol Detail
  $(document).on('click', '.btn-detail', function () {
    const orderId = $(this).data('order-id');
    console.log(`Mengambil detail transaksi untuk order_id: ${orderId}`);
    $.ajax({
      type: 'GET',
      url: `/api/transaction_detail/${orderId}`,
      success: function (response) {
        console.log('Respons dari server:', response);
        if (response.result === 'success') {
          const data = response.data;
          $('#modal-order-id').text(data.order_id);
          $('#modal-item').text(data.item);
          $('#modal-type-mobil').text(data.type_mobil);
          $('#modal-plat').text(data.plat);
          $('#modal-penyewa').text(data.penyewa);
          $('#modal-lama-rental').text(data.lama_rental);
          $('#modal-total').text(new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(data.total));
          $('#modal-date-rent').text(data.date_rent);
          $('#modal-end-rent').text(data.end_rent).data('end-time', data.end_time);
          $('#modal-status').text(data.status).removeClass('status-digunakan status-selesai status-pembayaran').addClass(`status-${data.status}`);
          $('#modal-countdown')
            .data('return-status', data.return_status || '')
            .data('actual-return-date', data.actual_return_date || '')
            .data('actual-return-time', data.actual_return_time || '');
          $('#modal-biaya-sopir').text(new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(data.biaya_sopir));
          $('#modal-gunakan-pengantaran').text(data.gunakan_pengantaran ? 'Ya' : 'Tidak');
          $('#modal-delivery-cost').text(new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(data.delivery_cost));
          $('#modal-delivery-location').text(data.delivery_location || '-');
          $('#modal-profile-image').attr('src', data.profile_image_path).on('error', function() {
            $(this).attr('src', '/static/icon/user.jpg');
          });
          $('#modal-sim-image').attr('src', data.image_path).on('error', function() {
            $(this).attr('src', '/static/icon/default_sim.png');
          });
          $('#transactionDetailModal').modal('show');
          updateCountdown();
        } else {
          console.error('Gagal mengambil detail transaksi:', response.msg);
          alert(response.msg || 'Gagal mengambil detail transaksi');
        }
      },
      error: function (xhr, status, error) {
        console.error('Error AJAX:', status, error, xhr.responseText);
        alert('Maaf, transaksi ini dilakukan manual');
      }
    });
  });

  // Handler untuk memperbesar gambar
  $(document).on('click', '.img-clickable', function () {
    const imgSrc = $(this).attr('src');
    const imgAlt = $(this).attr('alt');
    $('#zoomed-image').attr('src', imgSrc);
    $('#imageZoomModalLabel').text(imgAlt);
    $('#imageZoomModal').modal('show');
  });

  // Handler untuk tombol Reset
  $(document).on('click', '#reset-filter', function () {
    console.log('Resetting filter to show all transactions');
    $('#filter_transaksi').val('');
    $('#tanggal_input').remove();
    $('#tanggal').attr('hidden', true);
    $.ajax({
      type: 'GET',
      url: '/api/transaksi',
      success: function (response) {
        console.log('Respons semua transaksi:', response);
        $('#list-data').empty();
        if (response.length === 0) {
          $('#list-data').append(
            "<tr><td colspan='12' class='text-center'>Tidak ada transaksi</td></tr>"
          );
        } else {
          for (let i = 0; i < response.length; i++) {
            var temp = `<tr data-order-id="${response[i].order_id}" data-item="${response[i].item}">
                          <td>${i + 1}</td>
                          <td>${response[i].item}</td>
                          <td>${response[i].type_mobil}</td>
                          <td>${response[i].plat}</td>
                          <td>${response[i].penyewa}</td>
                          <td>${response[i].lama_rental}</td>
                          <td data-target="currency">${response[i].total}</td>
                          <td>${response[i].date_rent}</td>
                          <td>${response[i].end_rent}</td>
                          <td class="countdown" 
                              data-end-rent="${response[i].end_rent}" 
                              data-end-time="${response[i].end_time}" 
                              data-status="${response[i].status}" 
                              data-return-status="${response[i].return_status || ''}"
                              data-actual-return-date="${response[i].actual_return_date || ''}"
                              data-actual-return-time="${response[i].actual_return_time || ''}"></td>
                          <td id="status"><span class="status-badge status-badge-${response[i].status}">${response[i].status}</span></td>
                          <td>
                            <button class="btn btn-info btn-sm btn-detail" data-order-id="${response[i].order_id}">Detail</button>
                          </td>
                        </tr>`;
            $('#list-data').append(temp);
          }
          addStatusLabel();
          changeCurrency();
          updateCountdown();
          sortTableByStatus();
          applyCarColorClasses();
          applyStatusClasses();
        }
      },
      error: function (xhr, status, error) {
        console.error('Error fetching all transactions:', status, error, xhr.responseText);
        alert('Gagal memuat semua transaksi');
      }
    });
  });

  // Logika filter transaksi
  $("#filter_transaksi").on("change", function () {
    $("#tanggal_input").remove();
    var filter = $(this).val();

    if (filter == "1") {
      $("#tanggal").attr("hidden", false);
      $("#tanggal").append('<input type="text" readonly id="tanggal_input">');
      $("#tanggal_input").datepicker({
        dateFormat: "dd-MM-yy",
        changeMonth: true,
        changeYear: true,
        yearRange: "1900:2100",
      });

      $("#tanggal_input").on("change", function () {
        $(this).prop("disabled", true);
        $.ajax({
          type: "POST",
          url: "/api/filter_transaksi",
          data: JSON.stringify({
            mtd: "fTanggal",
            date: $(this).val(),
          }),
          contentType: "application/json",
          success: function (response) {
            console.log('Respons filter tanggal:', response);
            $("#list-data").empty();

            if (response.length == 0) {
              $("#list-data").append(
                "<tr><td colspan='12' class='text-center'>Tidak ada transaksi</td></tr>"
              );
            } else {
              for (let i = 0; i < response.length; i++) {
                var temp = `<tr data-order-id="${response[i].order_id}" data-item="${response[i].item}">
                              <td>${i + 1}</td>
                              <td>${response[i].item}</td>
                              <td>${response[i].type_mobil}</td>
                              <td>${response[i].plat}</td>
                              <td>${response[i].penyewa}</td>
                              <td>${response[i].lama_rental}</td>
                              <td data-target="currency">${response[i].total}</td>
                              <td>${response[i].date_rent}</td>
                              <td>${response[i].end_rent}</td>
                              <td class="countdown" 
                                  data-end-rent="${response[i].end_rent}" 
                                  data-end-time="${response[i].end_time}" 
                                  data-status="${response[i].status}" 
                                  data-return-status="${response[i].return_status || ''}"
                                  data-actual-return-date="${response[i].actual_return_date || ''}"
                                  data-actual-return-time="${response[i].actual_return_time || ''}"></td>
                              <td id="status"><span class="status-badge status-badge-${response[i].status}">${response[i].status}</span></td>
                              <td>
                                <button class="btn btn-info btn-sm btn-detail" data-order-id="${response[i].order_id}">Detail</button>
                              </td>
                            </tr>`;
                $("#list-data").append(temp);
              }
              addStatusLabel();
              changeCurrency();
              updateCountdown();
              sortTableByStatus();
              applyCarColorClasses();
              applyStatusClasses();
            }
          },
          error: function (xhr, status, error) {
            console.error('Error filter tanggal:', status, error, xhr.responseText);
            alert('Gagal memuat transaksi untuk tanggal ini');
            $("#tanggal_input").prop("disabled", false); // Aktifkan kembali input meskipun error
          },
          complete: function () {
            $("#tanggal_input").prop("disabled", false); // Pastikan input diaktifkan kembali
          }
        });
      });
    } else if (filter == "2") {
      $.ajax({
        type: "POST",
        url: "/api/filter_transaksi",
        data: JSON.stringify({
          mtd: "fPaid",
          date: $(this).val(),
        }),
        contentType: "application/json",
        success: function (response) {
          console.log('Respons filter sudah bayar:', response);
          $("#list-data").empty();
          if (response.length == 0) {
            $("#list-data").append(
              "<tr><td colspan='12' class='text-center'>Tidak ada transaksi</td></tr>"
            );
          } else {
            for (let i = 0; i < response.length; i++) {
              var temp = `<tr data-order-id="${response[i].order_id}" data-item="${response[i].item}">
                            <td>${i + 1}</td>
                            <td>${response[i].item}</td>
                            <td>${response[i].type_mobil}</td>
                            <td>${response[i].plat}</td>
                            <td>${response[i].penyewa}</td>
                            <td>${response[i].lama_rental}</td>
                            <td data-target="currency">${response[i].total}</td>
                            <td>${response[i].date_rent}</td>
                            <td>${response[i].end_rent}</td>
                            <td class="countdown" 
                                data-end-rent="${response[i].end_rent}" 
                                data-end-time="${response[i].end_time}" 
                                data-status="${response[i].status}" 
                                data-return-status="${response[i].return_status || ''}"
                                data-actual-return-date="${response[i].actual_return_date || ''}"
                                data-actual-return-time="${response[i].actual_return_time || ''}"></td>
                            <td id="status"><span class="status-badge status-badge-${response[i].status}">${response[i].status}</span></td>
                            <td>
                              <button class="btn btn-info btn-sm btn-detail" data-order-id="${response[i].order_id}">Detail</button>
                            </td>
                          </tr>`;
              $("#list-data").append(temp);
            }
            addStatusLabel();
            changeCurrency();
            updateCountdown();
            sortTableByStatus();
            applyCarColorClasses();
            applyStatusClasses();
          }
        },
        error: function (xhr, status, error) {
          console.error('Error filter sudah bayar:', status, error, xhr.responseText);
          alert('Gagal memuat transaksi sudah bayar');
        }
      });
    } else if (filter == "3") {
      $.ajax({
        type: "POST",
        url: "/api/filter_transaksi",
        data: JSON.stringify({
          mtd: "fUnpaid",
          date: $(this).val(),
        }),
        contentType: "application/json",
        success: function (response) {
          console.log('Respons filter dibatalkan:', response);
          $("#list-data").empty();
          if (response.length == 0) {
            $("#list-data").append(
              "<tr><td colspan='12' class='text-center'>Tidak ada transaksi</td></tr>"
            );
          } else {
            for (let i = 0; i < response.length; i++) {
              var temp = `<tr data-order-id="${response[i].order_id}" data-item="${response[i].item}">
                            <td>${i + 1}</td>
                            <td>${response[i].item}</td>
                            <td>${response[i].type_mobil}</td>
                            <td>${response[i].plat}</td>
                            <td>${response[i].penyewa}</td>
                            <td>${response[i].lama_rental}</td>
                            <td data-target="currency">${response[i].total}</td>
                            <td>${response[i].date_rent}</td>
                            <td>${response[i].end_rent}</td>
                            <td class="countdown" 
                                data-end-rent="${response[i].end_rent}" 
                                data-end-time="${response[i].end_time}" 
                                data-status="${response[i].status}" 
                                data-return-status="${response[i].return_status || ''}"
                                data-actual-return-date="${response[i].actual_return_date || ''}"
                                data-actual-return-time="${response[i].actual_return_time || ''}"></td>
                            <td id="status"><span class="status-badge status-badge-${response[i].status}">${response[i].status}</span></td>
                            <td>
                              <button class="btn btn-info btn-sm btn-detail" data-order-id="${response[i].order_id}">Detail</button>
                            </td>
                          </tr>`;
              $("#list-data").append(temp);
            }
            addStatusLabel();
            changeCurrency();
            updateCountdown();
            sortTableByStatus();
            applyCarColorClasses();
            applyStatusClasses();
          }
        },
        error: function (xhr, status, error) {
          console.error('Error filter dibatalkan:', status, error, xhr.responseText);
          alert('Gagal memuat transaksi dibatalkan');
        }
      });
    } else if (filter == "4") {
      $.ajax({
        type: "POST",
        url: "/api/filter_transaksi",
        data: JSON.stringify({
          mtd: "fDigunakan",
          date: $(this).val(),
        }),
        contentType: "application/json",
        success: function (response) {
          console.log('Respons filter mobil digunakan:', response);
          $("#list-data").empty();
          if (response.length == 0) {
            $("#list-data").append(
              "<tr><td colspan='12' class='text-center'>Tidak ada transaksi dengan mobil yang sedang digunakan</td></tr>"
            );
          } else {
            for (let i = 0; i < response.length; i++) {
              var temp = `<tr data-order-id="${response[i].order_id}" data-item="${response[i].item}">
                            <td>${i + 1}</td>
                            <td>${response[i].item}</td>
                            <td>${response[i].type_mobil}</td>
                            <td>${response[i].plat}</td>
                            <td>${response[i].penyewa}</td>
                            <td>${response[i].lama_rental}</td>
                            <td data-target="currency">${response[i].total}</td>
                            <td>${response[i].date_rent}</td>
                            <td>${response[i].end_rent}</td>
                            <td class="countdown" 
                                data-end-rent="${response[i].end_rent}" 
                                data-end-time="${response[i].end_time}" 
                                data-status="${response[i].status}" 
                                data-return-status="${response[i].return_status || ''}"
                                data-actual-return-date="${response[i].actual_return_date || ''}"
                                data-actual-return-time="${response[i].actual_return_time || ''}"></td>
                            <td id="status"><span class="status-badge status-badge-${response[i].status}">${response[i].status}</span></td>
                            <td>
                              <button class="btn btn-info btn-sm btn-detail" data-order-id="${response[i].order_id}">Detail</button>
                            </td>
                          </tr>`;
              $("#list-data").append(temp);
            }
            addStatusLabel();
            changeCurrency();
            updateCountdown();
            sortTableByStatus();
            applyCarColorClasses();
            applyStatusClasses();
          }
        },
        error: function (xhr, status, error) {
          console.error('Error filter mobil digunakan:', status, error, xhr.responseText);
          alert('Gagal memuat transaksi mobil digunakan');
        }
      });
    }
  });
    $(document).on('click', '#reload-page', function () {
    location.reload(); // Reload halaman
  });
});