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
    $('#sidebar').toggleClass('collapsed');
    $('.content-wrapper').toggleClass('expanded');
}

$(document).ready(function() {
    // Toggle Sidebar di Desktop
    $('#sidebarToggle').on('click', function() {
        hideSidebar();
    });

    // Tandai tautan navigasi aktif
    $(".nav .nav-link").each(function() {
        var path = $(this).attr("href");
        if (window.location.pathname.includes(path)) {
            $(this).removeClass("text-white").addClass("active");
            $(this).parent().children("b").removeAttr("hidden");
        }
    });

    // Tampilkan notifikasi sukses jika data ditambahkan
    if (localStorage.getItem("tambahData") === "true") {
        toastr.success("Berhasil Tambah Data");
        localStorage.removeItem("tambahData");
    }

    // Sembunyikan loading spinner setelah halaman dimuat
    $(window).on('load', function() {
        $('.loading-overlay').addClass('hidden');
    });
});