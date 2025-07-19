$(document).ready(function() {
    const stars = $('.fa-star');
    let selectedRating = parseInt($('#rating').val()) || 0;

    // Inisialisasi bintang berdasarkan rating awal
    updateStars(selectedRating);

    // Menangani klik pada bintang
    stars.on('click', function() {
        selectedRating = parseInt($(this).data('value'));
        updateStars(selectedRating);
        $('#rating').val(selectedRating);
    });

    // Memperbarui tampilan bintang
    function updateStars(rating) {
        stars.each(function() {
            if (parseInt($(this).data('value')) <= rating) {
                $(this).addClass('selected');
            } else {
                $(this).removeClass('selected');
            }
        });
    }

    // Menangani pengiriman form dengan AJAX
    $('#ratingForm').on('submit', function(event) {
        event.preventDefault();

        // Validasi rating
        if (!selectedRating || selectedRating < 1 || selectedRating > 5) {
            $('#response-message').text('Silakan pilih rating (1-5 bintang).').addClass('text-danger');
            return;
        }

        // Validasi car_id dan user_id
        const car_id = $('input[name="car_id"]').val();
        const user_id = $('input[name="user_id"]').val();
        if (!car_id || !user_id) {
            $('#response-message').text('Car ID atau User ID tidak valid.').addClass('text-danger');
            return;
        }

        const formData = $(this).serialize();
        console.log('Mengirim data:', formData);

        $.ajax({
            url: $(this).attr('action'),
            method: 'POST',
            data: formData,
            success: function(response) {
                if (response.result === 'success') {
                    // Tampilkan SweetAlert
                    Swal.fire({
                        icon: 'success',
                        title: 'Terima Kasih!',
                        text: 'Terima kasih telah memberikan rating.',
                        confirmButtonText: 'OK',
                        timer: 3000,
                        timerProgressBar: true
                    }).then(() => {
                        // Redirect ke dashboard setelah SweetAlert ditutup
                        window.location.href = '/';
                    });

                    // Reset form
                    selectedRating = 0;
                    $('#rating').val('');
                    $('#comment').val('');
                    updateStars(selectedRating);
                } else {
                    $('#response-message').text(response.msg).removeClass('text-success').addClass('text-danger');
                }
            },
            error: function(xhr) {
                const errorMsg = xhr.responseJSON && xhr.responseJSON.msg ? xhr.responseJSON.msg : 'Terjadi kesalahan saat mengirim rating.';
                $('#response-message').text(errorMsg).addClass('text-danger');
            }
        });
    });
});


// Fungsi untuk memperbarui rating di bagian atas
function updateDetailRating(mobilId) {
    console.log('Mengambil rating untuk mobil ID:', mobilId);
    fetch(`/get_rating_and_comment?car_id=${mobilId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Data dari server:', data);
            if (data.error) {
                console.error('Error dari server:', data.error);
                return;
            }
            // Pilih elemen di bagian atas (detail mobil)
            const ratingStars = document.querySelector('.col-md-6 #rating-stars');
            const currentRating = document.querySelector('.col-md-6 #current-rating');

            if (ratingStars && currentRating) {
                ratingStars.innerHTML = '';
                const rating = data.rating || 0;
                for (let i = 1; i <= 5; i++) {
                    const star = document.createElement('i');
                    star.className = `fa fa-star ${i <= rating ? 'star-rated' : 'star'}`;
                    ratingStars.appendChild(star);
                }
                currentRating.textContent = `${rating}/5`;
            } else {
                console.error('Elemen #rating-stars atau #current-rating tidak ditemukan di bagian atas');
            }
        })
        .catch(error => console.error('Error fetching rating:', error));
}

// Inisialisasi rating saat DOM dimuat
document.addEventListener("DOMContentLoaded", function () {
    // ... kode existing ...

    // Ambil mobilId dari URL
    const urlParams = new URLSearchParams(window.location.search);
    const mobilId = urlParams.get('id');

    if (mobilId) {
        updateDetailRating(mobilId);
    } else {
        console.error('Mobil ID tidak ditemukan di URL');
    }
});