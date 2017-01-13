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
        UUFClient.renderTemplate("sample-template",
                                 {
                                     "msgTitle": "Title",
                                     "msgBody": message
                                 },
                                 "sample-area", mode);
    });
});
