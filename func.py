import jwt
import requests
import base64
import os
from dbconnection import db
from datetime import datetime
import logging

# Konfigurasi logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def createSecretMessage(msg, SECRET_KEY, redirect="/"):
    payload = {"message": msg, "redirect": redirect}
    msg = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return msg

def send_fonnte_message(phone: str, order_id: str, message: str) -> bool:
    """Mengirim pesan WhatsApp melalui Fonnte."""
    logger.info(f"Mengirim pesan untuk order_id: {order_id} ke {phone}")
    
    FONNTE_TOKEN = os.environ.get("FONNTE_TOKEN")
    if not FONNTE_TOKEN:
        logger.error("Token Fonnte tidak ditemukan.")
        return False

    # Bersihkan nomor telepon
    cleaned_phone = "".join(filter(str.isdigit, phone))
    if cleaned_phone.startswith("0"):
        cleaned_phone = "62" + cleaned_phone[1:]
    elif not cleaned_phone.startswith("62"):
        cleaned_phone = "62" + cleaned_phone

    if not cleaned_phone.isdigit() or len(cleaned_phone) < 10 or len(cleaned_phone) > 15:
        logger.error(f"Nomor telepon tidak valid: {phone} -> {cleaned_phone}")
        return False

    url = "https://api.fonnte.com/send"
    headers = {"Authorization": FONNTE_TOKEN}
    data = {
        "target": cleaned_phone,
        "message": message,
        "connectOnly": "true",
        "delay": "2",
    }

    try:
        response = requests.post(url, headers=headers, data=data, timeout=10)
        response_json = response.json()
        if response.status_code == 200 and response_json.get("status") is True:
            logger.info(f"Pesan berhasil dikirim ke {cleaned_phone}: {response_json}")
            return True
        logger.error(f"Gagal mengirim pesan ke {cleaned_phone}: {response_json.get('reason', 'Unknown error')}")
        return False
    except Exception as e:
        logger.error(f"Error saat mengirim pesan ke {cleaned_phone}: {str(e)}")
        return False

def check_midtrans_status(order_id: str) -> dict:
    """Memeriksa status transaksi di Midtrans."""
    try:
        is_local = os.environ.get("APP_ENV", "production") == "local"
        if is_local or not (os.environ.get("MIDTRANS_SERVER_KEY") and os.environ.get("MIDTRANS_CLIENT_KEY")):
            logger.info(f"Mode lokal atau kredensial Midtrans tidak tersedia untuk {order_id}")
            return {"status": "skipped", "transaction_status": None}

        url = f"https://api.{'midtrans' if os.environ.get('MIDTRANS_ENV', 'sandbox') == 'production' else 'sandbox.midtrans'}.com/v2/{order_id}/status"
        auth_string = f"{os.environ.get('MIDTRANS_SERVER_KEY')}:{os.environ.get('MIDTRANS_CLIENT_KEY')}"
        auth_header = base64.b64encode(auth_string.encode()).decode()
        headers = {"accept": "application/json", "Authorization": f"Basic {auth_header}"}
        response = requests.get(url, headers=headers, timeout=5)
        
        if response.status_code >= 200 and response.status_code < 300:
            data = response.json()
            logger.info(f"Status Midtrans untuk {order_id}: {data.get('transaction_status')}")
            return {"status": "success", "transaction_status": data.get("transaction_status")}
        else:
            logger.warning(f"Gagal memeriksa status di Midtrans untuk {order_id}: {response.text}")
            return {"status": "error", "transaction_status": None}
    except Exception as e:
        logger.error(f"Gagal menghubungi Midtrans untuk status {order_id}: {str(e)}")
        return {"status": "error", "transaction_status": None}

def canceltransaction(order_id: str, msg: str, action: str = "cancel") -> bool:
    """Membatalkan atau mengatur kedaluwarsa transaksi di Midtrans dan database."""
    try:
        # Cari transaksi berdasarkan order_id
        transaction = db.transaction.find_one({"order_id": order_id})
        if not transaction:
            logger.error(f"Transaksi tidak ditemukan untuk order_id: {order_id}")
            raise ValueError("Transaksi tidak ditemukan")

        # Validasi status transaksi
        if transaction["status"] != "unpaid":
            logger.error(
                f"Transaksi {order_id} tidak dapat {action} karena status bukan 'unpaid': {transaction['status']}"
            )
            raise ValueError(
                f"Transaksi tidak dapat {action}: status {transaction['status']}"
            )

        # Cek apakah berjalan di mode lokal
        is_local = os.environ.get("APP_ENV", "production") == "local"

        # Coba batalkan atau expire di Midtrans jika tidak lokal dan kredensial tersedia
        midtrans_status = None
        if not is_local and os.environ.get("MIDTRANS_SERVER_KEY") and os.environ.get("MIDTRANS_CLIENT_KEY"):
            try:
                endpoint = "cancel" if action == "cancel" else "expire"
                url = f"https://api.{'midtrans' if os.environ.get('MIDTRANS_ENV', 'sandbox') == 'production' else 'sandbox.midtrans'}.com/v2/{order_id}/{endpoint}"
                auth_string = f"{os.environ.get('MIDTRANS_SERVER_KEY')}:{os.environ.get('MIDTRANS_CLIENT_KEY')}"
                auth_header = base64.b64encode(auth_string.encode()).decode()
                headers = {"accept": "application/json", "Authorization": f"Basic {auth_header}"}
                response = requests.post(url, headers=headers, timeout=5)
                if response.status_code >= 200 and response.status_code < 300:
                    logger.info(f"Transaksi {order_id} berhasil di{action} di Midtrans")
                    midtrans_status = "canceled" if action == "cancel" else "expired"
                else:
                    logger.warning(f"Gagal {action} di Midtrans untuk {order_id}: {response.text}")
            except Exception as e:
                logger.warning(f"Gagal menghubungi Midtrans untuk {order_id}: {str(e)}")

        # Perbarui database
        expire_at = datetime.utcnow()
        new_status = "canceled" if action == "cancel" else "expired"
        db.transaction.update_one(
            {"order_id": order_id},
            {
                "$set": {
                    "status": new_status,
                    "status_mobil": None,
                    "expired": expire_at,
                    "pesan": msg,
                }
            },
        )
        db.dataMobil.update_one(
            {"id_mobil": transaction["id_mobil"]},
            {
                "$set": {
                    "status_transaksi": None,
                    "order_id": None,
                    "status": "Tersedia",
                }
            },
        )
        logger.info(f"Transaksi {order_id} berhasil di{action} di database dengan pesan: {msg}")

        # Kirim notifikasi WhatsApp
        user = db.users.find_one({"user_id": transaction["user_id"]})
        if user and user.get("phone"):
            message = (
                f"Transaksi Anda (Order ID: {order_id}) telah dibatalkan.\n"
                f"Alasan: {msg}\n"
                "Silakan hubungi kami jika ada pertanyaan."
            )
            send_fonnte_message(phone=user["phone"], order_id=order_id, message=message)
        admin_message = (
            f"Transaksi dibatalkan (Order ID: {order_id}).\n"
            f"Penyewa: {transaction.get('penyewa', 'Tidak diketahui')}\n"
            f"Alasan: {msg}"
        )
        send_fonnte_message(phone=os.environ.get("ADMIN_PHONE", "6285342860104"), order_id=order_id, message=admin_message)

        return True
    except Exception as e:
        logger.error(f"Gagal {action} transaksi {order_id}: {str(e)}")
        raise