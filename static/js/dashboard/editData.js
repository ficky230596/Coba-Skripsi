$(document).ready(function () {
  $("#input-file").change(function (e) {
    file = this.files[0];
    if (file) {
      let reader = new FileReader();
      reader.onload = function (event) {
        $("#imgPreview").attr("src", event.target.result);
        $("#imgPreview").removeAttr("hidden");
      };
      reader.readAsDataURL(file);
    }
  });
});

function updateData(id_mobil) {
  var formData = new FormData();
  var file = $("#input-file")[0].files[0];

  // Validasi input lainnya
  if (!$("#merek").val()) {
    toastr.warning("Merek tidak boleh kosong");
    return;
  }
  if (!$("#type_mobil").val()) {
    toastr.warning("Tipe mobil tidak boleh kosong");
    return;
  }
  if (!$("#plat").val()) {
    toastr.warning("Plat tidak boleh kosong");
    return;
  }
  if (!$("#bahan_bakar").val()) {
    toastr.warning("Bahan bakar tidak boleh kosong");
    return;
  }
  if (!$("#seat").val()) {
    toastr.warning("Seat tidak boleh kosong");
    return;
  }
  if (!$("#transmisi").val()) {
    toastr.warning("Transmisi tidak boleh kosong");
    return;
  }
  if (!$("#harga").val()) {
    toastr.warning("Harga tidak boleh kosong");
    return;
  }

  // Tambahkan data ke FormData
  formData.append("id_mobil", id_mobil);
  formData.append("merek", $("#merek").val());
  formData.append("type_mobil", $("#type_mobil").val());
  formData.append("plat", $("#plat").val());
  formData.append("bahan_bakar", $("#bahan_bakar").val());
  formData.append("seat", $("#seat").val());
  formData.append("transmisi", $("#transmisi").val());
  formData.append("harga", $("#harga").val());

  // Nonaktifkan tombol untuk mencegah klik ganda
  $("#btn_update").attr("disabled", true);

  // Jika tidak ada file gambar, kirim data tanpa gambar
  if (!file) {
    $.ajax({
      url: "/data_mobil/update-data",
      type: "post",
      data: formData,
      contentType: false,
      processData: false,
      success: function (response) {
        $("#btn_update").attr("disabled", false);
        if (response["result"] == "success") {
          toastr.success("Data berhasil diperbarui", { timeOut: 3000 });
          localStorage.setItem("updateData", "true");
          setTimeout(function () {
            window.location.replace("/data_mobil");
          }, 3000);
        } else {
          toastr.warning(response["msg"]);
        }
      },
      error: function (xhr, status, error) {
        $("#btn_update").attr("disabled", false);
        toastr.error("Gagal memperbarui data: " + error);
      }
    });
    return;
  }

  // Kompresi gambar jika ada file
  toastr.info("Mengompresi gambar, harap tunggu...");
  compressImage(file, function (compressedBlob) {
    formData.append("gambar", compressedBlob, `compressed-${file.name}`);

    $.ajax({
      url: "/data_mobil/update-data",
      type: "post",
      data: formData,
      contentType: false,
      processData: false,
      success: function (response) {
        $("#btn_update").attr("disabled", false);
        if (response["result"] == "success") {
          toastr.success("Data berhasil diperbarui", { timeOut: 3000 });
          localStorage.setItem("updateData", "true");
          setTimeout(function () {
            window.location.replace("/data_mobil");
          }, 3000);
        } else {
          toastr.warning(response["msg"]);
        }
      },
      error: function (xhr, status, error) {
        $("#btn_update").attr("disabled", false);
        toastr.error("Gagal memperbarui data: " + error);
      }
    });
  });
}

// Fungsi untuk mengompresi gambar
function compressImage(file, callback) {
  const maxWidth = 800; // Lebar maksimum
  const maxHeight = 800; // Tinggi maksimum
  const quality = 0.7; // Kualitas JPEG (0.0 - 1.0)
  const validExtensions = ['image/jpeg', 'image/png'];

  // Validasi tipe file
  if (!validExtensions.includes(file.type)) {
    toastr.error("Format file tidak didukung. Gunakan JPG atau PNG.");
    $("#btn_update").attr("disabled", false);
    return;
  }

  // Validasi ukuran file (maks 10MB)
  if (file.size > 10 * 1024 * 1024) {
    toastr.error("Ukuran file terlalu besar, maksimum 10MB.");
    $("#btn_update").attr("disabled", false);
    return;
  }

  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();
    img.src = event.target.result;

    img.onload = function () {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Hitung dimensi baru dengan mempertahankan rasio aspek
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      // Atur ukuran canvas
      canvas.width = width;
      canvas.height = height;

      // Gambar ulang gambar ke canvas dengan ukuran baru
      ctx.drawImage(img, 0, 0, width, height);

      // Konversi ke Blob dengan kualitas tertentu
      canvas.toBlob(
        function (blob) {
          callback(blob);
        },
        'image/jpeg', // Selalu gunakan JPEG untuk kompresi maksimal
        quality
      );
    };

    img.onerror = function () {
      toastr.error("Gagal memuat gambar. Pastikan file valid.");
      $("#btn_update").attr("disabled", false);
    };
  };

  reader.onerror = function () {
    toastr.error("Gagal membaca file gambar.");
    $("#btn_update").attr("disabled", false);
  };
  reader.readAsDataURL(file);
}