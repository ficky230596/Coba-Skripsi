import { addStatusLabel, changeCurrency } from "./function.js";

$(document).ready(function () {
  // Inisialisasi Toastr
  toastr.options = {
    closeButton: true,
    progressBar: true,
    positionClass: "toast-top-right",
    timeOut: 5000,
  };

  // Inisialisasi Owl Carousel
  $(".owl-carousel").owlCarousel({
    loop: false,
    margin: 10,
    nav: false,
    responsive: {
      0: { items: 1 },
      600: { items: 2 },
      1000: { items: 4 },
    },
  });

  // Inisialisasi status label dan format currency
  addStatusLabel();
  changeCurrency();

  // Tampilkan/sembunyikan field pengantaran
  $("#gunakan_pengantaran").on("change", function () {
    if ($(this).is(":checked")) {
      $(".pengantaran-section").show();
    } else {
      $(".pengantaran-section").hide();
      $("#delivery_cost").val("0");
      $("#delivery_location").val("");
      updateTotal();
    }
  });

  // Update total harga saat input berubah
  $("#hari, #gunakan_sopir, #delivery_cost").on("change keyup", updateTotal);

  // Handler untuk submit form
  $("#transactionForm").on("submit", function (event) {
    event.preventDefault(); // Cegah reload default

    const id_mobil = $("#val_merek").attr("data-id");
    const hari = parseInt($("#hari").val()) || 0;
    const penyewa = $("#penyewa").val().trim();
    const gunakan_sopir = $("#gunakan_sopir").is(":checked");
    const gunakan_pengantaran = $("#gunakan_pengantaran").is(":checked");
    const delivery_cost = parseInt($("#delivery_cost").val()) || 0;
    const delivery_location = $("#delivery_location").val().trim();
    const mtd = $("#pembayaran").val();

    // Validasi input
    if (!id_mobil) {
      toastr.warning("Pilih mobil terlebih dahulu");
      return;
    }
    if (!hari || hari < 1) {
      toastr.warning("Masukkan jumlah hari rental yang valid");
      return;
    }
    if (!penyewa) {
      toastr.warning("Masukkan nama penyewa");
      return;
    }
    if (gunakan_pengantaran && !delivery_location) {
      toastr.warning("Masukkan lokasi pengantaran");
      return;
    }

    // Hitung total untuk validasi
    const harga = parseInt($("#val_harga").attr("data-value")) || 0;
    const biayaSopir = gunakan_sopir ? 100000 * hari : 0;
    const total = hari * harga + biayaSopir + delivery_cost;
    if (!total || total <= 0) {
      toastr.warning("Total harga tidak valid");
      return;
    }

    // Konfirmasi pembayaran dengan SweetAlert
    Swal.fire({
      position: "top",
      text: `Konfirmasi pembayaran cash dengan total Rp. ${total.toLocaleString("id-ID")}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Ya",
      cancelButtonText: "Batal",
    }).then((result) => {
      if (result.isConfirmed) {
        // Kirim data ke server
        const formData = new FormData();
        formData.append("mtd", mtd);
        formData.append("id_mobil", id_mobil);
        formData.append("hari", hari);
        formData.append("penyewa", penyewa);
        formData.append("gunakan_sopir", gunakan_sopir);
        formData.append("gunakan_pengantaran", gunakan_pengantaran);
        formData.append("delivery_cost", delivery_cost);
        formData.append("delivery_location", delivery_location);

        $.ajax({
          type: "POST",
          url: "/api/add_transaction_from_admin",
          data: formData,
          processData: false,
          contentType: false,
          xhrFields: {
            withCredentials: true, // Kirim cookie
          },
          success: function (response) {
            if (response.result === "success") {
              toastr.success(response.message, "Sukses", {
                onHidden: function () {
                  window.location.replace("/transaction");
                },
              });
            } else {
              toastr.error(response.message || "Transaksi gagal");
            }
          },
          error: function (xhr) {
            const errorMsg = xhr.responseJSON?.message || "Terjadi kesalahan saat memproses transaksi";
            toastr.error(errorMsg);
            if (errorMsg.includes("Sesi kadaluarsa") || errorMsg.includes("Token tidak ditemukan")) {
              Swal.fire({
                icon: "error",
                title: "Sesi Kadaluarsa",
                text: "Sesi Anda telah berakhir. Silakan login kembali.",
                confirmButtonText: "Ke Halaman Login",
              }).then(() => {
                window.location.href = "/login";
              });
            }
          },
        });
      }
    });
  });
});

// Handler untuk memilih mobil
$(".item-car").each(function () {
  $(this).on("click", function (event) {
    event.stopPropagation();
    // Reset form
    $("#hari").val("");
    $("#penyewa").val("");
    $("#gunakan_sopir").prop("checked", false);
    $("#gunakan_pengantaran").prop("checked", false);
    $(".pengantaran-section").hide();
    $("#delivery_cost").val("0");
    $("#delivery_location").val("");
    $("#val_total").html("0");
    $("#val_biaya_sopir").html("0");
    $(".item-car").removeClass("selected");
    $(this).addClass("selected");

    const id_mobil = $(this).attr("id");

    // Ambil data mobil dari API
    $.ajax({
      type: "GET",
      url: `/api/get_car/${id_mobil}`,
      xhrFields: {
        withCredentials: true,
      },
      success: function (response) {
        $("#val_merek").html(response.merek);
        $("#val_merek").attr("data-id", id_mobil);
        $("#val_harga").html(response.harga);
        $("#val_harga").attr("data-value", response.harga);
        updateTotal();
        changeCurrency();
      },
      error: function () {
        toastr.error("Gagal mengambil data mobil");
      },
    });
  });
});

// Fungsi untuk menghitung total harga
function updateTotal() {
  const hari = parseInt($("#hari").val()) || 0;
  const harga = parseInt($("#val_harga").attr("data-value")) || 0;
  const biayaSopir = $("#gunakan_sopir").is(":checked") ? 100000 * hari : 0;
  const deliveryCost = parseInt($("#delivery_cost").val()) || 0;

  $("#val_biaya_sopir").html(biayaSopir);
  $("#val_biaya_sopir").attr("data-value", biayaSopir);
  const total = hari * harga + biayaSopir + deliveryCost;
  $("#val_total").html(total);
  $("#val_total").attr("data-value", total);
  changeCurrency();
}