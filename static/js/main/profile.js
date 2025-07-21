document.addEventListener('DOMContentLoaded', function () {
    // Fungsi debounce untuk membatasi frekuensi permintaan
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Batasi input nomor telepon hanya ke angka
    const editPhone = document.getElementById('editPhone');
    if (editPhone) {
        editPhone.addEventListener('input', function () {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    } else {
        console.error('editPhone input not found.');
    }

    // Pratinjau gambar profil baru
    const editProfileImage = document.getElementById('editProfileImage');
    const profileImagePreview = document.getElementById('profileImagePreview');
    if (editProfileImage && profileImagePreview) {
        editProfileImage.addEventListener('change', function () {
            const file = this.files[0];
            profileImagePreview.style.display = 'none';
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    profileImagePreview.src = e.target.result;
                    profileImagePreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'File profil harus berupa gambar (jpg, png, dll).'
                });
            }
        });
    } else {
        console.error('editProfileImage or profileImagePreview not found.');
    }

    // Pratinjau gambar SIM baru
    const editSimImage = document.getElementById('editSimImage');
    const simImagePreview = document.getElementById('simImagePreview');
    if (editSimImage && simImagePreview) {
        editSimImage.addEventListener('change', function () {
            const file = this.files[0];
            simImagePreview.style.display = 'none';
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    simImagePreview.src = e.target.result;
                    simImagePreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'File SIM harus berupa gambar (jpg, png, dll).'
                });
            }
        });
    } else {
        console.error('editSimImage or simImagePreview not found.');
    }

    // Toggle visibility untuk password lama
    const toggleOldPassword = document.getElementById('toggleOldPassword');
    const oldPasswordInput = document.getElementById('oldPassword');
    if (toggleOldPassword && oldPasswordInput) {
        toggleOldPassword.addEventListener('click', function () {
            if (oldPasswordInput.type === 'password') {
                oldPasswordInput.type = 'text';
                toggleOldPassword.classList.remove('fa-eye');
                toggleOldPassword.classList.add('fa-eye-slash');
            } else {
                oldPasswordInput.type = 'password';
                toggleOldPassword.classList.remove('fa-eye-slash');
                toggleOldPassword.classList.add('fa-eye');
            }
        });
    } else {
        console.error('toggleOldPassword or oldPasswordInput not found.');
    }

    // Toggle visibility untuk password baru
    const toggleNewPassword = document.getElementById('toggleNewPassword');
    const newPasswordInput = document.getElementById('newPassword');
    if (toggleNewPassword && newPasswordInput) {
        toggleNewPassword.addEventListener('click', function () {
            if (newPasswordInput.type === 'password') {
                newPasswordInput.type = 'text';
                toggleNewPassword.classList.remove('fa-eye');
                toggleNewPassword.classList.add('fa-eye-slash');
            } else {
                newPasswordInput.type = 'password';
                toggleNewPassword.classList.remove('fa-eye-slash');
                toggleNewPassword.classList.add('fa-eye');
            }
        });
    } else {
        console.error('toggleNewPassword or newPasswordInput not found.');
    }

    // Fungsi untuk memeriksa keunikan field secara real-time
    const checkUniqueness = debounce(async function (field, value, validationElement) {
        if (!value) {
            validationElement.style.display = 'none';
            return;
        }
        const data = {};
        data[field] = value;
        try {
            const response = await fetch('/api/check_unique', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include'
            });
            const result = await response.json();
            if (result.result === 'success') {
                validationElement.textContent = `${field.charAt(0).toUpperCase() + field.slice(1)} tersedia`;
                validationElement.className = 'validation-message success';
                validationElement.style.display = 'block';
            } else {
                validationElement.textContent = result.errors[field] || 'Data tidak valid';
                validationElement.className = 'validation-message error';
                validationElement.style.display = 'block';
            }
        } catch (error) {
            validationElement.textContent = 'Gagal memeriksa keunikan';
            validationElement.className = 'validation-message error';
            validationElement.style.display = 'block';
        }
    }, 500);

    // Validasi real-time untuk username
    const editName = document.getElementById('editName');
    const usernameValidation = document.getElementById('usernameValidation');
    if (editName && usernameValidation) {
        editName.addEventListener('input', function () {
            if (this.value !== "{{ user_info['username'] }}") {
                checkUniqueness('username', this.value, usernameValidation);
            } else {
                usernameValidation.style.display = 'none';
            }
        });
    } else {
        console.error('editName or usernameValidation not found.');
    }

    // Validasi real-time untuk email
    const editEmail = document.getElementById('editEmail');
    const emailValidation = document.getElementById('emailValidation');
    if (editEmail && emailValidation) {
        editEmail.addEventListener('input', function () {
            if (this.value !== "{{ user_info['email'] }}") {
                checkUniqueness('email', this.value, emailValidation);
            } else {
                emailValidation.style.display = 'none';
            }
        });
    } else {
        console.error('editEmail or emailValidation not found.');
    }

    // Validasi real-time untuk nomor telepon
    const editPhoneValidation = document.getElementById('editPhone');
    const phoneValidation = document.getElementById('phoneValidation');
    if (editPhoneValidation && phoneValidation) {
        editPhoneValidation.addEventListener('input', function () {
            let cleanedPhone = this.value.replace(/[^0-9]/g, '');
            if (cleanedPhone.startsWith('0')) {
                cleanedPhone = '62' + cleanedPhone.slice(1);
            } else if (!cleanedPhone.startsWith('62')) {
                cleanedPhone = '62' + cleanedPhone;
            }
            if (cleanedPhone !== "{{ user_info['phone'] }}") {
                checkUniqueness('phone', cleanedPhone, phoneValidation);
            } else {
                phoneValidation.style.display = 'none';
            }
        });
    } else {
        console.error('editPhone or phoneValidation not found.');
    }

    // Event listener untuk tombol Save Changes
    const saveChanges = document.getElementById('saveChanges');
    if (saveChanges) {
        saveChanges.addEventListener('click', async function () {
            saveChanges.disabled = true;
            document.getElementById('loadingSpinner').style.display = 'flex';

            // Validasi file SIM
            const simFile = document.getElementById('editSimImage').files[0];
            if (simFile && !simFile.type.startsWith('image/')) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'File SIM harus berupa gambar (jpg, png, dll).'
                });
                saveChanges.disabled = false;
                document.getElementById('loadingSpinner').style.display = 'none';
                return;
            }

            // Validasi file profil
            const profileFile = document.getElementById('editProfileImage').files[0];
            if (profileFile && !profileFile.type.startsWith('image/')) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'File profil harus berupa gambar (jpg, png, dll).'
                });
                saveChanges.disabled = false;
                document.getElementById('loadingSpinner').style.display = 'none';
                return;
            }

            // Validasi password
            const oldPassword = document.getElementById('oldPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            if (newPassword && !oldPassword) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Password lama harus diisi untuk mengganti password.'
                });
                saveChanges.disabled = false;
                document.getElementById('loadingSpinner').style.display = 'none';
                return;
            }
            if (oldPassword && !newPassword) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Password baru harus diisi.'
                });
                saveChanges.disabled = false;
                document.getElementById('loadingSpinner').style.display = 'none';
                return;
            }
            if (newPassword && newPassword.length < 8) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Password baru harus minimal 8 karakter.'
                });
                saveChanges.disabled = false;
                document.getElementById('loadingSpinner').style.display = 'none';
                return;
            }

            // Cek keunikan username, email, dan nomor telepon jika diubah
            const username = document.getElementById('editName').value;
            const email = document.getElementById('editEmail').value;
            let cleanedPhone = document.getElementById('editPhone').value.replace(/[^0-9]/g, '');
            if (cleanedPhone.startsWith('0')) {
                cleanedPhone = '62' + cleanedPhone.slice(1);
            } else if (!cleanedPhone.startsWith('62')) {
                cleanedPhone = '62' + cleanedPhone;
            }

            if (username !== "{{ user_info['username'] }}" || email !== "{{ user_info['email'] }}" || cleanedPhone !== "{{ user_info['phone'] }}") {
                try {
                    const response = await fetch('/api/check_unique', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, email, phone: cleanedPhone }),
                        credentials: 'include'
                    });
                    const data = await response.json();
                    if (data.result !== 'success') {
                        let errorMsg = 'Data sudah digunakan: ';
                        if (data.errors.username) errorMsg += data.errors.username + '; ';
                        if (data.errors.email) errorMsg += data.errors.email + '; ';
                        if (data.errors.phone) errorMsg += data.errors.phone + '; ';
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: errorMsg
                        });
                        saveChanges.disabled = false;
                        document.getElementById('loadingSpinner').style.display = 'none';
                        return;
                    }
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Gagal memeriksa keunikan data.'
                    });
                    saveChanges.disabled = false;
                    document.getElementById('loadingSpinner').style.display = 'none';
                    return;
                }
            }

            // Mengumpulkan data dari form hanya untuk field yang diubah
            const formData = new FormData();
            if (username !== "{{ user_info['username'] }}") formData.append('username', username);
            if (email !== "{{ user_info['email'] }}") formData.append('email', email);
            if (cleanedPhone !== "{{ user_info['phone'] }}") formData.append('phone', cleanedPhone);
            if (document.getElementById('editAddress').value !== "{{ user_info['address'] }}") {
                formData.append('address', document.getElementById('editAddress').value);
            }
            if (document.getElementById('editFullName').value !== "{{ user_info['name'] }}") {
                formData.append('name', document.getElementById('editFullName').value);
            }
            if (profileFile) formData.append('profile_image', profileFile);
            if (simFile) formData.append('image', simFile);
            if (oldPassword) formData.append('old_password', oldPassword);
            if (newPassword) formData.append('new_password', newPassword);

            // Mengirimkan permintaan ke server
            fetch('/profile', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.result === 'success') {
                        // Memperbarui UI dengan data baru
                        if (formData.has('email')) document.getElementById('email').innerText = document.getElementById('editEmail').value;
                        if (formData.has('phone')) document.getElementById('phone').innerText = cleanedPhone;
                        if (formData.has('address')) document.getElementById('address').innerText = document.getElementById('editAddress').value;
                        if (formData.has('name')) document.getElementById('name').innerText = document.getElementById('editFullName').value;
                        if (formData.has('username')) document.querySelector('.f-w-600.mb-2').innerText = `Nama: ${document.getElementById('editName').value}`;

                        // Memperbarui gambar SIM jika ada file baru
                        if (simFile) {
                            const reader = new FileReader();
                            reader.onload = function (e) {
                                document.getElementById('ktpSimImage').src = e.target.result;
                            };
                            reader.readAsDataURL(simFile);
                        }

                        // Memperbarui gambar profil jika ada file baru
                        if (profileFile) {
                            const reader = new FileReader();
                            reader.onload = function (e) {
                                document.getElementById('profileImage').src = e.target.result;
                            };
                            reader.readAsDataURL(profileFile);
                        }

                        // Menutup modal dan menampilkan pesan sukses
                        $('#editModal').modal('hide');
                        Swal.fire({
                            icon: 'success',
                            title: 'Berhasil',
                            text: data.msg
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: data.msg
                        });
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Terjadi kesalahan saat memperbarui profil. Silakan coba lagi nanti.'
                    });
                })
                .finally(() => {
                    document.getElementById('loadingSpinner').style.display = 'none';
                    saveChanges.disabled = false;
                });
        });
    } else {
        console.error('saveChanges button not found.');
    }
});

function showImage() {
    const simImage = document.getElementById('ktpSimImage');
    if (simImage && simImage.src) {
        Swal.fire({
            title: 'Foto SIM',
            imageUrl: simImage.src,
            imageAlt: 'Foto SIM',
            imageWidth: '100%',
            imageHeight: 'auto',
            showCloseButton: true,
            showConfirmButton: false
        });
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Foto SIM tidak ditemukan!'
        });
    }
}