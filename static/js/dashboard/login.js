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

function loginDashboard() {
  var username = $("input[name=username]").val();
  var password = $("input[name=password]").val();
  if (password == "" && username == "") {
    toastr.error("Masukkan username dan password");
  } else if (password == "") {
    toastr.error("Masukkan password");
  } else if (username == "") {
    toastr.error("Masukkan username");
  } else {
    $.ajax({
      url: "/dashboard-login",
      type: "POST",
      data: {
        username: username,
        password: password,
      },
      success: function (response) {
        if (response["result"] == "success") {
          toastr.success("Login berhasil", "Sukses!", {
            onHidden: function() {
              $.cookie("tokenDashboard", response["token"], { path: "/" });
              window.location.replace("/dashboard");
            }
          });
        } else {
          toastr.error("Username atau password salah");
        }
      },
      error: function() {
        toastr.error("Terjadi kesalahan, coba lagi nanti.");
      }
    });
  }
}

function sendResetCode() {
  var email = $("#forgot_email").val();
  if (!email) {
    $("#emailError").text("Email tidak boleh kosong");
    return;
  }
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    $("#emailError").text("Masukkan email yang valid");
    return;
  }
  $("#emailError").text("");
  $("#btn_send_code").attr("disabled", true);
  $.ajax({
    url: "/forgot-password",
    type: "POST",
    data: {
      mtd: "send_reset_code",
      email: email
    },
    success: function (response) {
      if (response["result"] == "success") {
        toastr.success(response["msg"], "Sukses!");
        $("#step-email").hide();
        $("#step-code").show();
      } else {
        toastr.error(response["msg"]);
        $("#btn_send_code").attr("disabled", false);
      }
    },
    error: function() {
      toastr.error("Terjadi kesalahan, coba lagi nanti.");
      $("#btn_send_code").attr("disabled", false);
    }
  });
}

function verifyResetCode() {
  var email = $("#forgot_email").val();
  var code = $("#reset_code").val();
  if (!code) {
    $("#codeError").text("Kode verifikasi tidak boleh kosong");
    return;
  }
  $("#codeError").text("");
  $("#btn_verify_code").attr("disabled", true);
  $.ajax({
    url: "/forgot-password",
    type: "POST",
    data: {
      mtd: "verify_reset_code",
      email: email,
      code: code
    },
    success: function (response) {
      if (response["result"] == "success") {
        toastr.success(response["msg"], "Sukses!");
        $("#step-code").hide();
        $("#step-new-password").show();
      } else {
        toastr.error(response["msg"]);
        $("#btn_verify_code").attr("disabled", false);
      }
    },
    error: function() {
      toastr.error("Terjadi kesalahan, coba lagi nanti.");
      $("#btn_verify_code").attr("disabled", false);
    }
  });
}

function resetPassword() {
  var email = $("#forgot_email").val();
  var newPassword = $("#new_password").val();
  if (!newPassword) {
    $("#passwordError").text("Kata sandi baru tidak boleh kosong");
    return;
  }
  if (newPassword.length < 6) {
    $("#passwordError").text("Kata sandi minimal 6 karakter");
    return;
  }
  $("#passwordError").text("");
  $("#btn_reset_password").attr("disabled", true);
  $.ajax({
    url: "/forgot-password",
    type: "POST",
    data: {
      mtd: "reset_password",
      email: email,
      new_password: newPassword
    },
    success: function (response) {
      if (response["result"] == "success") {
        toastr.success(response["msg"], "Sukses!", {
          onHidden: function() {
            $("#forgotPasswordModal").modal("hide");
            // Reset modal ke langkah awal
            $("#step-new-password").hide();
            $("#step-email").show();
            $("#forgot_email").val("");
            $("#reset_code").val("");
            $("#new_password").val("");
          }
        });
      } else {
        toastr.error(response["msg"]);
        $("#btn_reset_password").attr("disabled", false);
      }
    },
    error: function() {
      toastr.error("Terjadi kesalahan, coba lagi nanti.");
      $("#btn_reset_password").attr("disabled", false);
    }
  });
}