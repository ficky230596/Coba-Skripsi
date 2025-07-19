$(document).ready(function () {
  $("#input-file").change(function (e) {
    file = this.files[0];
    if (file) {
      let reader = new FileReader();
      reader.onload = function (event) {
        $("#imgPreview").attr("src", event.target.result);
        $("#imgPreview").removeAttr("hidden");
      };
      reader.readAsDataURL(file);
    }
  });
});

function updateData(id_mobil) {
  var formData = new FormData();
  formData.append("id_mobil", id_mobil);
  formData.append("gambar", $("#input-file")[0].files[0]);
  formData.append("merek", $("#merek").val());
  formData.append("type_mobil", $("#type_mobil").val());
  formData.append("plat", $("#plat").val());
  formData.append("bahan_bakar", $("#bahan_bakar").val());
  formData.append("seat", $("#seat").val());
  formData.append("transmisi", $("#transmisi").val());
  formData.append("harga", $("#harga").val());
  $(this).attr('disabled', true)
  $.ajax({
    url: "/data_mobil/update-data",
    type: "post",
    data: formData,
    contentType: false,
    processData: false,
    success: function (response) {
      if (response["result"] == "success") {
        localStorage.setItem("updateData", "true");
        window.location.replace("/data_mobil");
      } else {
        toastr.warning(response["msg"]);
      }
    },
  });
}
