import jwt
import requests
import base64
import os
from dbconnection import db
from dateutil.relativedelta import relativedelta
from datetime import datetime
import logging

# Konfigurasi logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def createSecretMessage(msg, SECRET_KEY, redirect="/"):
    payload = {"message": msg, "redirect": redirect}
    msg = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return msg

def canceltransaction(order_id: str, msg: str):
    try:
        # Cari transaksi berdasarkan order_id
        transaction = db.transaction.find_one({"order_id": order_id})
        if not transaction:
            logger.error(f"Transaksi tidak ditemukan untuk order_id: {order_id}")
            raise ValueError("Transaksi tidak ditemukan")

        # Validasi status transaksi
        if transaction["status"] != "unpaid":
            logger.error(
                f"Transaksi {order_id} tidak dapat dibatalkan karena status bukan 'unpaid': {transaction['status']}"
            )
            raise ValueError(
                f"Transaksi tidak dapat dibatalkan: status {transaction['status']}"
            )

        # Cek apakah berjalan di mode lokal
        is_local = os.environ.get("APP_ENV", "production") == "local"

        # Coba batalkan di Midtrans jika tidak lokal dan kredensial tersedia
        if not is_local and os.environ.get("MIDTRANS_SERVER_KEY") and os.environ.get("MIDTRANS_CLIENT_KEY"):
            try:
                url = f"https://api.{'midtrans' if os.environ.get('MIDTRANS_ENV', 'sandbox') == 'production' else 'sandbox.midtrans'}.com/v2/{order_id}/cancel"
                auth_string = f"{os.environ.get('MIDTRANS_SERVER_KEY')}:{os.environ.get('MIDTRANS_CLIENT_KEY')}"
                auth_header = base64.b64encode(auth_string.encode()).decode()
                headers = {"accept": "application/json", "Authorization": f"Basic {auth_header}"}
                response = requests.post(url, headers=headers, timeout=5)
                if response.status_code >= 200 and response.status_code < 300:
                    logger.info(f"Transaksi {order_id} berhasil dibatalkan di Midtrans")
                else:
                    logger.warning(f"Gagal membatalkan di Midtrans untuk {order_id}: {response.text}")
            except Exception as e:
                logger.warning(f"Gagal menghubungi Midtrans untuk {order_id}: {str(e)}")

        # Perbarui database terlepas dari hasil Midtrans
        expire_at = datetime.utcnow()
        db.transaction.update_one(
            {"order_id": order_id},
            {
                "$set": {
                    "status": "canceled",
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
        logger.info(f"Transaksi {order_id} berhasil dibatalkan di database dengan pesan: {msg}")
        return True
    except Exception as e:
        logger.error(f"Gagal membatalkan transaksi {order_id}: {str(e)}")
        raise