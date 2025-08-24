from datetime import datetime, timedelta
from threading import Thread, Lock
from time import sleep
from pytz import timezone
import re  # Tambahkan impor ini
from dateutil import tz
from werkzeug.utils import secure_filename
import hashlib
import heapq
import json
import jwt
import random
import logging
import pymongo
import midtransclient
import os
from dotenv import load_dotenv
import requests
import urllib.parse
import uuid
from flask import Blueprint, request, jsonify, current_app
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from dbconnection import db
from func import createSecretMessage, canceltransaction

# Memuat variabel lingkungan dari .env
load_dotenv()
# Konfigurasi
SECRET_KEY = os.environ.get("SECRET_KEY")
FONNTE_TOKEN = os.environ.get("FONNTE_TOKEN")
ADMIN_PHONE = os.environ.get("ADMIN_PHONE", "6285342860104")  # Fallback
MIDTRANS_ENV = os.environ.get("MIDTRANS_ENV", "sandbox")  # Default ke sandbox

# Konfigurasi logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inisialisasi Blueprint
api = Blueprint("api", __name__)


# ------------------- Priority Queue Implementation -------------------
class PriorityQueue:

    def __init__(self):
        self._queue = []
        self._index = 0

    def push(self, transaction):
        heapq.heappush(self._queue, (-transaction["total"], self._index, transaction))
        self._index += 1

    def pop(self):
        return heapq.heappop(self._queue)[-1] if self._queue else None

    def peek(self):
        return self._queue[0][-1] if self._queue else None

    def is_empty(self):
        return len(self._queue) == 0


# Inisialisasi antrian prioritas global dan lock
priority_queue = PriorityQueue()
queue_lock = Lock()

# ------------------- WhatsApp Messaging -------------------


def send_fonnte_message(
    phone: str,
    order_id: str,
    penyewa: str,
    item: str,
    type_mobil: str,
    plat: str,
    bahan_bakar: str,
    seat: str,
    transmisi: str,
    total: int,
    lama_rental: str,
    biaya_sopir: int,
    gunakan_pengantaran: bool = False,
    delivery_cost: int = 0,
    delivery_location: str = "",
    delivery_lat: float = None,
    delivery_lon: float = None,
    is_admin: bool = False,
    user_phone: str = None,
) -> bool:
    logger.info(
        f"Mengirim pesan untuk order_id: {order_id}, gunakan_pengantaran: {gunakan_pengantaran}, delivery_location: {delivery_location}, delivery_lat: {delivery_lat}, delivery_lon: {delivery_lon}"
    )

    if not FONNTE_TOKEN:
        logger.error("Token Fonnte tidak ditemukan.")
        raise ValueError("Token Fonnte tidak ditemukan.")

    # Bersihkan nomor telepon
    cleaned_phone = "".join(filter(str.isdigit, phone))
    if cleaned_phone.startswith("0"):
        cleaned_phone = "62" + cleaned_phone[1:]
    elif not cleaned_phone.startswith("62"):
        cleaned_phone = "62" + cleaned_phone

    if (
        not cleaned_phone.isdigit()
        or len(cleaned_phone) < 10
        or len(cleaned_phone) > 15
    ):
        logger.error(f"Nomor telepon tidak valid: {phone} -> {cleaned_phone}")
        return False

    if gunakan_pengantaran and not delivery_location:
        logger.error(f"Lokasi pengantaran kosong untuk order_id: {order_id}")
        return False

    # Format pesan
    total_formatted = f"{total:,}".replace(",", ".")
    sopir_status = "Ya" if biaya_sopir > 0 else "Tidak"
    pengantaran_status = "Ya" if gunakan_pengantaran else "Tidak"
    delivery_cost_formatted = (
        f"Rp {delivery_cost:,}".replace(",", ".") if gunakan_pengantaran else "Tidak"
    )

    message_lines = [
        (
            f"Notifikasi Pemesanan Baru (Order ID: {order_id}):"
            if is_admin
            else f"Transaksi Anda (Order ID: {order_id}) telah berhasil dibayar!"
        ),
        "Detail Pemesanan:",
        f"- Penyewa: {penyewa}",
    ]

    # Tambahkan nomor telepon pengguna untuk pesan admin
    if is_admin and user_phone:
        cleaned_user_phone = "".join(filter(str.isdigit, user_phone))
        if cleaned_user_phone.startswith("0"):
            cleaned_user_phone = "62" + cleaned_user_phone[1:]
        elif not cleaned_user_phone.startswith("62"):
            cleaned_user_phone = "62" + cleaned_user_phone
        message_lines.append(f"- Nomor Telepon Penyewa: {cleaned_user_phone}")

    message_lines.extend(
        [
            f"- Item: {item}",
            f"- Tipe Mobil: {type_mobil}",
            f"- Plat Nomor: {plat}",
            f"- Bahan Bakar: {bahan_bakar}",
            f"- Jumlah Seat: {seat}",
            f"- Transmisi: {transmisi}",
            f"- Total Biaya: Rp {total_formatted}",
            f"- Lama Rental: {lama_rental}",
            f"- Sopir: {sopir_status}",
            f"- Pengantaran: {pengantaran_status}",
        ]
    )

    if gunakan_pengantaran:
        message_lines.extend(
            [
                f"- Biaya Pengantaran: {delivery_cost_formatted}",
                f"- Lokasi Pengantaran: {delivery_location}",
            ]
        )
        if delivery_lat is not None and delivery_lon is not None:
            google_maps_link = (
                f"https://www.google.com/maps?q={delivery_lat},{delivery_lon}"
            )
            message_lines.append(f"- Tautan Google Maps: {google_maps_link}")

    message_lines.append("- Status Pembayaran: Sudah Bayar")

    if is_admin:
        message_lines.append("Harap proses pemesanan ini segera.")
    else:
        if gunakan_pengantaran:
            message_lines.append(
                "Mobil akan diantar ke lokasi yang Anda tentukan. Terima kasih!"
            )
        else:
            message_lines.extend(
                [
                    "Silakan ke kantor untuk mengambil mobil pada tanggal dan waktu yang ditentukan.",
                    "Jangan lupa bawa bukti pembayaran. Terima kasih!",
                ]
            )

    message = "\n".join(message_lines)

    # Kirim pesan melalui Fonnte
    url = "https://api.fonnte.com/send"
    headers = {"Authorization": FONNTE_TOKEN}
    data = {
        "target": cleaned_phone,
        "message": message,
        "connectOnly": "true",
        "delay": "2",
    }

    session = requests.Session()
    retries = Retry(
        total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504]
    )
    session.mount("https://", HTTPAdapter(max_retries=retries))

    try:
        response = session.post(url, headers=headers, data=data, timeout=10)
        response_json = response.json()
        if response.status_code == 200 and response_json.get("status") is True:
            logger.info(f"Pesan berhasil dikirim ke {cleaned_phone}: {response_json}")
            return True
        logger.error(
            f"Gagal mengirim pesan ke {cleaned_phone}: {response_json.get('reason', 'Unknown error')}"
        )
        return False
    except Exception as e:
        logger.error(f"Error saat mengirim pesan ke {cleaned_phone}: {str(e)}")
        return False
    finally:
        session.close()


# ------------------- Transaction Management -------------------


def cancel_unpaid_transactions():
    logger.info("Memulai fungsi cancel_unpaid_transactions")  # Tambahkan log
    # Inisialisasi Snap dengan lingkungan dinamis
    is_production = MIDTRANS_ENV == "production"
    snap = midtransclient.Snap(
        is_production=is_production,
        server_key=os.environ.get("MIDTRANS_SERVER_KEY"),
        client_key=os.environ.get("MIDTRANS_CLIENT_KEY"),
    )
    wita = timezone('Asia/Makassar')  # Zona waktu WITA
    while True:
        now = datetime.now(wita)
        time_limit = now - timedelta(minutes=5)
        unpaid_transactions = db.transaction.find(
            {
                "status": "unpaid",
                "created_at": {"$lt": time_limit.astimezone(timezone('UTC'))},  # Konversi ke UTC
            }
        )
        for txn in unpaid_transactions:
            order_id = txn["order_id"]
            try:
                # Cek status transaksi di Midtrans
                status = snap.transactions.status(order_id)
                if status.get("transaction_status") in ["settlement", "capture"]:
                    logger.info(
                        f"Transaksi {order_id} sudah dibayar, lewati pembatalan"
                    )
                    db.transaction.update_one(
                        {"order_id": order_id},
                        {"$set": {"status": "sudah bayar", "status_mobil": "Diproses"}},
                    )
                    continue
                # Batalkan transaksi di Midtrans
                snap.transactions.cancel(order_id)
                logger.info(f"Transaksi {order_id} dibatalkan di Midtrans")
            except Exception as e:
                if "404" in str(e):  # Tangani error 404
                    logger.warning(f"Transaksi {order_id} tidak ditemukan di Midtrans, tetap batalkan di database")
                else:
                    logger.error(f"Gagal membatalkan transaksi {order_id} di Midtrans: {str(e)}")
                    continue  # Lewati transaksi ini, lanjutkan ke transaksi berikutnya

            # Hapus dari antrian prioritas
            with queue_lock:
                temp_queue = PriorityQueue()
                while not priority_queue.is_empty():
                    queued_transaction = priority_queue.pop()
                    if queued_transaction["order_id"] != order_id:
                        temp_queue.push(queued_transaction)
                while not temp_queue.is_empty():
                    priority_queue.push(temp_queue.pop())

            # Perbarui database
            db.transaction.update_one(
                {"order_id": order_id},
                {"$set": {"status": "canceled", "status_mobil": None}},
            )
            db.dataMobil.update_one(
                {"id_mobil": txn["id_mobil"]},
                {
                    "$set": {
                        "status_transaksi": None,
                        "order_id": None,
                        "status": "Tersedia",
                    }
                },
            )
            logger.info(
                f"Transaksi {order_id} dibatalkan karena tidak dibayar dalam 5 menit."
            )
        sleep(60)  # Interval 60 detik untuk mengurangi beban server


# ------------------- API Endpoints -------------------


# Endpoint untuk reverse geocoding
@api.route("/api/reverse_geocode", methods=["GET"])
def reverse_geocode():
    try:
        lat = request.args.get("lat")
        lon = request.args.get("lon")
        if not lat or not lon:
            return (
                jsonify(
                    {"status": "error", "message": "Parameter lat dan lon diperlukan"}
                ),
                400,
            )

        headers = {
            "User-Agent": "RentalMobilApp/1.0 (fickyrahanubun@gmail.com)"  # Ganti dengan email Anda
        }
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}"
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        return jsonify(response.json()), 200
    except requests.RequestException as e:
        logger.error(f"Error saat reverse geocoding: {str(e)}")
        return (
            jsonify(
                {"status": "error", "message": f"Gagal mendapatkan alamat: {str(e)}"}
            ),
            500,
        )


# Endpoint untuk pencarian lokasi
@api.route("/api/search_geocode", methods=["GET"])
def search_geocode():
    try:
        query = request.args.get("q")
        if not query:
            return (
                jsonify({"status": "error", "message": "Parameter query diperlukan"}),
                400,
            )

        headers = {
            "User-Agent": "RentalMobilApp/1.0 (fickyrahanubun@gmail.com)"  # Ganti dengan email Anda
        }
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={urllib.parse.quote(query)}&limit=1"
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        return jsonify(response.json()), 200
    except requests.RequestException as e:
        logger.error(f"Error saat pencarian lokasi: {str(e)}")
        return (
            jsonify({"status": "error", "message": f"Gagal mencari lokasi: {str(e)}"}),
            500,
        )


@api.route("/api/create_transaction", methods=["POST"])
def create_transaction():
    global priority_queue
    id_mobil = request.form.get("id_mobil")
    user_id = request.form.get("user_id")
    hari = request.form.get("hari")
    gunakan_sopir = request.form.get("gunakan_sopir") == "true"
    gunakan_pengantaran = request.form.get("gunakan_pengantaran") == "true"
    delivery_cost = (
        int(request.form.get("delivery_cost", 0)) if gunakan_pengantaran else 0
    )
    delivery_location = (
        request.form.get("delivery_location", "") if gunakan_pengantaran else ""
    )
    delivery_lat = (
        float(request.form.get("delivery_lat"))
        if request.form.get("delivery_lat")
        else None
    )
    delivery_lon = (
        float(request.form.get("delivery_lon"))
        if request.form.get("delivery_lon")
        else None
    )
    client_total_harga = int(request.form.get("total_harga", 0))

    # Validasi input
    try:
        hari = int(hari)
        if hari < 1:
            raise ValueError("Hari harus lebih besar dari 0")
    except (TypeError, ValueError):
        logger.error(f"Jumlah hari tidak valid: {hari}")
        return jsonify({"status": "error", "message": "Jumlah hari tidak valid."}), 400

    if not id_mobil or not user_id:
        logger.error(f"Data tidak lengkap: id_mobil={id_mobil}, user_id={user_id}")
        return jsonify({"status": "error", "message": "Data tidak lengkap."}), 400

    valid_delivery_costs = [0, 50000, 100000, 200000]
    if gunakan_pengantaran and delivery_cost not in valid_delivery_costs:
        logger.error(f"Biaya pengantaran tidak valid: {delivery_cost}")
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Biaya pengantaran tidak valid. Harus 0, 50000, 100000, atau 200000.",
                }
            ),
            400,
        )

    if gunakan_pengantaran and (
        not delivery_location or not delivery_lat or not delivery_lon
    ):
        logger.error("Lokasi pengantaran atau koordinat tidak lengkap.")
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Lokasi pengantaran dan koordinat (lat, lon) harus diisi.",
                }
            ),
            400,
        )

    # Ambil data mobil dan user
    data_mobil = db.dataMobil.find_one({"id_mobil": id_mobil})
    data_user = db.users.find_one({"user_id": user_id})

    if not data_mobil or not data_user:
        logger.error(
            f"Mobil atau pengguna tidak ditemukan: id_mobil={id_mobil}, user_id={user_id}"
        )
        return (
            jsonify(
                {"status": "error", "message": "Mobil atau pengguna tidak ditemukan."}
            ),
            404,
        )

    # Cek status mobil dan visibility
    if data_mobil.get("visibility") == "hidden":
        logger.error(f"Mobil tidak tersedia karena visibility hidden: id_mobil={id_mobil}")
        return jsonify({"status": "error", "message": "Mobil sedang dalam perawatan."}), 409

    if data_mobil.get("status_transaksi") in ["pembayaran", "digunakan"]:
        logger.error(
            f"Mobil sudah digunakan atau dalam proses pembayaran: id_mobil={id_mobil}"
        )
        return jsonify({"status": "error", "message": "Mobil tidak tersedia."}), 409

    # Cek transaksi yang belum dibayar atau sedang berlangsung
    unpaid_transaction = db.transaction.find_one(
        {"user_id": user_id, "status": "unpaid"}
    )
    if unpaid_transaction:
        logger.info(
            f"Ditemukan transaksi belum dibayar untuk user_id {user_id}: order_id {unpaid_transaction['order_id']}"
        )
        return (
            jsonify(
                {
                    "status": "unpaid_transaction",
                    "message": "Anda memiliki transaksi yang belum dibayar. Batalkan transaksi sebelumnya terlebih dahulu.",
                }
            ),
            400,
        )

    active_transaction = db.transaction.find_one(
        {
            "user_id": user_id,
            "status": {"$in": ["ongoing", "sudah bayar", "Diproses", "Digunakan"]},
        }
    )
    if active_transaction:
        logger.info(
            f"Ditemukan transaksi aktif untuk user_id {user_id}: order_id {active_transaction['order_id']}, status {active_transaction['status']}"
        )
        return (
            jsonify(
                {
                    "status": "active_rental",
                    "message": "Anda masih memiliki mobil yang sedang disewa. Selesaikan rental sebelum menyewa mobil lain.",
                }
            ),
            400,
        )

    # Hitung harga
    harga_per_hari = int(data_mobil["harga"])
    harga_sopir_per_hari = 100000
    biaya_sopir = harga_sopir_per_hari * hari if gunakan_sopir else 0
    total_harga = (harga_per_hari * hari) + biaya_sopir + delivery_cost

    # Validasi total_harga dari frontend
    if client_total_harga != total_harga:
        logger.error(
            f"Total harga tidak sesuai: client={client_total_harga}, server={total_harga}"
        )
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Total harga tidak sesuai dengan perhitungan server.",
                }
            ),
            400,
        )

    # Buat order_id dan data transaksi
    order_id = str(uuid.uuid1())
    wita = timezone('Asia/Makassar')
    now = datetime.now(wita)
    date_rent = now.strftime("%d-%B-%Y")
    end_rent = (now + timedelta(days=hari)).strftime("%d-%B-%Y")

    # Setup Midtrans
    is_production = MIDTRANS_ENV == "production"
    snap = midtransclient.Snap(
        is_production=is_production,
        server_key=os.environ.get("MIDTRANS_SERVER_KEY"),
        client_key=os.environ.get("MIDTRANS_CLIENT_KEY"),
    )

    param = {
        "transaction_details": {"order_id": order_id, "gross_amount": total_harga},
        "customer_details": {
            "first_name": data_user["name"],
            "email": data_user["email"],
            "phone": data_user["phone"],
        },
        "enabled_payments": ["credit_card", "bank_transfer", "gopay", "shopeepay"],
        "expiry": {"duration": 10, "unit": "minutes"},
    }

    try:
        logger.info(f"Param Midtrans: {json.dumps(param)}")
        transaction = snap.create_transaction(param)
        transaction_token = transaction["token"]
    except Exception as e:
        logger.error(f"❌ Gagal buat transaksi Midtrans: {e}")
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Gagal membuat transaksi Midtrans.",
                    "detail": str(e),
                }
            ),
            500,
        )

    # Buat data transaksi
    transaksi = {
        "user_id": data_user["user_id"],
        "order_id": order_id,
        "id_mobil": id_mobil,
        "penyewa": data_user["name"],
        "phone": data_user["phone"],
        "transaction_token": transaction_token,
        "item": data_mobil["merek"],
        "type_mobil": data_mobil["type_mobil"],
        "plat": data_mobil["plat"],
        "bahan_bakar": data_mobil["bahan_bakar"],
        "seat": data_mobil["seat"],
        "transmisi": data_mobil["transmisi"],
        "total": total_harga,
        "lama_rental": f"{hari} hari",
        "date_rent": date_rent,
        "time_rent": None,
        "end_rent": end_rent,
        "end_time": None,
        "status": "unpaid",
        "biaya_sopir": biaya_sopir,
        "gunakan_pengantaran": gunakan_pengantaran,
        "delivery_cost": delivery_cost,
        "delivery_location": delivery_location,
        "delivery_lat": delivery_lat,
        "delivery_lon": delivery_lon,
        "status_mobil": "pembayaran",
        "actual_return_date": None,
        "actual_return_time": None,
        "status_pengembalian": None,
        "created_at": now,
    }

    # Tambahkan transaksi ke antrian prioritas dengan penguncian
    with queue_lock:
        priority_queue.push(transaksi)
    logger.info(
        f"Transaksi {order_id} ditambahkan ke antrian prioritas dengan total {total_harga}"
    )

    # Periksa antrian secara berkala selama 10 detik
    logger.info(
        f"Memeriksa pesanan lain untuk id_mobil: {id_mobil} selama 10 detik"
    )
    from time import time
    wait_time = 10  # Total waktu tunggu dalam detik
    interval = 1    # Interval pemeriksaan dalam detik
    start_time = time()
    found_conflict = False
    selected_transaction = transaksi

    while time() - start_time < wait_time:
        with queue_lock:
            conflicting_orders = []
            temp_queue = PriorityQueue()
            while not priority_queue.is_empty():
                queued_transaction = priority_queue.pop()
                if (
                    queued_transaction["id_mobil"] == id_mobil
                    and queued_transaction["order_id"] != order_id
                    and queued_transaction["status"] in ["unpaid", "sudah bayar"]
                ):
                    conflicting_orders.append(queued_transaction)
                else:
                    temp_queue.push(queued_transaction)

            # Jika ada transaksi lain, bandingkan total
            for conflict in conflicting_orders:
                found_conflict = True
                if conflict["total"] > selected_transaction["total"]:
                    selected_transaction = conflict

            # Kembalikan transaksi ke antrian untuk pemeriksaan berikutnya
            while not temp_queue.is_empty():
                priority_queue.push(temp_queue.pop())
            for conflict in conflicting_orders:
                priority_queue.push(conflict)
            priority_queue.push(transaksi)

        # Jika tidak ada konflik pada pemeriksaan pertama, keluar lebih awal
        if not found_conflict and time() - start_time >= 1:
            logger.info(f"Tidak ada konflik untuk id_mobil {id_mobil}, lanjutkan pemrosesan")
            break

        sleep(interval)

    # Proses transaksi setelah periode tunggu atau keluar lebih awal
    with queue_lock:
        if selected_transaction["order_id"] != order_id:
            # Batalkan transaksi saat ini
            try:
                snap.transactions.cancel(order_id)
                logger.info(f"Transaksi {order_id} dibatalkan di Midtrans karena konflik")
            except Exception as e:
                if "404" in str(e):
                    logger.warning(f"Transaksi {order_id} tidak ditemukan di Midtrans, tetap lanjutkan pembatalan")
                else:
                    logger.error(f"Gagal membatalkan transaksi {order_id} di Midtrans: {str(e)}")
            db.transaction.delete_one({"order_id": order_id})
            db.dataMobil.update_one(
                {"id_mobil": id_mobil},
                {"$set": {"status_transaksi": None, "status": "Tersedia", "order_id": None}},
            )
            # Kembalikan transaksi lain ke antrian
            temp_queue = PriorityQueue()
            while not priority_queue.is_empty():
                queued_transaction = priority_queue.pop()
                if queued_transaction["order_id"] != order_id:
                    temp_queue.push(queued_transaction)
            while not temp_queue.is_empty():
                priority_queue.push(temp_queue.pop())
            logger.info(
                f"Transaksi {order_id} dibatalkan karena ada transaksi lain dengan nilai lebih tinggi"
            )
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": f"Mohon maaf mobil tidak tersedia lagi {id_mobil}",
                    }
                ),
                409,
            )

        # Jika transaksi ini dipilih, simpan ke database
        try:
            with db.client.start_session() as session:
                with session.start_transaction():
                    db.transaction.insert_one(transaksi, session=session)
                    db.dataMobil.update_one(
                        {"id_mobil": id_mobil},
                        {
                            "$set": {
                                "status_transaksi": "pembayaran",
                                "status": "pembayaran",
                                "order_id": order_id
                            }
                        },
                        session=session
                    )
        except Exception as e:
            logger.error(f"Gagal menyimpan transaksi {order_id} ke database: {str(e)}")
            try:
                snap.transactions.cancel(order_id)
                logger.info(f"Transaksi {order_id} dibatalkan di Midtrans karena gagal menyimpan")
            except Exception as cancel_error:
                if "404" in str(e):
                    logger.warning(f"Transaksi {order_id} tidak ditemukan di Midtrans, tetap lanjutkan pembatalan")
                else:
                    logger.error(f"Gagal membatalkan transaksi {order_id} di Midtrans: {str(cancel_error)}")
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Gagal menyimpan transaksi.",
                        "detail": str(e),
                    }
                ),
                500,
            )

        # Hapus transaksi dari antrian
        temp_queue = PriorityQueue()
        while not priority_queue.is_empty():
            queued_transaction = priority_queue.pop()
            if queued_transaction["order_id"] != order_id:
                temp_queue.push(queued_transaction)
        while not temp_queue.is_empty():
            priority_queue.push(temp_queue.pop())

    logger.info(f"Transaksi {order_id} berhasil disimpan dengan total {total_harga}")
    return (
        jsonify(
            {
                "status": "success",
                "id": order_id,
                "transaction_token": transaction_token,
            }
        ),
        200,
    )


@api.route("/api/midtrans-notification", methods=["POST"])
def midtrans_notification():
    notification = request.get_json()
    logger.info(f"Menerima notifikasi Midtrans: {json.dumps(notification, indent=2)}")  # Tambahkan log
    order_id = notification.get("order_id")
    status_code = notification.get("status_code")
    gross_amount = notification.get("gross_amount")
    transaction_status = notification.get("transaction_status")

    # Verifikasi signature
    server_key = os.environ.get("MIDTRANS_SERVER_KEY")
    signature_key = notification.get("signature_key")
    expected_signature = hashlib.sha512(
        f"{order_id}{status_code}{gross_amount}{server_key}".encode()
    ).hexdigest()

    if signature_key != expected_signature:
        return jsonify({"status": "error", "message": "Invalid signature"}), 400

    transaction = db.transaction.find_one({"order_id": order_id})
    if not transaction:
        return jsonify({"status": "error", "message": "Transaksi tidak ditemukan"}), 404

    # Jangan proses jika sudah final
    if transaction["status"] in ["sudah bayar", "canceled", "completed"]:
        return jsonify({"status": "success", "message": "Sudah diproses"}), 200

    if transaction_status == "pending":
        db.transaction.update_one(
            {"order_id": order_id}, {"$set": {"status": "unpaid"}}
        )
    elif transaction_status in ["cancel", "expire", "deny"]:
        db.transaction.update_one(
            {"order_id": order_id},
            {"$set": {"status": "canceled", "status_mobil": None}},
        )
        db.dataMobil.update_one(
            {"id_mobil": transaction["id_mobil"]},
            {
                "$set": {
                    "status_transaksi": None,
                    "status": "Tersedia",
                    "order_id": None,
                }
            },
        )
    elif transaction_status == "settlement":
        logger.info(
            f"Status settlement diterima, tapi dilewati (ditangani di frontend)."
        )

    return jsonify({"status": "success", "message": "Notifikasi diproses"}), 200


@api.route("/api/transaction-success", methods=["POST"])
def transaction_success():
    global priority_queue
    idcar = request.form.get("idcar")
    orderid = request.form.get("orderid")
    penyewa = request.form.get("penyewa")
    from_source = request.form.get("from")

    # Validasi input
    if not idcar or not orderid:
        logger.error(
            f"Parameter idcar atau orderid tidak lengkap: idcar={idcar}, orderid={orderid}"
        )
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Parameter idcar atau orderid tidak lengkap",
                }
            ),
            400,
        )

    # Ambil transaksi dari database
    transaction = db.transaction.find_one({"order_id": orderid})
    if not transaction:
        logger.error(f"Transaksi tidak ditemukan untuk order_id: {orderid}")
        return jsonify({"status": "error", "message": "Transaksi tidak ditemukan"}), 404

    # Validasi bahwa transaksi belum dibatalkan
    if transaction["status"] != "unpaid":
        logger.error(
            f"Transaksi {orderid} tidak dalam status unpaid: {transaction['status']}"
        )
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Transaksi tidak valid atau sudah diproses",
                }
            ),
            400,
        )

    # Ambil jumlah hari dari lama_rental
    try:
        hari = int(transaction["lama_rental"].split()[0])
    except (ValueError, IndexError):
        logger.error(f"Format lama_rental tidak valid: {transaction['lama_rental']}")
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Format lama rental tidak valid",
                }
            ),
            400,
        )

    # Perbarui status transaksi dan mobil
    user_id = transaction["user_id"]
    user = db.users.find_one({"user_id": user_id})
    if not user or not user.get("phone"):
        logger.error(
            f"Pengguna atau nomor telepon tidak ditemukan untuk user_id: {user_id}"
        )
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Pengguna atau nomor telepon tidak ditemukan",
                }
            ),
            404,
        )

    data_update = {
        "status": "Diproses" if from_source == "user" else "Digunakan",
        "order_id": orderid,
    }
    db.dataMobil.update_one({"id_mobil": idcar}, {"$set": data_update})
    db.transaction.update_one(
        {"order_id": orderid},
        {"$set": {"status": "sudah bayar"}},
    )

    # Kirim notifikasi WhatsApp
    user_success = send_fonnte_message(
        phone=user["phone"],
        order_id=transaction["order_id"],
        penyewa=transaction.get("penyewa", penyewa or "Tidak diketahui"),
        item=transaction.get("item", "Tidak diketahui"),
        type_mobil=transaction.get("type_mobil", "Tidak diketahui"),
        plat=transaction.get("plat", "Tidak diketahui"),
        bahan_bakar=transaction.get("bahan_bakar", "Tidak diketahui"),
        seat=transaction.get("seat", "Tidak diketahui"),
        transmisi=transaction.get("transmisi", "Tidak diketahui"),
        total=transaction.get("total", 0),
        lama_rental=transaction.get("lama_rental", "Tidak diketahui"),
        biaya_sopir=transaction.get("biaya_sopir", 0),
        gunakan_pengantaran=transaction.get("gunakan_pengantaran", False),
        delivery_cost=transaction.get("delivery_cost", 0),
        delivery_location=transaction.get("delivery_location", ""),
        delivery_lat=transaction.get("delivery_lat", None),
        delivery_lon=transaction.get("delivery_lon", None),
        is_admin=False,
    )

    admin_success = send_fonnte_message(
        phone=ADMIN_PHONE,
        order_id=transaction["order_id"],
        penyewa=transaction.get("penyewa", penyewa or "Tidak diketahui"),
        item=transaction.get("item", "Tidak diketahui"),
        type_mobil=transaction.get("type_mobil", "Tidak diketahui"),
        plat=transaction.get("plat", "Tidak diketahui"),
        bahan_bakar=transaction.get("bahan_bakar", "Tidak diketahui"),
        seat=transaction.get("seat", "Tidak diketahui"),
        transmisi=transaction.get("transmisi", "Tidak diketahui"),
        total=transaction.get("total", 0),
        lama_rental=transaction.get("lama_rental", "Tidak diketahui"),
        biaya_sopir=transaction.get("biaya_sopir", 0),
        gunakan_pengantaran=transaction.get("gunakan_pengantaran", False),
        delivery_cost=transaction.get("delivery_cost", 0),
        delivery_location=transaction.get("delivery_location", ""),
        delivery_lat=transaction.get("delivery_lat", None),
        delivery_lon=transaction.get("delivery_lon", None),
        is_admin=True,
        user_phone=user["phone"],
    )

    whatsapp_status = {
        "user": "sent" if user_success else "failed",
        "admin": "sent" if admin_success else "failed",
    }
    msg = (
        "Transaksi berhasil dan pesan WhatsApp telah dikirim ke pengguna dan admin"
        if user_success and admin_success
        else "Transaksi berhasil, tetapi beberapa pesan WhatsApp gagal dikirim"
    )
    logger.info(
        f"Status pengiriman WhatsApp untuk order_id {orderid}: {whatsapp_status}"
    )
    return (
        jsonify(
            {
                "status": "success",
                "message": msg,
                "whatsapp_status": whatsapp_status,
                "selected_order_id": orderid,
                "gunakan_pengantaran": transaction.get("gunakan_pengantaran", False),
            }
        ),
        200,
    )


@api.route("/api/confirmKembali", methods=["POST"])
def confirmKembali():
    id_mobil = request.form.get("id_mobil")

    # Ambil data mobil
    data_mobil = db.dataMobil.find_one({"id_mobil": id_mobil})
    if not data_mobil:
        logger.error(f"Mobil tidak ditemukan: id_mobil={id_mobil}")
        return jsonify({"result": "unsuccess", "msg": "Mobil tidak ditemukan"}), 404

    # Ambil data transaksi
    data_transaksi = db.transaction.find_one({"order_id": data_mobil.get("order_id")})
    if not data_transaksi:
        logger.error(
            f"Transaksi tidak ditemukan untuk order_id: {data_mobil.get('order_id')}"
        )
        return jsonify({"result": "unsuccess", "msg": "Transaksi tidak ditemukan"}), 404

    # Log status transaksi sebelum pembaruan
    logger.info(
        f"Status transaksi sebelum pengembalian untuk order_id {data_transaksi['order_id']}: "
        f"status={data_transaksi['status']}, status_mobil={data_transaksi.get('status_mobil')}"
    )

    # Waktu pengembalian aktual
    now = datetime.now()
    actual_return_date = now.strftime("%d-%B-%Y")
    actual_return_time = now.strftime("%H:%M")

    # Bandingkan dengan waktu seharusnya
    end_rent_str = data_transaksi.get("end_rent") + " " + data_transaksi.get("end_time")
    end_rent = datetime.strptime(end_rent_str, "%d-%B-%Y %H:%M")

    # Hitung selisih waktu dalam menit
    time_diff = now - end_rent
    minutes_diff = abs(time_diff.total_seconds()) / 60
    status_pengembalian = ""
    if now > end_rent:
        status_pengembalian = f"terlambat {int(minutes_diff)} menit"
    elif now < end_rent:
        status_pengembalian = f"lebih cepat {int(minutes_diff)} menit"
    else:
        status_pengembalian = "tepat waktu"

    # Update status transaksi
    db.transaction.update_one(
        {"order_id": data_mobil["order_id"]},
        {
            "$set": {
                "status": "completed",
                "status_mobil": "selesai",
                "actual_return_date": actual_return_date,
                "actual_return_time": actual_return_time,
                "status_pengembalian": status_pengembalian,
                "rating_prompted": True,
            }
        },
    )

    # Update status mobil
    db.dataMobil.update_one(
        {"id_mobil": id_mobil},
        {"$set": {"status": "Tersedia", "status_transaksi": None, "order_id": None}},
    )

    # Log status transaksi setelah pembaruan
    updated_transaction = db.transaction.find_one({"order_id": data_mobil["order_id"]})
    logger.info(
        f"Status transaksi setelah pengembalian untuk order_id {data_transaksi['order_id']}: "
        f"status={updated_transaction['status']}, status_mobil={updated_transaction.get('status_mobil')}"
    )

    logger.info(
        f"Transaksi {data_transaksi['order_id']} selesai, pengguna siap diarahkan ke rating."
    )
    return (
        jsonify({"result": "success", "status_pengembalian": status_pengembalian}),
        200,
    )


@api.route("/api/check_transaction_status/<order_id>", methods=["GET"])
def check_transaction_status_by_id(order_id):
    logger.info(f"Memeriksa status transaksi untuk order_id: {order_id}")
    try:
        # Cari transaksi berdasarkan order_id
        transaction = db.transaction.find_one({"order_id": order_id})
        if not transaction:
            logger.error(f"Transaksi tidak ditemukan untuk order_id: {order_id}")
            return jsonify({"result": "error", "msg": "Transaksi tidak ditemukan"}), 404

        # Kembalikan status transaksi
        return (
            jsonify(
                {
                    "result": "success",
                    "order_id": transaction["order_id"],
                    "status": transaction.get("status", ""),
                    "status_mobil": transaction.get("status_mobil", ""),
                    "msg": "Status transaksi ditemukan",
                }
            ),
            200,
        )
    except Exception as e:
        logger.error(f"Error saat memeriksa status transaksi {order_id}: {str(e)}")
        return jsonify({"result": "error", "msg": f"Terjadi kesalahan: {str(e)}"}), 500


@api.route("/api/check_transaction_status", methods=["GET"])
def check_transaction_status():
    token_receive = request.cookies.get("tokenMain")
    try:
        # Dekode JWT untuk mendapatkan user_id
        payload = jwt.decode(token_receive, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if not user_id:
            return jsonify({"result": "error", "msg": "User ID tidak valid"}), 401

        # Cari transaksi yang selesai dan siap untuk rating
        transaction = db.transaction.find_one(
            {"user_id": user_id, "status_mobil": "selesai", "rating_prompted": True}
        )

        if not transaction:
            return (
                jsonify(
                    {
                        "result": "no_action",
                        "msg": "Tidak ada transaksi yang perlu rating",
                    }
                ),
                200,
            )

        # Periksa apakah rating sudah diberikan untuk transaksi ini
        rating_exists = db.ratings.find_one(
            {"car_id": transaction["id_mobil"], "user_id": user_id, "order_id": transaction["order_id"]}
        )
        if rating_exists:
            db.transaction.update_one(
                {"order_id": transaction["order_id"]},
                {"$set": {"rating_prompted": False}},
            )
            return (
                jsonify({"result": "no_action", "msg": "Rating sudah diberikan"}),
                200,
            )

        # Kembalikan car_id dan order_id untuk redirect
        return (
            jsonify(
                {
                    "result": "redirect",
                    "car_id": transaction["id_mobil"],
                    "user_id": user_id,
                    "order_id": transaction["order_id"],
                    "msg": "Transaksi selesai, arahkan ke halaman rating",
                }
            ),
            200,
        )
    except jwt.ExpiredSignatureError:
        return jsonify({"result": "error", "msg": "Sesi kedaluwarsa"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"result": "error", "msg": "Token tidak valid"}), 401

@api.route("/api/search-dashboard")
def searchDahboard():
    search = request.args.get("search")
    data = db.dataMobil.find({"merek": {"$regex": search, "$options": "i"}}, {"_id": 0})
    return jsonify(list(data))


@api.route("/api/cancelPayment", methods=["POST"])
def cancelPayment():
    global priority_queue
    order_id = request.form.get("order_id")
    token_receive = request.cookies.get("tokenMain")

    if not order_id:
        logger.error("Order ID tidak diberikan.")
        return jsonify({"result": "failed", "message": "Order ID tidak diberikan"}), 400

    try:
        # Validasi token JWT
        if not token_receive:
            logger.error("Token tidak ditemukan untuk pembatalan transaksi")
            return (
                jsonify({"result": "failed", "message": "Token tidak ditemukan"}),
                401,
            )
        payload = jwt.decode(token_receive, SECRET_KEY, algorithms=["HS256"])
        user_id = payload["user_id"]

        # Cari transaksi
        transaction = db.transaction.find_one({"order_id": order_id})
        if not transaction:
            logger.error(f"Transaksi tidak ditemukan: order_id={order_id}")
            return (
                jsonify({"result": "failed", "message": "Transaksi tidak ditemukan"}),
                404,
            )

        # Validasi bahwa pengguna adalah pemilik transaksi
        if transaction["user_id"] != user_id:
            logger.error(
                f"Pengguna {user_id} tidak berhak membatalkan transaksi {order_id}"
            )
            return (
                jsonify(
                    {
                        "result": "failed",
                        "message": "Anda tidak berhak membatalkan transaksi ini",
                    }
                ),
                403,
            )

        # Validasi status transaksi
        if transaction["status"] != "unpaid":
            logger.error(
                f"Transaksi {order_id} tidak dapat dibatalkan karena status bukan 'unpaid': {transaction['status']}"
            )
            return (
                jsonify(
                    {
                        "result": "failed",
                        "message": f"Transaksi tidak dapat dibatalkan: status {transaction['status']}",
                    }
                ),
                400,
            )

        # Hapus dari antrian prioritas
        with queue_lock:
            temp_queue = PriorityQueue()
            while not priority_queue.is_empty():
                queued_transaction = priority_queue.pop()
                if queued_transaction["order_id"] != order_id:
                    temp_queue.push(queued_transaction)
            while not temp_queue.is_empty():
                priority_queue.push(temp_queue.pop())
        logger.info(f"Transaksi {order_id} dihapus dari antrian prioritas")

        # Panggil fungsi canceltransaction
        canceltransaction(order_id=order_id, msg="Dibatalkan sendiri")

        logger.info(f"Transaksi {order_id} berhasil dibatalkan oleh user {user_id}")
        return (
            jsonify({"result": "success", "message": "Transaksi berhasil dibatalkan"}),
            200,
        )
    except jwt.ExpiredSignatureError:
        logger.error("Token kadaluarsa untuk pembatalan transaksi")
        return (
            jsonify(
                {
                    "result": "failed",
                    "message": "Sesi kadaluarsa, silakan login kembali",
                }
            ),
            401,
        )
    except jwt.InvalidTokenError:
        logger.error("Token tidak valid untuk pembatalan transaksi")
        return jsonify({"result": "failed", "message": "Token tidak valid"}), 401
    except Exception as e:
        logger.error(f"Gagal membatalkan transaksi {order_id}: {str(e)}")
        return (
            jsonify(
                {
                    "result": "failed",
                    "message": f"Gagal membatalkan transaksi: {str(e)}",
                }
            ),
            500,
        )


@api.route("/api/register", methods=["POST"])
def reg():
    username = request.form.get("username")
    email = request.form.get("email")
    password = request.form.get("password")
    phone = request.form.get("phone")
    name = request.form.get("name")
    user_id = str(uuid.uuid1())

    # Validasi input
    if not username:
        return jsonify({"result": "ejected", "msg": "Username tidak boleh kosong"})
    if len(username) < 8:
        return jsonify({"result": "ejected", "msg": "Username minimal 8 karakter"})
    if not username[0].isalpha():
        return jsonify(
            {"result": "ejected", "msg": "Username harus diawali dengan huruf"}
        )
    if not username.replace(".", "").replace("_", "").isalnum():
        return jsonify({"result": "ejected", "msg": "Username tidak valid"})
    if not email:
        return jsonify({"result": "ejectedEmail", "msg": "Email tidak boleh kosong"})
    if not password:
        return jsonify({"result": "ejectedPW", "msg": "Password tidak boleh kosong"})
    if len(password) < 8:
        return jsonify({"result": "ejectedPW", "msg": "Password minimal 8 karakter"})
    if not phone:
        return jsonify(
            {"result": "ejectedPhone", "msg": "Nomor telepon tidak boleh kosong"}
        )
        
        
    #Tambah Jika User measukan 62 harus di hapus

    # Normalisasi nomor telepon: hapus spasi dan tanda "+"
    normalized_phone = phone.replace(" ", "").replace("+", "")
    # Validasi format nomor telepon (opsional, untuk memastikan hanya angka)
    if not normalized_phone.isdigit() or len(normalized_phone) < 10 or len(normalized_phone) > 13:
        return jsonify({"result": "ejectedPhone", "msg": "Nomor telepon tidak valid"})

    # Pengecekan apakah nomor telepon sudah digunakan (dengan normalisasi)
    # Cari semua nomor telepon di database dan normalisasi untuk perbandingan
    existing_users = db.users.find({"phone": {"$exists": True}})
    for user in existing_users:
        db_phone = user["phone"].replace(" ", "").replace("+", "")
        if db_phone == normalized_phone:
            return jsonify({"result": "ejectedPhone", "msg": "Nomor telepon sudah digunakan"})

    if not name:
        return jsonify(
            {"result": "ejectedName", "msg": "Nama lengkap tidak boleh kosong"}
        )
    if db.users.find_one({"username": username}):
        return jsonify({"result": "ejected", "msg": "Username sudah ada"})
    if db.users.find_one({"email": email}):
        return jsonify({"result": "ejectedEmail", "msg": "Email sudah ada"})

    # Menangani upload foto SIM
    if "image" not in request.files:
        return jsonify({"result": "ejected", "msg": "Harap unggah foto SIM"})
    file = request.files["image"]
    if file.filename == "":
        return jsonify({"result": "ejected", "msg": "Tidak ada file SIM yang dipilih"})

    # Pastikan folder tujuan ada
    upload_folder = os.path.join("static", "Gambar", "identitas")
    os.makedirs(upload_folder, exist_ok=True)

    # Simpan file ke folder yang diinginkan
    file_path = os.path.join(upload_folder, f"{user_id}_{file.filename}").replace(
        "\\", "/"
    )
    try:
        file.save(file_path)
    except Exception as e:
        logger.error(f"Gagal menyimpan file SIM: {str(e)}")
        return jsonify({"result": "ejected", "msg": "Gagal menyimpan foto SIM"})

    # Hash password menggunakan hashlib.sha256
    pw_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()

    # Simpan data pengguna ke database dengan nomor telepon yang dinormalisasi
    db.users.insert_one(
        {
            "user_id": user_id,
            "username": username,
            "email": email,
            "phone": normalized_phone,  # Simpan nomor telepon tanpa spasi
            "name": name,
            "password": pw_hash,
            "image_path": file_path,
            "verif": "unverified",
            "first_login": True,
        }
    )

    # Membuat token JWT
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(seconds=60 * 60 * 24),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    return jsonify({"result": "success", "token": token})


@api.route("/api/confirmPesanan", methods=["POST"])
def confirmPesanan():
    id_mobil = request.form.get("id_mobil")
    order_id = request.form.get("order_id")

    if not id_mobil:
        logger.error("ID mobil tidak diberikan.")
        return jsonify({"status": "error", "message": "ID mobil tidak diberikan"}), 400

    # Cari transaksi
    if order_id:
        transaction = db.transaction.find_one(
            {"order_id": order_id, "id_mobil": id_mobil}
        )
    else:
        transaction = db.transaction.find_one(
            {"id_mobil": id_mobil, "status": {"$in": ["sudah bayar", "Diproses"]}}
        )

    if not transaction:
        logger.error(
            f"Tidak ditemukan transaksi aktif untuk id_mobil: {id_mobil}, order_id: {order_id}"
        )
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Tidak ditemukan transaksi aktif untuk mobil ini",
                }
            ),
            404,
        )

    order_id = transaction["order_id"]

    # Validasi status transaksi
    valid_statuses = ["sudah bayar", "Diproses"]
    if transaction["status"] not in valid_statuses:
        logger.error(
            f"Transaksi {order_id} tidak dalam status yang valid untuk konfirmasi: {transaction['status']}"
        )
        return (
            jsonify(
                {
                    "status": "error",
                    "message": f"Transaksi tidak dalam status yang valid untuk konfirmasi: {transaction['status']}",
                }
            ),
            400,
        )

    # Ambil jumlah hari dari lama_rental
    try:
        hari = int(transaction["lama_rental"].split()[0])
    except (ValueError, IndexError):
        logger.error(f"Format lama_rental tidak valid: {transaction['lama_rental']}")
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Format lama rental tidak valid",
                }
            ),
            400,
        )

    # Perbarui waktu rental berdasarkan waktu saat ini
    wita = timezone('Asia/Makassar')
    now = datetime.now(wita)
    date_rent = now.strftime("%d-%B-%Y")
    time_rent = now.strftime("%H:%M")
    end_time = now + timedelta(days=hari)
    end_rent = end_time.strftime("%d-%B-%Y")
    end_time = end_time.strftime("%H:%M")

    # Perbarui status transaksi
    result_transaction = db.transaction.update_one(
        {"order_id": order_id},
        {
            "$set": {
                "status": "Digunakan",
                "status_mobil": "digunakan",
                "date_rent": date_rent,
                "time_rent": time_rent,
                "end_rent": end_rent,
                "end_time": end_time,
            }
        },
    )
    logger.info(
        f"Update transaksi {order_id}: matched={result_transaction.matched_count}, modified={result_transaction.modified_count}"
    )

    # Perbarui status mobil
    result_mobil = db.dataMobil.update_one(
        {"id_mobil": id_mobil},
        {
            "$set": {
                "status": "Digunakan",
                "status_transaksi": "digunakan",
                "order_id": order_id,
            }
        },
    )
    logger.info(
        f"Update mobil {id_mobil}: matched={result_mobil.matched_count}, modified={result_mobil.modified_count}"
    )

    logger.info(
        f"Transaksi {order_id} berhasil dikonfirmasi untuk id_mobil: {id_mobil}"
    )
    return (
        jsonify(
            {
                "status": "success",
                "message": "Pesanan berhasil dikonfirmasi",
                "order_id": order_id,
            }
        ),
        200,
    )


@api.route("/api/transaction_detail/<order_id>", methods=["GET"])
def get_transaction_detail(order_id):
    logger.info(f"Menerima permintaan untuk detail transaksi: order_id={order_id}")
    try:
        # Cari transaksi berdasarkan order_id
        transaction = db.transaction.find_one({"order_id": order_id})
        if not transaction:
            logger.error(f"Transaksi tidak ditemukan: order_id={order_id}")
            return jsonify({"result": "error", "msg": "Transaksi tidak ditemukan"}), 404

        # Cari data pengguna jika user_id ada
        user = None
        if transaction.get("user_id"):
            user = db.users.find_one({"user_id": transaction["user_id"]})
            if not user:
                logger.warning(f"Pengguna tidak ditemukan untuk user_id: {transaction['user_id']}, menggunakan nilai dari transaksi")

        # Siapkan data respons
        response = {
            "order_id": transaction["order_id"],
            "item": transaction.get("item", ""),
            "type_mobil": transaction.get("type_mobil", ""),
            "plat": transaction.get("plat", ""),
            "penyewa": transaction.get("penyewa", ""),
            "phone": transaction.get("phone", None),
            "lama_rental": transaction.get("lama_rental", ""),
            "total": transaction.get("total", 0),
            "date_rent": transaction.get("date_rent", "Menunggu konfirmasi"),
            "time_rent": transaction.get("time_rent", "Menunggu konfirmasi"),
            "end_rent": transaction.get("end_rent", "Menunggu konfirmasi"),
            "end_time": transaction.get("end_time", "Menunggu konfirmasi"),
            "status": transaction.get("status", ""),
            "status_mobil": transaction.get("status_mobil", ""),
            "return_status": transaction.get("status_pengembalian", ""),
            "actual_return_date": transaction.get("actual_return_date", ""),
            "actual_return_time": transaction.get("actual_return_time", ""),
            "biaya_sopir": transaction.get("biaya_sopir", 0),
            "gunakan_pengantaran": transaction.get("gunakan_pengantaran", False),
            "delivery_cost": transaction.get("delivery_cost", 0),
            "delivery_location": transaction.get("delivery_location", ""),
            "delivery_lat": transaction.get("delivery_lat", None),
            "delivery_lon": transaction.get("delivery_lon", None),
            "profile_image_path": transaction.get("profile_image_path", "/static/icon/user.jpg") if not user else user.get("profile_image_path", "/static/icon/user.jpg"),
            "image_path": transaction.get("image_path", "/static/icon/default_sim.png") if not user else user.get("image_path", "/static/icon/default_sim.png"),
        }

        logger.info(f"Detail transaksi berhasil diambil: order_id={order_id}")
        return jsonify({"result": "success", "data": response}), 200

    except Exception as e:
        logger.error(f"Error saat mengambil detail transaksi {order_id}: {str(e)}", exc_info=True)
        return (
            jsonify(
                {
                    "result": "error",
                    "msg": "Terjadi kesalahan saat mengambil detail transaksi",
                }
            ),
            500,
        )

@api.route("/api/delete_mobil", methods=["POST"])
def delete_mobil():
    id_mobil = request.form.get("id_mobil")
    data = db.dataMobil.find_one({"id_mobil": id_mobil})
    db.dataMobil.delete_one({"id_mobil": id_mobil})
    os.remove(f"static/gambar/mobil/{data['gambar']}")
    return jsonify({"result": "success"})


@api.route("/api/ambilPendapatan", methods=["POST"])
def ambilPendapatan():
    date = request.form.get("tahun")
    if not date:
        current_app.logger.error("Tahun tidak diberikan dalam permintaan")
        return jsonify({"error": "Tahun diperlukan"}), 400

    data = db.transaction.find(
        {
            "status": {"$in": ["sudah bayar", "completed"]},
            "date_rent": {"$regex": date, "$options": "i"},
        }
    )
    total = {month: 0 for month in range(1, 13)}
    try:
        for dt in data:
            try:
                bulan = datetime.strptime(dt["date_rent"], "%d-%B-%Y")
                total[bulan.month] += int(dt.get("total", 0))
            except ValueError as e:
                current_app.logger.error(
                    f"Gagal parsing date_rent untuk transaksi {dt.get('order_id', 'unknown')}: {dt['date_rent']}, error: {str(e)}"
                )
                continue
        current_app.logger.info(f"Pendapatan untuk tahun {date}: {total}")
        return jsonify(total)
    except Exception as e:
        current_app.logger.error(
            f"Error saat memproses pendapatan untuk tahun {date}: {str(e)}"
        )
        return (
            jsonify({"error": "Terjadi kesalahan saat mengambil data pendapatan"}),
            500,
        )


@api.route("/api/get_transaksi", methods=["GET"])
def get_transaksi():
    date = datetime.now().strftime("%Y")
    data = db.transaction.find(
        {
            "status": {"$in": ["sudah bayar", "completed"]},
            "date_rent": {"$regex": date, "$options": "i"},
        }
    )
    total = {month: 0 for month in range(1, 13)}
    try:
        for dt in data:
            try:
                bulan = datetime.strptime(dt["date_rent"], "%d-%B-%Y")
                total[bulan.month] += 1
            except ValueError as e:
                current_app.logger.error(
                    f"Gagal parsing date_rent untuk transaksi {dt.get('order_id', 'unknown')}: {dt['date_rent']}, error: {str(e)}"
                )
                continue
        current_app.logger.info(f"Jumlah transaksi untuk tahun {date}: {total}")
        return jsonify(total)
    except Exception as e:
        current_app.logger.error(
            f"Error saat memproses transaksi untuk tahun {date}: {str(e)}"
        )
        return (
            jsonify({"error": "Terjadi kesalahan saat mengambil data transaksi"}),
            500,
        )


@api.route("/api/filter_transaksi", methods=["POST"])
def filter_transaksi():
    try:
        data = request.get_json()
        mtd = data.get("mtd")
        date = data.get("date")
        query = {}

        if mtd == "fTanggal":
            if not date:
                return jsonify({"result": "error", "msg": "Tanggal tidak diberikan"}), 400
            query["date_rent"] = {"$regex": date, "$options": "i"}
        elif mtd == "fPaid":
            query["status"] = "completed"  # Ubah "completed" menjadi "Sudah Bayar" untuk konsistensi
        elif mtd == "fUnpaid":
            query["status"] = {"$in": ["Dibatalkan", "canceled"]}  # Sertakan "canceled"
        elif mtd == "fDigunakan":
            query["status"] = "Digunakan"
            query["end_rent"] = {"$exists": True, "$ne": ""}
            query["end_time"] = {"$exists": True, "$ne": ""}
        else:
            return jsonify({"result": "error", "msg": "Metode filter tidak valid"}), 400

        # Urutkan berdasarkan date_rent menurun
        transactions = list(db.transaction.find(query).sort("date_rent", -1))
        response = [
            {
                "order_id": trans["order_id"],
                "item": trans.get("item", ""),
                "type_mobil": trans.get("type_mobil", ""),
                "plat": trans.get("plat", ""),
                "penyewa": trans.get("penyewa", ""),
                "lama_rental": trans.get("lama_rental", ""),
                "total": trans.get("total", 0),
                "date_rent": trans.get("date_rent", ""),
                "end_rent": trans.get("end_rent", ""),
                "end_time": trans.get("end_time", ""),
                "status": trans.get("status", ""),
                "return_status": trans.get("status_pengembalian", ""),
                "actual_return_date": trans.get("actual_return_date", ""),
                "actual_return_time": trans.get("actual_return_time", ""),
            }
            for trans in transactions
        ]
        logger.info(
            f"Transaksi difilter: mtd={mtd}, date={date}, hasil={len(response)}"
        )
        return jsonify(response), 200
    except Exception as e:
        logger.error(f"Error saat memfilter transaksi: {str(e)}")
        return (
            jsonify(
                {"result": "error", "msg": "Terjadi kesalahan saat memfilter transaksi"}
            ),
            500,
        )


@api.route("/api/get_car/<id>")
def get_car(id):
    data = db.dataMobil.find_one({"id_mobil": id})
    return jsonify(
        {
            "merek": data["merek"],
            "harga": data["harga"],
        }
    )


@api.route("/api/add_transaction_from_admin", methods=["POST"])
def add_transaction_from_admin():
    try:
        # Ambil data dari form
        mtd = request.form.get("mtd")
        id_mobil = request.form.get("id_mobil")
        hari = request.form.get("hari")
        penyewa = request.form.get("penyewa")
        phone = request.form.get("phone")  # Nomor telepon penyewa (opsional)
        gunakan_sopir = request.form.get("gunakan_sopir") == "true"
        gunakan_pengantaran = request.form.get("gunakan_pengantaran") == "true"
        delivery_cost = (
            int(request.form.get("delivery_cost", 0)) if gunakan_pengantaran else 0
        )
        delivery_location = (
            request.form.get("delivery_location", "") if gunakan_pengantaran else ""
        )

        # Ambil file gambar dari form
        profile_image = request.files.get("profile_image")  # Foto muka
        sim_image = request.files.get("sim_image")  # Foto SIM

        # Log data yang diterima
        logger.info(
            f"Data diterima: mtd={mtd}, id_mobil={id_mobil}, hari={hari}, penyewa={penyewa}, "
            f"phone={phone}, gunakan_sopir={gunakan_sopir}, gunakan_pengantaran={gunakan_pengantaran}, "
            f"delivery_cost={delivery_cost}, delivery_location={delivery_location}, "
            f"profile_image={profile_image.filename if profile_image else None}, "
            f"sim_image={sim_image.filename if sim_image else None}"
        )

        # Validasi input
        if not mtd or not id_mobil or not hari or not penyewa:
            logger.error(
                f"Data tidak lengkap: mtd={mtd}, id_mobil={id_mobil}, hari={hari}, penyewa={penyewa}"
            )
            return (
                jsonify(
                    {
                        "result": "failed",
                        "message": "Data tidak lengkap: mtd, id_mobil, hari, dan penyewa harus diisi",
                    }
                ),
                400,
            )

        if not re.match(r'^[a-zA-Z\s]+$', penyewa) or len(penyewa) < 3:
            logger.error(f"Nama penyewa tidak valid: {penyewa}")
            return (
                jsonify(
                    {
                        "result": "failed",
                        "message": "Nama penyewa hanya boleh berisi huruf dan spasi, minimal 3 karakter",
                    }
                ),
                400,
            )

        # Validasi nomor telepon (opsional)
        cleaned_phone = None
        if phone:
            cleaned_phone = "".join(filter(str.isdigit, phone))
            if cleaned_phone.startswith("0"):
                cleaned_phone = "62" + cleaned_phone[1:]
            elif not cleaned_phone.startswith("62"):
                cleaned_phone = "62" + cleaned_phone
            if not cleaned_phone.isdigit() or len(cleaned_phone) < 10 or len(cleaned_phone) > 15:
                logger.error(f"Nomor telepon tidak valid: {phone} -> {cleaned_phone}")
                return (
                    jsonify(
                        {
                            "result": "failed",
                            "message": "Nomor telepon tidak valid",
                        }
                    ),
                    400,
                )

        try:
            hari = int(hari)
            if hari < 1:
                raise ValueError("Hari harus lebih besar dari 0")
        except (TypeError, ValueError) as e:
            logger.error(f"Jumlah hari tidak valid: {hari}, error: {str(e)}")
            return jsonify({"result": "failed", "message": "Jumlah hari tidak valid"}), 400

        if gunakan_pengantaran and not delivery_location:
            logger.error(f"Lokasi pengantaran tidak diisi untuk id_mobil: {id_mobil}")
            return (
                jsonify(
                    {
                        "result": "failed",
                        "message": "Lokasi pengantaran harus diisi jika menggunakan pengantaran",
                    }
                ),
                400,
            )

        valid_delivery_costs = [0, 100000, 200000]
        if gunakan_pengantaran and delivery_cost not in valid_delivery_costs:
            logger.error(f"Biaya pengantaran tidak valid: {delivery_cost}")
            return (
                jsonify(
                    {
                        "result": "failed",
                        "message": "Biaya pengantaran harus 0, 100000, atau 200000",
                    }
                ),
                400,
            )

        # Validasi dan simpan file gambar ke folder khusus untuk transaksi manual
        upload_folder = "static/uploads/manual"
        os.makedirs(upload_folder, exist_ok=True)  # Buat folder jika belum ada
        allowed_extensions = {"jpg", "jpeg", "png"}
        max_file_size = 5 * 1024 * 1024  # 5MB

        profile_image_path = "/static/icon/user.jpg"  # Default
        sim_image_path = "/static/icon/default_sim.png"  # Default

        def validate_and_save_file(file, prefix):
            if not file:
                return None
            filename = secure_filename(file.filename)
            ext = filename.rsplit(".", 1)[1].lower() if "." in filename else ""
            if ext not in allowed_extensions:
                logger.error(f"Ekstensi file tidak valid: {filename}")
                return None
            if file.content_length > max_file_size:
                logger.error(f"Ukuran file terlalu besar: {filename}")
                return None
            unique_filename = f"{prefix}_{uuid.uuid4().hex}.{ext}"
            file_path = os.path.join(upload_folder, unique_filename)
            file.save(file_path)
            return f"/{file_path}"

        # Simpan foto muka
        if profile_image:
            profile_image_path = validate_and_save_file(profile_image, "profile")
            if not profile_image_path:
                return (
                    jsonify(
                        {
                            "result": "failed",
                            "message": "Foto muka tidak valid (hanya JPG/PNG, maks 5MB)",
                        }
                    ),
                    400,
                )

        # Simpan foto SIM
        if sim_image:
            sim_image_path = validate_and_save_file(sim_image, "sim")
            if not sim_image_path:
                return (
                    jsonify(
                        {
                            "result": "failed",
                            "message": "Foto SIM tidak valid (hanya JPG/PNG, maks 5MB)",
                        }
                    ),
                    400,
                )

        # Ambil data mobil
        logger.info(f"Mencari mobil dengan id_mobil: {id_mobil}")
        data_mobil = db.dataMobil.find_one({"id_mobil": id_mobil})
        if not data_mobil:
            logger.error(f"Mobil tidak ditemukan: id_mobil={id_mobil}")
            return jsonify({"result": "failed", "message": "Mobil tidak ditemukan"}), 404

        # Cek status mobil
        if data_mobil.get("status_transaksi") in ["pembayaran", "digunakan"]:
            logger.error(
                f"Mobil sudah digunakan atau dalam proses pembayaran: id_mobil={id_mobil}"
            )
            return jsonify({"result": "failed", "message": "Mobil tidak tersedia"}), 409

        # Ambil data GPS jika tersedia
        delivery_lat = None
        delivery_lon = None
        if data_mobil.get("gps_device_id") and data_mobil.get("gps_device_type"):
            logger.info(f"Mengambil data GPS untuk id_mobil: {id_mobil}")
            gps_data = get_gps_data(id_mobil, data_mobil["gps_device_type"])
            if gps_data and isinstance(gps_data.get("lat"), (int, float)) and isinstance(gps_data.get("lon"), (int, float)):
                delivery_lat = gps_data["lat"]
                delivery_lon = gps_data["lon"]
                logger.info(f"Data GPS ditemukan: lat={delivery_lat}, lon={delivery_lon}")
            else:
                logger.warning(f"Data GPS tidak valid untuk id_mobil: {id_mobil}")

        # Hitung total harga
        try:
            harga_per_hari = int(data_mobil["harga"])
        except (TypeError, ValueError) as e:
            logger.error(f"Harga mobil tidak valid: {data_mobil.get('harga')}, error: {str(e)}")
            return jsonify({"result": "failed", "message": "Harga mobil tidak valid"}), 400

        biaya_sopir = 100000 * hari if gunakan_sopir else 0
        total_harga = harga_per_hari * hari + biaya_sopir + delivery_cost
        logger.info(
            f"Total harga dihitung: {total_harga} (harga_per_hari={harga_per_hari}, hari={hari}, "
            f"biaya_sopir={biaya_sopir}, delivery_cost={delivery_cost})"
        )

        # Buat transaksi
        order_id = str(uuid.uuid1())
        wita = timezone("Asia/Makassar")
        now = datetime.now(wita)
        date_rent = now.strftime("%d-%B-%Y")
        time_rent = now.strftime("%H:%M")
        end_rent = (now + timedelta(days=hari)).strftime("%d-%B-%Y")
        end_time = (now + timedelta(days=hari)).strftime("%H:%M")

        transaksi = {
            "user_id": "",
            "order_id": order_id,
            "id_mobil": id_mobil,
            "penyewa": penyewa,
            "phone": cleaned_phone,
            "transaction_token": "cash",
            "item": data_mobil["merek"],
            "type_mobil": data_mobil.get("type_mobil", ""),
            "plat": data_mobil.get("plat", ""),
            "bahan_bakar": data_mobil.get("bahan_bakar", ""),
            "seat": data_mobil.get("seat", ""),
            "transmisi": data_mobil.get("transmisi", ""),
            "total": total_harga,
            "lama_rental": f"{hari} hari",
            "date_rent": date_rent,
            "time_rent": time_rent,
            "end_rent": end_rent,
            "end_time": end_time,
            "status": "sudah bayar",
            "biaya_sopir": biaya_sopir,
            "gunakan_pengantaran": gunakan_pengantaran,
            "delivery_cost": delivery_cost,
            "delivery_location": delivery_location,
            "delivery_lat": delivery_lat,
            "delivery_lon": delivery_lon,
            "status_mobil": "Diproses",
            "created_at": now,
            "payment_confirmed_at": now,
            "profile_image_path": profile_image_path,
            "image_path": sim_image_path,
        }

        # Simpan transaksi ke database
        logger.info(f"Menyimpan transaksi dengan order_id: {order_id}")
        db.transaction.insert_one(transaksi)
        db.dataMobil.update_one(
            {"id_mobil": id_mobil},
            {
                "$set": {
                    "status": "Diproses",
                    "status_transaksi": "diproses",
                    "order_id": order_id,
                }
            },
        )

        # Kembalikan respons dengan informasi mobil
        logger.info(f"Transaksi berhasil untuk order_id: {order_id}")
        return (
            jsonify(
                {
                    "result": "success",
                    "message": "Transaksi Berhasil, Silakan Konfirmasi Pesanan",
                    "data": {
                        "order_id": order_id,
                        "merek": data_mobil["merek"],
                        "type_mobil": data_mobil.get("type_mobil", ""),
                        "plat": data_mobil.get("plat", ""),
                        "bahan_bakar": data_mobil.get("bahan_bakar", ""),
                        "seat": data_mobil.get("seat", ""),
                        "transmisi": data_mobil.get("transmisi", ""),
                        "total": total_harga,
                        "lama_rental": f"{hari} hari",
                        "penyewa": penyewa,
                        "phone": cleaned_phone,
                        "date_rent": date_rent,
                        "end_rent": end_rent,
                        "delivery_lat": delivery_lat,
                        "delivery_lon": delivery_lon,
                        "delivery_location": delivery_location,
                        "profile_image_path": profile_image_path,
                        "image_path": sim_image_path,
                    },
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error saat memproses transaksi: {str(e)}", exc_info=True)
        return (
            jsonify(
                {
                    "result": "failed",
                    "message": f"Terjadi kesalahan: {str(e)}",
                }
            ),
            500,
        )




@api.route("/api/detail_admin/<order_id>", methods=["GET"])
def detail_admin(order_id):
    try:
        logger.info(f"Mengambil detail transaksi admin untuk order_id: {order_id}")
        transaksi = db.transaction.find_one({"order_id": order_id})
        if not transaksi:
            logger.error(f"Transaksi tidak ditemukan untuk order_id: {order_id}")
            return jsonify({"result": "failed", "message": "Transaksi tidak ditemukan"}), 404

        # Data respons untuk modal
        data = {
            "order_id": transaksi["order_id"],
            "item": transaksi["item"],
            "type_mobil": transaksi.get("type_mobil", ""),
            "plat": transaksi.get("plat", ""),
            "penyewa": transaksi["penyewa"],
            "phone": transaksi.get("phone", None),
            "lama_rental": transaksi["lama_rental"],
            "total": transaksi["total"],
            "date_rent": transaksi["date_rent"],
            "end_rent": transaksi["end_rent"],
            "end_time": transaksi.get("end_time", ""),
            "status": transaksi["status"],
            "biaya_sopir": transaksi.get("biaya_sopir", 0),
            "gunakan_pengantaran": transaksi.get("gunakan_pengantaran", False),
            "delivery_cost": transaksi.get("delivery_cost", 0),
            "delivery_location": transaksi.get("delivery_location", ""),
            "profile_image_path": transaksi.get("profile_image_path", "/static/icon/user.jpg"),
            "image_path": transaksi.get("image_path", "/static/icon/default_sim.png"),
        }

        logger.info(f"Detail transaksi admin ditemukan untuk order_id: {order_id}")
        return jsonify({"result": "success", "data": data}), 200

    except Exception as e:
        logger.error(f"Error saat mengambil detail transaksi admin untuk order_id: {order_id}, error: {str(e)}", exc_info=True)
        return jsonify({"result": "failed", "message": f"Terjadi kesalahan: {str(e)}"}), 500

@api.route("/api/check_username", methods=["POST"])
def check_username():
    username = request.form.get("username")

    if len(username) < 8:
        return jsonify({"result": "ejected", "msg": "Username minimal 8 karakter"})
    elif db.users.find_one({"username": username}):
        return jsonify({"result": "ejected", "msg": "Username sudah ada"})
    elif not username[0].isalpha():
        return jsonify(
            {"result": "ejected", "msg": "Username harus diawali dengan huruf"}
        )
    elif not username.replace(".", "").replace("_", "").isalnum():
        return jsonify({"result": "ejected", "msg": "Username tidak valid"})
    else:
        return jsonify({"result": "available"})


@api.route("/api/daftar_lokasi_mobil", methods=["GET"])
def daftar_lokasi_mobil():
    try:
        # Ambil data mobil yang sedang digunakan atau dalam proses dari database
        logger.info("Mengambil data mobil dari database")
        mobil_digunakan = list(db.dataMobil.find(
            {"status_transaksi": {"$in": ["Diproses", "digunakan"]}},
            {"_id": 0}
        ))
        lokasi_mobil = []

        # Zona waktu WITA
        wita = timezone("Asia/Makassar")

        for mobil in mobil_digunakan:
            logger.info(f"Memproses mobil: {mobil['id_mobil']}")
            # Cari transaksi untuk mobil ini
            transaksi = db.transaction.find_one({
                "id_mobil": mobil["id_mobil"],
                "status_mobil": {"$in": ["Diproses", "digunakan"]}
            })
            if not transaksi:
                logger.warning(f"Tidak ditemukan transaksi aktif untuk id_mobil: {mobil['id_mobil']}")
                continue

            lokasi = {
                "id_mobil": mobil["id_mobil"],
                "merek": mobil["merek"],
                "plat": mobil["plat"],
                "status": mobil["status"],
                "order_id": transaksi.get("order_id", ""),
                "penyewa": transaksi.get("penyewa", ""),
                "lama_rental": transaksi.get("lama_rental", ""),
                "date_rent": transaksi.get("date_rent", ""),
                "end_rent": transaksi.get("end_rent", ""),
                "timestamp": transaksi.get("created_at", ""),
                "source": "transaksi"
            }

            # Prioritaskan data GPS dari perangkat
            if mobil.get("gps_device_id") and mobil.get("gps_device_type"):
                logger.info(f"Mengambil data GPS untuk id_mobil: {mobil['id_mobil']}")
                gps_data = get_gps_data(mobil["id_mobil"], mobil["gps_device_type"])
                if gps_data and isinstance(gps_data.get("lat"), (int, float)) and isinstance(gps_data.get("lon"), (int, float)):
                    logger.info(f"Menggunakan data GPS untuk id_mobil: {mobil['id_mobil']}")
                    alamat = get_alamat(gps_data["lat"], gps_data["lon"])
                    lokasi.update({
                        "lat": gps_data["lat"],
                        "lon": gps_data["lon"],
                        "alamat": alamat,
                        "source": "gps"
                    })
                else:
                    logger.warning(f"Data GPS tidak valid untuk id_mobil: {mobil['id_mobil']}")
                    # Gunakan delivery_lat dan delivery_lon dari transaksi jika tersedia
                    if transaksi.get("delivery_lat") and transaksi.get("delivery_lon"):
                        logger.info(f"Menggunakan delivery_lat/lon untuk id_mobil: {mobil['id_mobil']}")
                        alamat = get_alamat(transaksi["delivery_lat"], transaksi["delivery_lon"])
                        lokasi.update({
                            "lat": transaksi["delivery_lat"],
                            "lon": transaksi["delivery_lon"],
                            "alamat": alamat
                        })
                    else:
                        # Gunakan delivery_location sebagai alamat
                        logger.info(f"Menggunakan delivery_location untuk id_mobil: {mobil['id_mobil']}")
                        lokasi.update({
                            "lat": None,
                            "lon": None,
                            "alamat": transaksi.get("delivery_location", "Tidak ada alamat")
                        })
            else:
                # Tidak ada GPS, gunakan delivery_lat dan delivery_lon dari transaksi
                if transaksi.get("delivery_lat") and transaksi.get("delivery_lon"):
                    logger.info(f"Menggunakan delivery_lat/lon untuk id_mobil: {mobil['id_mobil']}")
                    alamat = get_alamat(transaksi["delivery_lat"], transaksi["delivery_lon"])
                    lokasi.update({
                        "lat": transaksi["delivery_lat"],
                        "lon": transaksi["delivery_lon"],
                        "alamat": alamat
                    })
                else:
                    # Gunakan delivery_location sebagai alamat
                    logger.info(f"Menggunakan delivery_location untuk id_mobil: {mobil['id_mobil']}")
                    lokasi.update({
                        "lat": None,
                        "lon": None,
                        "alamat": transaksi.get("delivery_location", "Tidak ada alamat")
                    })

            # Format timestamp
            if isinstance(lokasi["timestamp"], datetime):
                lokasi["timestamp"] = lokasi["timestamp"].astimezone(wita).strftime("%Y-%m-%d %H:%M:%S %Z")
            else:
                logger.warning(f"Field created_at tidak valid untuk transaksi id_mobil: {mobil['id_mobil']}")
                lokasi["timestamp"] = datetime.now(wita).strftime("%Y-%m-%d %H:%M:%S %Z")

            lokasi_mobil.append(lokasi)

        logger.info(f"Mengembalikan {len(lokasi_mobil)} lokasi mobil")
        return jsonify({"lokasi_mobil": lokasi_mobil}), 200

    except pymongo.errors.PyMongoError as e:
        logger.error(f"Error database saat mengambil lokasi mobil: {str(e)}")
        return jsonify({"result": "unsuccess", "msg": f"Gagal mengakses database: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Error tak terduga saat mengambil lokasi mobil: {str(e)}", exc_info=True)
        return jsonify({"result": "unsuccess", "msg": f"Terjadi kesalahan: {str(e)}"}), 500

def get_gps_data(id_mobil, gps_device_type):
    """
    Ambil data GPS dari API eksternal berdasarkan tipe perangkat GPS.
    Saat ini mengembalikan data dummy jika GPS tidak tersedia.
    """
    logger.info(f"get_gps_data dipanggil untuk id_mobil: {id_mobil}, gps_device_type: {gps_device_type}")

    # Konfigurasi GPS dari .env
    gps_configs = {
        "teltonika": {
            "api_endpoint": os.getenv("GPS_TELTONIKA_URL"),
            "api_key": os.getenv("GPS_TELTONIKA_API_KEY"),
            "method": os.getenv("GPS_TELTONIKA_METHOD", "GET")
        },
        "concox": {
            "api_endpoint": os.getenv("GPS_CONCOX_URL"),
            "api_key": os.getenv("GPS_CONCOX_API_KEY"),
            "method": os.getenv("GPS_CONCOX_METHOD", "POST")
        },
        "dummy": {
            "api_endpoint": None,
            "method": None
        }
    }

    # Ambil konfigurasi berdasarkan gps_device_type
    config = gps_configs.get(gps_device_type.lower(), gps_configs["dummy"])

    try:
        # Jika dummy diaktifkan atau tidak ada API endpoint, gunakan data dummy
        if os.getenv("GPS_DUMMY_ENABLED", "true").lower() == "true" or config["api_endpoint"] is None:
            logger.info(f"Menggunakan data dummy untuk id_mobil: {id_mobil}")
            lat_center = float(os.getenv("GPS_DUMMY_LAT_CENTER", -1.474))
            lon_center = float(os.getenv("GPS_DUMMY_LON_CENTER", 124.842))
            lat_range = float(os.getenv("GPS_DUMMY_LAT_RANGE", 0.05))
            lon_range = float(os.getenv("GPS_DUMMY_LON_RANGE", 0.05))
            lat = lat_center + random.uniform(-lat_range, lat_range)
            lon = lon_center + random.uniform(-lon_range, lon_range)
            timestamp = datetime.now(tz.gettz('Asia/Makassar')).strftime("%Y-%m-%d %H:%M:%S")
            return {"lat": lat, "lon": lon, "timestamp": timestamp}

        # Logika untuk Teltonika
        if gps_device_type.lower() == "teltonika":
            headers = {"Authorization": f"Bearer {config['api_key']}"}
            params = {"device_id": id_mobil}
            response = requests.get(config["api_endpoint"], headers=headers, params=params, timeout=5)
            response.raise_for_status()
            data = response.json()
            return {
                "lat": data["latitude"],
                "lon": data["longitude"],
                "timestamp": data.get("timestamp", datetime.now(tz.gettz('Asia/Makassar')).strftime("%Y-%m-%d %H:%M:%S"))
            }

        # Logika untuk Concox
        elif gps_device_type.lower() == "concox":
            headers = {"Authorization": f"Bearer {config['api_key']}"}
            payload = {"device_id": id_mobil}
            response = requests.post(config["api_endpoint"], json=payload, headers=headers, timeout=5)
            response.raise_for_status()
            data = response.json()
            return {
                "lat": data["lat"],
                "lon": data["lng"],
                "timestamp": data.get("time", datetime.now(tz.gettz('Asia/Makassar')).strftime("%Y-%m-%d %H:%M:%S"))
            }

        # Tambahkan logika untuk merek GPS lain di sini

    except requests.RequestException as e:
        logger.error(f"Gagal mengambil data GPS untuk id_mobil: {id_mobil}, gps_device_type: {gps_device_type}: {str(e)}")
        # Fallback ke data dummy
        lat_center = float(os.getenv("GPS_DUMMY_LAT_CENTER", -1.474))
        lon_center = float(os.getenv("GPS_DUMMY_LON_CENTER", 124.842))
        lat_range = float(os.getenv("GPS_DUMMY_LAT_RANGE", 0.05))
        lon_range = float(os.getenv("GPS_DUMMY_LON_RANGE", 0.05))
        lat = lat_center + random.uniform(-lat_range, lat_range)
        lon = lon_center + random.uniform(-lon_range, lon_range)
        timestamp = datetime.now(tz.gettz('Asia/Makassar')).strftime("%Y-%m-%d %H:%M:%S")
        return {"lat": lat, "lon": lon, "timestamp": timestamp}

    except Exception as e:
        logger.error(f"Error tak terduga di get_gps_data untuk id_mobil: {id_mobil}: {str(e)}")
        return None

def get_alamat(lat, lon):
    """
    Ambil alamat dari koordinat menggunakan endpoint reverse_geocode.
    """
    try:
        url = f"{request.url_root}api/reverse_geocode?lat={lat}&lon={lon}"
        logger.info(f"Calling reverse_geocode: {url}")
        headers = {
            "User-Agent": "RentalMobilApp/1.0 (fickyrahanubun@gmail.com)"
        }
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        data = response.json()
        logger.info(f"Reverse geocode response: {data}")
        return data.get("display_name", "Alamat tidak tersedia")
    except requests.RequestException as e:
        logger.error(f"Gagal mendapatkan alamat untuk lat={lat}, lon={lon}: {str(e)}")
        return "Alamat tidak tersedia"