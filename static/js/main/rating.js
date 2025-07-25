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

        // Validasi car_id, user_id, dan order_id
        const car_id = $('input[name="car_id"]').val();
        const user_id = $('input[name="user_id"]').val();
        const order_id = $('input[name="order_id"]').val(); // Tambahkan order_id
        if (!car_id || !user_id || !order_id) {
            $('#response-message').text('Car ID, User ID, atau Order ID tidak valid.').addClass('text-danger');
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