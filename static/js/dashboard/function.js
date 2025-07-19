export function addStatusLabel() {
  $("tr td#status").each(function () {
    var status = $(this).text();
    if (status == "sudah bayar" || status == 'Tersedia') {
      $(this).parent().addClass("table-success");
    } else if (status === "Diproses") {
      $(this).parent().addClass("table-warning");
    } else {
      $(this).parent().addClass("table-danger");
    }
  });
}

export function changeCurrency() {
  $('[data-target="currency"]').each(function () {
    var currentText = $(this).text().trim();
    if (currentText.includes("Rp")) {
      return;
    }else if(currentText == ''){

    } else {
      $(this).text(
        new Intl.NumberFormat("id", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(parseInt($(this).text()))
      );
    }
  });
}
