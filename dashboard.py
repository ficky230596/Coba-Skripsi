from flask import Blueprint, render_template, request,redirect, url_for, jsonify,current_app
import jwt
import hashlib
from datetime import datetime,timedelta
from dbconnection import db
import os
import uuid
from dateutil.relativedelta import relativedelta
from flask_mail import Message
import random
import re

SECRET_KEY_DASHBOARD = os.environ.get("SECRET_KEY_DASHBOARD")

dashboard = Blueprint('dashboard', __name__)



# GET METHODS
@dashboard.route('/dashboard')
def dashboard_page():
    token_receive = request.cookies.get("tokenDashboard")
    try:
        payload = jwt.decode(token_receive, SECRET_KEY_DASHBOARD, algorithms=['HS256'])
        user_info = db.users_admin.find_one({"username": payload["user"]})
        if not user_info:
            current_app.logger.error(f"User admin tidak ditemukan: {payload['user']}")
            return redirect(url_for("dashboard.dashboard_login", msg="User tidak ditemukan"))

        jumlah_mobil = db.dataMobil.count_documents({})
        jumlah_transaksi = db.transaction.count_documents({'status': {'$in': ['sudah bayar', 'completed']}})
        datenow = datetime.now().strftime("%Y")
        total_transaksi = list(db.transaction.find({
            'status': {'$in': ['sudah bayar', 'completed']},
            'date_rent': {'$regex': datenow, '$options': 'i'}
        }, {'_id': 0, 'total': 1}))
        total_values = sum([trans.get('total', 0) for trans in total_transaksi])
        current_app.logger.info(f"Total pendapatan tahun {datenow}: {total_values}")

        transaksi_pertahun = db.transaction.find({'status': {'$in': ['sudah bayar', 'completed']}})
        tahun_transaksi = set()
        for data in transaksi_pertahun:
            try:
                date = datetime.strptime(data['date_rent'], "%d-%B-%Y")
                tahun_transaksi.add(str(date.year))
            except ValueError as e:
                current_app.logger.error(f"Gagal parsing date_rent untuk transaksi {data.get('order_id')}: {data['date_rent']}, error: {str(e)}")
                continue

        tahun_transaksi = sorted(list(tahun_transaksi))
        current_app.logger.info(f"Tahun transaksi: {tahun_transaksi}")

        return render_template(
            'dashboard/dashboard.html',
            user_info=user_info,
            jumlah_mobil=jumlah_mobil,
            jumlah_transaksi=jumlah_transaksi,
            total_transaksi=total_values,
            tahun_transaksi=tahun_transaksi
        )
    except jwt.ExpiredSignatureError:
        current_app.logger.warning("Token dashboard kedaluwarsa")
        return redirect(url_for("dashboard.dashboard_login", msg="Your token has expired"))
    except jwt.exceptions.DecodeError:
        current_app.logger.warning("Token dashboard tidak valid")
        return redirect(url_for("dashboard.dashboard_login"))
    except Exception as e:
        current_app.logger.error(f"Error di rute dashboard: {str(e)}")
        return redirect(url_for("dashboard.dashboard_login", msg="Terjadi kesalahan"))

@dashboard.route('/data_mobil')
def data_mobil():
    token_receive = request.cookies.get("tokenDashboard")
    try:
        payload = jwt.decode(token_receive, SECRET_KEY_DASHBOARD, algorithms=['HS256'])
        user_info = db.users_admin.find_one({"username": payload["user"]})
        data = db.dataMobil.find({})
        return render_template('dashboard/data_mobil.html',user_info=user_info, data=data)
    except jwt.ExpiredSignatureError:
         return redirect(url_for("dashboard.dashboard_login", msg="Your token has expired"))
    except jwt.exceptions.DecodeError:
        return redirect(url_for("dashboard.dashboard_login"))

@dashboard.route('/data_mobil/edit')
def data_mobilDetail():
    id = request.args.get('id')
    token_receive = request.cookies.get("tokenDashboard")
    try:
        payload = jwt.decode(token_receive, SECRET_KEY_DASHBOARD, algorithms=['HS256'])
        user_info = db.users_admin.find_one({"username": payload["user"]})
        data = db.dataMobil.find_one({'id_mobil' : id})
        return render_template('dashboard/edit_mobil.html',user_info=user_info, data=data)
    except jwt.ExpiredSignatureError:
         return redirect(url_for("dashboard.dashboard_login", msg="Your token has expired"))
    except jwt.exceptions.DecodeError:
        return redirect(url_for("dashboard.dashboard_login"))

@dashboard.route('/transaction')
def transaction():
    token_receive = request.cookies.get("tokenDashboard")
    try:
        payload = jwt.decode(token_receive, SECRET_KEY_DASHBOARD, algorithms=['HS256'])
        user_info = db.users_admin.find_one({"username": payload["user"]})
        data = db.transaction.find({})
        return render_template('dashboard/transaction.html',user_info=user_info, data=data)
    except jwt.ExpiredSignatureError:
         return redirect(url_for("dashboard.dashboard_login", msg="Your token has expired"))
    except jwt.exceptions.DecodeError:
        return redirect(url_for("dashboard.dashboard_login"))

@dashboard.route('/settings')
def setting():
    token_receive = request.cookies.get("tokenDashboard")
    try:
        payload = jwt.decode(token_receive, SECRET_KEY_DASHBOARD, algorithms=['HS256'])
        user_info = db.users_admin.find_one({"username": payload["user"]})
        data = db.transaction.find({})
        return render_template('dashboard/setting.html',user_info=user_info, data=data)
    except jwt.ExpiredSignatureError:
         return redirect(url_for("dashboard.dashboard_login", msg="Your token has expired"))
    except jwt.exceptions.DecodeError:
        return redirect(url_for("dashboard.dashboard_login"))
    
@dashboard.route('/settings/change_username', methods=['POST'])
def change_username():
    new_username = request.form.get('new_username')
    username = request.form.get('username')
    data = db.users_admin.find_one({'username' : username})
    if datetime.now() < data['expired_username']:
        print('tes')
        return jsonify({
            'result' : 'failed',
            'msg' : 'username telah diubah coba lagi nanti'
        })
    else:
        exp = datetime.now() + relativedelta(months=1)
        db.users_admin.update_one({'username' : username}, {'$set' : {'username' : new_username, 'expired_username' : exp}})
        payload = {
            "user": new_username,
            "exp": datetime.utcnow() + timedelta(seconds=60 * 60 * 24),
        }
        token = jwt.encode(payload, SECRET_KEY_DASHBOARD, algorithm="HS256")
        return jsonify({
            "result": "success",
            "token": token
        })
    

@dashboard.route('/settings/change_email', methods=['GET', 'POST'])
def ganti_email():
    current_app.logger.info(f"Request ke /settings/change_email: method={request.method}, form={request.form}")
    
    if request.method == 'POST':
        username = request.form.get('username')
        mtd = request.form.get('mtd')
        
        current_app.logger.info(f"POST: mtd={mtd}, username={username}")
        
        if not username:
            current_app.logger.error("Username tidak diberikan")
            return jsonify({'result': 'gagal', 'msg': 'Username tidak diberikan'})

        user_info = db.users_admin.find_one({'username': username})
        if not user_info:
            current_app.logger.error(f"Pengguna tidak ditemukan: {username}")
            return jsonify({'result': 'gagal', 'msg': 'Pengguna tidak ditemukan'})

        if mtd == 'initiate_change':
            password = request.form.get('password')
            new_email = request.form.get('new_email')
            if not password or not new_email:
                current_app.logger.error("Password atau email baru tidak diberikan")
                return jsonify({'result': 'gagal', 'msg': 'Password dan email baru harus diisi'})
            
            # Verifikasi kata sandi
            pw_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
            if user_info['password'] != pw_hash:
                current_app.logger.error(f"Password salah untuk {username}")
                return jsonify({'result': 'gagal', 'msg': 'Password salah'})
            
            # Jika ada email lama, kirim kode verifikasi ke email lama
            if user_info.get('email'):
                try:
                    send_verification(email=user_info['email'], username=username)
                    db.users_admin.update_one(
                        {'username': username},
                        {'$set': {'verif': 'verify_old_email', 'temp_email': new_email}}
                    )
                    current_app.logger.info(f"Kode verifikasi dikirim ke email lama {user_info['email']}")
                    return jsonify({'result': 'success', 'msg': 'Kode verifikasi dikirim ke email lama'})
                except Exception as e:
                    current_app.logger.error(f"Gagal mengirim kode ke {user_info['email']}: {str(e)}")
                    return jsonify({'result': 'gagal', 'msg': f'Gagal mengirim kode: {str(e)}'})
            else:
                # Jika tidak ada email lama, langsung kirim kode ke email baru
                try:
                    send_verification(email=new_email, username=username)
                    db.users_admin.update_one(
                        {'username': username},
                        {'$set': {'verif': 'verify_new_email', 'temp_email': new_email}}
                    )
                    current_app.logger.info(f"Kode verifikasi dikirim ke email baru {new_email}")
                    return jsonify({'result': 'success', 'msg': 'Kode verifikasi dikirim ke email baru'})
                except Exception as e:
                    current_app.logger.error(f"Gagal mengirim kode ke {new_email}: {str(e)}")
                    return jsonify({'result': 'gagal', 'msg': f'Gagal mengirim kode: {str(e)}'})

        elif mtd == 'verify_old_email':
            kode = request.form.get('kode')
            if not kode:
                current_app.logger.error("Kode verifikasi tidak diberikan")
                return jsonify({'result': 'gagal', 'msg': 'Kode verifikasi tidak diberikan'})
            try:
                if verif(user=username, kode=kode):
                    new_email = user_info.get('temp_email')
                    send_verification(email=new_email, username=username)
                    db.users_admin.update_one(
                        {'username': username},
                        {'$set': {'verif': 'verify_new_email'}}
                    )
                    current_app.logger.info(f"Verifikasi email lama berhasil, kode dikirim ke {new_email}")
                    return jsonify({'result': 'success', 'msg': 'Verifikasi email lama berhasil, periksa email baru Anda'})
                else:
                    return jsonify({'result': 'gagal', 'msg': 'Kode verifikasi salah'})
            except Exception as e:
                current_app.logger.error(f"Gagal verifikasi untuk {username}: {str(e)}")
                return jsonify({'result': 'gagal', 'msg': f'Kode salah: {str(e)}'})

        elif mtd == 'verify_new_email':
            kode = request.form.get('kode')
            if not kode:
                current_app.logger.error("Kode verifikasi tidak diberikan")
                return jsonify({'result': 'gagal', 'msg': 'Kode verifikasi tidak diberikan'})
            try:
                if verif(user=username, kode=kode):
                    new_email = user_info.get('temp_email')
                    db.users_admin.update_one(
                        {'username': username},
                        {'$set': {'email': new_email, 'verif': 'verifed', 'temp_email': None, 'kode': None}}
                    )
                    current_app.logger.info(f"Email berhasil diubah menjadi {new_email} untuk {username}")
                    return jsonify({'result': 'success', 'msg': 'Email berhasil diubah'})
                else:
                    return jsonify({'result': 'gagal', 'msg': 'Kode verifikasi salah'})
            except Exception as e:
                current_app.logger.error(f"Gagal verifikasi untuk {username}: {str(e)}")
                return jsonify({'result': 'gagal', 'msg': f'Kode salah: {str(e)}'})

        elif mtd == 'send_verif':
            email = user_info.get('email') or user_info.get('temp_email')
            if not email:
                current_app.logger.error(f"Email tidak diatur untuk {username}")
                return jsonify({'result': 'gagal', 'msg': 'Email belum diatur'})
            try:
                send_verification(email=email, username=username)
                current_app.logger.info(f"Kode verifikasi dikirim ke {email}")
                return jsonify({'result': 'success', 'msg': 'Kode verifikasi telah dikirim'})
            except Exception as e:
                current_app.logger.error(f"Gagal mengirim kode ke {email}: {str(e)}")
                return jsonify({'result': 'gagal', 'msg': f'Gagal mengirim kode: {str(e)}'})

        elif mtd == 'verif':
            kode = request.form.get('kode')
            if not kode:
                current_app.logger.error("Kode verifikasi tidak diberikan")
                return jsonify({'result': 'gagal', 'msg': 'Kode verifikasi tidak diberikan'})
            try:
                if verif(user=username, kode=kode):
                    db.users_admin.update_one({'username': username}, {'$set': {'verif': 'verifed'}})
                    current_app.logger.info(f"Verifikasi berhasil untuk {username}")
                    return jsonify({'result': 'success', 'msg': 'Email berhasil diverifikasi'})
                else:
                    return jsonify({'result': 'gagal', 'msg': 'Kode verifikasi salah'})
            except Exception as e:
                current_app.logger.error(f"Gagal verifikasi untuk {username}: {str(e)}")
                return jsonify({'result': 'gagal', 'msg': f'Kode salah: {str(e)}'})

        else:
            current_app.logger.error(f"Metode tidak valid: {mtd}")
            return jsonify({'result': 'gagal', 'msg': 'Metode tidak valid'})

    else:
        token_receive = request.cookies.get("tokenDashboard")
        try:
            payload = jwt.decode(token_receive, SECRET_KEY_DASHBOARD, algorithms=['HS256'])
            user_info = db.users_admin.find_one({"username": payload["user"]})
            current_app.logger.info(f"Merender change_email.html untuk {payload['user']}")
            return render_template('dashboard/change_email.html', user_info=user_info)
        except jwt.ExpiredSignatureError:
            current_app.logger.warning("Token kedaluwarsa")
            return redirect(url_for("dashboard.dashboard_login", msg="Your token has expired"))
        except jwt.exceptions.DecodeError:
            current_app.logger.warning("Token tidak valid")
            return redirect(url_for("dashboard.dashboard_login"))
        
        
@dashboard.route('/settings/change_password', methods=['POST'])
def change_password():
    old_pass = request.form.get('password_lama')
    new_pass = request.form.get('password_baru')
    username = request.form.get('username')

    if old_pass == '':
        return jsonify({
            'result' : 'gagal',
            'msg' : 'password lama tidak boleh kosong'
        })
    elif new_pass == '':
        return jsonify({
            'result' : 'gagal',
            'msg' : 'password baru tidak boleh kosong'
        })
    elif len(new_pass) < 6:
        return jsonify({
            'result' : 'gagal',
            'msg' : 'password baru minimal 6 karakter'
        })
    
    pw_hash = hashlib.sha256(old_pass.encode("utf-8")).hexdigest()

    data = db.users_admin.find_one({'username' : username})
    
    if data['password'] == pw_hash:

        pw_hash_new = hashlib.sha256(new_pass.encode("utf-8")).hexdigest()
        db.users_admin.update_one({'username' : username},{'$set': {'password' : pw_hash_new}})
        return jsonify({
            'result' : 'success',
            'msg' : 'password berhasil di ganti'
        })
    
    else:
            
        return jsonify({
            'result' : 'gagal',
            'msg' : f'gagal : password salah'
        })
    
@dashboard.route('/data_mobil/add-data')
def addData():
    token_receive = request.cookies.get("tokenDashboard")
    try:
        payload = jwt.decode(token_receive, SECRET_KEY_DASHBOARD, algorithms=['HS256'])
        user_info = db.users_admin.find_one({"username": payload["user"]})
        return render_template('dashboard/tambahdata.html',user_info=user_info)
    except jwt.ExpiredSignatureError:
         return redirect(url_for("dashboard.dashboard_login", msg="Your token has expired"))
    except jwt.exceptions.DecodeError:
        return redirect(url_for("dashboard.dashboard_login"))

@dashboard.route('/dashboard-login', methods = ['GET'])
def dashboard_login():
    token_receive = request.cookies.get("tokenDashboard")
    try:
        jwt.decode(token_receive, SECRET_KEY_DASHBOARD, algorithms=['HS256'])
        return redirect(url_for("dashboard.dashboard_page"))
    except jwt.ExpiredSignatureError:
        return render_template('dashboard/login.html')
    except jwt.exceptions.DecodeError:
        return render_template('dashboard/login.html')


# POST METHODS
@dashboard.route('/dashboard-login', methods = ['POST'])
def dashboard_login_post():
    user = request.form.get("username")
    password = request.form.get("password")
    pw_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
    result = db.users_admin.find_one({'username': user, 'password': pw_hash})
    if result:
        payload = {
            "user": user,
            "exp": datetime.utcnow() + timedelta(seconds=60 * 60 * 24),
        }
        token = jwt.encode(payload, SECRET_KEY_DASHBOARD, algorithm="HS256")
        return jsonify({
            "result": "success",
            "token": token
        })
    else:
        return jsonify({
            'result' : 'unsucces',
            'msg' : 'password atau username salah'
        })

@dashboard.route('/data_mobil/add-data', methods = ['POST'])
def addData_post():

    payload = jwt.decode(request.cookies.get("tokenDashboard"), SECRET_KEY_DASHBOARD, algorithms=['HS256'])
    user_info = db.users_admin.find_one({"username": payload["user"]})
    id_mobil = uuid.uuid1()
    merek = request.form.get('merek')
    type_mobil = request.form.get('type_mobil')
    plat = request.form.get('plat')
    bahan_bakar = request.form.get('bahan_bakar')
    seat = request.form.get('seat')
    transmisi = request.form.get('transmisi')
    harga = request.form.get('harga')

    if merek == '':
        return jsonify({
            'result' : 'unsucces',
            'msg' : 'merek tidak boleh kosong'
            })
    elif type_mobil == '':
        return jsonify({
            'result' : 'unsucces',
            'msg' : 'type mobil tidak boleh kosong'
            })
    elif plat == '':
        return jsonify({
            'result' : 'unsucces',
            'msg' : 'plat tidak boleh kosong'
        })
    elif bahan_bakar == '':
        return jsonify({
            'result' : 'unsucces',
            'msg' : 'bahan bakar tidak boleh kosong'
            })
    elif seat == '':
        return jsonify({
            'result' : 'unsucces',
            'msg' : 'seat tidak boleh kosong'
            })
    elif transmisi == '':
        return jsonify({
            'result' : 'unsucces',
            'msg' : 'transmisi tidak boleh kosong'
            })
    elif harga == '':
        return jsonify({
            'result' : 'unsucces',
            'msg' : 'harga tidak boleh kosong'
        })

    try:
        file = request.files['gambar']
        extension = file.filename.split('.')[-1]
        upload_date = datetime.now().strftime('%Y-%M-%d-%H-%m-%S')
        gambar_name = f'mobil-{upload_date}.{extension}'
        file.save(f'static/gambar/{gambar_name}')
    except:
        return jsonify({
            'result' : 'unsucces',
            'msg' : 'Masukkan gambar'
        }) 

    db.dataMobil.insert_one({
        'id_mobil' : str(id_mobil),
        'user' : user_info['username'],
        'merek' : merek.capitalize(),
        'type_mobil' : type_mobil.capitalize(),
        'plat' : plat.capitalize(),
        'bahan_bakar' : bahan_bakar.capitalize(),
        'gambar' : gambar_name,
        'seat' : seat.capitalize(),
        'transmisi' : transmisi.capitalize(),
        'harga' : harga.capitalize(),
        'status' : 'tersedia'.capitalize(),
    })

    return jsonify({'result':'success'})

@dashboard.route('/data_mobil/update-data', methods = ['POST'])
def updateData_post():

    payload = jwt.decode(request.cookies.get("tokenDashboard"), SECRET_KEY_DASHBOARD, algorithms=['HS256'])
    user_info = db.users_admin.find_one({"username": payload["user"]})
    id_mobil = request.form.get('id_mobil')
    merek = request.form.get('merek')
    type_mobil = request.form.get('type_mobil')
    plat = request.form.get('plat')
    bahan_bakar = request.form.get('bahan_bakar')
    seat = request.form.get('seat')
    transmisi = request.form.get('transmisi')
    harga = request.form.get('harga')

    data = db.dataMobil.find_one({"id_mobil": id_mobil})

    try:
        file = request.files['gambar']
        os.remove(f"static/gambar/{data['gambar']}")
        extension = file.filename.split('.')[-1]
        upload_date = datetime.now().strftime('%Y-%M-%d-%H-%m-%S')
        gambar_name = f'mobil-{upload_date}.{extension}'
        file.save(f'static/gambar/{gambar_name}')
    except:
        gambar_name = data['gambar']

    db.dataMobil.update_one({'id_mobil' : id_mobil},
    {'$set':{
        'user' : user_info['username'],
        'merek' : merek.capitalize(),
        'type_mobil' : type_mobil.capitalize(),
        'plat' : plat.capitalize(),
        'bahan_bakar' : bahan_bakar.capitalize(),
        'gambar' : gambar_name,
        'seat' : seat.capitalize(),
        'transmisi' : transmisi.capitalize(),
        'harga' : harga.capitalize(),
        'status' : 'tersedia'.capitalize(),
    }})

    return jsonify({'result':'success'})


@dashboard.route('/transaction/add_transaction')
def add_transaction():
    token_receive = request.cookies.get("tokenDashboard")
    try:
        payload = jwt.decode(token_receive, SECRET_KEY_DASHBOARD, algorithms=['HS256'])
        user_info = db.users_admin.find_one({"username": payload["user"]})
        data = db.dataMobil.find({'status' : 'Tersedia'})
        return render_template('dashboard/add_transaction.html',user_info=user_info, data =data)
    except jwt.ExpiredSignatureError:
         return redirect(url_for("dashboard.dashboard_login", msg="Your token has expired"))
    except jwt.exceptions.DecodeError:
        return redirect(url_for("dashboard.dashboard_login"))


# list mobil
@dashboard.route('/api/daftar_mobil')
def api_daftar_mobil():
    data_mobil = list(db.dataMobil.find({}))
    for mobil in data_mobil:
        mobil['_id'] = str(mobil['_id'])  # Convert ObjectId to string
    return jsonify({'data_mobil': data_mobil})


def send_verification(email, username):
    current_app.logger.info(f"Mengirim kode verifikasi ke {email} untuk {username}")
    
    # Validasi email
    if not email or not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        current_app.logger.error(f"Email tidak valid atau kosong: {email}")
        raise ValueError("Email tidak valid atau kosong")
    
    # Validasi Flask-Mail
    if 'mail' not in current_app.extensions:
        current_app.logger.error("Flask-Mail tidak diinisialisasi")
        raise Exception("Flask-Mail tidak diinisialisasi")

    kode = random.randint(10000, 99999)
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifikasi Email</title>
        <style>
            .container {{ width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border: 1px solid #dddddd; font-family: Arial, sans-serif; }}
            .header {{ text-align: center; padding: 10px 0; background-color: #007bff; color: white; }}
            .content {{ padding: 20px; text-align: center; }}
            .footer {{ text-align: center; padding: 10px 0; background-color: #f6f6f6; color: #999999; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Verifikasi Email Anda</h1>
            </div>
            <div class="content">
                <p>Halo,</p>
                <p>Berikut adalah kode verifikasi Anda:</p>
                <h2>{kode}</h2>
                <p>Masukkan kode ini di halaman verifikasi.</p>
            </div>
            <div class="footer">
                <p>© 2024 Rental Mobil Manado. Semua hak dilindungi.</p>
            </div>
        </div>
    </body>
    </html>
    """
    try:
        msg = Message('Confirm Email', recipients=[email], html=html_content, sender=('Rental Mobil Manado', current_app.config['MAIL_USERNAME']))
        mail = current_app.extensions['mail']
        mail.send(msg)
        current_app.logger.info(f"Kode verifikasi dikirim ke {email}")
        kode_hash = hashlib.sha256(str(kode).encode("utf-8")).hexdigest()
        result = db.users_admin.update_one(
            {'username': username},
            {'$set': {'verif': 'sending_email', 'kode': kode_hash}}
        )
        if result.modified_count == 0:
            current_app.logger.error(f"Gagal memperbarui database untuk {username}")
            raise Exception("Gagal memperbarui database")
    except Exception as e:
        current_app.logger.error(f"Gagal mengirim email ke {email}: {str(e)}")
        raise e

def verif(user, kode):
    current_app.logger.info(f"Memverifikasi kode untuk {user}")
    kode_hash = hashlib.sha256(str(kode).encode("utf-8")).hexdigest()
    result = db.users_admin.find_one({'username': user, 'kode': kode_hash})
    if result:
        result = db.users_admin.update_one({'username': user}, {'$set': {'verif': 'verifed'}})
        current_app.logger.info(f"Verifikasi berhasil untuk {user}")
        return True
    else:
        current_app.logger.error(f"Kode verifikasi salah untuk {user}")
        raise ValueError("Kode verifikasi salah")
    
@dashboard.route('/forgot-password', methods=['POST'])
def forgot_password():
    current_app.logger.info(f"Request ke /forgot-password: method={request.method}, form={request.form}")
    
    mtd = request.form.get('mtd')
    email = request.form.get('email')
    
    if not mtd:
        current_app.logger.error("Metode tidak diberikan")
        return jsonify({'result': 'gagal', 'msg': 'Metode tidak diberikan'})

    if mtd == 'send_reset_code':
        if not email:
            current_app.logger.error("Email tidak diberikan")
            return jsonify({'result': 'gagal', 'msg': 'Email tidak diberikan'})
        
        user_info = db.users_admin.find_one({'email': email})
        if not user_info:
            current_app.logger.error(f"Email tidak ditemukan: {email}")
            return jsonify({'result': 'gagal', 'msg': 'Email tidak terdaftar'})
        
        try:
            send_verification(email=email, username=user_info['username'])
            current_app.logger.info(f"Kode verifikasi dikirim ke {email}")
            return jsonify({'result': 'success', 'msg': 'Kode verifikasi telah dikirim ke email Anda'})
        except Exception as e:
            current_app.logger.error(f"Gagal mengirim kode ke {email}: {str(e)}")
            return jsonify({'result': 'gagal', 'msg': f'Gagal mengirim kode: {str(e)}'})

    elif mtd == 'verify_reset_code':
        code = request.form.get('code')
        if not code:
            current_app.logger.error("Kode verifikasi tidak diberikan")
            return jsonify({'result': 'gagal', 'msg': 'Kode verifikasi tidak diberikan'})
        
        user_info = db.users_admin.find_one({'email': email})
        if not user_info:
            current_app.logger.error(f"Email tidak ditemukan: {email}")
            return jsonify({'result': 'gagal', 'msg': 'Email tidak terdaftar'})
        
        try:
            if verif(user=user_info['username'], kode=code):
                current_app.logger.info(f"Kode verifikasi berhasil untuk {email}")
                return jsonify({'result': 'success', 'msg': 'Kode verifikasi valid, masukkan kata sandi baru'})
            else:
                current_app.logger.error(f"Kode verifikasi salah untuk {email}")
                return jsonify({'result': 'gagal', 'msg': 'Kode verifikasi salah'})
        except Exception as e:
            current_app.logger.error(f"Gagal memverifikasi kode untuk {email}: {str(e)}")
            return jsonify({'result': 'gagal', 'msg': f'Kode salah: {str(e)}'})

    elif mtd == 'reset_password':
        new_password = request.form.get('new_password')
        if not new_password:
            current_app.logger.error("Kata sandi baru tidak diberikan")
            return jsonify({'result': 'gagal', 'msg': 'Kata sandi baru tidak diberikan'})
        if len(new_password) < 6:
            current_app.logger.error("Kata sandi baru terlalu pendek")
            return jsonify({'result': 'gagal', 'msg': 'Kata sandi minimal 6 karakter'})
        
        user_info = db.users_admin.find_one({'email': email})
        if not user_info:
            current_app.logger.error(f"Email tidak ditemukan: {email}")
            return jsonify({'result': 'gagal', 'msg': 'Email tidak terdaftar'})
        
        try:
            pw_hash = hashlib.sha256(new_password.encode("utf-8")).hexdigest()
            db.users_admin.update_one(
                {'email': email},
                {'$set': {'password': pw_hash, 'kode': None}}
            )
            current_app.logger.info(f"Kata sandi berhasil diubah untuk {email}")
            return jsonify({'result': 'success', 'msg': 'Kata sandi berhasil diubah'})
        except Exception as e:
            current_app.logger.error(f"Gagal mengubah kata sandi untuk {email}: {str(e)}")
            return jsonify({'result': 'gagal', 'msg': f'Gagal mengubah kata sandi: {str(e)}'})

    else:
        current_app.logger.error(f"Metode tidak valid: {mtd}")
        return jsonify({'result': 'gagal', 'msg': 'Metode tidak valid'})