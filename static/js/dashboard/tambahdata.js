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

function addData() {
  var formData = new FormData();
  var file = $("#input-file")[0].files[0];

  // Validasi file
  if (!file) {
    toastr.warning("Pilih gambar terlebih dahulu");
    return;
  }

  // Kompresi gambar
  compressImage(file, function (compressedBlob) {
    formData.append("gambar", compressedBlob, `compressed-${file.name}`);
    formData.append("merek", $("#merek").val());
    formData.append("type_mobil", $("#type_mobil").val());
    formData.append("plat", $("#plat").val());
    formData.append("bahan_bakar", $("#bahan_bakar").val());
    formData.append("seat", $("#seat").val());
    formData.append("transmisi", $("#transmisi").val());
    formData.append("harga", $("#harga").val());

    $.ajax({
      url: "add-data",
      type: "post",
      data: formData,
      contentType: false,
      processData: false,
      success: function (response) {
        if (response["result"] == "success") {
          localStorage.setItem('tambahData', 'true');
          window.location.replace("/data_mobil");
        } else {
          toastr.warning(response['msg']);
        }
      },
      error: function (xhr, status, error) {
        toastr.error("Gagal mengunggah data: " + error);
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
    return;
  }

  // Validasi ukuran file (maks 10MB)
  if (file.size > 10 * 1024 * 1024) {
    toastr.error("Ukuran file terlalu besar, maksimum 10MB.");
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
    };
  };

  reader.onerror = function () {
    toastr.error("Gagal membaca file gambar.");
  };
  reader.readAsDataURL(file);
}