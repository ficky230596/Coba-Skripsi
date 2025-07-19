import { changeCurrency } from "./function.js";

$(document).ready(function () {
    let myChart = null;

    function load_chart_pendapatan() {
        var filter = $("#filtercart").val();
        $.ajax({
            url: "/api/ambilPendapatan",
            type: "POST",
            data: { tahun: filter },
            success: function (response) {
                if (response.error) {
                    console.error("Error dari API /api/ambilpendapatan:", response.error);
                    $("#totalPendapatan").text("0");
                    changeCurrency();
                    if (myChart) myChart.destroy();
                    return;
                }
                let data = [];
                let total = 0;
                for (let month = 1; month <= 12; month++) {
                    let value = response[month] || 0;
                    data.push(value);
                    total += value;
                }
                $("#totalPendapatan").text(total);
                changeCurrency();
                if (myChart) myChart.destroy();

                const ctx = document.getElementById("myChart");
                myChart = new Chart(ctx, {
                    type: "bar",
                    data: {
                        labels: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
                        datasets: [{
                            label: "Pendapatan",
                            data: data,
                            backgroundColor: ["rgba(255, 99, 132, 0.2)"],
                            borderColor: ["rgba(255, 99, 132, 1)"],
                            borderRadius: 20,
                            borderWidth: 1,
                        }],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { x: { grid: { display: false } } },
                    },
                });
            },
            error: function (xhr) {
                console.error("AJAX error dari /api/ambilpendapatan:", xhr.responseText);
                $("#totalPendapatan").text("0");
                changeCurrency();
                if (myChart) myChart.destroy();
            },
        });
    }

    // Set tahun default ke tahun saat ini
    const currentYear = new Date().getFullYear().toString();
    if ($("#filtercart option[value='" + currentYear + "']").length > 0) {
        $("#filtercart").val(currentYear);
    }
    load_chart_pendapatan();

    $("#filtercart").on("change", function () {
        load_chart_pendapatan();
    });

    changeCurrency();

    $.ajax({
        type: "GET",
        url: "/api/get_transaksi",
        success: function (response) {
            if (response.error) {
                console.error("Error dari /api/get_transaksi:", response.error);
                return;
            }
            let data = [];
            for (let month = 1; month <= 12; month++) {
                data.push(response[month] || 0);
            }
            const ctx2 = document.getElementById("piechart");
            new Chart(ctx2, {
                type: "pie",
                data: {
                    labels: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
                    datasets: [{
                        label: "Transaksi",
                        data: data,
                        backgroundColor: [
                            "rgba(255, 99, 132, 0.2)",
                            "rgba(54, 162, 235, 0.2)",
                            "rgba(255, 206, 86, 0.2)",
                            "rgba(75, 192, 192, 0.2)",
                            "rgba(153, 102, 255, 0.2)",
                            "rgba(255, 159, 64, 0.2)",
                            "rgba(255, 99, 132, 0.2)",
                            "rgba(54, 162, 235, 0.2)",
                            "rgba(255, 206, 86, 0.2)",
                            "rgba(75, 192, 192, 0.2)",
                            "rgba(153, 102, 255, 0.2)",
                            "rgba(255, 159, 64, 0.2)",
                        ],
                        borderWidth: 1,
                    }],
                },
                options: {
                    responsive: true,
                    plugins: {
                        datalabels: {
                            anchor: "center",
                            align: "center",
                            formatter: (value, ctx) => {
                                if (value === 0) return null;
                                return `${ctx.chart.data.labels[ctx.dataIndex]}: ${value}`;
                            },
                            color: "#000",
                        },
                        legend: { display: false },
                    },
                },
                plugins: [ChartDataLabels],
            });
        },
        error: function (xhr) {
            console.error("AJAX error dari /api/get_transaksi:", xhr.responseText);
        },
    });
});