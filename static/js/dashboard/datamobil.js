import { addStatusLabel, changeCurrency } from "./function.js";

$(document).ready(function () {
  addStatusLabel();
  changeCurrency();

  // Cek apakah ada pesan toastr di localStorage saat halaman dimuat
  const toastrMessage = localStorage.getItem('toastrMessage');
  if (toastrMessage) {
    try {
      const { type, text } = JSON.parse(toastrMessage);
      console.log('Menampilkan toastr:', { type, text }); // Debugging
      toastr[type](text);
      localStorage.removeItem('toastrMessage');
    } catch (e) {
      console.error('Gagal parsing toastrMessage:', e);
      localStorage.removeItem('toastrMessage');
    }
  }

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
          temp = "<tr><td colspan='11' class='text-center'>No Data</td></tr>";
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
        const errorMessage = xhr.responseJSON && xhr.responseJSON.msg
          ? xhr.responseJSON.msg
          : "Gagal melakukan pencarian. Silakan coba lagi.";
        toastr.error(errorMessage);
      }
    });
  });
});

export function confirm(fitur, id_mobil, order_id = null) {
  let doc = {
    pesanan: {
      text: "Pastikan client sudah datang dan menyerahkan KTP ke kantor. Yakin untuk konfirmasi pesanan?",
      url: "/api/confirmPesanan",
      successMessage: "Pesanan berhasil dikonfirmasi!",
      errorMessage: "Gagal mengkonfirmasi pesanan. Silakan coba lagi.",
    },
    kembali: {
      text: "Pastikan client sudah mengembalikan mobil, yakin untuk merubah status?",
      url: "/api/confirmKembali",
      successMessage: "Pengembalian dikonfirmasi. User akan memberikan rating.",
      errorMessage: "Gagal mengkonfirmasi pengembalian. Silakan coba lagi.",
    },
    hapus: {
      text: "Yakin untuk menghapus mobil?",
      url: "/api/delete_mobil",
      successMessage: "Mobil berhasil dihapus!",
      errorMessage: "Gagal menghapus mobil. Silakan coba lagi.",
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
            toastr.warning(response['msg'] || 'Terjadi kesalahan pada server.');
          } else {
            localStorage.setItem('toastrMessage', JSON.stringify({
              type: 'success',
              text: response['msg'] || doc[fitur].successMessage,
            }));
            if (fitur === 'kembali') {
              $.ajax({
                type: "POST",
                url: "/api/hide_mobil",
                data: { id_mobil: id_mobil },
                success: function (response) {
                  if (response['result'] === 'success') {
                    localStorage.setItem('toastrMessage', JSON.stringify({
                      type: 'success',
                      text: response['msg'] || doc[fitur].successMessage,
                    }));
                    setTimeout(() => location.reload(), 100);
                  } else {
                    toastr.warning(response['msg'] || 'Terjadi kesalahan pada server.');
                  }
                },
                error: function (xhr, status, error) {
                  const errorMessage = xhr.responseJSON && xhr.responseJSON.msg
                    ? xhr.responseJSON.msg
                    : "Gagal menyembunyikan mobil. Silakan coba lagi.";
                  toastr.error(errorMessage);
                }
              });
            } else {
              setTimeout(() => location.reload(), 100);
            }
          }
        },
        error: function (xhr, status, error) {
          const errorMessage = xhr.responseJSON && xhr.responseJSON.msg
            ? xhr.responseJSON.msg
            : doc[fitur].errorMessage;
          toastr.error(errorMessage);
        }
      });
    }
  });
}
window.confirm = confirm;

export function toggleVisibility(action, id_mobil) {
  let url = action === 'hide' ? '/api/hide_mobil' : '/api/show_mobil';
  let errorMessage = action === 'hide'
    ? 'Gagal menyembunyikan mobil. Silakan coba lagi.'
    : 'Gagal menampilkan mobil. Silakan coba lagi.';

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
            toastr.warning(response['msg'] || 'Terjadi kesalahan pada server.');
          } else {
            localStorage.setItem('toastrMessage', JSON.stringify({
              type: 'success',
              text: response['msg'] || (action === 'hide' ? 'Mobil berhasil disembunyikan!' : 'Mobil berhasil ditampilkan!'),
            }));
            setTimeout(() => location.reload(), 100);
          }
        },
        error: function (xhr, status, error) {
          const errorMessage = xhr.responseJSON && xhr.responseJSON.msg
            ? xhr.responseJSON.msg
            : errorMessage;
          toastr.error(errorMessage);
        }
      });
    }
  });
}
window.toggleVisibility = toggleVisibility;