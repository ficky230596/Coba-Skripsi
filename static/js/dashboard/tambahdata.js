$(document).ready(function () {
    $("#input-file").change(function (e) {
        const file = this.files[0];
        if (file) {
            let reader = new FileReader();
            reader.onload = function (event) {
                $("#imgPreview").attr("src", event.target.result);
                $("#imgPreview").removeAttr("hidden");
            };
            reader.readAsDataURL(file);
        }
    });

    // Validasi form sebelum submit
    $("#form-tambah-data").on("submit", function (e) {
        e.preventDefault();
        addData();
    });

    // Format input merek dan type_mobil saat diketik
    $("#merek, #type_mobil").on("input", function () {
        $(this).val(formatTitleCase($(this).val()));
    });
});

// Fungsi untuk mengkapitalkan huruf pertama setiap kata
function formatTitleCase(str) {
    return str.toLowerCase().replace(/(^|\s)\w/g, letter => letter.toUpperCase());
}

function addData() {
    const formData = new FormData();
    const file = $("#input-file")[0].files[0];

    // Validasi field wajib
    const merek = $("#merek").val().trim();
    const type_mobil = $("#type_mobil").val().trim();
    const plat = $("#plat").val().trim();
    const bahan_bakar = $("#bahan_bakar").val();
    const seat = $("#seat").val().trim();
    const transmisi = $("#transmisi").val();
    const harga = $("#harga").val().trim();
    const gps_device_id = $("#gps_device_id").val().trim();
    const gps_device_type = $("#gps_device_type").val();

    if (!merek) {
        toastr.warning("Merek mobil tidak boleh kosong");
        return;
    }
    if (!type_mobil) {
        toastr.warning("Tipe mobil tidak boleh kosong");
        return;
    }
    if (!plat || !/^[A-Z]{1,2}\s?[0-9]{1,4}\s?[A-Z]{1,3}$/.test(plat)) {
        toastr.warning("Nomor plat tidak valid (contoh: B 1234 ABC)");
        return;
    }
    if (!bahan_bakar) {
        toastr.warning("Bahan bakar tidak boleh kosong");
        return;
    }
    if (!seat || parseInt(seat) <= 0) {
        toastr.warning("Jumlah kursi harus angka positif");
        return;
    }
    if (!transmisi) {
        toastr.warning("Transmisi tidak boleh kosong");
        return;
    }
    if (!harga || !/^[0-9]+$/.test(harga) || parseInt(harga) <= 0) {
        toastr.warning("Harga sewa harus angka positif");
        return;
    }
    if (gps_device_type && !gps_device_id) {
        toastr.warning("ID Perangkat GPS harus diisi jika tipe perangkat dipilih");
        return;
    }
    if (!file) {
        toastr.warning("Pilih gambar terlebih dahulu");
        return;
    }
    const validExtensions = ['image/jpeg', 'image/png'];
    if (!validExtensions.includes(file.type)) {
        toastr.error("Format file tidak didukung. Gunakan JPG atau PNG.");
        $("#btn_tambah").attr("disabled", false);
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        toastr.error("Ukuran file terlalu besar, maksimum 10MB.");
        $("#btn_tambah").attr("disabled", false);
        return;
    }

    // Nonaktifkan tombol untuk mencegah klik ganda
    $("#btn_tambah").attr("disabled", true);

    // Kompresi gambar
    toastr.info("Mengompresi gambar, harap tunggu...");
    compressImage(file, function (compressedBlob) {
        formData.append("gambar", compressedBlob, `compressed-${file.name}`);
        formData.append("merek", merek);
        formData.append("type_mobil", type_mobil);
        formData.append("plat", plat);
        formData.append("bahan_bakar", bahan_bakar);
        formData.append("seat", seat);
        formData.append("transmisi", transmisi);
        formData.append("harga", harga);
        formData.append("gps_device_id", gps_device_id);
        formData.append("gps_device_type", gps_device_type);

        $.ajax({
            url: "/data_mobil/add-data",
            type: "POST",
            data: formData,
            contentType: false,
            processData: false,
            success: function (response) {
                $("#btn_tambah").attr("disabled", false);
                if (response.result === "success") {
                    toastr.success(response.msg || "Data mobil berhasil ditambahkan");
                    localStorage.setItem('tambahData', 'true');
                    setTimeout(function () {
                        window.location.replace("/data_mobil");
                    }, 3000);
                } else {
                    toastr.warning(response.msg);
                }
            },
            error: function (xhr, status, error) {
                $("#btn_tambah").attr("disabled", false);
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
                'image/jpeg',
                quality
            );
        };

        img.onerror = function () {
            toastr.error("Gagal memuat gambar. Pastikan file valid.");
            $("#btn_tambah").attr("disabled", false);
        };
    };

    reader.onerror = function () {
        toastr.error("Gagal membaca file gambar.");
        $("#btn_tambah").attr("disabled", false);
    };
    reader.readAsDataURL(file);
}