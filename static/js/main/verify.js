// Ensure SweetAlert2 is available
const Swal = window.Swal || {
  fire: options => {
      console.error('SweetAlert2 is not loaded. Please ensure sweetalert2.min.js is included.');
      alert(options.text || options.title);
  }
};

function sendVerify(user_id) {
  // Tampilkan spinner seperti di reset password
  document.getElementById('spinner').style.display = 'flex';

  // Disable tombol saat mengirim
  $("#btn").attr("disabled", true);

  $.ajax({
      type: "POST",
      url: "/api/verify",
      data: {
          user_id: user_id
      },
      success: function (data) {
          document.getElementById('spinner').style.display = 'none';
          Swal.fire({
              title: "Berhasil!",
              text: "Email verifikasi telah dikirim!",
              icon: "success",
              confirmButtonText: "OK"
          }).then(result => {
              if (result.isConfirmed) {
                  window.location.reload(); // Reload halaman jika berhasil
              }
          });
          $("#btn").attr("disabled", false);
      },
      error: function () {
          document.getElementById('spinner').style.display = 'none';
          Swal.fire({
              title: "Error!",
              text: "Gagal mengirim email. Silakan coba lagi.",
              icon: "error",
              confirmButtonText: "OK"
          });
          $("#btn").attr("disabled", false);
      }
  });
}

function verifyKode(user_id) {
  const kode = $('#kodeVerif').val();
  
  // Tampilkan spinner
  document.getElementById('spinner').style.display = 'flex';

  $.ajax({
      type: "POST",
      url: "/api/verify_kode",
      data: {
          user_id: user_id,
          kode: kode
      },
      success: function (data) {
          document.getElementById('spinner').style.display = 'none';
          if (data['result'] === 'success') {
              Swal.fire({
                  title: "Berhasil!",
                  text: "Email berhasil diverifikasi!",
                  icon: "success",
                  confirmButtonText: "OK"
              }).then(result => {
                  if (result.isConfirmed) {
                      window.location.href = '/';
                  }
              });
          } else {
              Swal.fire({
                  title: "Error!",
                  text: "Kode verifikasi salah.",
                  icon: "error",
                  confirmButtonText: "OK"
              });
          }
      },
      error: function () {
          document.getElementById('spinner').style.display = 'none';
          Swal.fire({
              title: "Error!",
              text: "Terjadi kesalahan. Silakan coba lagi.",
              icon: "error",
              confirmButtonText: "OK"
          });
      }
  });
}

function logout() {
  Swal.fire({
      title: "Konfirmasi Logout",
      text: "Anda yakin ingin logout?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#1b1bb3",
      cancelButtonColor: "#dc3545",
      confirmButtonText: "Ya",
      cancelButtonText: "Batal"
  }).then(result => {
      if (result.isConfirmed) {
          $.removeCookie("tokenMain");
          localStorage.setItem("logout", "true");
          window.location.replace("/");
      }
  });
}