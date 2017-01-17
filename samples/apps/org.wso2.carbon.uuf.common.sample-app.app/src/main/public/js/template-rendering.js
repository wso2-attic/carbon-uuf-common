$(document).ready(function () {

    // Hide the loading animation at startup
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

        var fillingObject = {
            "msgTitle": "Title",
            "msgBody": message
        };

        var callbacks = {
            onSuccess: function () {
                $('[data-toggle="loading"]').loading('hide');
            },
            onFailure: function (message, e) {
                $('[data-toggle="loading"]').loading('hide');
                alert(message);
            }
        };

        // setTimeout() is used to simulate network throttling and show the loading animation
        setTimeout(function () {
            UUFClient.renderTemplate("sample-template", fillingObject, "sample-area", mode, callbacks);
        }, 2000);
    });
});
