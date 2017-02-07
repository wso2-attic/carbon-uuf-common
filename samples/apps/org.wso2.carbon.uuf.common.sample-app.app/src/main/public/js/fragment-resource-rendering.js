$(document).ready(function () {
    // Hide the loading animation at startup
    $('[data-toggle="loading"]').loading('hide');

    $("#pushToZone").on("click", function () {
        $('[data-toggle="loading"]').loading('show');

        var fillingObject = {
            "class": "click",
            "msgClass": "default",
            "msgTitle": "Title",
        };
        var callbacks = {
            onSuccess: function () {
                $('[data-toggle="loading"]').loading('hide');
                initScript();
            },
            onFailure: function (e) {
                $('[data-toggle="loading"]').loading('hide');
                alert(e);
            }
        };

        // setTimeout() is used to simulate network throttling and show the loading animation
        setTimeout(function () {
            UUFClient.renderFragment("org.wso2.carbon.uuf.common.sample-app.feature.click", fillingObject,
                                     "sample-area", "PREPEND", callbacks);
        }, 2000);
    });
});
