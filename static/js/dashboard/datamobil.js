import { addStatusLabel, changeCurrency } from "./function.js";

$(document).ready(function () {
  addStatusLabel();
  changeCurrency();

  $("#search-data").keyup(function () {
    var search = $(this).val();
    $.ajax({
      url: "/api/search-dashboard",
      type: "GET",
      data: { search: search },
      success: function (data) {
        $("#list-data").empty();
        var temp = "";
        if (data.length === 0) {
          temp = "<tr><td colspan='11' class='text-center'>No Data</td></tr>"; // Ubah colspan ke 11
          $("#list-data").append(temp);
        } else {
          for (let i = 0; i < data.length; i++) {
            let button = "";
            if (data[i].status == "Diproses") {
              button = `<ul class="dropdown-menu">
                            <li><a class="dropdown-item" onclick="confirm('pesanan','${data[i].id_mobil}','${data[i].order_id}')"
                                role="button">Konfirmasi Pesanan</a></li>
                        </ul>`;
            } else if (data[i].status == "Digunakan") {
              button = `<ul class="dropdown-menu">
                            <li><a class="dropdown-item" onclick="confirm('kembali','${data[i].id_mobil}')"
                                role="button">Konfirmasi Kembali</a></li>
                        </ul>`;
            } else {
              button = `<ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="/data_mobil/edit?id=${data[i].id_mobil}">Edit Mobil</a></li>
                            <li><a class="dropdown-item" onclick="confirm('hapus','${data[i].id_mobil}')"
                                role="button">Hapus</a></li>
                            ${data[i].visibility == 'visible'
                  ? `<li><a class="dropdown-item" onclick="toggleVisibility('hide','${data[i].id_mobil}')"
                                        role="button">Sembunyikan</a></li>`
                  : `<li><a class="dropdown-item" onclick="toggleVisibility('show','${data[i].id_mobil}')"
                                        role="button">Tampilkan</a></li>`
                }
                        </ul>`;
            }
            temp = `<tr>
                        <td>${i + 1}</td>
                        <td id="merek">${data[i].merek}</td>
                        <td>${data[i].type_mobil}</td>
                        <td>${data[i].plat}</td>
                        <td>${data[i].bahan_bakar}</td>
                        <td>${data[i].seat}</td>
                        <td>${data[i].transmisi}</td>
                        <td data-target="currency">${data[i].harga}</td>
                        <td id="status">${data[i].status}</td>
                        <td>
                            <button class="btn fa-solid fa-edit" type="button" data-bs-toggle="dropdown" aria-expanded="false"></button>
                            ${button}
                        </td>
                        <td>
                            ${data[i].visibility == 'visible'
                  ? `<a class="dropdown-item" onclick="toggleVisibility('hide', '${data[i].id_mobil}')" role="button">
                                <i class="fa-solid fa-eye-slash"></i> Hide
                            </a>`
                  : `<a class="dropdown-item" onclick="toggleVisibility('show', '${data[i].id_mobil}')" role="button">
                                <i class="fa-solid fa-eye"></i> Show
                            </a>`
                }
                        </td>
                    </tr>`;
            $("#list-data").append(temp);
          }
        }
        addStatusLabel();
        changeCurrency();
      },
      error: function (xhr, status, error) {
        toastr.error("Gagal melakukan pencarian. Silakan coba lagi.");
      }
    });
  });
});

export function confirm(fitur, id_mobil, order_id = null) {
  let doc = {
    pesanan: {
      text: "Pastikan client sudah datang dan menyerahkan KTP ke kantor. Yakin untuk konfirmasi pesanan?",
      url: "/api/confirmPesanan",
    },
    kembali: {
      text: "Pastikan client sudah mengembalikan mobil, yakin untuk merubah status?",
      url: "/api/confirmKembali",
    },
    hapus: {
      text: "Yakin untuk menghapus mobil?",
      url: "/api/delete_mobil",
    },
  };

  Swal.fire({
    position: "top",
    text: doc[fitur].text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "Yes",
  }).then((result) => {
    if (result.isConfirmed) {
      let data = { id_mobil: id_mobil };
      if (fitur === 'pesanan' && order_id) {
        data.order_id = order_id;
      }
      $.ajax({
        type: "POST",
        url: doc[fitur].url,
        data: data,
        success: function (response) {
          if (response['result'] === 'unsuccess') {
            toastr.warning(response['msg']);
          } else {
            if (fitur === 'kembali') {
              $.ajax({
                type: "POST",
                url: "/api/hide_mobil",
                data: { id_mobil: id_mobil },
                success: function (response) {
                  if (response['result'] === 'success') {
                    toastr.success("Pengembalian dikonfirmasi. User akan memberikan rating.");
                    location.reload();
                  } else {
                    toastr.warning(response['msg']);
                  }
                },
                error: function (xhr, status, error) {
                  toastr.error("Gagal menyembunyikan mobil.");
                }
              });
            } else {
              toastr.success("Berhasil di Konfirmasi!");
              location.reload();
            }
          }
        },
        error: function (xhr, status, error) {
          toastr.error("Terjadi kesalahan. Silakan coba lagi.");
        }
      });
    }
  });
}
window.confirm = confirm;

export function toggleVisibility(action, id_mobil) {
  let url = action === 'hide' ? '/api/hide_mobil' : '/api/show_mobil';

  Swal.fire({
    position: "top",
    text: action === 'hide' ? "Sembunyikan mobil ini?" : "Tampilkan mobil ini?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "Yes",
  }).then((result) => {
    if (result.isConfirmed) {
      $.ajax({
        type: "POST",
        url: url,
        data: { id_mobil: id_mobil },
        success: function (response) {
          if (response['result'] === 'unsuccess') {
            toastr.warning(response['msg']);
          } else {
            location.reload();
          }
        },
        error: function (xhr, status, error) {
          toastr.error("Terjadi kesalahan. Silakan coba lagi.");
        }
      });
    }
  });
}
window.toggleVisibility = toggleVisibility;