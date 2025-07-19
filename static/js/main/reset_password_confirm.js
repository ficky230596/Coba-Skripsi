// Ensure SweetAlert2 is available
const Swal = window.Swal || {
    fire: options => {
        console.error('SweetAlert2 is not loaded. Please ensure sweetalert2.min.js is included.');
        alert(options.text || options.title);
    }
};

document.querySelector('#resetPasswordForm').addEventListener('submit', function (event) {
    event.preventDefault();

    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm_password').value;
    const token = document.querySelector('input[name="token"]').value;

    if (password !== confirmPassword) {
        Swal.fire({
            title: "Error!",
            text: "Kata Sandi Tidak Sama!",
            icon: "error",
            confirmButtonText: "OK"
        });
        return;
    }

    document.getElementById('spinner').style.display = 'flex';

    fetch(window.location.pathname, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: new URLSearchParams({
            password: password,
            confirm_password: confirmPassword,
            token: token
        })
    })
    .then(response => {
        document.getElementById('spinner').style.display = 'none';

        if (response.redirected) {
            Swal.fire({
                title: "Berhasil!",
                text: "Kata sandi berhasil diganti!",
                icon: "success",
                confirmButtonText: "OK"
            }).then(result => {
                if (result.isConfirmed) {
                    window.location.href = '/login';
                }
            });
        } else if (!response.ok) {
            return response.json().catch(() => response.text()).then(data => {
                throw new Error(data.message || data || 'Terjadi kesalahan di server.');
            });
        } else {
            return response.json().catch(() => {
                throw new Error('Respons server tidak valid.');
            }).then(data => {
                if (data.message) {
                    Swal.fire({
                        title: data.error ? "Error!" : "Berhasil!",
                        text: data.message,
                        icon: data.error ? "error" : "success",
                        confirmButtonText: "OK"
                    }).then(result => {
                        if (result.isConfirmed && !data.error) {
                            window.location.href = '/login'; // Redirect ke login untuk kasus sukses
                        }
                    });
                } else {
                    throw new Error('Respons server tidak valid.');
                }
            });
        }
    })
    .catch(error => {
        document.getElementById('spinner').style.display = 'none';
        Swal.fire({
            title: "Error!",
            text: error.message || "Terjadi kesalahan. Silakan coba lagi.",
            icon: "error",
            confirmButtonText: "OK"
        });
    });
});

// Toggle password visibility
const togglePassword = document.querySelector('#togglePassword');
const passwordField = document.querySelector('#password');

togglePassword.addEventListener('click', function () {
    const type = passwordField.type === 'password' ? 'text' : 'password';
    passwordField.type = type;
    this.querySelector('i').classList.toggle('bi-eye');
    this.querySelector('i').classList.toggle('bi-eye-slash');
});

const toggleConfirmPassword = document.querySelector('#toggleConfirmPassword');
const confirmPasswordField = document.querySelector('#confirm_password');

toggleConfirmPassword.addEventListener('click', function () {
    const type = confirmPasswordField.type === 'password' ? 'text' : 'password';
    confirmPasswordField.type = type;
    this.querySelector('i').classList.toggle('bi-eye');
    this.querySelector('i').classList.toggle('bi-eye-slash');
});