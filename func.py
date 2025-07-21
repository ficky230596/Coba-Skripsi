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


def canceltransaction(order_id, msg):
    try:
        # Cari transaksi berdasarkan order_id
        transaction = db.transaction.find_one({"order_id": order_id})
        if not transaction:
            logger.error(f"Transaksi tidak ditemukan untuk order_id: {order_id}")
            raise ValueError("Transaksi tidak ditemukan")

        # Validasi status transaksi (hanya batalkan jika statusnya 'unpaid')
        if transaction["status"] != "unpaid":
            logger.error(
                f"Transaksi {order_id} tidak dapat dibatalkan karena status bukan 'unpaid': {transaction['status']}"
            )
            raise ValueError(
                f"Transaksi tidak dapat dibatalkan: status {transaction['status']}"
            )

        # Panggil API Midtrans untuk membatalkan transaksi
        is_sandbox = os.environ.get("MIDTRANS_ENV", "production") == "sandbox"
        base_url = "https://api.sandbox.midtrans.com" if is_sandbox else "https://api.midtrans.com"
        url = f"{base_url}/v2/{order_id}/cancel"
        server_key = os.environ.get("MIDTRANS_SERVER_KEY")
        client_key = os.environ.get("MIDTRANS_CLIENT_KEY")
        auth_string = f"{server_key}:{client_key}"
        auth_header = base64.b64encode(auth_string.encode()).decode()

        headers = {
            "accept": "application/json",
            "Authorization": f"Basic {auth_header}",
        }
        response = requests.post(url, headers=headers, timeout=10)

        # Periksa apakah pembatalan Midtrans berhasil
        if 200 <= response.status_code < 300:  # Sukses (200-299)
            logger.info(f"Transaksi {order_id} berhasil dibatalkan di Midtrans")
        else:
            response_json = response.json()
            logger.error(
                f"Gagal membatalkan transaksi di Midtrans untuk order_id {order_id}: {response_json.get('status_message', 'Unknown error')}"
            )
            raise Exception(
                f"Gagal membatalkan transaksi di Midtrans: {response_json.get('status_message', 'Unknown error')}"
            )

        # Perbarui status transaksi di koleksi transaction
        expire_at = datetime.utcnow()
        db.transaction.update_one(
            {"order_id": order_id},
            {"$set": {"expired": expire_at, "status": "Dibatalkan", "pesan": msg}},
        )

        # Perbarui status_transaksi dan status di koleksi dataMobil
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
        logger.info(
            f"Transaksi {order_id} berhasil dibatalkan, status_transaksi dan status di dataMobil direset ke None dan Tersedia"
        )

        return True
    except Exception as e:
        logger.error(f"Gagal membatalkan transaksi {order_id}: {str(e)}")
        raise
