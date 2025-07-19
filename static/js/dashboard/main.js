function logout() {
  Swal.fire({
    position: "top",
    text: "Anda yakin untuk logout?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "Yes",
  }).then((result) => {
    if (result.isConfirmed) {
      $.removeCookie("tokenDashboard");
      localStorage.setItem("logoutDashboard", "true");
      window.location.reload();
    }
  });
}

function hideSidebar() {
  $(".logo h4").toggleClass("d-none");
  $(this).toggle(function () {
    $("body").css("grid-template-columns", "5rem 1fr 1fr");
  });
}

$(".nav.menu .nav-link").each(function () {
  path = $(this).attr("href");
  if (window.location.pathname.includes(path)) {
    $(this).removeClass("text-white");
    $(this).addClass("text-primary");
    $(this).addClass("active");
    $(this).parent().children("b").removeAttr("hidden");
  }
});

if (localStorage.getItem("tambahData") == "true") {
  toastr.success("Berhasil Tambah Data");
  localStorage.removeItem("tambahData");
}

$(window).on('load', function() {
  $('#loading').hide()
});