function change_username_admin(username) {
  $("#btn-change_username_admin").attr("disabled", true);
  $.ajax({
    type: "POST",
    url: "/settings/change_username",
    data: {
      username: username,
      new_username: $("#new_username").val(),
    },
    success: function (response) {
      if (response["result"] == "success") {
        $.removeCookie("tokenDashboard");
        $.cookie("tokenDashboard", response["token"], { path: "/" });
        toastr.success('Username berhasil diubah', 'Sukses!', {
          onHidden: function() {
            window.location.reload();
          }
        });
      } else if (response["result"] == "failed") {
        $("#helpId").text(response["msg"]);
        $("#helpId").addClass("text-danger");
        $("#helpId").removeClass("text-muted");
        $("#btn-change_username_admin").attr("disabled", false);
      }
    },
    error: function() {
      toastr.error('Terjadi kesalahan, coba lagi nanti.');
      $("#btn-change_username_admin").attr("disabled", false);
    }
  });
}

function change_email(username) {
  $("#btn_email").attr("disabled", true);
  $.ajax({
    type: "POST",
    url: "/settings/change_email",
    data: {
      mtd: 'add_email',
      username: username,
      new_email: $("#new_email").val(),
    },
    success: function (response) {
      if (response["result"] == "success") {
        toastr.success('Email berhasil diganti', 'Sukses!', {
          onHidden: function() {
            window.location = "/settings"; // Redirect ke setting.html
          }
        });
      } else if (response["result"] == "failed") {
        $("#helpId_email").text(response["msg"]);
        $("#helpId_email").addClass("text-danger");
        $("#helpId_email").removeClass("text-muted");
        $("#btn_email").attr("disabled", false);
      }
    },
    error: function() {
      toastr.error('Terjadi kesalahan, coba lagi nanti.');
      $("#btn_email").attr("disabled", false);
    }
  });
}

function add_email(username) {
  $("#btn_email").attr("disabled", true);
  $.ajax({
    type: "POST",
    url: "/settings/change_email",
    data: {
      mtd: 'add_email',
      username: username,
      new_email: $("#new_email").val(),
    },
    success: function (response) {
      if (response["result"] == "success") {
        toastr.success('Email berhasil ditambahkan', 'Sukses!', {
          onHidden: function() {
            window.location = "/settings"; // Redirect ke setting.html
          }
        });
      } else if (response["result"] == "failed") {
        $("#helpId_email").text(response["msg"]);
        $("#helpId_email").addClass("text-danger");
        $("#helpId_email").removeClass("text-muted");
        $("#btn_email").attr("disabled", false);
      }
    },
    error: function() {
      toastr.error('Terjadi kesalahan, coba lagi nanti.');
      $("#btn_email").attr("disabled", false);
    }
  });
}

function send_verif(username) {
  $("#btn_email").attr("disabled", true);
  $.ajax({
    type: "POST",
    url: "/settings/change_email",
    data: {
      mtd: 'send_verif',
      username: username,
    },
    success: function (response) {
      console.log(response);
      if (response["result"] == "success") {
        toastr.success('Kode verifikasi telah dikirim', 'Sukses!');
        window.location.reload();
      } else if (response["result"] == "gagal") {
        toastr.error(response['msg']);
        $("#btn_email").attr("disabled", false);
      }
    },
    error: function() {
      toastr.error('Terjadi kesalahan, coba lagi nanti.');
      $("#btn_email").attr("disabled", false);
    }
  });
}

function verif(username) {
  $("#btn_email").attr("disabled", true);
  $.ajax({
    type: "POST",
    url: "/settings/change_email",
    data: {
      mtd: 'verif',
      username: username,
      kode: $('#kode').val()
    },
    success: function (response) {
      console.log(response);
      if (response["result"] == "success") {
        toastr.success('Email berhasil diverifikasi', 'Sukses!', {
          onHidden: function() {
            window.location = "/settings"; // Redirect ke setting.html
          }
        });
      } else if (response["result"] == "gagal") {
        toastr.error(response['msg']);
        $("#btn_email").attr("disabled", false);
      }
    },
    error: function() {
      toastr.error('Terjadi kesalahan, coba lagi nanti.');
      $("#btn_email").attr("disabled", false);
    }
  });
}

function ganti_password(username) {
  $("#btn_ganti_password").attr("disabled", true);
  $.ajax({
    type: "POST",
    url: "/settings/change_password",
    data: {
      username: username,
      password_lama: $('#ganti_password_lama').val(),
      password_baru: $('#ganti_password_baru').val(),
    },
    success: function(response) {
      if (response['result'] == 'success') {
        toastr.success('Password berhasil diganti', 'Sukses!', {
          onHidden: function() {
            window.location = "/settings"; // Redirect ke setting.html
          }
        });
      } else if (response['result'] == 'gagal') {
        toastr.error(response['msg']);
        $("#btn_ganti_password").attr("disabled", false);
      }
    },
    error: function() {
      toastr.error('Terjadi kesalahan, coba lagi nanti.');
      $("#btn_ganti_password").attr("disabled", false);
    }
  });
}

$(document).ready(function() {
  toastr.options = {
    "closeButton": true,
    "debug": false,
    "newestOnTop": false,
    "progressBar": true,
    "preventDuplicates": false,
    "onclick": null,
    "showDuration": "300",
    "hideDuration": "1000",
    "timeOut": "1500",
    "extendedTimeOut": "1500",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
  };
});