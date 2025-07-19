#app.py
from flask import Flask,render_template,request,jsonify, redirect,url_for,flash
import dashboard
import api
from dbconnection import db, ensure_indexes
from bson import ObjectId
import jwt
import re
import os
from dotenv import load_dotenv
import hashlib
import midtransclient
import random
import datetime
from flask_mail import Mail, Message
from func import canceltransaction
from pymongo import DESCENDING 
from collections import Counter
import time
from collections import defaultdict
from datetime import timedelta  
from api import cancel_unpaid_transactions
from threading import Thread 
import logging  # Impor modul logging
ensure_indexes()
load_dotenv()  # Memuat variabel lingkungan dari .env
SECRET_KEY = os.environ.get("SECRET_KEY")

# Konfigurasi logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)  # Inisialisasi logger



app = Flask(__name__)
SECRET_KEY = os.environ.get("SECRET_KEY")
RATE_LIMIT = 5
INTERVAL = 30  # Dalam detik (1 menit)
SUB_INTERVAL = 15  # Sub-waktu (misalnya setiap 15 detik)

# Menyimpan hitungan permintaan per pengguna atau IP
requests_count = defaultdict(lambda: defaultdict(int))

# Fungsi rate limiting dengan Sliding Window Counter
def is_rate_limited(user_id):
    current_time = int(time.time())
    window_start = current_time - INTERVAL

    # Hapus data lama dari sub-interval di luar jendela waktu utama
    for timestamp in list(requests_count[user_id].keys()):
        if timestamp < window_start:
            del requests_count[user_id][timestamp]

    # Hitung total permintaan dalam jendela waktu utama
    request_count_in_interval = sum(requests_count[user_id].values())
    
    # Jika permintaan melebihi RATE_LIMIT, tolak permintaan
    if request_count_in_interval >= RATE_LIMIT:
        return True

    # Tambahkan permintaan baru ke sub-waktu saat ini
    requests_count[user_id][current_time // SUB_INTERVAL * SUB_INTERVAL] += 1
    return False

app.config.from_pyfile('config.py')

mail = Mail(app)

# Modifikasi endpoint /home (ganti yang lama dengan ini)
@app.route('/')
def home():
    token_receive = request.cookies.get("tokenMain")
    user_id = request.remote_addr  # Menggunakan IP sebagai pengenal, bisa diganti dengan ID pengguna

    # Cek rate limit sebelum melanjutkan ke logika utama
    if is_rate_limited(user_id):
        return jsonify({"error": "Rate limit exceeded. Try again later."}), 429

    # Lanjutkan ke logika utama fungsi home jika tidak terkena rate limit
    data_mobil = list(db.dataMobil.find({
        'status': 'Tersedia', 
        'visibility': 'visible',
        'status_transaksi': {'$ne': 'pembayaran'}  # Mengecualikan status Pembayaran
    }))

    if not token_receive:
        return render_template('main/home_page.html', data=data_mobil, show_tutorial=False)

    try:
        payload = jwt.decode(token_receive, SECRET_KEY, algorithms=['HS256'])
        user_info = db.users.find_one({"user_id": payload["user_id"]})
        if user_info is None:
            return redirect(url_for('login'))
        if user_info.get('verif') != 'verifed':
            return redirect(url_for('verify_email'))

        # Cek apakah ini login pertama
        if user_info.get('first_login', False):
            return redirect(url_for('welcome'))  # Arahkan ke halaman tutorial

        return render_template('main/home_page.html', data=data_mobil, user_info=user_info, show_tutorial=False)

    except jwt.ExpiredSignatureError:
        return render_template('main/home_page.html', data=data_mobil, show_tutorial=False)
    except jwt.exceptions.DecodeError:
        return render_template('main/home_page.html', data=data_mobil, show_tutorial=False)

# Tambahkan endpoint baru /welcome
@app.route('/welcome')
def welcome():
    token_receive = request.cookies.get("tokenMain")
    if not token_receive:
        return redirect(url_for('login'))

    try:
        payload = jwt.decode(token_receive, SECRET_KEY, algorithms=['HS256'])
        user_info = db.users.find_one({"user_id": payload["user_id"]})
        if user_info is None:
            return redirect(url_for('login'))
        if user_info.get('verif') != 'verifed':
            return redirect(url_for('verify_email'))

        # Tandai bahwa tutorial telah ditampilkan
        db.users.update_one(
            {'user_id': payload["user_id"]},
            {'$set': {'first_login': False}}
        )

        return render_template('main/welcome_tutorial.html', user_info=user_info)

    except jwt.ExpiredSignatureError:
        return redirect(url_for('login'))
    except jwt.exceptions.DecodeError:
        return redirect(url_for('login'))

@app.route('/filter_mobil', methods=['GET'])
def filter_mobil():
    type_mobil = request.args.get('type_mobil')
    merek = request.args.get('merek')
    transmisi = request.args.get('transmisi')
    seat = request.args.get('seat')
    harga = request.args.get('harga')

    logger.info(f'Filter: type_mobil={type_mobil}, merek={merek}, transmisi={transmisi}, seat={seat}, harga={harga}')

    query = {'status': 'Tersedia', 'visibility': 'visible'}
    if type_mobil:
        query['type_mobil'] = {'$regex': type_mobil, '$options': 'i'}  # Case-insensitive
    if merek:
        query['merek'] = {'$regex': merek, '$options': 'i'}
    if transmisi:
        query['transmisi'] = transmisi
    if seat:
        try:
            query['seat'] = int(seat)
        except ValueError:
            logger.error(f'Invalid seat value: {seat}')
    if harga:
        try:
            query['harga'] = {'$lte': int(harga)}  # Harga maksimum
        except ValueError:
            logger.error(f'Invalid harga value: {harga}')

    data_mobil = list(db.dataMobil.find(query))
    for mobil in data_mobil:
        mobil['_id'] = str(mobil['_id'])

    return jsonify(data_mobil)

@app.route('/search_mobil', methods=['GET'])
def search_mobil():
    search = request.args.get('search')
    logger.info(f'Search: {search}')
    query = {'status': 'Tersedia', 'visibility': 'visible'}
    if search:
        search_regex = {'$regex': search, '$options': 'i'}
        query['$or'] = [
            {'type_mobil': search_regex},
            {'merek': search_regex},
            {'transmisi': search_regex},
            {'bahan_bakar': search_regex},
            {'seat': {'$eq': search if search.isdigit() else -1}},
            {'harga': {'$eq': search if search.isdigit() else -1}}  # Gunakan string untuk harga
        ]
    data_mobil = list(db.dataMobil.find(query))
    for mobil in data_mobil:
        mobil['_id'] = str(mobil['_id'])
    return jsonify(data_mobil)


@app.route('/reset_password/<token>', methods=['GET', 'POST'])
def reset_password_confirm(token):
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        user_id = payload['user_id']
        user = db.users.find_one({'user_id': user_id})

        if not user or user.get('reset_token') != token or user.get('reset_token_used', True):
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'error': True, 'message': 'Link tidak valid atau sudah digunakan.'}), 400
            flash("Link tidak valid atau sudah digunakan. Silakan login.", "danger")
            return redirect(url_for('login'))

        if request.method == 'POST':
            new_password = request.form.get('password')
            confirm_password = request.form.get('confirm_password')

            # Validasi input
            if not new_password or len(new_password) < 8:
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({'error': True, 'message': 'Password harus minimal 8 karakter.'}), 400
                return render_template(
                    'main/reset_password_confirm.html',
                    token=token,
                    message="Password harus minimal 8 karakter.",
                    alert_type="warning"
                )

            if new_password != confirm_password:
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({'error': True, 'message': 'Kata sandi tidak sama.'}), 400
                return render_template(
                    'main/reset_password_confirm.html',
                    token=token,
                    message="Kata sandi tidak sama.",
                    alert_type="warning"
                )

            # Hash password baru
            new_pw_hash = hashlib.sha256(new_password.encode('utf-8')).hexdigest()

            # Cek apakah password baru sama dengan yang lama
            if new_pw_hash == user.get('password'):
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({'error': True, 'message': 'Password baru tidak boleh sama dengan password lama.'}), 400
                return render_template(
                    'main/reset_password_confirm.html',
                    token=token,
                    message="Password baru tidak boleh sama dengan password lama.",
                    alert_type="warning"
                )

            # Update password & tandai token sebagai sudah digunakan
            try:
                db.users.update_one(
                    {'user_id': user_id},
                    {
                        '$set': {
                            'password': new_pw_hash,
                            'reset_token_used': True
                        }
                    }
                )
            except Exception as e:
                logger.error(f"Database error: {str(e)}")
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({'error': True, 'message': 'Gagal memperbarui password. Silakan coba lagi.'}), 500
                flash("Gagal memperbarui password. Silakan coba lagi.", "danger")
                return redirect(url_for('request_reset'))

            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'error': False, 'message': 'Password berhasil diperbarui!'}), 200
            flash('Password berhasil diperbarui!', 'success')
            return redirect(url_for('login'))

        return render_template('main/reset_password_confirm.html', token=token)

    except jwt.ExpiredSignatureError:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': True, 'message': 'Link telah kedaluwarsa.'}), 400
        flash("Link telah kedaluwarsa. Silakan minta reset ulang.", "danger")
        return redirect(url_for('request_reset'))
    except jwt.InvalidTokenError:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': True, 'message': 'Token tidak valid.'}), 400
        flash("Token tidak valid.", "danger")
        return redirect(url_for('request_reset'))
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': True, 'message': 'Terjadi kesalahan di server.'}), 500
        flash("Terjadi kesalahan. Silakan coba lagi.", "danger")
        return redirect(url_for('request_reset'))

# Edit Profil
# Tambahkan endpoint untuk memeriksa ketersediaan email dan nomor telepon
@app.route('/api/check_email_phone', methods=['POST'])
def check_email_phone():
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        phone = data.get('phone')
        user_id = data.get('user_id')

        if not user_id:
            logger.error("User ID diperlukan untuk memeriksa email/phone")
            return jsonify({'result': 'error', 'msg': 'User ID diperlukan'}), 400

        response = {
            'username': 'available',
            'email': 'available',
            'phone': 'available'
        }

        # Cek nama pengguna
        if username:
            if len(username) < 8:
                response['username'] = 'invalid'
                logger.info(f"Username terlalu pendek: {username}")
            elif not username[0].isalpha():
                response['username'] = 'invalid'
                logger.info(f"Username tidak diawali huruf: {username}")
            elif not username.replace('.', '').replace('_', '').isalnum():
                response['username'] = 'invalid'
                logger.info(f"Username tidak valid: {username}")
            else:
                existing_username = db.users.find_one({'username': username, 'user_id': {'$ne': user_id}})
                if existing_username:
                    response['username'] = 'unavailable'
                    logger.info(f"Username {username} sudah digunakan oleh user lain")

        # Cek email
        if email:
            if '@' not in email:
                response['email'] = 'invalid'
                logger.info(f"Email tidak valid, tidak mengandung @: {email}")
            else:
                existing_email = db.users.find_one({'email': email, 'user_id': {'$ne': user_id}})
                if existing_email:
                    response['email'] = 'unavailable'
                    logger.info(f"Email {email} sudah digunakan oleh user lain")

        # Cek nomor telepon
        if phone:
            # Sanitasi nomor telepon seperti di profile.js
            cleaned_phone = re.sub(r'[^0-9]', '', phone)
            if cleaned_phone.startswith('0'):
                cleaned_phone = cleaned_phone
            elif cleaned_phone.startswith('62'):
                cleaned_phone = '0' + cleaned_phone[2:]
            phone_regex = re.compile(r'^(0|\+62)\d{9,12}$')
            if not phone_regex.match(phone):
                response['phone'] = 'invalid'
                logger.info(f"Nomor telepon tidak valid: {phone}")
            else:
                existing_phone = db.users.find_one({'phone': cleaned_phone, 'user_id': {'$ne': user_id}})
                if existing_phone:
                    response['phone'] = 'unavailable'
                    logger.info(f"Nomor telepon {cleaned_phone} sudah digunakan oleh user lain")

        return jsonify(response), 200
    except Exception as e:
        logger.error(f"Error saat memeriksa email/phone: {str(e)}")
        return jsonify({'result': 'error', 'msg': 'Terjadi kesalahan saat memeriksa data'}), 500

# Modifikasi endpoint /profile untuk mendukung perubahan password
@app.route('/profile', methods=['POST'])
def update_profile():
    token_receive = request.cookies.get("tokenMain")
    if not token_receive:
        logger.error("Token tidak ditemukan di cookie")
        return jsonify({'result': 'unsuccess', 'msg': 'Token tidak ditemukan'}), 401

    try:
        payload = jwt.decode(token_receive, SECRET_KEY, algorithms=['HS256'])
        user_id = payload['user_id']
        user = db.users.find_one({'user_id': user_id})
        if not user:
            logger.error(f"Pengguna tidak ditemukan: user_id={user_id}")
            return jsonify({'result': 'unsuccess', 'msg': 'Pengguna tidak ditemukan'}), 404

        # Periksa batasan 48 jam sejak pengembalian mobil terakhir
        now = datetime.datetime.now()
        time_limit = now - timedelta(hours=48)
        latest_transaction = db.transaction.find_one(
            {'user_id': user_id, 'status': 'completed'},
            sort=[('actual_return_date', -1)]
        )
        if latest_transaction:
            try:
                return_date = datetime.datetime.strptime(
                    latest_transaction.get('actual_return_date') + ' ' + latest_transaction.get('actual_return_time'),
                    '%d-%B-%Y %H:%M'
                )
                if return_date > time_limit:
                    logger.warning(f"Pembaruan profil diblokir untuk user_id={user_id}: dalam batas 48 jam")
                    return jsonify({
                        'result': 'unsuccess',
                        'msg': 'Profil hanya dapat diperbarui setelah 48 jam sejak pengembalian mobil terakhir'
                    }), 403
            except ValueError:
                logger.error(f"Format tanggal tidak valid untuk transaksi: {latest_transaction.get('order_id')}")
                pass

        # Ambil data dari form
        username = request.form.get('username', user['username'])
        email = request.form.get('email', user['email'])
        phone = request.form.get('phone', user['phone'])
        name = request.form.get('name', user['name'])
        address = request.form.get('address', user.get('address', ''))
        old_password = request.form.get('old_password')
        new_password = request.form.get('new_password')

        # Validasi input
        if not username:
            logger.error("Username tidak boleh kosong")
            return jsonify({'result': 'unsuccess', 'msg': 'Username tidak boleh kosong'}), 400
        if len(username) < 8:
            logger.error(f"Username terlalu pendek: {username}")
            return jsonify({'result': 'unsuccess', 'msg': 'Username minimal 8 karakter'}), 400
        if not username[0].isalpha():
            logger.error(f"Username tidak diawali huruf: {username}")
            return jsonify({'result': 'unsuccess', 'msg': 'Username harus diawali dengan huruf'}), 400
        if not username.replace('.', '').replace('_', '').isalnum():
            logger.error(f"Username tidak valid: {username}")
            return jsonify({'result': 'unsuccess', 'msg': 'Username tidak valid'}), 400
        if not email:
            logger.error("Email tidak boleh kosong")
            return jsonify({'result': 'unsuccess', 'msg': 'Email tidak boleh kosong'}), 400
        if not phone:
            logger.error("Nomor telepon tidak boleh kosong")
            return jsonify({'result': 'unsuccess', 'msg': 'Nomor telepon tidak boleh kosong'}), 400
        if not name:
            logger.error("Nama lengkap tidak boleh kosong")
            return jsonify({'result': 'unsuccess', 'msg': 'Nama lengkap tidak boleh kosong'}), 400

        # Sanitasi nomor telepon
        cleaned_phone = phone.replace('[^0-9]', '')
        if cleaned_phone.startswith('0'):
            cleaned_phone = cleaned_phone
        elif cleaned_phone.startswith('62'):
            cleaned_phone = '0' + cleaned_phone[2:]
        if not cleaned_phone:
            logger.error("Nomor telepon tidak valid")
            return jsonify({'result': 'unsuccess', 'msg': 'Nomor telepon tidak valid'}), 400

        # Periksa apakah username, email, atau nomor telepon sudah digunakan
        existing_user = db.users.find_one({'username': username, 'user_id': {'$ne': user_id}})
        if existing_user:
            logger.error(f"Username sudah ada: {username}")
            return jsonify({'result': 'unsuccess', 'msg': 'Username sudah ada'}), 400
        existing_email = db.users.find_one({'email': email, 'user_id': {'$ne': user_id}})
        if existing_email:
            logger.error(f"Email sudah ada: {email}")
            return jsonify({'result': 'unsuccess', 'msg': 'Email sudah ada'}), 400
        existing_phone = db.users.find_one({'phone': cleaned_phone, 'user_id': {'$ne': user_id}})
        if existing_phone:
            logger.error(f"Nomor telepon sudah ada: {cleaned_phone}")
            return jsonify({'result': 'unsuccess', 'msg': 'Nomor telepon sudah ada'}), 400

        # Validasi dan perbarui password jika ada
        updates = {
            'username': username,
            'email': email,
            'phone': cleaned_phone,
            'name': name,
            'address': address
        }

        if old_password and new_password:
            # Verifikasi password lama
            old_pw_hash = hashlib.sha256(old_password.encode('utf-8')).hexdigest()
            if old_pw_hash != user['password']:
                logger.error(f"Password lama salah untuk user_id: {user_id}")
                return jsonify({'result': 'unsuccess', 'msg': 'Password lama salah'}), 400
            if len(new_password) < 8:
                logger.error("Password baru terlalu pendek")
                return jsonify({'result': 'unsuccess', 'msg': 'Password baru minimal 8 karakter'}), 400
            new_pw_hash = hashlib.sha256(new_password.encode('utf-8')).hexdigest()
            if new_pw_hash == user['password']:
                logger.error("Password baru sama dengan password lama")
                return jsonify({'result': 'unsuccess', 'msg': 'Password baru tidak boleh sama dengan password lama'}), 400
            updates['password'] = new_pw_hash

        # Tangani upload foto profil
        if 'profile_image' in request.files and request.files['profile_image'].filename != '':
            profile_image = request.files['profile_image']
            allowed_extensions = {'jpg', 'jpeg', 'png'}
            if '.' not in profile_image.filename or profile_image.filename.rsplit('.', 1)[1].lower() not in allowed_extensions:
                logger.error(f"Tipe file profil tidak valid: {profile_image.filename}")
                return jsonify({'result': 'unsuccess', 'msg': 'File profil harus berupa jpg atau png'}), 400
            profile_upload_folder = os.path.join('static', 'profile_images')
            os.makedirs(profile_upload_folder, exist_ok=True)
            profile_image_filename = f"{user_id}_profile.jpg"
            profile_image_path = os.path.join(profile_upload_folder, profile_image_filename).replace('\\', '/')
            try:
                profile_image.save(profile_image_path)
                if os.path.exists(profile_image_path):
                    logger.info(f"Foto profil berhasil disimpan di: {profile_image_path}")
                    if 'profile_image_path' in user and user['profile_image_path'] != profile_image_path and os.path.exists(user['profile_image_path']):
                        try:
                            os.remove(user['profile_image_path'])
                            logger.info(f"Foto profil lama dihapus: {user['profile_image_path']}")
                        except Exception as e:
                            logger.error(f"Gagal menghapus foto profil lama {user['profile_image_path']}: {str(e)}")
                    updates['profile_image_path'] = profile_image_path
                else:
                    logger.error(f"Gagal menyimpan foto profil: File tidak ditemukan di {profile_image_path}")
                    return jsonify({'result': 'unsuccess', 'msg': 'Gagal menyimpan foto profil'}), 500
            except Exception as e:
                logger.error(f'Gagal menyimpan foto profil: {str(e)}')
                return jsonify({'result': 'unsuccess', 'msg': 'Gagal menyimpan foto profil'}), 500

        # Tangani upload foto SIM
        if 'image' in request.files and request.files['image'].filename != '':
            sim_image = request.files['image']
            allowed_extensions = {'jpg', 'jpeg', 'png'}
            if '.' not in sim_image.filename or sim_image.filename.rsplit('.', 1)[1].lower() not in allowed_extensions:
                logger.error(f"Tipe file SIM tidak valid: {sim_image.filename}")
                return jsonify({'result': 'unsuccess', 'msg': 'File SIM harus berupa jpg atau png'}), 400
            sim_upload_folder = os.path.join('static', 'Gambar', 'identitas')
            os.makedirs(sim_upload_folder, exist_ok=True)
            sim_image_filename = f"{user_id}_sim.jpg"
            sim_image_path = os.path.join(sim_upload_folder, sim_image_filename).replace('\\', '/')
            try:
                sim_image.save(sim_image_path)
                if os.path.exists(sim_image_path):
                    logger.info(f"Foto SIM berhasil disimpan di: {sim_image_path}")
                    if 'image_path' in user and user['image_path'] != sim_image_path and os.path.exists(user['image_path']):
                        try:
                            os.remove(user['image_path'])
                            logger.info(f"Foto SIM lama dihapus: {user['image_path']}")
                        except Exception as e:
                            logger.error(f"Gagal menghapus foto SIM lama {user['image_path']}: {str(e)}")
                    updates['image_path'] = sim_image_path
                else:
                    logger.error(f"Gagal menyimpan foto SIM: File tidak ditemukan di {sim_image_path}")
                    return jsonify({'result': 'unsuccess', 'msg': 'Gagal menyimpan foto SIM'}), 500
            except Exception as e:
                logger.error(f'Gagal menyimpan foto SIM: {str(e)}')
                return jsonify({'result': 'unsuccess', 'msg': 'Gagal menyimpan foto SIM'}), 500

        # Perbarui data pengguna di database
        try:
            db.users.update_one({'user_id': user_id}, {'$set': updates})
            logger.info(f"Profil diperbarui untuk user_id: {user_id}")
            return jsonify({'result': 'success', 'msg': 'Profil berhasil diperbarui'})
        except Exception as e:
            logger.error(f"Error saat memperbarui profil di database: {str(e)}")
            return jsonify({'result': 'unsuccess', 'msg': 'Terjadi kesalahan saat memperbarui profil'}), 500

    except jwt.ExpiredSignatureError:
        logger.error("Token telah kadaluarsa")
        return jsonify({'result': 'unsuccess', 'msg': 'Token telah kadaluarsa'}), 401
    except jwt.InvalidTokenError:
        logger.error("Token tidak valid")
        return jsonify({'result': 'unsuccess', 'msg': 'Token tidak valid'}), 401
    except Exception as e:
        logger.error(f"Error saat memperbarui profil: {str(e)}")
        return jsonify({'result': 'unsuccess', 'msg': 'Terjadi kesalahan saat memperbarui profil'}), 500

@app.route('/maps')
def maps():
    token_receive = request.cookies.get("tokenMain")

    if not token_receive:
        flash("Akses tidak valid!", "danger")
        return redirect(url_for('home'))

    try:
        payload = jwt.decode(token_receive, SECRET_KEY, algorithms=['HS256'])
        id_user = payload.get("user_id")

        # Periksa apakah user ada di database
        user_info = db.users.find_one({"user_id": id_user})
        if not user_info:
            flash("User tidak ditemukan!", "danger")
            return redirect(url_for('home'))

        return render_template('main/maps.html', id_user=id_user)

    except jwt.ExpiredSignatureError:
        flash("Sesi telah berakhir, silakan login kembali.", "warning")
        return redirect(url_for('login'))
    except jwt.exceptions.DecodeError:
        flash("Token tidak valid!", "danger")
        return redirect(url_for('login'))
    except Exception as e:
        flash(f"Terjadi kesalahan: {str(e)}", "danger")
        return redirect(url_for('home'))




@app.route('/api/hide_mobil', methods=['POST'])
def hide_mobil():
    id_mobil = request.form.get('id_mobil')
    if not id_mobil:
        return jsonify({'result': 'unsuccess', 'msg': 'ID mobil tidak ditemukan'})
    db.dataMobil.update_one({'id_mobil': id_mobil}, {'$set': {'visibility': 'hidden'}})
    return jsonify({'result': 'success'})

@app.route('/api/show_mobil', methods=['POST'])
def show_mobil():
    id_mobil = request.form.get('id_mobil')
    if not id_mobil:
        return jsonify({'result': 'unsuccess', 'msg': 'ID mobil tidak ditemukan'})
    db.dataMobil.update_one({'id_mobil': id_mobil}, {'$set': {'visibility': 'visible'}})
    return jsonify({'result': 'success'})

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        user_id = username  # Menggunakan username sebagai pengenal
        # Cek rate limit sebelum melanjutkan ke proses login
        if is_rate_limited(user_id):
            return jsonify({"error": "Too many login attempts. Please try again later."}), 429

        # Hashing password
        pw = hashlib.sha256(password.encode("utf-8")).hexdigest()
        user = db.users.find_one({"username": username, "password": pw})

        if user:
            payload = {
                "user_id": user['user_id'],
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
            }
            
            token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')

            return jsonify({
                'result': 'success',
                'token': token,
            })       
        else:
            # Jika login gagal, tambahkan hitungan untuk percobaan login
            requests_count[user_id][int(time.time()) // SUB_INTERVAL * SUB_INTERVAL] += 1
            return jsonify({
                'msg': 'Invalid username or password'
            })
    else:
        msg = request.args.get('msg')
        try:
            payload = jwt.decode(msg, SECRET_KEY, algorithms=['HS256'])
            msg = payload['message']
            return render_template('main/login.html', msg=msg)
        except:
            return render_template('main/login.html')
 


  
        
@app.route('/api/verify_password', methods=['POST'])
def verify_password():
    data = request.json  # Mengambil data JSON
    user_id = data.get('user_id')  # Mendapatkan user_id dari data
    password = data.get('password')  # Mendapatkan password dari data

    # Pastikan user_id dan password ditemukan
    if not user_id or not password:
        return jsonify({'status': 'fail', 'message': 'User ID atau password tidak ditemukan!'}), 400
    
    # Ambil data user dari database berdasarkan user_id
    user = db.users.find_one({"user_id": user_id})
    
    if user:
        hashed_password = hashlib.sha256(password.encode("utf-8")).hexdigest()
        if user['password'] == hashed_password:
            return jsonify({'status': 'success'})
        else:
            return jsonify({'status': 'fail', 'message': 'Password salah!'})
    else:
        return jsonify({'status': 'fail', 'message': 'User tidak ditemukan!'})

@app.route('/transaksi')
def transaksiUser():
    token_receive = request.cookies.get("tokenMain")
    
    try:
        payload = jwt.decode(token_receive, SECRET_KEY, algorithms=['HS256'])
        user_info = db.users.find_one({"user_id": payload["user_id"]})
        if user_info['verif'] != 'verifed':
            return redirect(url_for('verify_email'))
        data = db.transaction.find({"user_id": payload["user_id"]})
        return render_template('main/transaction.html', data = data,user_info=user_info)
    except jwt.ExpiredSignatureError:
        msg = createSecreteMassage('Akses transaksi login terlebih dahulu')
        return redirect(url_for('login', msg = msg))
    except jwt.exceptions.DecodeError:
        msg = createSecreteMassage('Akses transaksi login terlebih dahulu')
        return redirect(url_for('login', msg = msg))

@app.route('/transaksi/<id>')
def payment(id):
    token_receive = request.cookies.get("tokenMain")
    try:
        data = db.transaction.find_one({'order_id': id})

        # CEK JIKA TRANSAKSI SUDAH DIBATALKAN
        if not data or data['status'] == 'canceled':
            flash('Transaksi telah dibatalkan dan tidak dapat dilanjutkan.', 'error')
            return redirect(url_for('transaksiUser'))

        # CEK MOBIL SUDAH DISEWA ATAU BELUM
        data_mobil = db.dataMobil.find_one({'id_mobil': data['id_mobil']})
        if data_mobil['status'] in ['Diproses', 'Digunakan']:
            canceltransaction(order_id=data['order_id'], msg='Sudah ada transaksi lain')
            return render_template('main/transactionDetail.html', data=data)
        
        payload = jwt.decode(token_receive, SECRET_KEY, algorithms=['HS256'])
        user_info = db.users.find_one({"user_id": payload["user_id"]})
        if user_info['verif'] != 'verifed':
            return redirect(url_for('verify_email'))
        
        token = data['transaction_token']
        return render_template('main/payment.html', data=data, user_info=user_info)

    except jwt.ExpiredSignatureError:
        msg = createSecreteMassage('Akses transaksi login terlebih dahulu')
        return redirect(url_for('login', msg=msg))
    except jwt.exceptions.DecodeError:
        msg = createSecreteMassage('Akses transaksi login terlebih dahulu')
        return redirect(url_for('login', msg=msg))

    
@app.route('/detail-mobil')
def detail():
    id = request.args.get('id')

    # Cari mobil berdasarkan id_mobil dan pastikan visibility-nya 'visible'
    data = db.dataMobil.find_one({'id_mobil': id, 'visibility': 'visible'})
    
    # Cari mobil lain yang tersedia dan visibility-nya 'visible', tetapi berbeda dengan id yang sedang ditampilkan
    data_mobil = db.dataMobil.find({"id_mobil": {"$ne": id}, 'status': 'Tersedia', 'visibility': 'visible'})

    if data:
        # Konversi harga ke integer jika ada
        data['harga'] = int(data.get('harga', 0))

    token_receive = request.cookies.get("tokenMain")

    try:
        payload = jwt.decode(token_receive, SECRET_KEY, algorithms=['HS256'])
        user_info = db.users.find_one({"user_id": payload["user_id"]})
        if user_info['verif'] != 'verifed':
            return redirect(url_for('verify_email'))
        return render_template('main/car-details.html', data=data, user_info=user_info, data_mobil=data_mobil)
    
    except jwt.ExpiredSignatureError:
        return render_template('main/car-details.html', data=data)
    
    except jwt.exceptions.DecodeError:
        return render_template('main/car-details.html', data=data)


@app.route('/profile', methods=['GET'])
def get_profile():
    token_receive = request.cookies.get("tokenMain")
    try:
        payload = jwt.decode(token_receive, SECRET_KEY, algorithms=['HS256'])
        user_info = db.users.find_one({"user_id": payload["user_id"]})
        if user_info['verif'] != 'verifed':
            return redirect(url_for('verify_email'))
        
        return render_template('main/profil.html',user_info=user_info)
    except jwt.ExpiredSignatureError:
        msg = createSecreteMassage('login terlebih dahulu')
        return redirect(url_for('login', msg = msg))
    except jwt.exceptions.DecodeError:
        msg = createSecreteMassage('login terlebih dahulu')
        return redirect(url_for('login', msg = msg))
    

@app.route('/verify_email')
def verify_email():
    token_receive = request.cookies.get("tokenMain")
    try:
        payload = jwt.decode(token_receive, SECRET_KEY, algorithms=['HS256'])
        user_info = db.users.find_one({"user_id": payload["user_id"]})
        mesagge = ''
        if user_info['verif'] == 'sending_email':
            mesagge = 'Email Sudah Terkirim, masukkan kode yang diberikan ke bawah ini'
        else:
            mesagge = 'Rental Mobil Manado perlu tahu kalau emailmu aktif, jadi verifikasi emailmu dengan klik tombol dibawah'

        return render_template('main/verify_email.html', mesagge =mesagge, user_info = user_info)
    except jwt.ExpiredSignatureError:
        msg = createSecreteMassage('login terlebih dahulu')
        return redirect(url_for('login', msg = msg))
    except jwt.exceptions.DecodeError:
        msg = createSecreteMassage('login terlebih dahulu')
        return redirect(url_for('login', msg = msg))

@app.route('/api/verify', methods=['POST'])
def verify():
    user = db.users.find_one({'user_id' : request.form.get('user_id')})

    kode = random.randint(10000, 99999)
    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifikasi Email</title>
    <style>
        .container {{
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 20px;
            border: 1px solid #dddddd;
            font-family: Arial, sans-serif;
        }}
        .header {{
            text-align: center;
            padding: 10px 0;
            background-color: #007bff;
            color: white;
        }}
        .content {{
            padding: 20px;
            text-align: center;
        }}
        .footer {{
            text-align: center;
            padding: 10px 0;
            background-color: #f6f6f6;
            color: #999999;
        }}
        .button {{
            display: inline-block;
            padding: 10px 20px;
            margin: 20px 0;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 5px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Verifikasi Email Anda</h1>
        </div>
        <div class="content">
            <p>Halo,</p>
            <p>Terima kasih telah mendaftar. Berikut adalah kode verifikasi Anda:</p>
            <h2>{kode}</h2>
            <p>Silakan masukkan kode ini di halaman verifikasi untuk mengaktifkan akun Anda.</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Rental Mobil Manado.</p>
        </div>
    </div>
</body>
</html>
"""

    msg = Message('confirm email', recipients=[user['email']], html=html_content, sender=app.config['MAIL_USERNAME'])
    mail.send(msg)

    kode_hash = hashlib.sha256(str(kode).encode("utf-8")).hexdigest()
    
    db.users.update_one({'user_id' : user['user_id']},{'$set' : {'verif' : 'sending_email', 'kode' : kode_hash}})
    return jsonify({
        'msg': 'succeess'
    })

@app.route('/api/verify_kode', methods=['POST'])
def verify_kode():
    user = request.form.get('user_id')
    kode = request.form.get('kode')
    kode_hash = hashlib.sha256(kode.encode("utf-8")).hexdigest()
    result = db.users.find_one({'user_id' : user , 'kode' : kode_hash})

    if result:
        db.users.update_one({'user_id' : user},{'$set' : {'verif' : 'verifed'}})
        return jsonify({
            'result' : 'success'
        })
    else:
        
        return jsonify({
            'result' : 'failed',
            'msg' : 'kode verifikasi salah'
        })

def createSecreteMassage(msg):
    payload = {
            "message": msg,
        }
    msg = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return msg


# Perubahan tambahan untuk reset pass

@app.route('/reset_password')
def reset_password():
    return render_template('main/reset_password.html')

@app.route('/request_reset', methods=['POST'])
def request_reset():
    email = request.form.get('email')
    user = db.users.find_one({'email': email})
    
    if user:
        token = jwt.encode({
            'user_id': user['user_id'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        # Simpan token dan set status penggunaannya sebagai belum digunakan
        db.users.update_one(
            {'user_id': user['user_id']},
            {'$set': {'reset_token': token, 'reset_token_used': False}}
        )
        
        reset_url = url_for('reset_password_confirm', token=token, _external=True)
        
        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Password</title>
            <style>
                body {{
                    margin: 0;
                    padding: 0;
                    background-color: #f0f2f5;
                    font-family: Arial, sans-serif;
                }}
                .container {{
                    width: 100%;
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #ffffff;
                    padding: 20px;
                    border: 1px solid #dddddd;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                }}
                .header {{
                    text-align: center;
                    padding: 10px 0;
                    background-color: #007bff;
                    color: white;
                    border-bottom: 1px solid #dddddd;
                }}
                .content {{
                    padding: 20px;
                    text-align: center;
                    color: black;
                }}
                .footer {{
                    text-align: center;
                    padding: 10px 0;
                    background-color: #007bff;
                    color: #ffffff;
                    border-top: 1px solid #dddddd;
                }}
                .button {{
                    display: inline-block;
                    padding: 10px 20px;
                    margin: 20px 0;
                    background-color: #00ff00 ; /* Background color */
                    color: #ffffff; /* Text color */
                    text-decoration: none;
                    border-radius: 5px;
                }}
                .button:hover {{
                    background-color: #0056b3;
                    color: #ffffff;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Reset Password</h1>
                </div>
                <div class="content">
                    <p>Hi {user['username']},</p>
                    <p>Untuk mengatur ulang kata sandi Anda, klik tautan di bawah ini:</p>
                    <a href="{reset_url}" class="button">Reset Password</a>
                </div>
                <div class="footer">
                    <p>&copy; 2024 Rental Mobil Manado. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        msg = Message('Password Reset Request', recipients=[email], html=html_content, sender=app.config['MAIL_USERNAME'])
        mail.send(msg)
        
        return jsonify({'result': 'success', 'msg': 'Password reset link has been sent to your email'})
    else:
        return jsonify({'result': 'failed', 'msg': 'Email not found'})






# Endpoint untuk menampilkan halaman rating
@app.route('/rating')
def rating():
    token_receive = request.cookies.get("tokenMain")
    try:
        # Dekode JWT untuk mendapatkan user_id
        payload = jwt.decode(token_receive, SECRET_KEY, algorithms=['HS256'])
        user_id = payload.get("user_id")
        if not user_id:
            raise jwt.exceptions.DecodeError

        # Mengambil car_id dari query parameter
        car_id = request.args.get('car_id')
        if not car_id:
            return "Mobil ID tidak ditemukan.", 400

        # Verifikasi transaksi selesai untuk car_id dan user_id
        transaction = db.transaction.find_one({
            'id_mobil': car_id,
            'user_id': user_id,
            'status_mobil': 'selesai',
            'rating_prompted': True
        })
        if not transaction:
            return "Anda tidak memiliki transaksi selesai untuk mobil ini.", 403

        # Mengambil data rating dan komentar dari database
        rating_data = db.ratings.find_one({"car_id": car_id, "user_id": user_id})
        if rating_data:
            rating_value = rating_data.get('rating')
            comment_value = rating_data.get('komentar')
        else:
            rating_value = 0
            comment_value = "Belum ada komentar."

        # Render halaman rating dengan user_id, car_id, rating, dan komentar
        return render_template('main/rating.html', car_id=car_id, user_id=user_id, rating=rating_value, comment=comment_value)

    except jwt.ExpiredSignatureError:
        msg = createSecreteMassage('Sesi Anda telah kedaluwarsa, silakan login kembali')
        return redirect(url_for('login', msg=msg))
    except jwt.exceptions.DecodeError:
        msg = createSecreteMassage('Token tidak valid, silakan login kembali')
        return redirect(url_for('login', msg=msg))

@app.route('/submit-rating', methods=['POST'])
def submit_rating():
    rating = request.form.get('rating')
    komentar = request.form.get('comment')
    car_id = request.form.get('car_id')
    user_id = request.form.get('user_id')

    # Debugging output
    print(f"Rating: {rating}, Komentar: {komentar}, Car ID: {car_id}, User ID: {user_id}")

    # Validasi data yang diterima
    if not all([rating, car_id, user_id]):
        missing_fields = []
        if not rating:
            missing_fields.append("rating")
        if not car_id:
            missing_fields.append("car_id")
        if not user_id:
            missing_fields.append("user_id")
        print(f"Missing fields: {missing_fields}")
        return jsonify({'result': 'failed', 'msg': 'Semua data harus diisi'}), 400

    # Verifikasi transaksi selesai untuk car_id dan user_id
    transaction = db.transaction.find_one({
        'id_mobil': car_id,
        'user_id': user_id,
        'status_mobil': 'selesai',
        'rating_prompted': True
    })
    if not transaction:
        return jsonify({'result': 'failed', 'msg': 'Transaksi tidak valid atau sudah diberi rating'}), 403

    # Periksa apakah rating sudah ada
    if db.ratings.find_one({'car_id': car_id, 'user_id': user_id}):
        return jsonify({'result': 'failed', 'msg': 'Anda sudah memberikan rating untuk mobil ini'}), 400

    rating_data = {
        'user_id': user_id,
        'car_id': car_id,
        'rating': int(rating),
        'komentar': komentar,
        'timestamp': datetime.datetime.utcnow()
    }

    try:
        db.ratings.insert_one(rating_data)
        # Nonaktifkan rating_prompted
        db.transaction.update_one(
            {'order_id': transaction['order_id']},
            {'$set': {'rating_prompted': False}}
        )
        return jsonify({'result': 'success', 'msg': 'Rating berhasil dikirim'})
    except Exception as e:
        print(f"Database error: {str(e)}")
        return jsonify({'result': 'failed', 'msg': 'Gagal menyimpan rating'}), 500

# Endpoint untuk mengambil rating dan komentar
@app.route('/get_rating_and_comment', methods=['GET'])
def get_rating_and_comment():
    car_id = request.args.get('car_id')
    if not car_id:
        return jsonify({"error": "car_id is required"}), 400

    ratings = list(db.ratings.find({"car_id": car_id}))

    if not ratings:
        return jsonify({"rating": 0, "comment": "Belum ada komentar."}), 200

    rating_counts = Counter(rating['rating'] for rating in ratings)
    most_common_rating, count = rating_counts.most_common(1)[0]
    latest_comment = max(ratings, key=lambda x: x['timestamp'])['komentar']

    return jsonify({
        "rating": most_common_rating,
        "comment": latest_comment,
        "count": count
    })

@app.route('/logout')
def logout():
    response = redirect(url_for('home'))
    response.delete_cookie('tokenMain')
    flash('Berhasil logout', 'success')
    return response

# Penanganan Kesalahan 404
@app.errorhandler(404)
def page_not_found(e):
    return render_template('main/404.html'), 404


app.register_blueprint(dashboard.dashboard)
app.register_blueprint(api.api)

 
# if __name__ == '__main__':
#     app.run(debug=True)
 
Thread(target=cancel_unpaid_transactions, daemon=True).start() 

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
