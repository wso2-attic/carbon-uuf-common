$(document).ready(function () {
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
        UUFClient.renderFragment("org.wso2.carbon.uuf.common.foundation.message",
                                 {
                                     "class": "message",
                                     "msgClass": "default",
                                     "msgTitle": "Title",
                                     "msgBody": message
                                 },
                                 "sample-area", mode);
    });
});
