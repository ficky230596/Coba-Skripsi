$(document).ready(function () {
    // Handle request reset password form submission
    $('#resetPasswordRequestForm').on('submit', function (e) {
        e.preventDefault();

        $.ajax({
            type: 'POST',
            url: '/reset_password',
            data: {
                email: $('#email').val()
            },
            success: function (response) {
                if (response.result === 'success') {
                    alert(response.msg);
                    $('#resetPasswordRequest').hide();
                    $('#resetPasswordForm').show();
                } else {
                    alert(response.msg);
                }
            },
            error: function () {
                alert('Terjadi kesalahan. Silakan coba lagi.');
            }
        });
    });

    // Handle reset password form submission
    $('#resetPasswordForm').on('submit', function (e) {
        e.preventDefault();

        $.ajax({
            type: 'POST',
            url: '/verify_reset_password',
            data: {
                email: $('#email').val(),
                otp: $('#otp').val(),
                new_password: $('#newPassword').val()
            },
            success: function (response) {
                if (response.result === 'success') {
                    alert(response.msg);
                    window.location.href = '/login'; // Redirect to login page or another appropriate page
                } else {
                    alert(response.msg);
                }
            },
            error: function () {
                alert('Terjadi kesalahan. Silakan coba lagi.');
            }
        });
    });
});
