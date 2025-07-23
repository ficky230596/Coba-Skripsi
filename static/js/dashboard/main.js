// Fungsi Logout
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
            console.log("Logging out"); // Debugging
            Cookies.remove("tokenDashboard"); // Menggunakan js-cookie
            localStorage.setItem("logoutDashboard", "true");
            window.location.href = "/"; // Redirect ke halaman utama
        }
    });
}

// Fungsi untuk toggle sidebar
function hideSidebar() {
    $('#sidebar').toggleClass('collapsed');
    $('.content-wrapper').toggleClass('expanded');
}

$(document).ready(function() {
    // Debugging untuk memastikan jQuery dimuat
    console.log("jQuery loaded, version:", $.fn.jquery);

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

    // Sembunyikan loading spinner setelah DOM selesai dimuat
    document.addEventListener('DOMContentLoaded', function() {
        console.log("DOM fully loaded"); // Debugging
        $('.loading-overlay').addClass('hidden');
    });

    // Fallback: sembunyikan loading setelah 3 detik
    setTimeout(function() {
        console.log("Fallback: hiding loading overlay"); // Debugging
        $('.loading-overlay').addClass('hidden');
    }, 3000);
});