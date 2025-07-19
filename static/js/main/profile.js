document.addEventListener('DOMContentLoaded', () => {
    /**
     * Mengambil user_id dari token di cookie.
     * @returns {string|null} User ID atau null jika token tidak valid.
     */
    const getUserIdFromToken = () => {
        const token = document.cookie.split('; ').find(row => row.startsWith('tokenMain='));
        if (!token) return null;
        try {
            const tokenValue = token.split('=')[1];
            const payload = JSON.parse(atob(tokenValue.split('.')[1]));
            return payload.user_id;
        } catch (error) {
            console.error('Error parsing token:', error);
            return null;
        }
    };

    const userId = getUserIdFromToken();
    const saveChangesBtn = document.getElementById('saveChanges');
    let isUsernameValid = true;
    let isEmailValid = true;
    let isPhoneValid = true;

    /**
     * Memeriksa ketersediaan field (username, email, atau phone) di server.
     * @param {string} field - Nama field (username, email, phone).
     * @param {string} value - Nilai field.
     * @param {HTMLElement} statusElement - Elemen untuk menampilkan status.
     * @returns {Promise<boolean>} True jika valid dan tersedia, false jika tidak.
     */
    const checkAvailability = async (field, value, statusElement) => {
        if (!value) {
            statusElement.textContent = '';
            return false;
        }

        // Validasi email di frontend
        if (field === 'email' && !value.includes('@')) {
            statusElement.textContent = 'Email harus mengandung @';
            statusElement.className = 'status-message status-invalid';
            return false;
        }

        try {
            const response = await fetch('/api/check_email_phone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value, user_id: userId }),
                credentials: 'include'
            });
            const data = await response.json();

            if (data[field] === 'available') {
                statusElement.textContent = 'Tersedia';
                statusElement.className = 'status-message status-available';
                return true;
            } else if (data[field] === 'unavailable') {
                statusElement.textContent = 'Sudah digunakan';
                statusElement.className = 'status-message status-unavailable';
                return false;
            } else if (data[field] === 'invalid') {
                statusElement.textContent = 
                    field === 'username' ? 'Username tidak valid' :
                    field === 'email' ? 'Email tidak valid' : 'Nomor telepon tidak valid';
                statusElement.className = 'status-message status-invalid';
                return false;
            }
        } catch (error) {
            console.error(`Error checking ${field}:`, error);
            statusElement.textContent = 'Terjadi kesalahan saat memeriksa';
            statusElement.className = 'status-message status-invalid';
            return false;
        }
    };

    /**
     * Memperbarui status tombol Simpan berdasarkan validitas input.
     */
    const updateSaveButton = () => {
        const fullName = document.getElementById('editFullName').value;
        const oldPassword = document.getElementById('oldPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        saveChangesBtn.disabled = !(
            isUsernameValid && isEmailValid && isPhoneValid && fullName &&
            (!newPassword || (oldPassword && newPassword.length >= 8))
        );
    };

    // Validasi nomor telepon (hanya angka)
    const editPhone = document.getElementById('editPhone');
    if (editPhone) {
        editPhone.addEventListener('input', () => {
            editPhone.value = editPhone.value.replace(/[^0-9]/g, '');
            checkAvailability('phone', editPhone.value, document.getElementById('phoneStatus'))
                .then(isValid => {
                    isPhoneValid = isValid;
                    updateSaveButton();
                });
        });
    } else {
        console.error('Input editPhone tidak ditemukan.');
    }

    // Validasi username secara real-time
    const editName = document.getElementById('editName');
    if (editName) {
        editName.addEventListener('input', () => {
            checkAvailability('username', editName.value, document.getElementById('usernameStatus'))
                .then(isValid => {
                    isUsernameValid = isValid;
                    updateSaveButton();
                });
        });
    } else {
        console.error('Input editName tidak ditemukan.');
    }

    // Validasi email secara real-time
    const editEmail = document.getElementById('editEmail');
    if (editEmail) {
        editEmail.addEventListener('input', () => {
            checkAvailability('email', editEmail.value, document.getElementById('emailStatus'))
                .then(isValid => {
                    isEmailValid = isValid;
                    updateSaveButton();
                });
        });
    } else {
        console.error('Input editEmail tidak ditemukan.');
    }

    // Pratinjau gambar profil
    const editProfileImage = document.getElementById('editProfileImage');
    const profileImagePreview = document.getElementById('profileImagePreview');
    if (editProfileImage && profileImagePreview) {
        editProfileImage.addEventListener('change', () => {
            const file = editProfileImage.files[0];
            profileImagePreview.style.display = 'none';
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = e => {
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
        console.error('Input editProfileImage atau profileImagePreview tidak ditemukan.');
    }

    // Pratinjau gambar SIM
    const editSimImage = document.getElementById('editSimImage');
    const simImagePreview = document.getElementById('simImagePreview');
    if (editSimImage && simImagePreview) {
        editSimImage.addEventListener('change', () => {
            const file = editSimImage.files[0];
            simImagePreview.style.display = 'none';
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = e => {
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
        console.error('Input editSimImage atau simImagePreview tidak ditemukan.');
    }

    // Show/Hide Password
    const toggleOldPassword = document.getElementById('toggleOldPassword');
    const oldPassword = document.getElementById('oldPassword');
    const toggleNewPassword = document.getElementById('toggleNewPassword');
    const newPassword = document.getElementById('newPassword');

    if (toggleOldPassword && oldPassword) {
        toggleOldPassword.addEventListener('click', () => {
            oldPassword.type = oldPassword.type === 'password' ? 'text' : 'password';
            toggleOldPassword.classList.toggle('fa-eye');
            toggleOldPassword.classList.toggle('fa-eye-slash');
        });
    }

    if (toggleNewPassword && newPassword) {
        toggleNewPassword.addEventListener('click', () => {
            newPassword.type = newPassword.type === 'password' ? 'text' : 'password';
            toggleNewPassword.classList.toggle('fa-eye');
            toggleNewPassword.classList.toggle('fa-eye-slash');
        });
    }

    // Validasi nama lengkap dan password
    const editFullName = document.getElementById('editFullName');
    if (editFullName) editFullName.addEventListener('input', updateSaveButton);
    if (oldPassword) oldPassword.addEventListener('input', updateSaveButton);
    if (newPassword) newPassword.addEventListener('input', updateSaveButton);

    // Simpan perubahan
    if (saveChangesBtn) {
        saveChangesBtn.addEventListener('click', async () => {
            saveChangesBtn.disabled = true;
            document.getElementById('loadingSpinner').style.display = 'flex';

            // Validasi file
            const simFile = document.getElementById('editSimImage').files[0];
            if (simFile && !simFile.type.startsWith('image/')) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'File SIM harus berupa gambar (jpg, png, dll).'
                });
                saveChangesBtn.disabled = false;
                document.getElementById('loadingSpinner').style.display = 'none';
                return;
            }

            const profileFile = document.getElementById('editProfileImage').files[0];
            if (profileFile && !profileFile.type.startsWith('image/')) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'File profil harus berupa gambar (jpg, png, dll).'
                });
                saveChangesBtn.disabled = false;
                document.getElementById('loadingSpinner').style.display = 'none';
                return;
            }

            // Validasi input
            const username = document.getElementById('editName').value;
            const email = document.getElementById('editEmail').value;
            const phone = document.getElementById('editPhone').value;
            const address = document.getElementById('editAddress').value;
            const fullName = document.getElementById('editFullName').value;
            const oldPasswordValue = document.getElementById('oldPassword').value;
            const newPasswordValue = document.getElementById('newPassword').value;

            if (!username) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Username tidak boleh kosong.' });
                saveChangesBtn.disabled = false;
                document.getElementById('loadingSpinner').style.display = 'none';
                return;
            }

            if (!email) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Email tidak boleh kosong.' });
                saveChangesBtn.disabled = false;
                document.getElementById('loadingSpinner').style.display = 'none';
                return;
            }

            if (!phone) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Nomor telepon tidak boleh kosong.' });
                saveChangesBtn.disabled = false;
                document.getElementById('loadingSpinner').style.display = 'none';
                return;
            }

            const phoneRegex = /^(0|\+62)\d{9,12}$/;
            if (!phoneRegex.test(phone)) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Nomor telepon tidak valid. Harus dimulai dengan 0 atau +62 dan memiliki 10-13 digit.'
                });
                saveChangesBtn.disabled = false;
                document.getElementById('loadingSpinner').style.display = 'none';
                return;
            }

            if (!fullName) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Nama lengkap tidak boleh kosong.' });
                saveChangesBtn.disabled = false;
                document.getElementById('loadingSpinner').style.display = 'none';
                return;
            }

            if (newPasswordValue && !oldPasswordValue) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Masukkan password lama untuk mengubah password.'
                });
                saveChangesBtn.disabled = false;
                document.getElementById('loadingSpinner').style.display = 'none';
                return;
            }

            // Sanitasi nomor telepon
            let cleanedPhone = phone.replace(/[^0-9]/g, '');
            if (cleanedPhone.startsWith('0')) {
                cleanedPhone = cleanedPhone;
            } else if (cleanedPhone.startsWith('62')) {
                cleanedPhone = '0' + cleanedPhone.slice(2);
            }

            // Kirim data ke server
            const formData = new FormData();
            formData.append('username', username);
            formData.append('email', email);
            formData.append('phone', cleanedPhone);
            formData.append('address', address);
            formData.append('name', fullName);
            if (oldPasswordValue) formData.append('old_password', oldPasswordValue);
            if (newPasswordValue) formData.append('new_password', newPasswordValue);
            if (profileFile) formData.append('profile_image', profileFile);
            if (simFile) formData.append('image', simFile);

            try {
                const response = await fetch('/profile', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                const data = await response.json();

                if (!response.ok) {
                    if (response.status === 403) {
                        Swal.fire({
                            icon: 'error',
                            title: 'Pembaruan Diblokir',
                            text: data.msg || 'Pembaruan profil diblokir karena batas waktu 48 jam.'
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: data.msg || 'Terjadi kesalahan saat memperbarui profil.'
                        });
                    }
                    return;
                }

                if (data.result === 'success') {
                    // Perbarui UI
                    document.getElementById('email').textContent = email;
                    document.getElementById('phone').textContent = cleanedPhone;
                    document.getElementById('address').textContent = address;
                    document.getElementById('name').textContent = fullName;

                    if (simFile) {
                        const reader = new FileReader();
                        reader.onload = e => document.getElementById('ktpSimImage').src = e.target.result;
                        reader.readAsDataURL(simFile);
                    }

                    if (profileFile) {
                        const reader = new FileReader();
                        reader.onload = e => document.getElementById('profileImage').src = e.target.result;
                        reader.readAsDataURL(profileFile);
                    }

                    $('#editModal').modal('hide');
                    Swal.fire({
                        icon: 'success',
                        title: 'Berhasil',
                        text: 'Profil berhasil diperbarui!'
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.msg || 'Terjadi kesalahan saat memperbarui profil.'
                    });
                }
            } catch (error) {
                console.error('Error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Terjadi kesalahan jaringan. Silakan coba lagi.'
                });
            } finally {
                saveChangesBtn.disabled = false;
                document.getElementById('loadingSpinner').style.display = 'none';
            }
        });
    } else {
        console.error('Tombol saveChanges tidak ditemukan.');
    }
});

/**
 * Menampilkan foto SIM dalam modal SweetAlert.
 */
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