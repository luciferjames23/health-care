import sys, os
import requests
import json

try:
    res = requests.get('http://localhost:8000/api/finance/bills/87232')
    print("Bill 87232 status:", res.status_code)
    data = res.json()
    bill = data.get('bill', {})
    pharmacy_items = bill.get('pharmacy_items', [])
    print(f"Pharmacy items in bill 87232 ({len(pharmacy_items)} items):")
    for it in pharmacy_items:
        print(f"  - {it.get('item_name')}: {it.get('quantity')} units @ {it.get('unit_price')} = {it.get('net_amount')} [{it.get('payment_status')}]")

    res_adm = requests.get('http://localhost:8000/api/finance/bills/admission/87232')
    print("\nBill by admission 87232 status:", res_adm.status_code)
    data_adm = res_adm.json()
    bill_adm = data_adm.get('bill', {})
    pharmacy_items_adm = bill_adm.get('pharmacy_items', [])
    print(f"Pharmacy items in admission bill ({len(pharmacy_items_adm)} items):")
    for it in pharmacy_items_adm:
        print(f"  - {it.get('item_name')}: {it.get('quantity')} units @ {it.get('unit_price')} = {it.get('net_amount')} [{it.get('payment_status')}]")
except Exception as e:
    print("Error:", e)
