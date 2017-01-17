$(document).ready(function () {

    $('[data-toggle="loading"]').loading('hide');

    $("#pushToZone").on("click", function () {
        var message = $("#message").val();
        if (!message) {
            alert("Please enter a message.");
            return;
        }
        var mode = $("#mode").val();
        if (!mode) {
            alert("Please select a mode.");
            return;
        }

        $('[data-toggle="loading"]').loading('show');

        var callbacks = {
            "onSuccess": function () {
                $("#spinner").hide();
            }, "onFailure": function (message, e) {
                $("#spinner").hide();
                alert(message)
            }
        };

        UUFClient.renderTemplate("sample-template",
                                 {
                                     "msgTitle": "Title",
                                     "msgBody": message
                                 },
                                 "sample-area", mode, callbacks);
    });
});
