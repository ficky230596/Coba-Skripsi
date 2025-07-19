$(document).ready(function () {
    // Inisialisasi Inputmask untuk nomor telepon
    $("#reg_phone").inputmask({ placeholder: "" });
  
    // Beralih antara form login dan registrasi
    $("#showRegister").click(function () {
        $("#loginForm").hide();
        $("#registerForm").show();
        // Reset gambar ke login5.png saat beralih form
        $("#brand-logo-img").attr("src", $("body").data("login5-img"));
    });
  
    $("#showLogin").click(function () {
        $("#registerForm").hide();
        $("#loginForm").show();
        // Reset gambar ke login5.png saat beralih form
        $("#brand-logo-img").attr("src", $("body").data("login5-img"));
    });
  
    // Beralih ke halaman reset password
    $("#showResetPassword").click(function () {
        window.location.href = "/reset_password";
    });
  
    // Pratinjau gambar SIM
    $("#reg_image").on("change", function () {
        var file = this.files[0];
        $("#image_status").removeClass("text-success text-danger").html("");
        if (file && file.type.startsWith("image/")) {
            var reader = new FileReader();
            reader.onload = function (e) {
                $("#image_status").html(`<img src="${e.target.result}" style="max-width: 100px; max-height: 100px;" />`);
            };
            reader.readAsDataURL(file);
        } else {
            $("#image_status").addClass("text-danger").text("Harap pilih file gambar (jpg, png, dll).");
        }
    });
  
    // Toggle visibility password, gambar, dan suara untuk login
    $("#toggleLoginPassword").click(function () {
        var passwordField = $("#login_password");
        var brandLogoImg = $("#brand-logo-img");
        var clickSound = document.getElementById("clickSound");
        if (passwordField.attr("type") === "password") {
            passwordField.attr("type", "text");
            $(this).removeClass("bi-eye-slash").addClass("bi-eye");
            brandLogoImg.addClass("changing");
            clickSound.play(); // Putar suara
            setTimeout(() => {
                brandLogoImg.attr("src", $("body").data("login6-img"));
                brandLogoImg.removeClass("changing");
            }, 150);
        } else {
            passwordField.attr("type", "password");
            $(this).removeClass("bi-eye").addClass("bi-eye-slash");
            brandLogoImg.addClass("changing");
            clickSound.play(); // Putar suara
            setTimeout(() => {
                brandLogoImg.attr("src", $("body").data("login5-img"));
                brandLogoImg.removeClass("changing");
            }, 150);
        }
    });
  
    // Toggle visibility password, gambar, dan suara untuk registrasi
    $("#toggleRegPassword").click(function () {
        var passwordField = $("#reg_password");
        var brandLogoImg = $("#brand-logo-img");
        var clickSound = document.getElementById("clickSound");
        if (passwordField.attr("type") === "password") {
            passwordField.attr("type", "text");
            $(this).removeClass("bi-eye-slash").addClass("bi-eye");
            brandLogoImg.addClass("changing");
            clickSound.play(); // Putar suara
            setTimeout(() => {
                brandLogoImg.attr("src", $("body").data("login6-img"));
                brandLogoImg.removeClass("changing");
            }, 150);
        } else {
            passwordField.attr("type", "password");
            $(this).removeClass("bi-eye").addClass("bi-eye-slash");
            brandLogoImg.addClass("changing");
            clickSound.play(); // Putar suara
            setTimeout(() => {
                brandLogoImg.attr("src", $("body").data("login5-img"));
                brandLogoImg.removeClass("changing");
            }, 150);
        }
    });
  });
  
  // Login
  $("#form-login").on("submit", function (e) {
    e.preventDefault();
    var redirect = $("#login_button").attr("data-redirect") || "/";
    var username = $("#login_username").val();
    var password = $("#login_password").val();
  
    $("#login_button").attr("disabled", true);
    $.ajax({
        url: "/login",
        type: "post",
        data: {
            username: username,
            password: password,
        },
        success: function (response) {
            if (response["result"] == "success") {
                $.cookie("tokenMain", response["token"], { path: "/" });
                localStorage.setItem("login", "true");
                window.location.replace(redirect);
            } else {
                toastr.warning(response["msg"]);
                $("#login_button").attr("disabled", false);
            }
        },
        error: function (xhr, status, error) {
            console.error(xhr.responseText);
            toastr.error("Terlalu banyak mencoba, coba lagi dalam beberapa menit.");
            $("#login_button").attr("disabled", false);
        },
    });
  });
  
  // Registrasi
  $("#form-register").on("submit", function (e) {
    e.preventDefault();
    $("#reg_button").attr("disabled", true);
  
    // Validasi file SIM
    var file = $("#reg_image")[0].files[0];
    $("#image_status").removeClass("text-success text-danger").html("");
  
    if (!file) {
        $("#image_status").addClass("text-danger").text("Harap unggah foto SIM.");
        $("#reg_button").attr("disabled", false);
        return;
    }
    if (!file.type.startsWith("image/")) {
        $("#image_status").addClass("text-danger").text("File harus berupa gambar (jpg, png, dll).");
        $("#reg_button").attr("disabled", false);
        return;
    }
    if (file.size > 2 * 1024 * 1024) { // Maksimum 2MB
        $("#image_status").addClass("text-danger").text("Ukuran file maksimum 2MB.");
        $("#reg_button").attr("disabled", false);
        return;
    }
  
    // Membuat FormData
    var formData = new FormData();
    formData.append("username", $("#reg_username").val());
    formData.append("email", $("#reg_email").val());
    formData.append("password", $("#reg_password").val());
    formData.append("phone", $("#reg_phone").val());
    formData.append("name", $("#reg_nama").val());
    formData.append("image", file);
  
    // Reset status sebelum pengiriman
    $("#username_status, #email_status, #pw_status, #phone_status, #name_status, #image_status")
        .removeClass("text-danger text-success")
        .text("");
  
    $.ajax({
        url: "/api/register",
        type: "post",
        data: formData,
        contentType: false,
        processData: false,
        success: function (response) {
            var redirect = "/verify_email";
  
            if (response["result"] == "success") {
                $("#image_status").addClass("text-success").text("Foto SIM berhasil diunggah!");
                $.cookie("tokenMain", response["token"], { path: "/" });
                localStorage.setItem("login", "true");
                setTimeout(() => window.location.replace(redirect), 1000);
            } else {
                $("#reg_button").attr("disabled", false);
                if (response["result"] == "ejected") {
                    if (response["msg"].includes("SIM")) {
                        $("#image_status").addClass("text-danger").text(response["msg"]);
                    } else {
                        $("#username_status").addClass("text-danger").text(response["msg"]);
                    }
                } else if (response["result"] == "ejectedPW") {
                    $("#pw_status").addClass("text-danger").text(response["msg"]);
                } else if (response["result"] == "ejectedEmail") {
                    $("#email_status").addClass("text-danger").text(response["msg"]);
                } else if (response["result"] == "ejectedPhone") {
                    $("#phone_status").addClass("text-danger").text(response["msg"]);
                } else if (response["result"] == "ejectedName") {
                    $("#name_status").addClass("text-danger").text(response["msg"]);
                } else {
                    toastr.error(response["msg"] || "Terjadi kesalahan saat registrasi.");
                }
            }
        },
        error: function (xhr, status, error) {
            console.error(xhr.responseText);
            toastr.error("Terjadi kesalahan saat proses registrasi.");
            $("#reg_button").attr("disabled", false);
            $("#image_status").addClass("text-danger").text("Gagal mengunggah file SIM.");
        },
    });
  });
  
  // Cek ketersediaan username
  $("#reg_username").on("change", function () {
    $.ajax({
        url: "/api/check_username",
        type: "post",
        data: {
            username: $("#reg_username").val(),
        },
        success: function (response) {
            $("#username_status").removeClass("text-success text-danger").text("");
            if (response["result"] == "available") {
                $("#username_status").addClass("text-success").text("Username tersedia");
            } else if (response["result"] == "ejected") {
                $("#username_status").addClass("text-danger").text(response["msg"]);
            }
        },
        error: function () {
            $("#username_status").addClass("text-danger").text("Gagal memeriksa username.");
        },
    });
  });
