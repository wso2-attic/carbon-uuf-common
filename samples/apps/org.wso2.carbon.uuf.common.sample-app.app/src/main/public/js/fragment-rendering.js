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
                $('[data-toggle="loading"]').loading('hide');
            }, "onFailure": function (message, e) {
                $('[data-toggle="loading"]').loading('hide');
                alert(message)
            }
        };

        UUFClient.renderFragment("org.wso2.carbon.uuf.common.foundation.ui.message",
                                 {
                                     "class": "message",
                                     "msgClass": "default",
                                     "msgTitle": "Title",
                                     "msgBody": message
                                 },
                                 "sample-area", mode, callbacks);
    });
});
